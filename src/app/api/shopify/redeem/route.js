import { NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode, initDatabase } from '@/lib/supabase';
import { disableShopifyDiscount } from '@/lib/shopify'; // Fixed import name

export async function POST(request) {
  try {
    await initDatabase(); // Added await
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ success: false, message: 'Coupon code is required' }, { status: 400 });
    }

    const coupon = await getCouponByCode(code); // Added await
    if (!coupon) {
      return NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 });
    }
    if (coupon.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Coupon is not active', couponDetails: coupon }, { status: 400 });
    }

    const result = await validateCoupon(code, 'SHOPIFY', 0); // Added await
    if (result.success && coupon.shopify_discount_id) {
      await disableShopifyDiscount(coupon.shopify_discount_id); // Fixed function name and added await
    }

    const updatedCoupon = await getCouponByCode(code); // Added await
    return NextResponse.json({ ...result, couponDetails: updatedCoupon });
  } catch (error) {
    console.error('Shopify redeem API error:', error);
    return NextResponse.json({ success: false, message: 'Error deactivating coupon', error: error.message }, { status: 500 });
  }
}