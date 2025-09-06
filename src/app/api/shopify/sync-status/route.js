import { NextResponse } from 'next/server';
import { syncShopifyStatusToLocal, checkAndSyncSpecificCoupon } from '@/lib/shopify';
import { syncCouponsWithShopify, initDatabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    initDatabase();
    
    const { action, couponCode } = await request.json();
    
    // Sync specific coupon
    if (action === 'sync-one' && couponCode) {
      const result = await checkAndSyncSpecificCoupon(couponCode);
      return NextResponse.json(result);
    }
    
    // Sync all coupons
    if (action === 'sync-all') {
      console.log('🔄 Starting full Shopify status sync...');
      
      // Get Shopify statuses
      const shopifyData = await syncShopifyStatusToLocal();
      
      if (!shopifyData.success) {
        return NextResponse.json({
          success: false,
          message: shopifyData.message
        }, { status: 400 });
      }
      
      // Update local database
      const syncResult = syncCouponsWithShopify(shopifyData.discounts);
      
      return NextResponse.json({
        success: true,
        message: `✅ ${syncResult.message}`,
        totalFound: shopifyData.discounts.length,
        synced: syncResult.syncedCount,
        deactivated: syncResult.deactivatedCount
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "sync-one" or "sync-all"'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Sync status API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error syncing status from Shopify',
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const couponCode = searchParams.get('code');
    
    if (couponCode) {
      const result = await checkAndSyncSpecificCoupon(couponCode);
      return NextResponse.json(result);
    }
    
    return NextResponse.json({
      success: false,
      message: 'Coupon code parameter required'
    }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}