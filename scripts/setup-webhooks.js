#!/usr/bin/env node

/**
 * Shopify Webhook Setup Script
 * 
 * This script sets up webhooks for your Shopify store to communicate with your application.
 * Place this file at: scripts/setup-webhooks.js
 * 
 * Usage:
 * node scripts/setup-webhooks.js
 * node scripts/setup-webhooks.js --delete-existing
 * node scripts/setup-webhooks.js --help
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create Shopify Admin API client
const client = createAdminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_URL,
  apiVersion: process.env.SHOPIFY_API_VERSION || '2025-07',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});

/**
 * List all existing webhooks in the Shopify store
 */
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

/**
 * Delete a specific webhook by ID
 */
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

/**
 * Create a new webhook subscription
 */
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

/**
 * Test if the webhook endpoint is accessible
 */
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
        'X-Shopify-Shop-Domain': process.env.SHOPIFY_STORE_URL,
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

/**
 * Main function to set up all webhooks
 */
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

  // Warn about missing webhook secret
  if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
    console.warn('⚠️ SHOPIFY_WEBHOOK_SECRET not set - webhooks will not be verified');
    console.log('   Consider adding SHOPIFY_WEBHOOK_SECRET=your_secret_here to .env.local');
  }

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/shopify`;
  console.log(`📡 Webhook URL: ${webhookUrl}`);

  // Test the webhook endpoint first
  const endpointWorking = await testWebhookEndpoint(webhookUrl);
  if (!endpointWorking) {
    console.error('❌ Webhook endpoint is not accessible.');
    console.log('💡 For local development, use ngrok: npx ngrok http 3000');
    console.log('💡 Then update WEBHOOK_BASE_URL in your .env.local file');
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

  // Define webhook topics to create
  const topics = [
    // Discount webhooks
    'DISCOUNT_CODES_CREATE',
    'DISCOUNT_CODES_UPDATE',
    'DISCOUNT_CODES_DELETE',
    
    // Order webhooks
    'ORDERS_CREATE',
    'ORDERS_UPDATED',
    'ORDERS_PAID'
  ];

  let successCount = 0;
  
  // Create webhooks
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

  // Summary
  console.log(`\n📊 Setup complete: ${successCount}/${topics.length} webhooks created`);
  
  if (successCount === topics.length) {
    console.log('✅ All webhooks are set up successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test creating a discount in your Shopify admin');
    console.log('2. Test placing an order with a discount code');
    console.log('3. Check your application logs for webhook activity');
    console.log('4. Monitor the webhook endpoint for incoming requests');
  } else {
    console.log('⚠️ Some webhooks failed to create. Check the errors above.');
  }
}

/**
 * Additional utility functions
 */

// List webhooks only (no creation/deletion)
async function listWebhooksOnly() {
  console.log('📋 Listing all webhooks for your store...');
  const webhooks = await listExistingWebhooks();
  
  if (webhooks.length === 0) {
    console.log('No webhooks found. Run setup to create them.');
  }
}

// Delete all webhooks pointing to our endpoint
async function cleanupWebhooks() {
  console.log('🧹 Cleaning up existing webhooks...');
  const webhooks = await listExistingWebhooks();
  const ourWebhooks = webhooks.filter(w => 
    w.callbackUrl.includes('/api/webhooks/shopify')
  );
  
  for (const webhook of ourWebhooks) {
    await deleteWebhook(webhook.id);
  }
  
  console.log(`✅ Cleaned up ${ourWebhooks.length} webhooks`);
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Shopify Webhook Setup Script

Usage:
  node scripts/setup-webhooks.js [options]

Options:
  --delete-existing  Delete existing webhooks before creating new ones
  --list-only       List existing webhooks without making changes
  --cleanup         Delete all webhooks pointing to your endpoint
  --help            Show this help message

Environment Variables Required:
  SHOPIFY_STORE_URL      Your Shopify store domain (store.myshopify.com)
  SHOPIFY_ACCESS_TOKEN   Your Shopify private app access token
  SHOPIFY_API_VERSION    API version (default: 2025-07)
  WEBHOOK_BASE_URL       Your application's base URL (https://yourdomain.com)
  SHOPIFY_WEBHOOK_SECRET Webhook signature secret (optional but recommended)

Supported Webhook Topics:
  - DISCOUNT_CODES_CREATE    When discount codes are created
  - DISCOUNT_CODES_UPDATE    When discount codes are updated
  - DISCOUNT_CODES_DELETE    When discount codes are deleted
  - ORDERS_CREATE           When orders are created
  - ORDERS_UPDATED          When orders are updated
  - ORDERS_PAID             When orders are paid

Examples:
  node scripts/setup-webhooks.js
  node scripts/setup-webhooks.js --delete-existing
  node scripts/setup-webhooks.js --list-only
  node scripts/setup-webhooks.js --cleanup
  `);
  process.exit(0);
}

// Execute based on command line arguments
if (process.argv.includes('--list-only')) {
  listWebhooksOnly().catch(error => {
    console.error('❌ Failed to list webhooks:', error);
    process.exit(1);
  });
} else if (process.argv.includes('--cleanup')) {
  cleanupWebhooks().catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
} else {
  // Run the main setup
  setupWebhooks().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}