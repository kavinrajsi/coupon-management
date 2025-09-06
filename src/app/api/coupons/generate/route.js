import { NextResponse } from 'next/server';
import { generateCoupons, initDatabase, getAllCoupons } from '@/lib/database';
import { createShopifyDiscount } from '@/lib/shopify';

export async function POST(request) {
  try {
    initDatabase();
    
      const { count = 10000, syncToShopify = true } = await request.json();
    
    // Validate request count
    if (count < 1 || count > 10000) {
      return NextResponse.json({
        success: false,
        message: 'Invalid count. Must be between 1 and 10,000 codes.'
      }, { status: 400 });
    }
    
    // Check existing coupons in database
    const existingCoupons = getAllCoupons();
    const existingCount = existingCoupons.length;
    
    // Check if adding new codes would exceed 10,000 total
    if (existingCount + count > 10000) {
      const remaining = 10000 - existingCount;
      return NextResponse.json({
        success: false,
        message: `Cannot generate ${count} codes. Database already has ${existingCount} codes. Maximum total is 10,000. You can only generate ${remaining} more codes.`,
        existingCount,
        requestedCount: count,
        maxTotal: 10000,
        remainingSlots: remaining
      }, { status: 400 });
    }
    
    // If we already have 10,000 codes, don't allow any more
    if (existingCount >= 10000) {
      return NextResponse.json({
        success: false,
        message: 'Database already contains the maximum of 10,000 coupon codes. Cannot generate more.',
        existingCount,
        maxTotal: 10000
      }, { status: 400 });
    }
    
    const generatedCount = generateCoupons(count);
    
    let shopifyMessage = '';
    if (syncToShopify && generatedCount > 0) {
      // Trigger background sync (you could also do this immediately)
      shopifyMessage = ' (Shopify sync will begin shortly)';
    }
    
    return NextResponse.json({
      success: true,
      message: `Generated ${generatedCount} coupon codes${shopifyMessage}`,
      count: generatedCount,
      totalInDatabase: existingCount + generatedCount,
      shopifySyncEnabled: syncToShopify
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error generating coupons',
      error: error.message
    }, { status: 500 });
  }

}