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
export async function validateCoupon(code, employeeCode, storeLocation, orderId) {
  try {
    console.log('validateCoupon called with:', { code, employeeCode, storeLocation, orderId});
    
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
        status: 'used',
        order_id: orderId,
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

// Mark coupon as used from Shopify order
export async function markCouponUsedFromOrder(couponCode, orderReference = 'SHOPIFY_ORDER') {
  try {
    console.log(`🛒 Marking coupon ${couponCode} as used from order: ${orderReference}`);
    
    const coupon = await getCouponByCode(couponCode);
    
    if (!coupon) {
      return { 
        success: false, 
        message: 'Coupon not found in database',
        code: couponCode
      };
    }
    
    if (coupon.status !== 'active') {
      return { 
        success: false, 
        message: `Coupon is not active. Current status: ${coupon.status}`,
        code: couponCode,
        currentStatus: coupon.status
      };
    }
    
    if (coupon.used_date) {
      return { 
        success: false, 
        message: 'Coupon already used',
        code: couponCode,
        usedDate: coupon.used_date
      };
    }

    // Mark coupon as used
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update({
        status: 'used',
        used_date: new Date().toISOString(),
        employee_code: orderReference,
        store_location: 'Online Store'
      })
      .eq('code', couponCode)
      .eq('status', 'active') // Double-check it's still active
      .select();
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`✅ Successfully marked coupon ${couponCode} as used`);
      
      // Also disable in Shopify if it has a Shopify ID
      if (coupon.shopify_discount_id) {
        try {
          const { disableShopifyDiscount } = await import('./shopify.js');
          const shopifyResult = await disableShopifyDiscount(coupon.shopify_discount_id);
          
          if (shopifyResult.success) {
            console.log(`🔒 Also disabled coupon ${couponCode} in Shopify`);
            await updateShopifyStatus(couponCode, 'disabled');
          }
        } catch (shopifyError) {
          console.warn(`⚠️ Failed to disable coupon in Shopify:`, shopifyError);
        }
      }
      
      return {
        success: true,
        message: 'Coupon marked as used successfully',
        code: couponCode,
        usedDate: data[0].used_date,
        orderReference
      };
    } else {
      return {
        success: false,
        message: 'No rows were updated - coupon may have been used by another process',
        code: couponCode
      };
    }
    
  } catch (error) {
    console.error(`❌ Error marking coupon ${couponCode} as used:`, error);
    return {
      success: false,
      message: `Database error: ${error.message}`,
      code: couponCode
    };
  }
}

// Batch process multiple coupons from an order
export async function markMultipleCouponsUsedFromOrder(couponCodes, orderReference) {
  try {
    console.log(`🛒 Processing ${couponCodes.length} coupons from order: ${orderReference}`);
    
    const results = [];
    let successCount = 0;
    
    for (const couponCode of couponCodes) {
      const result = await markCouponUsedFromOrder(couponCode, orderReference);
      results.push(result);
      
      if (result.success) {
        successCount++;
      }
      
      // Add small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
      success: true,
      message: `Processed ${successCount}/${couponCodes.length} coupons successfully`,
      orderReference,
      totalProcessed: couponCodes.length,
      successCount,
      results
    };
    
  } catch (error) {
    console.error(`❌ Error processing multiple coupons:`, error);
    return {
      success: false,
      message: error.message,
      orderReference
    };
  }
}

// Get coupon usage statistics
export async function getCouponUsageStats(timeframe = '24 hours') {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('store_location, used_date, employee_code')
      .eq('status', 'used')
      .gte('used_date', new Date(Date.now() - (timeframe === '24 hours' ? 86400000 : 604800000)).toISOString())
      .order('used_date', { ascending: false });
    
    if (error) throw error;
    
    // Group by store location
    const stats = data.reduce((acc, coupon) => {
      const location = coupon.store_location || 'Unknown';
      if (!acc[location]) {
        acc[location] = { total: 0, online: 0, inStore: 0 };
      }
      acc[location].total++;
      
      if (coupon.employee_code?.includes('SHOPIFY') || coupon.employee_code?.includes('ORDER')) {
        acc[location].online++;
      } else {
        acc[location].inStore++;
      }
      
      return acc;
    }, {});
    
    return {
      success: true,
      timeframe,
      totalUsed: data.length,
      stats
    };
    
  } catch (error) {
    console.error('❌ Error getting usage stats:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// Get paginated coupons with search and sorting
export async function getCouponsPaginated({
  page = 1,
  limit = 1000,
  sortBy = 'created_date',
  sortOrder = 'desc',
  searchQuery = ''
}) {
  try {
    console.log('📋 Supabase: Fetching paginated coupons...', { page, limit, sortBy, sortOrder, searchQuery });

    // Calculate offset
    const offset = (page - 1) * limit;

    // Validate sort column to prevent SQL injection
    const validSortColumns = [
      'id', 'code', 'status', 'created_date', 'used_date', 
      'scratched_date', 'employee_code', 'is_scratched', 
      'store_location', 'shopify_status'
    ];
    
    if (!validSortColumns.includes(sortBy)) {
      throw new Error(`Invalid sort column: ${sortBy}`);
    }

    // Validate sort order
    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      throw new Error(`Invalid sort order: ${sortOrder}`);
    }

    // Build the base query
    let query = supabaseAdmin
      .from('coupons')
      .select('*');

    // Add search filter if provided
    if (searchQuery && searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim().toLowerCase();
      query = query.or(`code.ilike.%${trimmedQuery}%,employee_code.ilike.%${trimmedQuery}%,store_location.ilike.%${trimmedQuery}%`);
    }

    // Get total count for pagination (before applying limit/offset)
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('coupons')
      .select('*', { count: 'exact', head: true })
      .then(result => {
        // Apply same search filter for count
        if (searchQuery && searchQuery.trim()) {
          const trimmedQuery = searchQuery.trim().toLowerCase();
          return supabaseAdmin
            .from('coupons')
            .select('*', { count: 'exact', head: true })
            .or(`code.ilike.%${trimmedQuery}%,employee_code.ilike.%${trimmedQuery}%,store_location.ilike.%${trimmedQuery}%`);
        }
        return result;
      });

    if (countError) {
      console.error('❌ Error getting total count:', countError);
      throw countError;
    }

    // Apply sorting, pagination
    const { data, error } = await query
      .order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching paginated coupons:', error);
      throw error;
    }

    // Process the data to ensure valid status
    const processedData = (data || []).map(coupon => ({
      ...coupon,
      status: coupon.status || 'active',
      shopify_status: coupon.shopify_status || 'active'
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPrevPage,
      startIndex: offset + 1,
      endIndex: Math.min(offset + limit, totalCount)
    };

    console.log('📊 Supabase: Pagination result:', pagination);

    return {
      coupons: processedData,
      pagination
    };

  } catch (error) {
    console.error('❌ Error in getCouponsPaginated:', error);
    throw error;
  }
}

// Get coupon statistics (optimized for large datasets)
export async function getCouponStats() {
  try {
    console.log('📊 Supabase: Fetching coupon statistics...');

    // Use aggregate queries instead of loading all data
    const [totalResult, activeResult, usedResult, scratchedResult] = await Promise.all([
      // Total count
      supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true }),
      
      // Active count
      supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      
      // Used count
      supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'used'),
      
      // Scratched count
      supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .eq('is_scratched', true)
    ]);

    // Check for errors
    const errors = [totalResult.error, activeResult.error, usedResult.error, scratchedResult.error].filter(Boolean);
    if (errors.length > 0) {
      throw new Error(`Statistics query errors: ${errors.map(e => e.message).join(', ')}`);
    }

    const stats = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      used: usedResult.count || 0,
      scratched: scratchedResult.count || 0
    };

    console.log('✅ Supabase: Statistics fetched:', stats);
    return stats;

  } catch (error) {
    console.error('❌ Error fetching coupon statistics:', error);
    throw error;
  }
}

// Optimized search function for large datasets
export async function searchCoupons(searchQuery, limit = 50) {
  try {
    if (!searchQuery || !searchQuery.trim()) {
      return { coupons: [], totalCount: 0 };
    }

    const trimmedQuery = searchQuery.trim().toLowerCase();
    
    // Use ILIKE for case-insensitive search with index support
    const { data, error, count } = await supabaseAdmin
      .from('coupons')
      .select('*', { count: 'exact' })
      .or(`code.ilike.%${trimmedQuery}%,employee_code.ilike.%${trimmedQuery}%,store_location.ilike.%${trimmedQuery}%`)
      .order('created_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const processedData = (data || []).map(coupon => ({
      ...coupon,
      status: coupon.status || 'active',
      shopify_status: coupon.shopify_status || 'active'
    }));

    return {
      coupons: processedData,
      totalCount: count || 0
    };

  } catch (error) {
    console.error('❌ Error searching coupons:', error);
    throw error;
  }
}

export default supabaseAdmin;