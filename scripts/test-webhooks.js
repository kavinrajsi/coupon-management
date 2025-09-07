#!/usr/bin/env node

/**
 * Webhook Testing Utility
 * 
 * This script helps test your webhook endpoints locally and remotely.
 * Place this file at: scripts/test-webhooks.js
 * 
 * Usage:
 * node scripts/test-webhooks.js
 * node scripts/test-webhooks.js --endpoint https://yourdomain.com/api/webhooks/shopify
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Generate HMAC signature for webhook verification
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return hmac.digest('base64');
}

/**
 * Test webhook endpoint with various payloads
 */
async function testWebhookEndpoint(endpointUrl) {
  console.log(`🧪 Testing webhook endpoint: ${endpointUrl}`);
  
  const testCases = [
    {
      name: 'Order Created',
      topic: 'orders/create',
      payload: {
        id: 6298275610782,
        name: '#TEST1001',
        order_number: 1001,
        financial_status: 'paid',
        discount_applications: [
          {
            type: 'discount_code',
            code: 'TEST123',
            value: '1000.0',
            value_type: 'fixed_amount'
          }
        ],
        customer: {
          email: 'test@example.com'
        },
        line_items: [
          {
            title: 'Test Product',
            quantity: 1,
            price: '29.99'
          }
        ]
      }
    },
    {
      name: 'Discount Created',
      topic: 'discount_codes/create',
      payload: {
        admin_graphql_api_id: 'gid://shopify/DiscountCodeNode/1234567890',
        title: 'Coupon Discount TEST123',
        status: 'ACTIVE',
        code: 'TEST123'
      }
    },
    {
      name: 'Discount Updated',
      topic: 'discount_codes/update',
      payload: {
        admin_graphql_api_id: 'gid://shopify/DiscountCodeNode/1234567890',
        title: 'Coupon Discount TEST123',
        status: 'DISABLED',
        code: 'TEST123'
      }
    }
  ];

  let passedTests = 0;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name} (${testCase.topic})`);
    
    try {
      const payloadString = JSON.stringify(testCase.payload);
      const headers = {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': testCase.topic,
        'X-Shopify-Shop-Domain': process.env.SHOPIFY_STORE_URL,
        'User-Agent': 'Shopify-Captain-Hook'
      };

      // Add signature if secret is available
      if (secret) {
        const signature = generateSignature(payloadString, secret);
        headers['X-Shopify-Hmac-Sha256'] = signature;
        console.log(`  📝 Generated signature: ${signature.substring(0, 20)}...`);
      }

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: payloadString
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`  ✅ Success: ${result.message || 'Test passed'}`);
        passedTests++;
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Failed (${response.status}): ${errorText}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Test Results: ${passedTests}/${testCases.length} tests passed`);
  
  if (passedTests === testCases.length) {
    console.log('🎉 All tests passed! Your webhook endpoint is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check your webhook implementation.');
  }
}

/**
 * Test local webhook endpoint
 */
async function testLocalEndpoint() {
  const localUrl = 'http://localhost:3000/api/webhooks/shopify';
  console.log('🏠 Testing local development server...');
  
  try {
    // First check if local server is running
    const healthCheck = await fetch(localUrl, { method: 'GET' });
    
    if (healthCheck.ok) {
      console.log('✅ Local server is running');
      await testWebhookEndpoint(localUrl);
    } else {
      console.log('❌ Local server not responding. Make sure you run: npm run dev');
    }
  } catch (error) {
    console.log('❌ Cannot connect to local server. Make sure you run: npm run dev');
  }
}

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  console.log('🔧 Validating environment configuration...');
  
  const required = ['SHOPIFY_STORE_URL', 'SHOPIFY_ACCESS_TOKEN'];
  const optional = ['SHOPIFY_WEBHOOK_SECRET', 'WEBHOOK_BASE_URL'];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(key => console.log(`  - ${key}`));
    return false;
  }
  
  console.log('✅ Required environment variables present');
  
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.log('⚠️ Missing optional environment variables:');
    missingOptional.forEach(key => console.log(`  - ${key}`));
  }
  
  return true;
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Webhook Testing Utility

Usage:
  node scripts/test-webhooks.js [options]

Options:
  --endpoint URL    Test a specific webhook endpoint
  --local          Test local development server (default)
  --help           Show this help message

Examples:
  node scripts/test-webhooks.js
  node scripts/test-webhooks.js --local
  node scripts/test-webhooks.js --endpoint https://yourdomain.com/api/webhooks/shopify
  `);
  process.exit(0);
}

// Main execution
(async () => {
  if (!validateEnvironment()) {
    process.exit(1);
  }

  const endpointIndex = args.indexOf('--endpoint');
  
  if (endpointIndex !== -1 && args[endpointIndex + 1]) {
    // Test specific endpoint
    const endpoint = args[endpointIndex + 1];
    await testWebhookEndpoint(endpoint);
  } else {
    // Test local endpoint
    await testLocalEndpoint();
  }
})().catch(error => {
  console.error('❌ Testing failed:', error);
  process.exit(1);
});