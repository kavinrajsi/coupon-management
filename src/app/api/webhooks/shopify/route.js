// src/app/api/webhooks/shopify/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getCouponByCode, getCouponByShopifyId, validateCoupon, initDatabase, updateShopifyStatus, deactivateLocalCoupon } from '@/lib/supabase';
import { disableShopifyDiscount } from '@/lib/shopify';

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
    
    // Get headers
    const headersList = await headers();
    const shopifyTopic = headersList.get('X-Shopify-Topic');
    const shopifySignature = headersList.get('X-Shopify-Hmac-Sha256');
    
    console.log('📋 Webhook details:', {
      topic: shopifyTopic,
      shop: headersList.get('X-Shopify-Shop-Domain'),
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
      // Discount-related webhooks
      case 'discount_codes/create':
      case 'discounts/create':
        return handleDiscountCreate(webhookData);
      
      case 'discount_codes/update':
      case 'discounts/update':
        return handleDiscountUpdate(webhookData);
      
      case 'discount_codes/delete':
      case 'discounts/delete':
        return handleDiscountDelete(webhookData);
      
      // Order-related webhooks
      case 'orders/create':
      case 'orders/paid':
        return handleOrderCreated(webhookData);
      
      case 'orders/updated':
        return handleOrderUpdated(webhookData);
      
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

// ORDER WEBHOOK HANDLERS
// Handle order creation/payment
async function handleOrderCreated(orderData) {
  try {
    console.log('🆕 Processing order creation/payment webhook');
    
    const orderId = orderData.id;
    const orderNumber = orderData.order_number || orderData.name;
    const discountApplications = orderData.discount_applications || [];
    
    console.log(`📦 Order ${orderNumber} (${orderId}) with ${discountApplications.length} discounts`);
    
    let processedCoupons = 0;
    const results = [];
    
    // Process each discount application
    for (const discount of discountApplications) {
      if (discount.type === 'discount_code') {
        const couponCode = discount.code;
        console.log(`🎫 Processing coupon: ${couponCode}`);
        
        // Check if coupon exists in our system
        const localCoupon = await getCouponByCode(couponCode);
        
        if (!localCoupon) {
          console.warn(`⚠️ Coupon ${couponCode} not found in local database`);
          results.push({
            code: couponCode,
            success: false,
            message: 'Coupon not found in local database'
          });
          continue;
        }
        
        if (localCoupon.status === 'used') {
          console.log(`ℹ️ Coupon ${couponCode} already marked as used`);
          results.push({
            code: couponCode,
            success: true,
            message: 'Coupon already marked as used'
          });
          continue;
        }
        
        // Mark coupon as used - use "Online Shopify" as a valid store location
        const validationResult = await validateCoupon(
          couponCode, 
          'SHOPIFY_ORDER', 
          'Online Shopify'
        );
        
        if (validationResult.success) {
          console.log(`✅ Marked coupon ${couponCode} as used for order ${orderNumber}`);
          processedCoupons++;
          
          // Also disable the discount in Shopify to prevent reuse
          if (localCoupon.shopify_discount_id) {
            try {
              const shopifyResult = await disableShopifyDiscount(localCoupon.shopify_discount_id);
              if (shopifyResult.success) {
                console.log(`🔒 Also disabled coupon ${couponCode} in Shopify`);
                await updateShopifyStatus(couponCode, 'disabled');
              }
            } catch (shopifyError) {
              console.warn(`⚠️ Failed to disable coupon ${couponCode} in Shopify:`, shopifyError);
            }
          }
          
          results.push({
            code: couponCode,
            success: true,
            message: `Marked as used for order ${orderNumber}`,
            shopifyDisabled: !!localCoupon.shopify_discount_id
          });
        } else {
          console.error(`❌ Failed to mark coupon ${couponCode} as used:`, validationResult.message);
          results.push({
            code: couponCode,
            success: false,
            message: validationResult.message
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed order ${orderNumber}: ${processedCoupons} coupons marked as used`,
      orderId,
      orderNumber,
      processedCoupons,
      results
    });
    
  } catch (error) {
    console.error('❌ Error handling order creation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle order updates
async function handleOrderUpdated(orderData) {
  try {
    console.log('🔄 Processing order update webhook');
    
    // For order updates, we mainly care about payment status changes
    const orderId = orderData.id;
    const orderNumber = orderData.order_number || orderData.name;
    const financialStatus = orderData.financial_status;
    const discountApplications = orderData.discount_applications || [];
    
    console.log(`📦 Order ${orderNumber} updated - Financial Status: ${financialStatus}`);
    
    // Only process if order is paid and has discount codes
    if (financialStatus === 'paid' && discountApplications.length > 0) {
      return handleOrderCreated(orderData); // Reuse the same logic
    }
    
    return NextResponse.json({
      success: true,
      message: `Order ${orderNumber} update processed - no action needed`,
      financialStatus
    });
    
  } catch (error) {
    console.error('❌ Error handling order update:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DISCOUNT WEBHOOK HANDLERS
// Handle discount creation
async function handleDiscountCreate(discountData) {
  try {
    console.log('🆕 Processing discount creation webhook');
    
    // Extract coupon information
    const discountId = discountData.admin_graphql_api_id || `gid://shopify/DiscountCodeNode/${discountData.id}`;
    let couponCode = discountData.code;
    
    // If no direct code, try to extract from title
    if (!couponCode && discountData.title) {
      couponCode = extractCouponCodeFromTitle(discountData.title);
      console.log(`📝 Extracted code from title: ${couponCode}`);
    }
    
    if (!couponCode) {
      console.warn('⚠️ No coupon code found in discount creation webhook');
      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no coupon code found'
      });
    }
    
    console.log(`📝 Created discount: ${couponCode} (${discountId})`);
    
    // Check if we have this coupon in our local database
    const localCoupon = await getCouponByCode(couponCode);
    
    if (localCoupon) {
      // Update the Shopify ID if we have the coupon locally
      console.log(`🔗 Linking local coupon ${couponCode} to Shopify discount ${discountId}`);
      
      await updateShopifyStatus(couponCode, 'active', discountId);
      
      return NextResponse.json({
        success: true,
        message: `Linked local coupon ${couponCode} to Shopify discount`,
        action: 'linked'
      });
    } else {
      console.log(`ℹ️ Discount ${couponCode} created in Shopify but not found locally`);
      
      return NextResponse.json({
        success: true,
        message: `Discount ${couponCode} noted but not managed locally`,
        action: 'noted'
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling discount creation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle discount updates
async function handleDiscountUpdate(discountData) {
  try {
    console.log('🔄 Processing discount update webhook');
    
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
      console.warn('⚠️ No coupon code found for update webhook');
      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no coupon code found'
      });
    }
    
    console.log(`📝 Updated discount: ${couponCode} (${discountId})`);
    
    // If we didn't find by Shopify ID, try by code
    if (!localCoupon) {
      localCoupon = await getCouponByCode(couponCode);
    }
    
    if (!localCoupon) {
      console.log(`ℹ️ Discount ${couponCode} updated in Shopify but not found locally`);
      return NextResponse.json({
        success: true,
        message: `Discount ${couponCode} noted but not managed locally`
      });
    }
    
    // Determine Shopify status from webhook data
    const newLocalStatus = (discountData.status === 'ACTIVE' && !discountData.ends_at) ? 
        'active' : 'disabled';
    
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
      // Clear the Shopify reference and update status
      console.log(`🔗 Unlinking local coupon ${couponCode} from deleted Shopify discount`);
      
      await updateShopifyStatus(couponCode, 'not_synced', null);
      
      return NextResponse.json({
        success: true,
        message: `Unlinked local coupon ${couponCode} from deleted Shopify discount`,
        action: 'unlinked'
      });
    } else {
      console.log(`ℹ️ Discount ${couponCode} deleted in Shopify but not found locally`);
      
      return NextResponse.json({
        success: true,
        message: `Discount ${couponCode} deletion noted`,
        action: 'noted'
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling discount deletion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Extract coupon code from discount title (fallback method)
function extractCouponCodeFromTitle(title) {
  // Pattern: "Coupon Discount ABC123" -> extract "ABC123"
  const match = title?.match(/Coupon Discount ([A-Z]{3}\d{3})/);
  return match ? match[1] : null;
}

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Shopify webhook endpoint is active',
    timestamp: new Date().toISOString(),
    supportedTopics: [
      'discount_codes/create',
      'discount_codes/update', 
      'discount_codes/delete',
      'orders/create',
      'orders/paid',
      'orders/updated'
    ]
  });
}