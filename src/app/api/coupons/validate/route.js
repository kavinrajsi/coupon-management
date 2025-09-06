import { NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode, initDatabase } from '@/lib/supabase';
import { disableShopifyDiscount } from '@/lib/shopify';  // ✅ Fixed import

export async function POST(request) {
  try {
    initDatabase();
    
    const body = await request.json();
    console.log('Received request body:', body);
    
    const { code, employeeCode, storeLocation } = body;
    
    if (!code || !employeeCode || !storeLocation) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields. Please fill in all fields.'
      }, { status: 400 });
    }

    // First, get the coupon details for debugging
    let coupon = getCouponByCode(code);
    console.log('Coupon found:', coupon);

    if (!coupon) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" not found in database. Please check if the coupon code is correct.`,
        couponDetails: null
      });
    }

    // Return detailed information about why validation failed
    if (coupon.status !== 'active') {
      return NextResponse.json({
        success: false,
        message: `Coupon is not active. Current status: "${coupon.status}". ${
          coupon.status === 'used' ? 'This coupon has already been used.' : 
          'This coupon is inactive.'
        }`,
        couponDetails: coupon
      });
    }

    if (coupon.used_date) {
      return NextResponse.json({
        success: false,
        message: `Coupon already used on ${new Date(coupon.used_date).toLocaleString()} by employee ${coupon.employee_code} at Store ${coupon.store_location}.`,
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
    coupon = getCouponByCode(code);
  }
}


    // Proceed with validation
    const result = validateCoupon(code, employeeCode, storeLocation);
    console.log('Validation result:', result);
    
    if (result.success) {
      // If coupon was validated successfully and has Shopify ID, disable it in Shopify
      if (result.shouldDisableShopify && result.coupon.shopify_discount_id) {
        console.log(`🔒 Auto-disabling Shopify discount for used coupon: ${code}`);
        
        try {
          const shopifyResult = await disableShopifyDiscount(result.coupon.shopify_discount_id);  // ✅ Fixed function call
          
          if (shopifyResult.success) {
            console.log('✅ Successfully disabled coupon in Shopify');
            // Update database to reflect Shopify status
            const { updateShopifyStatus } = await import('@/lib/database');
            updateShopifyStatus(code, 'disabled');
            
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
      const updatedCoupon = getCouponByCode(code);
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