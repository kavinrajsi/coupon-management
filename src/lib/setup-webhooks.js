import { createAdminApiClient } from '@shopify/admin-api-client';

const client = createAdminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_URL,
  apiVersion: '2023-10',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});

export async function setupShopifyWebhooks() {
  const webhookUrl = process.env.WEBHOOK_BASE_URL + '/api/webhooks/shopify';
  
  const webhooks = [
    {
      topic: 'discounts/create',
      address: webhookUrl,
      format: 'json'
    },
    {
      topic: 'discounts/update', 
      address: webhookUrl,
      format: 'json'
    },
    {
      topic: 'discounts/delete',
      address: webhookUrl,
      format: 'json'
    }
  ];

  const createWebhookMutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          callbackUrl
          topic
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  for (const webhook of webhooks) {
    try {
      const response = await client.request(createWebhookMutation, {
        variables: {
          topic: webhook.topic.toUpperCase().replace('/', '_'),
          webhookSubscription: {
            callbackUrl: webhook.address,
            format: webhook.format.toUpperCase()
          }
        }
      });

      if (response.data.webhookSubscriptionCreate.userErrors.length > 0) {
        console.error('❌ Webhook creation errors:', response.data.webhookSubscriptionCreate.userErrors);
      } else {
        console.log(`✅ Created webhook for ${webhook.topic}`);
      }
    } catch (error) {
      console.error(`❌ Error creating webhook for ${webhook.topic}:`, error);
    }
  }
}

// Run this to set up webhooks
// setupShopifyWebhooks();