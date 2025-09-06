import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'coupon_system.db');
const db = new Database(dbPath);

// Safe way to add columns if they don't exist
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columnExists = tableInfo.some(col => col.name === columnName);
    
    if (!columnExists) {
      console.log(`➕ Adding column ${columnName} to ${tableName}`);
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`✅ Added ${columnName} column`);
    }
  } catch (error) {
    console.error(`❌ Error adding column ${columnName}:`, error);
  }
}

// Initialize database tables
export function initDatabase() {
  // Create main coupons table
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_date DATETIME NULL,
      scratched_date DATETIME NULL,
      store_location INTEGER NULL,
      employee_code TEXT NULL,
      is_scratched INTEGER DEFAULT 0
    )
  `);

  // Add Shopify-related columns safely with correct types
  addColumnIfNotExists('coupons', 'shopify_discount_id', 'TEXT NULL');
  addColumnIfNotExists('coupons', 'shopify_synced', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('coupons', 'shopify_status', 'TEXT DEFAULT "active"');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      store_location INTEGER NULL
    )
  `);

  console.log('✅ Database initialized successfully');
}

// Generate unique coupon code (3 letters + 3 numbers)
export function generateCouponCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let code = '';
  
  // Generate 3 random letters
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Generate 3 random numbers
  for (let i = 0; i < 3; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return code;
}

// Generate multiple coupon codes with 10,000 total limit
export function generateCoupons(count = 1000) {
  // Check current total in database
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;
  
  // Enforce maximum total of 10,000 codes
  if (existingCount >= 10000) {
    console.log(`Cannot generate codes: Database already has ${existingCount} codes (max: 10,000)`);
    return 0;
  }
  
  // Adjust count if it would exceed the limit
  const maxNewCodes = 10000 - existingCount;
  const actualCount = Math.min(count, maxNewCodes);
  
  if (actualCount < count) {
    console.log(`Requested ${count} codes, but can only generate ${actualCount} to stay within 10,000 limit`);
  }
  
  const insertStmt = db.prepare(`
    INSERT INTO coupons (code, status, shopify_synced, shopify_status) 
    VALUES (?, 'active', 0, 'active')
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
      } catch (error) {
        console.log(`Duplicate code generated: ${code}`);
      }
    }
    generated++;
  }

  return codes.size;
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

// Update Shopify sync status - FIXED VERSION
export function updateShopifySync(code, shopifyId, syncStatus = true, shopifyStatus = 'active') {
  try {
    // First check if the columns exist
    const tableInfo = db.prepare("PRAGMA table_info(coupons)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('shopify_status')) {
      console.log('⚠️ shopify_status column missing, adding it...');
      addColumnIfNotExists('coupons', 'shopify_status', 'TEXT DEFAULT "active"');
    }
    
    // Convert boolean to integer for SQLite
    const syncStatusInt = syncStatus ? 1 : 0;
    
    const updateStmt = db.prepare(`
      UPDATE coupons 
      SET shopify_discount_id = ?, shopify_synced = ?, shopify_status = ?
      WHERE code = ?
    `);
    
    const result = updateStmt.run(shopifyId, syncStatusInt, shopifyStatus, code);
    console.log(`✅ Updated Shopify sync for ${code}:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Error updating Shopify sync for ${code}:`, error);
    throw error;
  }
}

// Update Shopify status when coupon is used
export function updateShopifyStatus(code, shopifyStatus) {
  try {
    // Check if column exists
    const tableInfo = db.prepare("PRAGMA table_info(coupons)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('shopify_status')) {
      console.log('⚠️ shopify_status column missing, adding it...');
      addColumnIfNotExists('coupons', 'shopify_status', 'TEXT DEFAULT "active"');
    }
    
    const updateStmt = db.prepare(`
      UPDATE coupons 
      SET shopify_status = ?
      WHERE code = ?
    `);
    
    return updateStmt.run(shopifyStatus, code);
    
  } catch (error) {
    console.error(`❌ Error updating Shopify status for ${code}:`, error);
    throw error;
  }
}

// Get coupons that need Shopify sync
export function getCouponsNeedingSync() {
  // First ensure the column exists
  const tableInfo = db.prepare("PRAGMA table_info(coupons)").all();
  const columnNames = tableInfo.map(col => col.name);
  
  if (!columnNames.includes('shopify_synced')) {
    console.log('⚠️ shopify_synced column missing, adding it...');
    addColumnIfNotExists('coupons', 'shopify_synced', 'INTEGER DEFAULT 0');
  }
  
  const stmt = db.prepare(`
    SELECT * FROM coupons 
    WHERE (shopify_synced = 0 OR shopify_synced IS NULL) AND status = 'active'
  `);
  return stmt.all();
}

// Validate and use coupon
export function validateCoupon(code, employeeCode, storeLocation) {
  console.log('validateCoupon called with:', { code, employeeCode, storeLocation });
  
  const coupon = getCouponByCode(code);
  
  if (!coupon) {
    return { success: false, message: 'Coupon not found' };
  }
  
  if (coupon.status !== 'active') {
    return { success: false, message: 'Coupon is not active' };
  }
  
  if (coupon.used_date) {
    return { success: false, message: 'Coupon already used' };
  }

  try {
    // Update coupon as used
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
    
    // Return coupon data including Shopify ID for disabling
    const updatedCoupon = getCouponByCode(code);
    
    return { 
      success: true, 
      message: 'Coupon validated successfully',
      coupon: updatedCoupon,
      shouldDisableShopify: !!updatedCoupon.shopify_discount_id
    };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, message: 'Database error occurred' };
  }
}

// Scratch coupon
export function scratchCoupon(code) {
  const coupon = getCouponByCode(code);
  
  if (!coupon) {
    return { success: false, message: 'Coupon not found' };
  }
  
  if (coupon.is_scratched) {
    return { success: false, message: 'Coupon already scratched' };
  }

  const updateStmt = db.prepare(`
    UPDATE coupons 
    SET is_scratched = 1, 
        scratched_date = CURRENT_TIMESTAMP
    WHERE code = ?
  `);
  
  updateStmt.run(code);
  
  return { success: true, message: 'Coupon scratched successfully' };
}

// Deactivate local coupon (when Shopify is deactivated)
export function deactivateLocalCoupon(code, reason = 'Deactivated') {
  try {
    const updateStmt = db.prepare(`
      UPDATE coupons 
      SET status = 'inactive',
          used_date = CURRENT_TIMESTAMP,
          employee_code = ?
      WHERE code = ? AND status = 'active'
    `);
    
    const result = updateStmt.run(reason, code);
    
    if (result.changes > 0) {
      console.log(`✅ Deactivated local coupon: ${code} (${reason})`);
      return { success: true, message: 'Coupon deactivated locally' };
    } else {
      console.log(`⚠️ Coupon ${code} was already inactive or not found`);
      return { success: false, message: 'Coupon already inactive or not found' };
    }
    
  } catch (error) {
    console.error(`❌ Error deactivating local coupon ${code}:`, error);
    return { success: false, message: error.message };
  }
}

// Sync all coupons with Shopify status
export function syncCouponsWithShopify(shopifyDiscounts) {
  try {
    let syncedCount = 0;
    let deactivatedCount = 0;
    
    for (const discountData of shopifyDiscounts) {
      const { couponCode, localShopifyStatus } = discountData;
      
      // Get current local coupon
      const localCoupon = getCouponByCode(couponCode);
      
      if (!localCoupon) {
        console.warn(`⚠️ Local coupon not found: ${couponCode}`);
        continue;
      }

      // Update Shopify status
      if (localCoupon.shopify_status !== localShopifyStatus) {
        updateShopifyStatus(couponCode, localShopifyStatus);
        syncedCount++;
        
        // If Shopify is disabled and local is still active, deactivate locally
        if (localShopifyStatus === 'disabled' && localCoupon.status === 'active') {
          deactivateLocalCoupon(couponCode, 'Shopify sync - deactivated');
          deactivatedCount++;
        }
      }
    }
    
    return {
      success: true,
      syncedCount,
      deactivatedCount,
      message: `Synced ${syncedCount} coupons, deactivated ${deactivatedCount} locally`
    };
    
  } catch (error) {
    console.error('❌ Error syncing coupons with Shopify:', error);
    return { success: false, message: error.message };
  }
}

// Get coupon by Shopify discount ID
export function getCouponByShopifyId(shopifyId) {
  const stmt = db.prepare(`
    SELECT * FROM coupons WHERE shopify_discount_id = ?
  `);
  return stmt.get(shopifyId);
}


export default db;