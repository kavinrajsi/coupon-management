import { NextResponse } from 'next/server';
import { scratchCoupon, initDatabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    await initDatabase();
    
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json({
        success: false,
        message: 'Coupon code is required'
      }, { status: 400 });
    }
    
    const result = await scratchCoupon(code);
    
    // Ensure we always return a properly structured response
    return NextResponse.json({
      success: result.success || false,
      message: result.message || (result.success ? 'Coupon scratched successfully' : 'Failed to scratch coupon'),
      ...result
    });
  } catch (error) {
    console.error('Scratch API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error scratching coupon',
      error: error.message
    }, { status: 500 });
  }
}