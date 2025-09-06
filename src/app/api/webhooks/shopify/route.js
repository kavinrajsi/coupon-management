import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getCouponByShopifyId, updateShopifyStatus, deactivateLocalCoupon, initDatabase } from '@/lib/supabase';

// Verify webhook signature
function verifyShopifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const hash = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(hash, 'base64')
  );
}

export async function POST(request) {
  try {
    initDatabase();
    
    const headersList = headers();
    const shopifyTopic = headersList.get('X-Shopify-Topic');
    const shopifyShop = headersList.get('X-Shopify-Shop-Domain');
    const shopifySignature = headersList.get('X-Shopify-Hmac-Sha256');
    
    console.log('🎣 Received Shopify webhook:', {
      topic: shopifyTopic,
      shop: shopifyShop,
      hasSignature: !!shopifySignature
    });

    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && shopifySignature) {
      const isValid = verifyShopifyWebhook(rawBody, shopifySignature, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse the webhook payload
    const webhookData = JSON.parse(rawBody);
    console.log('📦 Webhook payload:', JSON.stringify(webhookData, null, 2));

    // Handle different webhook topics
    switch (shopifyTopic) {
      case 'discounts/create':
        return handleDiscountCreate(webhookData);
      
      case 'discounts/update':
        return handleDiscountUpdate(webhookData);
      
      case 'discounts/delete':
        return handleDiscountDelete(webhookData);
      
      default:
        console.log(`⚠️ Unhandled webhook topic: ${shopifyTopic}`);
        return NextResponse.json({ 
          success: true, 
          message: 'Webhook received but not processed' 
        });
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Handle discount creation
async function handleDiscountCreate(discountData) {
  try {
    console.log('🆕 Processing discount creation webhook');
    
    const discountId = `gid://shopify/DiscountCodeNode/${discountData.id}`;
    const couponCode = discountData.code;
    const status = discountData.status || 'enabled';
    
    console.log(`📝 New discount: ${couponCode} (${discountId}) - Status: ${status}`);
    
    // Find local coupon by code and update Shopify ID if missing
    const { getCouponByCode, updateShopifySync } = await import('@/lib/database');
    const localCoupon = getCouponByCode(couponCode);
    
    if (localCoupon && !localCoupon.shopify_discount_id) {
      console.log(`🔗 Linking local coupon ${couponCode} to Shopify ID ${discountId}`);
      updateShopifySync(couponCode, discountId, true, status === 'enabled' ? 'active' : 'disabled');
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed discount creation: ${couponCode}`
    });
    
  } catch (error) {
    console.error('❌ Error handling discount creation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle discount updates (status changes)
async function handleDiscountUpdate(discountData) {
  try {
    console.log('🔄 Processing discount update webhook');
    
    const discountId = `gid://shopify/DiscountCodeNode/${discountData.id}`;
    const couponCode = discountData.code;
    const shopifyStatus = discountData.status; // 'enabled' or 'disabled'
    
    console.log(`📝 Updated discount: ${couponCode} (${discountId}) - New Status: ${shopifyStatus}`);
    
    // Find local coupon by Shopify ID or code
    let localCoupon = getCouponByShopifyId(discountId);
    if (!localCoupon) {
      const { getCouponByCode } = await import('@/lib/database');
      localCoupon = getCouponByCode(couponCode);
    }
    
    if (!localCoupon) {
      console.warn(`⚠️ Local coupon not found for ${couponCode} (${discountId})`);
      return NextResponse.json({
        success: true,
        message: `Webhook received but coupon not found locally: ${couponCode}`
      });
    }
    
    // Map Shopify status to local status
    const newLocalShopifyStatus = shopifyStatus === 'enabled' ? 'active' : 'disabled';
    
    // Update local Shopify status
    if (localCoupon.shopify_status !== newLocalShopifyStatus) {
      console.log(`🔄 Updating local Shopify status: ${localCoupon.shopify_status} → ${newLocalShopifyStatus}`);
      updateShopifyStatus(couponCode, newLocalShopifyStatus);
      
      // If disabled in Shopify and still active locally, deactivate locally too
      if (newLocalShopifyStatus === 'disabled' && localCoupon.status === 'active') {
        console.log(`🔒 Deactivating local coupon ${couponCode} due to Shopify disable`);
        deactivateLocalCoupon(couponCode, 'Webhook: Disabled in Shopify');
        
        return NextResponse.json({
          success: true,
          message: `Coupon ${couponCode} disabled locally due to Shopify deactivation`,
          action: 'deactivated_locally'
        });
      }
      
      return NextResponse.json({
        success: true,
        message: `Updated ${couponCode} status to ${newLocalShopifyStatus}`,
        action: 'status_updated'
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Status already in sync for ${couponCode}`,
      action: 'no_change_needed'
    });
    
  } catch (error) {
    console.error('❌ Error handling discount update:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle discount deletion
async function handleDiscountDelete(discountData) {
  try {
    console.log('🗑️ Processing discount deletion webhook');
    
    const discountId = `gid://shopify/DiscountCodeNode/${discountData.id}`;
    const couponCode = discountData.code;
    
    console.log(`📝 Deleted discount: ${couponCode} (${discountId})`);
    
    // Find and update local coupon
    let localCoupon = getCouponByShopifyId(discountId);
    if (!localCoupon) {
      const { getCouponByCode } = await import('@/lib/database');
      localCoupon = getCouponByCode(couponCode);
    }
    
    if (localCoupon) {
      // Update local status to reflect Shopify deletion
      updateShopifyStatus(couponCode, 'deleted');
      
      // Deactivate locally if still active
      if (localCoupon.status === 'active') {
        deactivateLocalCoupon(couponCode, 'Webhook: Deleted from Shopify');
        
        return NextResponse.json({
          success: true,
          message: `Coupon ${couponCode} deactivated locally due to Shopify deletion`,
          action: 'deactivated_locally'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed deletion of ${couponCode}`,
      action: 'deletion_processed'
    });
    
  } catch (error) {
    console.error('❌ Error handling discount deletion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}