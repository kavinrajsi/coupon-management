// src/app/api/coupons/route.js - Updated with pagination
import { NextResponse } from 'next/server';
import { getAllCoupons, getCouponsPaginated, initDatabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🔄 API: Starting to fetch coupons...');
    
    await initDatabase();
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    // Handle single coupon lookup
    if (code) {
      console.log('🔍 API: Fetching single coupon:', code);
      const { getCouponByCode } = await import('@/lib/supabase');
      const coupon = await getCouponByCode(code);
      
      console.log('📋 API: Single coupon result:', coupon);
      
      return NextResponse.json({
        success: !!coupon,
        coupons: coupon ? [coupon] : [],
        pagination: null
      });
    }

    // Handle paginated requests
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 1000;
    const sortBy = searchParams.get('sortBy') || 'created_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const searchQuery = searchParams.get('search') || '';

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 1000) {
      return NextResponse.json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-1000.',
        coupons: []
      }, { status: 400 });
    }

    console.log('📋 API: Fetching paginated coupons...', { page, limit, sortBy, sortOrder, searchQuery });
    
    const result = await getCouponsPaginated({
      page,
      limit,
      sortBy,
      sortOrder,
      searchQuery
    });
    
    console.log('📊 API: Paginated result:', {
      couponCount: result.coupons?.length || 0,
      totalCount: result.pagination?.totalCount,
      totalPages: result.pagination?.totalPages
    });
    
    return NextResponse.json({
      success: true,
      coupons: result.coupons || [],
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error('❌ API: Error fetching coupons:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message,
      coupons: [],
      pagination: null
    }, { status: 500 });
  }
}