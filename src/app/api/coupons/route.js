import { NextResponse } from 'next/server';
import { getAllCoupons, getCouponByCode, initDatabase } from '@/lib/database';

export async function GET(request) {
  try {
    initDatabase();
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (code) {
      const coupon = getCouponByCode(code);
      return NextResponse.json({
        success: !!coupon,
        coupons: coupon ? [coupon] : []
      });
    }
    
    const coupons = getAllCoupons();
    
    return NextResponse.json({
      success: true,
      coupons
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message
    }, { status: 500 });
  }
}