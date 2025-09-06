import { NextResponse } from 'next/server';
import { getCouponByCode, initDatabase } from '@/lib/database';

export async function GET(request) {
  try {
    initDatabase();
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = getCouponByCode(code);
    
    return NextResponse.json({
      success: true,
      coupon: coupon,
      exists: !!coupon
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error checking coupon',
      error: error.message
    }, { status: 500 });
  }
}