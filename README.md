# 🎫 Coupon Management System

A comprehensive Next.js application for managing coupon codes with interactive scratch cards, admin dashboard, store validation, customer portal, and seamless Shopify integration.

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18+-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3+-38B2AC?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase)
![Shopify](https://img.shields.io/badge/Shopify-7AB55C?style=flat-square&logo=shopify)

## ✨ Features

### 🎯 Core Functionality

- **Interactive Scratch Cards** - Canvas-based scratching with real physics
- **Coupon Generation** - Unique 3-letter + 3-number codes (max 10,000)
- **Multi-Panel System** - Admin, Store, Customer, and View interfaces
- **Real-time Tracking** - Complete audit trail of coupon lifecycle
- **Store Management** - 14 Chennai store locations + Online Shopify
- **Shopify Integration** - Bidirectional sync with automatic webhook handling
- **Cloud Database** - Powered by Supabase PostgreSQL with real-time updates

### 🛒 Shopify Integration

- **Automatic Sync** - Coupons sync to Shopify as discount codes
- **Webhook Handling** - Real-time updates for orders and discount changes
- **Order Processing** - Automatic coupon validation when orders are placed
- **Conflict Resolution** - Prevents double usage across platforms
- **API Integration** - Full Shopify Admin API integration with GraphQL

### 🎨 Modern UI/UX

- **Responsive Design** - Works seamlessly on all devices
- **Gradient Themes** - Beautiful color schemes for each panel
- **Interactive Elements** - Hover effects, animations, and transitions
- **Sortable Tables** - Click any column header to sort data
- **Progress Indicators** - Visual feedback for all operations
- **Real-time Updates** - Live data refresh and synchronization

### 🔒 Security & Validation

- **Webhook Verification** - Cryptographic signature validation
- **Database Constraints** - Enforced data integrity and validation
- **Input Sanitization** - All inputs validated and sanitized
- **State Management** - Proper tracking of coupon states
- **Error Handling** - Comprehensive error messages and fallbacks
- **Rate Limiting** - API protection and abuse prevention

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project
- Shopify store with private app access

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/coupon-management-system.git
   cd coupon-management-system
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```env
   # Database Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Shopify Configuration
   SHOPIFY_STORE_URL=yourstore.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
   SHOPIFY_API_VERSION=2025-07
   SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

   # Webhook Configuration
   WEBHOOK_BASE_URL=https://yourdomain.com

   # Environment
   NODE_ENV=production

   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key-here
   ```

4. **Set up the database**

   Create the following tables in your Supabase project:

   ```sql
   -- Coupons table
   CREATE TABLE coupons (
     id BIGSERIAL PRIMARY KEY,
     code TEXT UNIQUE NOT NULL,
     status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'inactive')),
     created_date TIMESTAMPTZ DEFAULT NOW(),
     used_date TIMESTAMPTZ,
     scratched_date TIMESTAMPTZ,
     employee_code TEXT,
     is_scratched BOOLEAN DEFAULT FALSE,
     shopify_discount_id TEXT,
     shopify_synced BOOLEAN DEFAULT FALSE,
     shopify_status TEXT DEFAULT 'active',
     store_location TEXT,
     CONSTRAINT valid_store_locations CHECK (
       store_location IN (
         'Aminjikarai', 'Anna Nagar East', 'Arumbakkam', 'Kanchipuram',
         'Kilpauk', 'Mogappair', 'Mylapore', 'Nerkundram', 'Nungambakkam',
         'Perambur', 'Saligramam', 'Thiruvallur', 'Washermenpet', 'Adyar',
         'Online Shopify'
       )
     )
   );

   -- Create indexes for performance
   CREATE INDEX idx_coupons_code ON coupons(code);
   CREATE INDEX idx_coupons_status ON coupons(status);
   CREATE INDEX idx_coupons_shopify_discount_id ON coupons(shopify_discount_id);
   ```

5. **Set up Shopify webhooks**

   ```bash
   node scripts/setup-webhooks.js
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

7. **Open your browser**

   Navigate to `http://localhost:3000`

## 📱 Application Panels

### 🏛️ Admin Panel (`/admin`)

- **Dashboard Statistics** - Total, active, used, and scratched coupons
- **Coupon Generation** - Bulk generate up to 10,000 unique codes
- **Data Management** - View all coupons with sortable columns
- **Shopify Sync** - Manual sync button and status indicators
- **Real-time Updates** - Live statistics and data refresh

### 🏪 Store Panel (`/store`)

- **Coupon Validation** - Validate codes with employee tracking
- **Store Selection** - Choose from 14 Chennai locations + Online Shopify
- **Instant Feedback** - Real-time validation results with detailed status
- **Shopify Integration** - Automatic disable on Shopify when used in-store
- **Clean Interface** - Focused design for quick operations

### 👥 Customer Panel (`/customer`)

- **Coupon Discovery** - Browse all available scratch cards
- **Easy Sharing** - One-click URL copying for social sharing
- **Status Tracking** - See which cards are scratched/unscratched
- **Beautiful Gallery** - Modern card-based layout with animations
- **Search & Filter** - Find specific coupons quickly

### 🎨 Scratch Card View (`/view/[code]`)

- **Interactive Scratching** - Real canvas-based scratch mechanics
- **Progress Tracking** - Visual feedback during scratching
- **Prize Revelation** - Beautiful animations when prize is revealed
- **Mobile Optimized** - Touch-friendly for mobile devices
- **Social Sharing** - Built-in sharing capabilities

## 🗄️ Database Schema

### Coupons Table (Supabase PostgreSQL)

```sql
CREATE TABLE coupons (
  id BIGSERIAL PRIMARY KEY,                    -- Auto-incrementing ID
  code TEXT UNIQUE NOT NULL,                   -- Unique 3+3 alphanumeric code
  status TEXT DEFAULT 'active',               -- 'active', 'used', 'inactive'
  created_date TIMESTAMPTZ DEFAULT NOW(),     -- Creation timestamp
  used_date TIMESTAMPTZ,                      -- When coupon was validated
  scratched_date TIMESTAMPTZ,                 -- When scratch card was revealed
  employee_code TEXT,                         -- Employee who validated
  is_scratched BOOLEAN DEFAULT FALSE,         -- Scratch card status
  shopify_discount_id TEXT,                   -- Shopify discount ID
  shopify_synced BOOLEAN DEFAULT FALSE,       -- Sync status with Shopify
  shopify_status TEXT DEFAULT 'active',       -- Status in Shopify
  store_location TEXT,                        -- Store location or 'Online Shopify'
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'used', 'inactive')),
  CONSTRAINT valid_store_locations CHECK (
    store_location IN (
      'Aminjikarai', 'Anna Nagar East', 'Arumbakkam', 'Kanchipuram',
      'Kilpauk', 'Mogappair', 'Mylapore', 'Nerkundram', 'Nungambakkam',
      'Perambur', 'Saligramam', 'Thiruvallur', 'Washermenpet', 'Adyar',
      'Online Shopify'
    )
  )
);
```

## 🔌 API Endpoints

### Coupon Management

- `GET /api/coupons` - Fetch all coupons with optional filtering
- `GET /api/coupons?code=ABC123` - Get specific coupon details
- `POST /api/coupons/generate` - Generate new coupon codes
- `POST /api/coupons/validate` - Validate and use coupon code
- `POST /api/coupons/scratch` - Mark coupon as scratched

### Shopify Integration

- `POST /api/webhooks/shopify` - Handle all Shopify webhooks
- `POST /api/shopify/sync` - Manual sync with Shopify
- `GET /api/shopify/status` - Check Shopify integration status

### Webhook Endpoints

- `POST /api/webhooks/shopify` - Unified webhook handler for:
  - `orders/create` - New order processing
  - `orders/updated` - Order status changes
  - `orders/paid` - Payment confirmations
  - `discount_codes/create` - New discount creation
  - `discount_codes/update` - Discount modifications
  - `discount_codes/delete` - Discount deletions

### Request/Response Examples

#### Generate Coupons

```javascript
// POST /api/coupons/generate
{
  "count": 1000
}

// Response
{
  "success": true,
  "message": "Generated 1000 coupon codes",
  "count": 1000,
  "totalInDatabase": 5000,
  "shopifySync": "pending"
}
```

#### Validate Coupon

```javascript
// POST /api/coupons/validate
{
  "code": "ABC123",
  "employeeCode": "EMP001",
  "storeLocation": "Mylapore"
}

// Response
{
  "success": true,
  "message": "Coupon validated successfully",
  "couponDetails": {
    "code": "ABC123",
    "status": "used",
    "usedDate": "2025-09-07T15:30:00Z",
    "employeeCode": "EMP001",
    "storeLocation": "Mylapore",
    "shopifyDisabled": true
  }
}
```

#### Shopify Webhook (Order Created)

```javascript
// Incoming webhook from Shopify
{
  "id": 6298275610782,
  "name": "#OR1216",
  "financial_status": "paid",
  "discount_applications": [
    {
      "type": "discount_code",
      "code": "VGI266",
      "value": "1000.0"
    }
  ]
}

// Response
{
  "success": true,
  "message": "Processed order #OR1216: 1 coupons marked as used",
  "processedCoupons": 1,
  "results": [
    {
      "code": "VGI266",
      "success": true,
      "message": "Marked as used for order #OR1216",
      "shopifyDisabled": true
    }
  ]
}
```

## 🛠️ Configuration

### Store Locations

The system supports 14 Chennai store locations plus online Shopify:

- **Physical Stores**: Aminjikarai, Anna Nagar East, Arumbakkam, Kanchipuram, Kilpauk, Mogappair, Mylapore, Nerkundram, Nungambakkam, Perambur, Saligramam, Thiruvallur, Washermenpet, Adyar
- **Online Store**: Online Shopify

### Shopify Configuration

1. **Create a Private App** in your Shopify admin
2. **Enable Admin API access** with permissions:
   - `read_discounts` and `write_discounts`
   - `read_orders` and `write_orders`
3. **Set up webhooks** using the provided script
4. **Configure webhook secret** for security

### Webhook Topics

The system handles these Shopify webhook topics:

- **Orders**: `ORDERS_CREATE`, `ORDERS_UPDATED`, `ORDERS_PAID`
- **Discounts**: `DISCOUNT_CODES_CREATE`, `DISCOUNT_CODES_UPDATE`, `DISCOUNT_CODES_DELETE`

## 📂 Project Structure

```bash
src/
├── app/
│   ├── admin/                  # Admin dashboard
│   ├── store/                  # Store validation panel
│   ├── customer/               # Customer portal
│   ├── view/[code]/            # Scratch card view
│   ├── api/
│   │   ├── coupons/            # Coupon management endpoints
│   │   ├── webhooks/
│   │   │   └── shopify/        # Shopify webhook handler
│   │   └── shopify/            # Shopify integration endpoints
│   ├── globals.css             # Global styles
│   ├── layout.js              # Root layout
│   └── page.js                # Landing page
├── lib/
│   ├── supabase.js            # Database operations
│   ├── shopify.js             # Shopify API integration
│   └── utils.js               # Helper functions
├── components/
│   ├── ScratchCard.js         # Interactive scratch component
│   └── ...                    # Other reusable components
└── scripts/
    └── setup-webhooks.js      # Webhook setup utility
```

## 🧪 Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Shopify Webhook Management

```bash
# Set up webhooks for the first time
node scripts/setup-webhooks.js

# Delete existing webhooks and recreate
node scripts/setup-webhooks.js --delete-existing

# View help and options
node scripts/setup-webhooks.js --help
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**

   ```bash
   vercel
   ```

2. **Add environment variables** in Vercel dashboard

3. **Set up custom domain** and update `WEBHOOK_BASE_URL`

4. **Run webhook setup** with production URL

   ```bash
   WEBHOOK_BASE_URL=https://yourdomain.com node scripts/setup-webhooks.js
   ```

### Environment Variables for Production

```env
# Production URLs
WEBHOOK_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Security
NODE_ENV=production
SHOPIFY_WEBHOOK_SECRET=your-secure-webhook-secret

# Database & API keys (add via Vercel dashboard)
SUPABASE_SERVICE_ROLE_KEY=***
SHOPIFY_ACCESS_TOKEN=***
```

## 🔧 Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Ensure `SHOPIFY_WEBHOOK_SECRET` matches Shopify settings
   - Check webhook URL is accessible publicly

2. **Database constraint violations**
   - Verify store locations match the allowed list
   - Run the database migration script

3. **Shopify API version warnings**
   - Update `SHOPIFY_API_VERSION` to `2025-07` or latest supported

4. **Coupon not syncing to Shopify**
   - Check Shopify API permissions
   - Verify access token has discount creation rights

### Debug Commands

```bash
# Test webhook endpoint
curl -X GET https://yourdomain.com/api/webhooks/shopify

# Check Shopify connection
node -e "
const { testShopifyConnection } = require('./src/lib/shopify.js');
testShopifyConnection().then(console.log);
"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and patterns
- Add comments for complex logic, especially webhook handling
- Test on multiple screen sizes and devices
- Ensure webhook endpoints handle edge cases
- Update documentation for any new features

## 📄 License

This project is licensed under the MIT License

## 🎉 Acknowledgments

- **Next.js Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Supabase** - For the excellent backend-as-a-service platform
- **Shopify** - For the comprehensive e-commerce API
- **Vercel** - For seamless deployment and hosting

## 📞 Support

If you encounter any issues or need help with setup:

1. Check the troubleshooting section above
2. Review the webhook logs in your application
3. Verify all environment variables are correctly set
4. Ensure your Shopify app has the required permissions
