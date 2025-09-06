import { NextResponse } from 'next/server';
import { scratchCoupon, initDatabase } from '@/lib/database';

export async function POST(request) {
  try {
    initDatabase();
    
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json({
        success: false,
        message: 'Coupon code is required'
      }, { status: 400 });
    }
    
    const result = scratchCoupon(code);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error scratching coupon',
      error: error.message
    }, { status: 500 });
  }
}