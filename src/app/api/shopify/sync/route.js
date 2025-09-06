import { NextResponse } from 'next/server';
import { getCouponsNeedingSync, updateShopifySync, initDatabase } from '@/lib/supabase';
import { createShopifyDiscount } from '@/lib/shopify';

export async function POST(request) {
  try {
    console.log('🔄 Starting Shopify sync...');
    await initDatabase(); // Make sure this is awaited
    
    // Check environment variables
    if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        message: 'Missing Shopify configuration. Check SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN in .env.local'
      }, { status: 400 });
    }
    
    const { syncAll = false } = await request.json();
    
    // Make sure this is awaited since it's an async function
    const couponsToSync = await getCouponsNeedingSync();
    
    console.log('📋 Raw couponsToSync result:', couponsToSync);
    console.log(`📊 Found ${couponsToSync?.length || 0} coupons to sync`);
    
    // Check if we got a valid array
    if (!Array.isArray(couponsToSync)) {
      console.error('❌ getCouponsNeedingSync did not return an array:', typeof couponsToSync);
      return NextResponse.json({
        success: false,
        message: 'Error fetching coupons needing sync - invalid data type returned'
      }, { status: 500 });
    }
    
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
    
    // Add safety check for testCoupon
    if (!testCoupon || !testCoupon.code) {
      console.error('❌ Invalid test coupon:', testCoupon);
      return NextResponse.json({
        success: false,
        message: 'Invalid coupon data - missing code field'
      }, { status: 500 });
    }
    
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
    
    // Update test coupon - make sure this is awaited
    await updateShopifySync(testCoupon.code, testResult.shopifyId, true);
    results.push({
      code: testCoupon.code,
      success: true,
      shopifyId: testResult.shopifyId
    });
    
    // Continue with remaining coupons
    for (let i = 1; i < couponsToSync.length; i++) {
      const coupon = couponsToSync[i];
      
      // Add safety check for each coupon
      if (!coupon || !coupon.code) {
        console.error(`❌ Invalid coupon at index ${i}:`, coupon);
        results.push({
          code: 'INVALID',
          success: false,
          error: 'Invalid coupon data'
        });
        continue;
      }
      
      console.log(`🔄 Syncing coupon ${i + 1}/${couponsToSync.length}: ${coupon.code}`);
      
      const shopifyResult = await createShopifyDiscount(coupon.code);
      
      if (shopifyResult.success) {
        await updateShopifySync(coupon.code, shopifyResult.shopifyId, true);
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