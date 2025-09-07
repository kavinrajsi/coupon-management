import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client for server-side operations (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client for client-side operations (RLS enforced)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database functions
export async function initDatabase() {
  // Supabase tables are created via SQL, so this just verifies connection
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log('✅ Supabase database connection verified');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    throw error;
  }
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
export async function generateCoupons(count = 1000) {
  try {
    // Check current total in database
    const { count: existingCount, error: countError } = await supabaseAdmin
      .from('coupons')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
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
    
    // Generate codes
    const codes = new Set();
    const couponsToInsert = [];
    
    while (codes.size < actualCount) {
      const code = generateCouponCode();
      if (!codes.has(code)) {
        codes.add(code);
        couponsToInsert.push({
          code,
          status: 'active',
          shopify_synced: false,
          shopify_status: 'active'
        });
      }
    }
    
    // Batch insert into Supabase
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert(couponsToInsert)
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Generated ${data.length} coupon codes successfully`);
    return data.length;
    
  } catch (error) {
    console.error('❌ Error generating coupons:', error);
    throw error;
  }
}

// Get all coupons
export async function getAllCoupons() {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_date', { ascending: false });
    
    if (error) throw error;
    
    // Ensure all coupons have a valid status
    const processedData = (data || []).map(coupon => ({
      ...coupon,
      status: coupon.status || 'active', // Default to 'active' if status is null/undefined
      shopify_status: coupon.shopify_status || 'active'
    }));
    
    return processedData;
  } catch (error) {
    console.error('❌ Error fetching coupons:', error);
    throw error;
  }
}

// Get coupon by code
export async function getCouponByCode(code) {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    
    if (!data) return null;
    
    // Ensure the coupon has a valid status
    const processedCoupon = {
      ...data,
      status: data.status || 'active', // Default to 'active' if status is null/undefined
      shopify_status: data.shopify_status || 'active'
    };
    
    console.log('📋 Retrieved coupon with processed status:', processedCoupon);
    return processedCoupon;
  } catch (error) {
    console.error('❌ Error fetching coupon:', error);
    throw error;
  }
}

// Get coupon by Shopify ID
export async function getCouponByShopifyId(shopifyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('shopify_discount_id', shopifyId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!data) return null;
    
    // Ensure the coupon has a valid status
    return {
      ...data,
      status: data.status || 'active',
      shopify_status: data.shopify_status || 'active'
    };
  } catch (error) {
    console.error('❌ Error fetching coupon by Shopify ID:', error);
    throw error;
  }
}

// Update Shopify sync status
export async function updateShopifySync(code, shopifyId, syncStatus = true, shopifyStatus = 'active') {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({
        shopify_discount_id: shopifyId,
        shopify_synced: syncStatus,
        shopify_status: shopifyStatus
      })
      .eq('code', code)
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Updated Shopify sync for ${code}`);
    return data[0];
  } catch (error) {
    console.error(`❌ Error updating Shopify sync for ${code}:`, error);
    throw error;
  }
}

// Update Shopify status when coupon is used
export async function updateShopifyStatus(code, shopifyStatus) {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({ shopify_status: shopifyStatus })
      .eq('code', code)
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error(`❌ Error updating Shopify status for ${code}:`, error);
    throw error;
  }
}

// Get coupons that need Shopify sync
export async function getCouponsNeedingSync() {
  try {
    console.log('📋 Supabase: Fetching coupons needing sync...');
    
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('shopify_synced', false)
      .eq('status', 'active');
    
    if (error) {
      console.error('❌ Supabase error in getCouponsNeedingSync:', error);
      throw error;
    }
    
    console.log(`📊 Supabase: Found ${data?.length || 0} coupons needing sync`);
    console.log('📋 Sample coupons needing sync:', data?.slice(0, 2));
    
    // Always return an array, even if data is null
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching coupons needing sync from Supabase:', error);
    // Return empty array on error instead of throwing
    return [];
  }
}

// Validate and use coupon
export async function validateCoupon(code, employeeCode, storeLocation) {
  try {
    console.log('validateCoupon called with:', { code, employeeCode, storeLocation });
    
    const coupon = await getCouponByCode(code);
    
    if (!coupon) {
      return { success: false, message: 'Coupon not found' };
    }
    
    // Ensure coupon has a valid status
    const currentStatus = coupon.status || 'active';
    
    if (currentStatus !== 'active') {
      return { success: false, message: 'Coupon is not active' };
    }
    
    if (coupon.used_date) {
      return { success: false, message: 'Coupon already used' };
    }

    // Update coupon as used
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({
        used_date: new Date().toISOString(),
        employee_code: employeeCode,
        store_location: storeLocation,
        status: 'used'
      })
      .eq('code', code)
      .select();
    
    if (error) throw error;
    
    console.log('✅ Coupon validated successfully');
    
    const updatedCoupon = data[0];
    
    return { 
      success: true, 
      message: 'Coupon validated successfully',
      coupon: updatedCoupon,
      shouldDisableShopify: !!updatedCoupon.shopify_discount_id
    };
  } catch (error) {
    console.error('❌ Database error:', error);
    return { success: false, message: 'Database error occurred' };
  }
}

// Deactivate local coupon (when Shopify is deactivated)
export async function deactivateLocalCoupon(code, reason = 'Deactivated') {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({
        status: 'inactive',
        used_date: new Date().toISOString(),
        employee_code: reason
      })
      .eq('code', code)
      .eq('status', 'active')
      .select();
    
    if (error) throw error;
    
    if (data.length > 0) {
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

// Scratch coupon
export async function scratchCoupon(code) {
  try {
    const coupon = await getCouponByCode(code);
    
    if (!coupon) {
      return { success: false, message: 'Coupon not found' };
    }
    
    if (coupon.is_scratched) {
      return { success: false, message: 'Coupon already scratched' };
    }

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({
        is_scratched: true,
        scratched_date: new Date().toISOString()
      })
      .eq('code', code)
      .select();
    
    if (error) throw error;
    
    return { success: true, message: 'Coupon scratched successfully' };
  } catch (error) {
    console.error('❌ Error scratching coupon:', error);
    return { success: false, message: error.message };
  }
}

// Sync coupons with Shopify status
export async function syncCouponsWithShopify(shopifyDiscounts) {
  try {
    let syncedCount = 0;
    let deactivatedCount = 0;
    
    for (const discountData of shopifyDiscounts) {
      const { couponCode, localShopifyStatus } = discountData;
      
      // Get current local coupon
      const localCoupon = await getCouponByCode(couponCode);
      
      if (!localCoupon) {
        console.warn(`⚠️ Local coupon not found: ${couponCode}`);
        continue;
      }

      // Update Shopify status
      if (localCoupon.shopify_status !== localShopifyStatus) {
        await updateShopifyStatus(couponCode, localShopifyStatus);
        syncedCount++;
        
        // If Shopify is disabled and local is still active, deactivate locally
        if (localShopifyStatus === 'disabled' && localCoupon.status === 'active') {
          await deactivateLocalCoupon(couponCode, 'Shopify sync - deactivated');
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

export default supabaseAdmin;