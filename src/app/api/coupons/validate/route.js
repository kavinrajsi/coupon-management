import { NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode, initDatabase, updateShopifyStatus } from '@/lib/supabase';
import { disableShopifyDiscount } from '@/lib/shopify';

// Valid Chennai store locations
const VALID_STORE_LOCATIONS = [
  'Aminjikarai',
  'Anna Nagar East',
  'Arumbakkam',
  'Kanchipuram',
  'Kilpauk',
  'Mogappair',
  'Mylapore',
  'Nerkundram',
  'Nungambakkam',
  'Perambur',
  'Saligramam',
  'Thiruvallur',
  'Washermenpet',
  'Adyar'
];

export async function POST(request) {
  try {
    await initDatabase();
    
    const body = await request.json();
    console.log('Received request body:', body);
    
    const { code, employeeCode, storeLocation } = body;
    
    if (!code || !employeeCode || !storeLocation) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields. Please fill in all fields.'
      }, { status: 400 });
    }

    // Validate store location
    if (!VALID_STORE_LOCATIONS.includes(storeLocation)) {
      return NextResponse.json({
        success: false,
        message: `Invalid store location: "${storeLocation}". Please select a valid Chennai store location.`
      }, { status: 400 });
    }

    // First, get the coupon details for debugging
    let coupon = await getCouponByCode(code);
    console.log('Coupon found:', coupon);

    if (!coupon) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" not found in database. Please check if the coupon code is correct.`,
        couponDetails: null
      });
    }

    // Check if status is null/undefined and provide better error message
    if (!coupon.status) {
      console.warn(`⚠️ Coupon ${code} has null/undefined status, treating as inactive`);
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" has an invalid status in the database. Please contact system administrator.`,
        couponDetails: {
          ...coupon,
          status: coupon.status || 'unknown'
        }
      });
    }

    // Return detailed information about why validation failed
    if (coupon.status !== 'active') {
      const statusMessage = coupon.status === 'used' 
        ? 'This coupon has already been used.' 
        : coupon.status === 'inactive'
        ? 'This coupon has been deactivated.'
        : `This coupon has status: "${coupon.status}".`;
        
      return NextResponse.json({
        success: false,
        message: `Coupon is not active. Current status: "${coupon.status}". ${statusMessage}`,
        couponDetails: coupon
      });
    }

    if (coupon.used_date) {
      return NextResponse.json({
        success: false,
        message: `Coupon already used on ${new Date(coupon.used_date).toLocaleString()} by employee ${coupon.employee_code} at ${coupon.store_location}.`,
        couponDetails: coupon
      });
    }
    
    // Check Shopify status first
    if (coupon.shopify_discount_id) {
      const { checkAndSyncSpecificCoupon } = await import('@/lib/shopify');
      const statusCheck = await checkAndSyncSpecificCoupon(code);
      
      if (statusCheck.success && statusCheck.updated) {
        console.log(`📋 Updated coupon status from Shopify: ${statusCheck.message}`);
        // Refresh coupon data
        coupon = await getCouponByCode(code);
      }
    }

    // Proceed with validation - now passing string store location
    const result = await validateCoupon(code, employeeCode, storeLocation);
    console.log('Validation result:', result);
    
    if (result.success) {
      // If coupon was validated successfully and has Shopify ID, disable it in Shopify
      if (result.shouldDisableShopify && result.coupon.shopify_discount_id) {
        console.log(`🔒 Auto-disabling Shopify discount for used coupon: ${code}`);
        
        try {
          const shopifyResult = await disableShopifyDiscount(result.coupon.shopify_discount_id);
          
          if (shopifyResult.success) {
            console.log('✅ Successfully disabled coupon in Shopify');
            // Update database to reflect Shopify status
            await updateShopifyStatus(code, 'disabled');
            
            result.shopifyDisabled = true;
            result.message += ' (Also disabled in Shopify)';
          } else {
            console.warn('⚠️ Failed to disable coupon in Shopify:', shopifyResult.message);
            result.shopifyDisabled = false;
            result.shopifyError = shopifyResult.message;
          }
        } catch (shopifyError) {
          console.error('❌ Error disabling coupon in Shopify:', shopifyError);
          result.shopifyDisabled = false;
          result.shopifyError = shopifyError.message;
        }
      }
      
      // Get updated coupon details
      const updatedCoupon = await getCouponByCode(code);
      return NextResponse.json({
        ...result,
        couponDetails: updatedCoupon
      });
    }
    
    return NextResponse.json({
      ...result,
      couponDetails: coupon
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error validating coupon',
      error: error.message
    }, { status: 500 });
  }
}