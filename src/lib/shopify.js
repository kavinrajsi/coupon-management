import { createAdminApiClient } from '@shopify/admin-api-client';

// Add debugging
console.log('Shopify Config Check:');
console.log('Store URL:', process.env.SHOPIFY_STORE_URL);
console.log('Access Token exists:', !!process.env.SHOPIFY_ACCESS_TOKEN);
console.log('API Version:', process.env.SHOPIFY_API_VERSION);

const client = createAdminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_URL,
  apiVersion: process.env.SHOPIFY_API_VERSION || '2023-10',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});

export async function createShopifyDiscount(couponCode) {
  try {
    console.log(`🔄 Creating Shopify discount for: ${couponCode}`);
    
    // Test connection first
    const testQuery = `
      query {
        shop {
          name
          myshopifyDomain
        }
      }
    `;
    
    try {
      const testResponse = await client.request(testQuery);
      console.log('✅ Shopify connection successful:', testResponse.data.shop.name);
    } catch (testError) {
      console.error('❌ Shopify connection failed:', testError);
      throw new Error(`Connection failed: ${testError.message}`);
    }

    // Calculate dates
    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 120);
    const endDateISO = endDate.toISOString();

    console.log('📅 Date range:', { startDate, endDateISO });

    // Updated GraphQL mutation with proper structure
    const discountCodeCreate = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
                status
                summary
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables = {
      basicCodeDiscount: {
        title: `API Coupon Code ${couponCode}`,
        code: couponCode,
        startsAt: startDate,
        endsAt: endDateISO,
        customerSelection: {
          all: true
        },
        customerGets: {
          value: {
            discountAmount: {
              amount: "1000.00",
              appliesOnEachItem: false
            }
          },
          items: {
            all: true
          }
        },
        minimumRequirement: {
          subtotal: {
            greaterThanOrEqualToSubtotal: "1000.00"
          }
        },
        usageLimit: 1,
        appliesOncePerCustomer: true,
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false
        }
      }
    };

    console.log('📤 Sending mutation variables:', JSON.stringify(variables, null, 2));

    const response = await client.request(discountCodeCreate, {
      variables,
    });

    console.log('📥 Shopify response:', JSON.stringify(response, null, 2));

    if (response.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
      const errors = response.data.discountCodeBasicCreate.userErrors;
      console.error('❌ Shopify user errors:', errors);
      
      throw new Error(
        errors.map(error => `${error.field}: ${error.message} (${error.code})`).join(', ')
      );
    }

    const discountNode = response.data?.discountCodeBasicCreate?.codeDiscountNode;
    if (!discountNode) {
      throw new Error('No discount node returned from Shopify');
    }

    console.log('✅ Shopify discount created successfully:', discountNode.id);

    return {
      success: true,
      shopifyId: discountNode.id,
      message: 'Discount created successfully in Shopify'
    };

  } catch (error) {
    console.error('❌ Shopify discount creation error:', error);
    
    // More specific error messages
    if (error.message.includes('Unauthorized')) {
      return {
        success: false,
        message: 'Invalid Shopify access token. Please check your credentials.'
      };
    }
    
    if (error.message.includes('not found')) {
      return {
        success: false,
        message: 'Shopify store not found. Please check SHOPIFY_STORE_URL.'
      };
    }
    
    if (error.message.includes('rate limit')) {
      return {
        success: false,
        message: 'Shopify API rate limit exceeded. Please try again later.'
      };
    }

    return {
      success: false,
      message: `Shopify API Error: ${error.message}`,
      details: error
    };
  }
} 