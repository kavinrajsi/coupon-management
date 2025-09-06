import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'coupon_system.db');
const db = new Database(dbPath);

// Initialize database tables
export function initDatabase() {
  // Coupons table
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_date DATETIME NULL,
      scratched_date DATETIME NULL,
      store_location INTEGER NULL,
      employee_code TEXT NULL,

      -- Store boolean-ish flags as INTEGER 0/1
      is_scratched INTEGER NOT NULL DEFAULT 0 CHECK (is_scratched IN (0,1)),
      shopify_synced INTEGER NOT NULL DEFAULT 0 CHECK (shopify_synced IN (0,1)),

      -- Shopify fields
      shopify_discount_id TEXT NULL
    );
  `);

  // Optional: trigger to keep updated_at fresh on any update
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS coupons_set_updated_at
    AFTER UPDATE ON coupons
    FOR EACH ROW
    BEGIN
      UPDATE coupons SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  console.log('Database initialized successfully');
}

// Generate unique coupon code (3 letters + 3 numbers)
export function generateCouponCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  return code;
}

// Generate multiple coupon codes with 10,000 total limit
export function generateCoupons(count = 1000) {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;

  if (existingCount >= 10000) {
    console.log(`Cannot generate codes: Database already has ${existingCount} codes (max: 10,000)`);
    return 0;
    }

  const maxNewCodes = 10000 - existingCount;
  const actualCount = Math.min(count, maxNewCodes);

  if (actualCount < count) {
    console.log(`Requested ${count} codes, but can only generate ${actualCount} to stay within 10,000 limit`);
  }

  const insertStmt = db.prepare(`
    INSERT INTO coupons (code, status, shopify_synced) VALUES (?, 'active', 0)
  `);

  const codes = new Set();
  let generated = 0;

  while (codes.size < actualCount && generated < actualCount * 2) {
    const code = generateCouponCode();
    if (!codes.has(code)) {
      codes.add(code);
      try {
        insertStmt.run(code);
        console.log(`Generated coupon: ${code} with status: active`);
      } catch {
        console.log(`Duplicate code generated: ${code}`);
      }
    }
    generated++;
  }

  return codes.size;
}

// Update Shopify sync status
export function updateShopifySync(code, shopifyId, syncStatus) {
  if (typeof code !== 'string' || !code) {
    throw new Error('updateShopifySync: "code" must be a non-empty string');
  }
  if (shopifyId != null && typeof shopifyId !== 'string') {
    shopifyId = String(shopifyId);
  }
  const syncedInt = syncStatus ? 1 : 0;

  const updateStmt = db.prepare(`
    UPDATE coupons
      SET shopify_discount_id = ?, shopify_synced = ?
    WHERE code = ?
  `);

  return updateStmt.run(shopifyId, syncedInt, code);
}

// Get coupons that need Shopify sync
export function getCouponsNeedingSync() {
  const stmt = db.prepare(`
    SELECT * FROM coupons 
    WHERE shopify_synced = 0 AND status = 'active'
  `);
  return stmt.all();
}

// Get all coupons
export function getAllCoupons() {
  const stmt = db.prepare(`
    SELECT * FROM coupons ORDER BY created_date DESC
  `);
  return stmt.all();
}

// Get coupon by code
export function getCouponByCode(code) {
  const stmt = db.prepare(`
    SELECT * FROM coupons WHERE code = ?
  `);
  return stmt.get(code);
}

// Validate and use coupon
export function validateCoupon(code, employeeCode, storeLocation) {
  console.log('validateCoupon called with:', { code, employeeCode, storeLocation });
  const coupon = getCouponByCode(code);

  if (!coupon) return { success: false, message: 'Coupon not found' };
  if (coupon.status !== 'active') return { success: false, message: 'Coupon is not active' };
  if (coupon.used_date) return { success: false, message: 'Coupon already used' };

  try {
    const updateStmt = db.prepare(`
      UPDATE coupons 
      SET used_date = CURRENT_TIMESTAMP, 
          employee_code = ?, 
          store_location = ?,
          status = 'used'
      WHERE code = ?
    `);

    const result = updateStmt.run(employeeCode, storeLocation, code);
    console.log('Database update result:', result);

    return { success: true, message: 'Coupon validated successfully' };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, message: 'Database error occurred' };
  }
}

// Deactivate coupon without marking as used
export function deactivateCoupon(code) {
  const coupon = getCouponByCode(code);
  if (!coupon) return { success: false, message: 'Coupon not found' };
  if (coupon.status !== 'active') return { success: false, message: 'Coupon is not active' };

  const updateStmt = db.prepare(`
    UPDATE coupons
    SET status = 'inactive'
    WHERE code = ?
  `);

  updateStmt.run(code);
  return { success: true, message: 'Coupon deactivated successfully' };
}

// Scratch coupon
export function scratchCoupon(code) {
  const coupon = getCouponByCode(code);
  if (!coupon) return { success: false, message: 'Coupon not found' };
  if (coupon.is_scratched) return { success: false, message: 'Coupon already scratched' };

  const updateStmt = db.prepare(`
    UPDATE coupons 
    SET is_scratched = 1, 
        scratched_date = CURRENT_TIMESTAMP
    WHERE code = ?
  `);

  updateStmt.run(code);
  return { success: true, message: 'Coupon scratched successfully' };
}

export default db;
