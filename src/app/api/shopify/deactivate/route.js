import { NextResponse } from 'next/server';
import { getCouponByCode, initDatabase, deactivateCoupon } from '@/lib/database';

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

    const result = deactivateCoupon(code);
    const updatedCoupon = getCouponByCode(code);
    return NextResponse.json({ ...result, couponDetails: updatedCoupon });
  } catch (error) {
    console.error('Shopify deactivate API error:', error);
    return NextResponse.json({ success: false, message: 'Error deactivating coupon', error: error.message }, { status: 500 });
  }
}

