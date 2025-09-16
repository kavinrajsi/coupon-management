// src/app/api/coupons/stats/route.js - New stats endpoint
import { NextResponse } from 'next/server';
import { getCouponStats, initDatabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('📊 API: Fetching coupon statistics...');
    
    await initDatabase();
    
    const stats = await getCouponStats();
    
    console.log('✅ API: Statistics fetched successfully:', stats);
    
    return NextResponse.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ API: Error fetching statistics:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message,
      stats: { total: 0, active: 0, used: 0, scratched: 0 }
    }, { status: 500 });
  }
}