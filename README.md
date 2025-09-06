# 🎫 Coupon Management System

A comprehensive Next.js application for managing coupon codes with interactive scratch cards, admin dashboard, store validation, and customer portal.

![Next.js](https://img.shields.io/badge/Next.js-13+-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18+-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3+-38B2AC?style=flat-square&logo=tailwind-css)
![SQLite](https://img.shields.io/badge/SQLite-3+-003B57?style=flat-square&logo=sqlite)

## ✨ Features

### 🎯 Core Functionality

- **Interactive Scratch Cards** - Canvas-based scratching with real physics
- **Coupon Generation** - Unique 3-letter + 3-number codes (max 10,000)
- **Multi-Panel System** - Admin, Store, Customer, and View interfaces
- **Real-time Tracking** - Complete audit trail of coupon lifecycle
- **Store Management** - 18 store locations with employee tracking
- **Shopify Sync** - Codes stay in sync with Shopify for redemptions and manual deactivations

### 🎨 Modern UI/UX

- **Responsive Design** - Works seamlessly on all devices
- **Gradient Themes** - Beautiful color schemes for each panel
- **Interactive Elements** - Hover effects, animations, and transitions
- **Sortable Tables** - Click any column header to sort data
- **Progress Indicators** - Visual feedback for all operations

### 🔒 Security & Validation

- **Backend Validation** - Prevents exceeding 10,000 coupon limit
- **Input Sanitization** - All inputs validated and sanitized
- **State Management** - Proper tracking of coupon states
- **Error Handling** - Comprehensive error messages and fallbacks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

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
   JWT_SECRET=your-super-secret-jwt-key-here
   NODE_ENV=development
   ```

4. **Initialize the database** (optional)

   ```bash
   npm run init-db
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**

   ```bash
   http://localhost:3000
   ```

## 📱 Application Panels

### 🏛️ Admin Panel (`/admin`)

- **Dashboard Statistics** - Total, active, used, and scratched coupons
- **Coupon Generation** - Bulk generate up to 10,000 unique codes
- **Data Management** - View all coupons with sortable columns
- **Real-time Updates** - Live statistics and data refresh

### 🏪 Store Panel (`/store`)

- **Coupon Validation** - Validate codes with employee tracking
- **Store Selection** - Choose from 18 store locations
- **Instant Feedback** - Real-time validation results
- **Clean Interface** - Focused design for quick operations

### 👥 Customer Panel (`/customer`)

- **Coupon Discovery** - Browse all available scratch cards
- **Easy Sharing** - One-click URL copying for social sharing
- **Status Tracking** - See which cards are scratched/unscratched
- **Beautiful Gallery** - Modern card-based layout

### 🎨 Scratch Card View (`/view/[code]`)

- **Interactive Scratching** - Real canvas-based scratch mechanics
- **Progress Tracking** - Visual feedback during scratching
- **Prize Revelation** - Beautiful animations when prize is revealed
- **Mobile Optimized** - Touch-friendly for mobile devices

## 🗄️ Database Schema

### Coupons Table

```sql
CREATE TABLE coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,           -- Unique 3+3 alphanumeric code
  status TEXT DEFAULT 'active',       -- 'active' or 'used'
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_date DATETIME NULL,             -- When coupon was validated
  scratched_date DATETIME NULL,        -- When scratch card was revealed
  store_location INTEGER NULL,         -- Store 1-18
  employee_code TEXT NULL,             -- Employee who validated
  is_scratched BOOLEAN DEFAULT FALSE   -- Scratch card status
);
```

## 🎯 API Endpoints

### Coupon Management

- `GET /api/coupons` - Fetch all coupons
- `GET /api/coupons?code=ABC123` - Get specific coupon
- `POST /api/coupons/generate` - Generate new coupons
- `POST /api/coupons/validate` - Validate coupon code
- `POST /api/coupons/scratch` - Mark coupon as scratched
- `POST /api/shopify/redeem` - Mark a coupon as used from Shopify checkout
- `POST /api/shopify/deactivate` - Deactivate a local coupon when its Shopify discount is disabled

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
  "totalInDatabase": 5000
}
```

#### Validate Coupon

```javascript
// POST /api/coupons/validate
{
  "code": "ABC123",
  "employeeCode": "EMP001",
  "storeLocation": 5
}

// Response
{
  "success": true,
  "message": "Coupon validated successfully",
  "couponDetails": { ... }
}
```

## 🎨 Styling & Theming

### Color Schemes

- **Admin Panel** - Indigo to Purple gradient theme
- **Store Panel** - Blue to Purple gradient theme
- **Customer Panel** - Purple to Pink gradient theme
- **Scratch Cards** - Yellow celebration theme

### Responsive Breakpoints

- **Mobile** - `< 768px`
- **Tablet** - `768px - 1024px`
- **Desktop** - `> 1024px`

## 🔧 Configuration

### Coupon Generation

- **Format** - 3 uppercase letters + 3 numbers (e.g., ABC123)
- **Maximum** - 10,000 total coupons in database
- **Uniqueness** - Automatic duplicate prevention
- **Batch Size** - Up to 10,000 per generation request

### Store Configuration

- **Total Stores** - 18 locations (Store 1-18)
- **Special Labels** - Store 1 (Main Branch), Store 5 (Downtown), Store 10 (Mall)
- **Employee Codes** - Alphanumeric format (e.g., EMP001)

## 📂 Project Structure

```bash
src/
├── app/
│   ├── admin/              # Admin dashboard
│   ├── store/              # Store validation panel
│   ├── customer/           # Customer portal
│   ├── view/[code]/        # Scratch card view
│   ├── api/
│   │   └── coupons/        # API endpoints
│   ├── globals.css         # Global styles
│   ├── layout.js          # Root layout
│   └── page.js            # Landing page
├── lib/
│   ├── database.js        # SQLite operations
│   ├── auth.js           # Authentication utilities
│   └── utils.js          # Helper functions
└── components/
    ├── ScratchCard.js    # Interactive scratch component
    └── ...               # Other reusable components
```

## 🧪 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run init-db      # Initialize database with sample data
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Manual Deployment

```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add comments for complex logic
- Test on multiple screen sizes
- Ensure mobile compatibility

## 📄 License

This project is licensed under the MIT License

## 🎉 Acknowledgments

- **Next.js Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Better SQLite3** - For the efficient database operations
- **Vercel** - For seamless deployment platform
