import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getCouponByCode, validateCoupon, initDatabase, updateShopifyStatus } from '@/lib/supabase';
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
  console.log('🛒 Order webhook received');
  
  try {
    await initDatabase();
    
    // Get headers
    const headersList = await headers();
    const shopifyTopic = headersList.get('X-Shopify-Topic');
    const shopifySignature = headersList.get('X-Shopify-Hmac-Sha256');
    
    console.log('📋 Order webhook details:', {
      topic: shopifyTopic,
      hasSignature: !!shopifySignature
    });

    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature if secret is provided
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && shopifySignature) {
      const isValid = verifyShopifyWebhook(rawBody, shopifySignature, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Webhook signature verified');
    }

    // Parse the webhook payload
    let orderData;
    try {
      orderData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse webhook JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle different order webhook topics
    switch (shopifyTopic) {
      case 'orders/create':
      case 'orders/paid':
        return handleOrderCreated(orderData);
      
      case 'orders/updated':
        return handleOrderUpdated(orderData);
      
      default:
        console.log(`⚠️ Unhandled order webhook topic: ${shopifyTopic}`);
        return NextResponse.json({ 
          success: true, 
          message: `Order webhook received but topic ${shopifyTopic} not handled` 
        });
    }

  } catch (error) {
    console.error('❌ Order webhook processing error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

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
        
        // Mark coupon as used - using order reference as store location
        const validationResult = await validateCoupon(
          couponCode, 
          'SHOPIFY_ORDER', 
          `Order ${orderNumber}`
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

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Shopify order webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}