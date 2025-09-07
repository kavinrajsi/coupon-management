# Scripts Documentation

This folder contains utility scripts for managing Shopify webhooks and testing your integration.

## Files

### `setup-webhooks.js`

Main script for managing Shopify webhook subscriptions.

**Features:**

- Creates webhooks for orders and discount codes
- Tests webhook endpoint accessibility
- Lists existing webhooks
- Deletes and recreates webhooks
- Validates environment configuration

### `test-webhooks.js`

Testing utility for webhook endpoints.

**Features:**

- Tests webhook endpoint with realistic payloads
- Generates proper HMAC signatures for testing
- Tests both local and production endpoints
- Validates webhook response handling

## Usage

### First-time Setup

1. **Install dependencies** (if not already done):

   ```bash
   npm install @shopify/admin-api-client dotenv
   ```

2. **Configure environment variables** in `.env.local`:

   ```env
   SHOPIFY_STORE_URL=yourstore.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_private_app_token
   SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
   WEBHOOK_BASE_URL=https://yourdomain.com
   ```

3. **Make scripts executable** (Unix/Linux/Mac):

   ```bash
   chmod +x scripts/*.js
   ```

### Webhook Setup Commands

```bash
# Set up webhooks for the first time
npm run webhook:setup

# Delete existing webhooks and recreate them
npm run webhook:setup-clean

# List all existing webhooks
npm run webhook:list

# Clean up (delete) all webhooks pointing to your endpoint
npm run webhook:cleanup
```

### Testing Commands

```bash
# Test local development server
npm run webhook:test

# Test production endpoint
npm run webhook:test-prod

# Test specific endpoint
node scripts/test-webhooks.js --endpoint https://yourdomain.com/api/webhooks/shopify
```

### Manual Commands

```bash
# Setup with options
node scripts/setup-webhooks.js --help
node scripts/setup-webhooks.js --delete-existing
node scripts/setup-webhooks.js --list-only

# Testing with options
node scripts/test-webhooks.js --help
node scripts/test-webhooks.js --local
```

## Troubleshooting

### Common Issues

1. **"Endpoint not accessible"**
   - For local development: Use ngrok to expose your local server
   - For production: Ensure your domain is publicly accessible

2. **"Missing environment variables"**
   - Check that all required variables are set in `.env.local`
   - Verify Shopify access token has correct permissions

3. **"Webhook creation failed"**
   - Verify Shopify API permissions include webhook management
   - Check that the store URL and access token are correct

### Environment Setup for Local Development

1. **Start your development server:**

   ```bash
   npm run dev
   ```

2. **In a new terminal, start ngrok:**

   ```bash
   npx ngrok http 3000
   ```

3. **Update your `.env.local` with the ngrok URL:**

   ```env
   WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

4. **Run the webhook setup:**

   ```bash
   npm run webhook:setup
   ```

### Webhook Testing Flow

1. **Test local endpoint first:**

   ```bash
   npm run webhook:test
   ```

2. **If successful, set up webhooks:**

   ```bash
   npm run webhook:setup
   ```

3. **Test a real order in Shopify admin**

4. **Check your application logs for webhook activity**

## Script Dependencies

Make sure these packages are installed in your project:

```json
{
  "dependencies": {
    "@shopify/admin-api-client": "^1.0.1",
    "dotenv": "^16.3.1"
  }
}
```

## Security Notes

- Always use HTTPS for production webhook endpoints
- Set `SHOPIFY_WEBHOOK_SECRET` for webhook verification
- Never commit `.env.local` to version control
- Rotate your Shopify access tokens regularly

## Webhook Topics Handled

The scripts set up webhooks for these topics:

**Order Events:**

- `ORDERS_CREATE` - New orders
- `ORDERS_UPDATED` - Order status changes
- `ORDERS_PAID` - Payment confirmations

**Discount Events:**

- `DISCOUNT_CODES_CREATE` - New discount codes
- `DISCOUNT_CODES_UPDATE` - Discount modifications
- `DISCOUNT_CODES_DELETE` - Discount deletions