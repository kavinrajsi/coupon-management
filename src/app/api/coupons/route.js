import { NextResponse } from 'next/server';
import { getAllCoupons, initDatabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🔄 API: Starting to fetch coupons...');
    
    await initDatabase();
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (code) {
      console.log('🔍 API: Fetching single coupon:', code);
      const { getCouponByCode } = await import('@/lib/supabase');
      const coupon = await getCouponByCode(code);
      
      console.log('📋 API: Single coupon result:', coupon);
      
      return NextResponse.json({
        success: !!coupon,
        coupons: coupon ? [coupon] : []
      });
    }
    
    console.log('📋 API: Fetching all coupons...');
    const coupons = await getAllCoupons();
    
    console.log('📊 API: Fetched coupons count:', coupons?.length || 0);
    console.log('📋 API: First few coupons:', coupons?.slice(0, 3));
    
    return NextResponse.json({
      success: true,
      coupons: coupons || []
    });
  } catch (error) {
    console.error('❌ API: Error fetching coupons:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message,
      coupons: []
    }, { status: 500 });
  }
}