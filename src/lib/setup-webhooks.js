#!/usr/bin/env node

import { createAdminApiClient } from '@shopify/admin-api-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createAdminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_URL,
  apiVersion: process.env.SHOPIFY_API_VERSION || '2023-10',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});

async function listExistingWebhooks() {
  console.log('📋 Checking existing webhooks...');
  
  try {
    const query = `
      query {
        webhookSubscriptions(first: 50) {
          nodes {
            id
            callbackUrl
            topic
            format
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await client.request(query);
    const webhooks = response.data.webhookSubscriptions.nodes;
    
    console.log(`Found ${webhooks.length} existing webhooks:`);
    webhooks.forEach(webhook => {
      console.log(`  - ${webhook.topic}: ${webhook.callbackUrl}`);
    });
    
    return webhooks;
  } catch (error) {
    console.error('❌ Failed to list webhooks:', error);
    return [];
  }
}

async function deleteWebhook(webhookId) {
  console.log(`🗑️ Deleting webhook: ${webhookId}`);
  
  try {
    const mutation = `
      mutation webhookSubscriptionDelete($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: { id: webhookId }
    });

    if (response.data.webhookSubscriptionDelete.userErrors.length > 0) {
      console.error('❌ Delete errors:', response.data.webhookSubscriptionDelete.userErrors);
    } else {
      console.log('✅ Webhook deleted successfully');
    }
  } catch (error) {
    console.error('❌ Failed to delete webhook:', error);
  }
}

async function createWebhook(topic, webhookUrl) {
  console.log(`🔗 Creating webhook for ${topic}...`);
  
  try {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            callbackUrl
            topic
            format
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: {
        topic,
        webhookSubscription: {
          callbackUrl: webhookUrl,
          format: 'JSON'
        }
      }
    });

    const result = response.data.webhookSubscriptionCreate;
    
    if (result.userErrors.length > 0) {
      console.error(`❌ Failed to create webhook for ${topic}:`, result.userErrors);
      return false;
    } else {
      console.log(`✅ Created webhook for ${topic}:`, result.webhookSubscription.id);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error creating webhook for ${topic}:`, error);
    return false;
  }
}

async function testWebhookEndpoint(webhookUrl) {
  console.log('🧪 Testing webhook endpoint...');
  
  try {
    const testPayload = {
      id: 'test123',
      code: 'TEST123',
      status: 'enabled'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'discount_codes/create',
        'X-Shopify-Shop-Domain': 'test.myshopify.com',
        'User-Agent': 'Shopify/1.0'
      },
      body: JSON.stringify(testPayload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook endpoint is working:', result);
      return true;
    } else {
      console.error('❌ Webhook endpoint returned error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to test webhook endpoint:', error);
    return false;
  }
}

async function setupWebhooks() {
  console.log('🚀 Starting Shopify webhook setup...');
  
  // Validate environment variables
  const required = ['SHOPIFY_STORE_URL', 'SHOPIFY_ACCESS_TOKEN', 'WEBHOOK_BASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.log('Please add these to your .env.local file:');
    missing.forEach(key => {
      console.log(`${key}=your_value_here`);
    });
    process.exit(1);
  }

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/shopify`;
  console.log(`📡 Webhook URL: ${webhookUrl}`);

  // Test the webhook endpoint first
  const endpointWorking = await testWebhookEndpoint(webhookUrl);
  if (!endpointWorking) {
    console.error('❌ Webhook endpoint is not accessible. Please fix this before continuing.');
    console.log('💡 For local development, use ngrok: npx ngrok http 3000');
    process.exit(1);
  }

  // List existing webhooks
  const existingWebhooks = await listExistingWebhooks();
  
  // Delete existing webhooks for our endpoint (optional)
  const shouldDelete = process.argv.includes('--delete-existing');
  if (shouldDelete) {
    console.log('🗑️ Deleting existing webhooks...');
    for (const webhook of existingWebhooks) {
      if (webhook.callbackUrl.includes('/api/webhooks/shopify')) {
        await deleteWebhook(webhook.id);
      }
    }
  }

  // Create new webhooks
  const topics = [
    'DISCOUNT_CODES_CREATE',
    'DISCOUNT_CODES_UPDATE',
    'DISCOUNT_CODES_DELETE'
  ];

  let successCount = 0;
  
  for (const topic of topics) {
    // Check if webhook already exists
    const exists = existingWebhooks.some(w => 
      w.topic === topic && w.callbackUrl === webhookUrl
    );
    
    if (exists && !shouldDelete) {
      console.log(`⚠️ Webhook for ${topic} already exists`);
      successCount++;
      continue;
    }
    
    const created = await createWebhook(topic, webhookUrl);
    if (created) successCount++;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Setup complete: ${successCount}/${topics.length} webhooks created`);
  
  if (successCount === topics.length) {
    console.log('✅ All webhooks are set up successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test creating a discount in your Shopify admin');
    console.log('2. Check your application logs for webhook activity');
    console.log('3. Use the manual sync button if webhooks fail');
  } else {
    console.log('⚠️ Some webhooks failed to create. Check the errors above.');
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Shopify Webhook Setup Script

Usage:
  node scripts/setup-webhooks.js [options]

Options:
  --delete-existing  Delete existing webhooks before creating new ones
  --help            Show this help message

Environment Variables Required:
  SHOPIFY_STORE_URL      Your Shopify store domain (store.myshopify.com)
  SHOPIFY_ACCESS_TOKEN   Your Shopify private app access token
  WEBHOOK_BASE_URL       Your application's base URL (https://yourdomain.com)

Examples:
  node scripts/setup-webhooks.js
  node scripts/setup-webhooks.js --delete-existing
  `);
  process.exit(0);
}

// Run the setup
setupWebhooks().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});