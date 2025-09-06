import { NextResponse } from 'next/server';
import { getCouponByCode, updateShopifyStatus, initDatabase } from '@/lib/supabase';
import { disableShopifyDiscount } from '@/lib/shopify';

export async function POST(request) {
  try {
    initDatabase();
    
    const { couponCode } = await request.json();
    
    if (!couponCode) {
      return NextResponse.json({
        success: false,
        message: 'Coupon code is required'
      }, { status: 400 });
    }

    // Get coupon data
    const coupon = getCouponByCode(couponCode);
    
    if (!coupon) {
      return NextResponse.json({
        success: false,
        message: 'Coupon not found'
      }, { status: 404 });
    }

    if (!coupon.shopify_discount_id) {
      return NextResponse.json({
        success: false,
        message: 'Coupon not synced to Shopify'
      }, { status: 400 });
    }

    if (coupon.shopify_status === 'disabled') {
      return NextResponse.json({
        success: true,
        message: 'Coupon already disabled in Shopify'
      });
    }

    // Disable in Shopify
    console.log(`🔒 Disabling Shopify discount for coupon: ${couponCode}`);
    const shopifyResult = await disableShopifyDiscount(coupon.shopify_discount_id);
    
    if (shopifyResult.success) {
      // Update local database
      updateShopifyStatus(couponCode, 'disabled');
      
      return NextResponse.json({
        success: true,
        message: 'Coupon disabled successfully in Shopify',
        shopifyId: shopifyResult.shopifyId,
        status: shopifyResult.status
      });
    } else {
      return NextResponse.json({
        success: false,
        message: shopifyResult.message
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Shopify disable API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error disabling coupon in Shopify',
      error: error.message
    }, { status: 500 });
  }
}