import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getCouponByShopifyId, updateShopifyStatus, deactivateLocalCoupon, initDatabase, getCouponByCode, updateShopifySync } from '@/lib/supabase';
import { getShopifyDiscountStatus } from '@/lib/shopify';

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
  console.log('🎣 Webhook received');
  
  try {
    await initDatabase();
    
    // Fix: Await headers() call
    const headersList = await headers();
    const shopifyTopic = headersList.get('X-Shopify-Topic');
    const shopifyShop = headersList.get('X-Shopify-Shop-Domain');
    const shopifySignature = headersList.get('X-Shopify-Hmac-Sha256');
    
    console.log('📋 Webhook details:', {
      topic: shopifyTopic,
      shop: shopifyShop,
      hasSignature: !!shopifySignature,
      userAgent: headersList.get('User-Agent')
    });

    // Get raw body for signature verification
    const rawBody = await request.text();
    console.log('📦 Raw body length:', rawBody.length);
    
    // Verify webhook signature if secret is provided
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && shopifySignature) {
      const isValid = verifyShopifyWebhook(rawBody, shopifySignature, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️ No webhook secret configured - signature not verified');
    }

    // Parse the webhook payload
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
      console.log('📦 Parsed webhook data:', webhookData);
    } catch (parseError) {
      console.error('❌ Failed to parse webhook JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle different webhook topics
    switch (shopifyTopic) {
      case 'discount_codes/create':
      case 'discounts/create':
        return handleDiscountCreate(webhookData);
      
      case 'discount_codes/update':
      case 'discounts/update':
        return handleDiscountUpdate(webhookData);
      
      case 'discount_codes/delete':
      case 'discounts/delete':
        return handleDiscountDelete(webhookData);
      
      default:
        console.log(`⚠️ Unhandled webhook topic: ${shopifyTopic}`);
        return NextResponse.json({ 
          success: true, 
          message: `Webhook received but topic ${shopifyTopic} not handled` 
        });
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Extract coupon code from discount title (fallback method)
function extractCouponCodeFromTitle(title) {
  // Pattern: "Coupon Discount ABC123" -> extract "ABC123"
  const match = title?.match(/Coupon Discount ([A-Z]{3}\d{3})/);
  return match ? match[1] : null;
}

// Get coupon code by fetching full discount details from Shopify
async function getCouponCodeFromShopify(discountId) {
  try {
    console.log(`🔍 Fetching discount details from Shopify: ${discountId}`);
    
    const discountDetails = await getShopifyDiscountStatus(discountId);
    
    if (discountDetails.success && discountDetails.discount) {
      const codes = discountDetails.discount.codes?.nodes;
      if (codes && codes.length > 0) {
        const couponCode = codes[0].code;
        console.log(`✅ Found coupon code from Shopify API: ${couponCode}`);
        return couponCode;
      }
    }
    
    console.warn('⚠️ No coupon code found in Shopify discount details');
    return null;
  } catch (error) {
    console.error('❌ Error fetching discount details from Shopify:', error);
    return null;
  }
}

// Handle discount creation
async function handleDiscountCreate(discountData) {
  try {
    console.log('🆕 Processing discount creation webhook');
    
    const discountId = discountData.admin_graphql_api_id || `gid://shopify/DiscountCodeNode/${discountData.id}`;
    let couponCode = discountData.code;
    const status = discountData.status || 'enabled';
    
    // If no direct code, try to extract from title
    if (!couponCode && discountData.title) {
      couponCode = extractCouponCodeFromTitle(discountData.title);
      console.log(`📝 Extracted code from title: ${couponCode}`);
    }
    
    // If still no code, fetch from Shopify API
    if (!couponCode) {
      couponCode = await getCouponCodeFromShopify(discountId);
    }
    
    if (!couponCode) {
      console.warn('⚠️ No coupon code found in webhook data or Shopify API');
      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no coupon code found'
      });
    }
    
    console.log(`📝 New discount: ${couponCode} (${discountId}) - Status: ${status}`);
    
    // Find local coupon by code and update Shopify ID if missing
    const localCoupon = await getCouponByCode(couponCode);
    
    if (localCoupon && !localCoupon.shopify_discount_id) {
      console.log(`🔗 Linking local coupon ${couponCode} to Shopify ID ${discountId}`);
      await updateShopifySync(couponCode, discountId, true, status === 'ACTIVE' ? 'active' : 'disabled');
    } else if (!localCoupon) {
      console.warn(`⚠️ Local coupon not found for ${couponCode}`);
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
    
    const discountId = discountData.admin_graphql_api_id || `gid://shopify/DiscountCodeNode/${discountData.id}`;
    let couponCode = discountData.code;
    const shopifyStatus = discountData.status; // 'ACTIVE', 'EXPIRED', etc.
    
    // If no direct code, try to extract from title
    if (!couponCode && discountData.title) {
      couponCode = extractCouponCodeFromTitle(discountData.title);
      console.log(`📝 Extracted code from title: ${couponCode}`);
    }
    
    // If still no code, fetch from Shopify API
    if (!couponCode) {
      couponCode = await getCouponCodeFromShopify(discountId);
    }
    
    // Try to find local coupon by Shopify ID first
    let localCoupon = await getCouponByShopifyId(discountId);
    
    // If still no coupon code but we found local coupon, use its code
    if (!couponCode && localCoupon) {
      couponCode = localCoupon.code;
      console.log(`📝 Using code from local coupon: ${couponCode}`);
    }
    
    if (!couponCode) {
      console.warn('⚠️ No coupon code found in webhook data, title, or Shopify API');
      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no coupon code found'
      });
    }
    
    console.log(`📝 Updated discount: ${couponCode} (${discountId}) - New Status: ${shopifyStatus}`);
    
    // Find local coupon if we haven't already
    if (!localCoupon) {
      localCoupon = await getCouponByCode(couponCode);
    }
    
    if (!localCoupon) {
      console.warn(`⚠️ Local coupon not found for ${couponCode} (${discountId})`);
      return NextResponse.json({
        success: true,
        message: `Webhook received but coupon not found locally: ${couponCode}`
      });
    }
    
    // Map Shopify status to local status
    const newLocalStatus = shopifyStatus === 'ACTIVE' ? 'active' : 'disabled';
    
    // Update local status if different
    if (localCoupon.shopify_status !== newLocalStatus) {
      console.log(`🔄 Updating local status for ${couponCode}: ${localCoupon.shopify_status} → ${newLocalStatus}`);
      
      await updateShopifyStatus(couponCode, newLocalStatus);
      
      // If disabled in Shopify and still active locally, deactivate locally too
      if (newLocalStatus === 'disabled' && localCoupon.status === 'active') {
        console.log(`🔒 Deactivating local coupon ${couponCode} due to Shopify disable`);
        await deactivateLocalCoupon(couponCode, 'Webhook: Disabled in Shopify');
        
        return NextResponse.json({
          success: true,
          message: `Coupon ${couponCode} disabled locally due to Shopify deactivation`,
          action: 'deactivated_locally'
        });
      }
      
      return NextResponse.json({
        success: true,
        message: `Updated ${couponCode} status to ${newLocalStatus}`,
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
    
    const discountId = discountData.admin_graphql_api_id || `gid://shopify/DiscountCodeNode/${discountData.id}`;
    let couponCode = discountData.code;
    
    // If no direct code, try to extract from title
    if (!couponCode && discountData.title) {
      couponCode = extractCouponCodeFromTitle(discountData.title);
      console.log(`📝 Extracted code from title: ${couponCode}`);
    }
    
    // Try to find local coupon by Shopify ID first
    let localCoupon = await getCouponByShopifyId(discountId);
    
    // If still no coupon code but we found local coupon, use its code
    if (!couponCode && localCoupon) {
      couponCode = localCoupon.code;
      console.log(`📝 Using code from local coupon: ${couponCode}`);
    }
    
    if (!couponCode) {
      console.warn('⚠️ No coupon code found for deletion webhook');
      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no coupon code found'
      });
    }
    
    console.log(`📝 Deleted discount: ${couponCode} (${discountId})`);
    
    // Find local coupon if we haven't already
    if (!localCoupon) {
      localCoupon = await getCouponByCode(couponCode);
    }
    
    if (localCoupon) {
      // Update local status to reflect Shopify deletion
      await updateShopifyStatus(couponCode, 'deleted');
      
      // Deactivate locally if still active
      if (localCoupon.status === 'active') {
        await deactivateLocalCoupon(couponCode, 'Webhook: Deleted from Shopify');
        
        return NextResponse.json({
          success: true,
          message: `Coupon ${couponCode} deactivated locally due to Shopify deletion`,
          action: 'deactivated_locally'
        });
      }
    } else {
      console.warn(`⚠️ Local coupon not found for deletion: ${couponCode}`);
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

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Shopify webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}