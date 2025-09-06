import { NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode, initDatabase } from '@/lib/database';
import { deactivateShopifyDiscount } from '@/lib/shopify';

export async function POST(request) {
  try {
    initDatabase();
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ success: false, message: 'Coupon code is required' }, { status: 400 });
    }

    const coupon = getCouponByCode(code);
    if (!coupon) {
      return NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 });
    }
    if (coupon.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Coupon is not active', couponDetails: coupon }, { status: 400 });
    }

    const result = validateCoupon(code, 'SHOPIFY', 0);
    if (result.success && coupon.shopify_discount_id) {
      await deactivateShopifyDiscount(coupon.shopify_discount_id);
    }

    const updatedCoupon = getCouponByCode(code);
    return NextResponse.json({ ...result, couponDetails: updatedCoupon });
  } catch (error) {
    console.error('Shopify redeem API error:', error);
    return NextResponse.json({ success: false, message: 'Error deactivating coupon', error: error.message }, { status: 500 });
  }
}
