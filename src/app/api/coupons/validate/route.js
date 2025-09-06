import { NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode, initDatabase } from '@/lib/database';

export async function POST(request) {
  try {
    initDatabase();
    
    const body = await request.json();
    console.log('Received request body:', body);
    
    const { code, employeeCode, storeLocation } = body;
    
    if (!code || !employeeCode || !storeLocation) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields. Please fill in all fields.'
      }, { status: 400 });
    }

    // First, get the coupon details for debugging
    const coupon = getCouponByCode(code);
    console.log('Coupon found:', coupon);

    if (!coupon) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" not found in database. Please check if the coupon code is correct.`,
        couponDetails: null
      });
    }

    // Return detailed information about why validation failed
    if (coupon.status !== 'active') {
      return NextResponse.json({
        success: false,
        message: `Coupon is not active. Current status: "${coupon.status}". ${
          coupon.status === 'used' ? 'This coupon has already been used.' : 
          'This coupon is inactive.'
        }`,
        couponDetails: coupon
      });
    }

    if (coupon.used_date) {
      return NextResponse.json({
        success: false,
        message: `Coupon already used on ${new Date(coupon.used_date).toLocaleString()} by employee ${coupon.employee_code} at Store ${coupon.store_location}.`,
        couponDetails: coupon
      });
    }
    
    // Proceed with validation
    const result = validateCoupon(code, employeeCode, storeLocation);
    console.log('Validation result:', result);
    
    if (result.success) {
      // Get updated coupon details
      const updatedCoupon = getCouponByCode(code);
      return NextResponse.json({
        ...result,
        couponDetails: updatedCoupon
      });
    }
    
    return NextResponse.json({
      ...result,
      couponDetails: coupon
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error validating coupon',
      error: error.message
    }, { status: 500 });
  }
}