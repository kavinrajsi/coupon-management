import { NextResponse } from 'next/server';
import { getCouponsNeedingSync, updateShopifySync, initDatabase } from '@/lib/database';
import { createShopifyDiscount } from '@/lib/shopify';

export async function POST(request) {
  try {
    console.log('🔄 Starting Shopify sync...');
    initDatabase();
    
    // Check environment variables
    if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        message: 'Missing Shopify configuration. Check SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN in .env.local'
      }, { status: 400 });
    }
    
    const { syncAll = false } = await request.json();
    const couponsToSync = getCouponsNeedingSync();
    
    console.log(`📊 Found ${couponsToSync.length} coupons to sync`);
    
    if (couponsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No coupons need syncing',
        synced: 0
      });
    }

    const results = [];
    
    // Sync first coupon as test
    const testCoupon = couponsToSync[0];
    console.log(`🧪 Testing with coupon: ${testCoupon.code}`);
    
    const testResult = await createShopifyDiscount(testCoupon.code);
    
    if (!testResult.success) {
      console.error('❌ Test sync failed:', testResult.message);
      return NextResponse.json({
        success: false,
        message: `Shopify sync failed: ${testResult.message}`,
        testCoupon: testCoupon.code,
        error: testResult.details
      }, { status: 400 });
    }
    
    // Update test coupon
    updateShopifySync(testCoupon.code, testResult.shopifyId, true);
    results.push({
      code: testCoupon.code,
      success: true,
      shopifyId: testResult.shopifyId
    });
    
    // Continue with remaining coupons
    for (let i = 1; i < couponsToSync.length; i++) {
      const coupon = couponsToSync[i];
      console.log(`🔄 Syncing coupon ${i + 1}/${couponsToSync.length}: ${coupon.code}`);
      
      const shopifyResult = await createShopifyDiscount(coupon.code);
      
      if (shopifyResult.success) {
        updateShopifySync(coupon.code, shopifyResult.shopifyId, true);
        results.push({
          code: coupon.code,
          success: true,
          shopifyId: shopifyResult.shopifyId
        });
      } else {
        console.error(`❌ Failed to sync ${coupon.code}:`, shopifyResult.message);
        results.push({
          code: coupon.code,
          success: false,
          error: shopifyResult.message
        });
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;

    console.log(`✅ Sync complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount} coupons to Shopify${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      synced: successCount,
      errors: errorCount,
      results: results
    });

  } catch (error) {
    console.error('❌ Shopify sync API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal sync error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}