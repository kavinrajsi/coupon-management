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

    // GraphQL mutation to create discount
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
        title: `Coupon Discount ${couponCode}`,
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

export async function disableShopifyDiscount(shopifyDiscountId) {
  try {
    console.log(`🔒 Disabling Shopify discount: ${shopifyDiscountId}`);

    const discountCodeDeactivate = `
      mutation discountCodeDeactivate($id: ID!) {
        discountCodeDeactivate(id: $id) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
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

    const response = await client.request(discountCodeDeactivate, {
      variables: { id: shopifyDiscountId }
    });

    console.log('📥 Shopify deactivate response:', JSON.stringify(response, null, 2));

    if (response.data?.discountCodeDeactivate?.userErrors?.length > 0) {
      const errors = response.data.discountCodeDeactivate.userErrors;
      console.error('❌ Shopify deactivate errors:', errors);
      
      throw new Error(
        errors.map(error => `${error.field}: ${error.message} (${error.code})`).join(', ')
      );
    }

    const discountNode = response.data?.discountCodeDeactivate?.codeDiscountNode;
    if (!discountNode) {
      throw new Error('No discount node returned from Shopify deactivation');
    }

    console.log('✅ Shopify discount disabled successfully:', discountNode.id);

    return {
      success: true,
      shopifyId: discountNode.id,
      status: discountNode.codeDiscount?.status,
      message: 'Discount disabled successfully in Shopify'
    };

  } catch (error) {
    console.error('❌ Shopify discount deactivation error:', error);
    
    // Handle specific errors
    if (error.message.includes('not found')) {
      return {
        success: false,
        message: 'Discount not found in Shopify (may already be deleted)'
      };
    }
    
    if (error.message.includes('Unauthorized')) {
      return {
        success: false,
        message: 'Unauthorized: Check Shopify access token permissions'
      };
    }

    return {
      success: false,
      message: `Failed to disable Shopify discount: ${error.message}`,
      details: error
    };
  }
}

export async function deleteShopifyDiscount(shopifyId) {
  try {
    console.log(`🗑️ Deleting Shopify discount: ${shopifyId}`);

    const discountCodeDelete = `
      mutation discountCodeDelete($id: ID!) {
        discountCodeDelete(id: $id) {
          deletedCodeDiscountId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(discountCodeDelete, {
      variables: { id: shopifyId }
    });

    console.log('📥 Shopify delete response:', JSON.stringify(response, null, 2));

    if (response.data?.discountCodeDelete?.userErrors?.length > 0) {
      throw new Error(
        response.data.discountCodeDelete.userErrors
          .map(error => error.message)
          .join(', ')
      );
    }

    console.log('✅ Shopify discount deleted successfully');

    return {
      success: true,
      message: 'Discount deleted from Shopify'
    };

  } catch (error) {
    console.error('❌ Shopify discount deletion error:', error);
    return {
      success: false,
      message: `Failed to delete Shopify discount: ${error.message}`
    };
  }
}

export async function getShopifyDiscountStatus(shopifyDiscountId) {
  try {
    console.log(`📊 Getting Shopify discount status: ${shopifyDiscountId}`);

    const query = `
      query getDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            ... on DiscountCodeBasic {
              title
              status
              codes(first: 1) {
                nodes {
                  code
                }
              }
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              customerGets {
                value {
                  ... on DiscountAmount {
                    amount {
                      amount
                    }
                  }
                }
              }
              minimumRequirement {
                ... on DiscountMinimumSubtotal {
                  greaterThanOrEqualToSubtotal {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: { id: shopifyDiscountId }
    });

    console.log('📥 Shopify status response:', JSON.stringify(response, null, 2));

    return {
      success: true,
      discount: response.data?.discountNode?.discount
    };

  } catch (error) {
    console.error('❌ Error getting Shopify discount status:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

export async function listShopifyDiscounts(limit = 50) {
  try {
    console.log('📋 Listing Shopify discounts...');

    const query = `
      query listDiscounts($first: Int!) {
        codeDiscountNodes(first: $first) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: { first: limit }
    });

    console.log(`📥 Found ${response.data?.codeDiscountNodes?.nodes?.length || 0} discounts`);

    return {
      success: true,
      discounts: response.data?.codeDiscountNodes?.nodes || [],
      pageInfo: response.data?.codeDiscountNodes?.pageInfo
    };

  } catch (error) {
    console.error('❌ Error listing Shopify discounts:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

export async function syncShopifyStatusToLocal() {
  try {
    console.log('🔄 Starting Shopify to Local status sync...');

    // Get all discounts from Shopify
    const shopifyDiscounts = await listShopifyDiscounts(250); // Get up to 250 discounts
    
    if (!shopifyDiscounts.success) {
      throw new Error(`Failed to fetch Shopify discounts: ${shopifyDiscounts.message}`);
    }

    const results = [];
    
    for (const discountNode of shopifyDiscounts.discounts) {
      const discount = discountNode.codeDiscount;
      const couponCode = discount.codes?.nodes?.[0]?.code;
      const shopifyStatus = discount.status; // 'ACTIVE' or 'EXPIRED' or other statuses
      
      if (!couponCode) {
        console.warn('⚠️ Discount without code found, skipping:', discountNode.id);
        continue;
      }

      // Map Shopify status to local status
      let localStatus;
      let localShopifyStatus;
      
      switch (shopifyStatus) {
        case 'ACTIVE':
          localShopifyStatus = 'active';
          break;
        case 'EXPIRED':
        case 'SCHEDULED':
          localShopifyStatus = 'disabled';
          break;
        default:
          localShopifyStatus = 'disabled';
      }

      results.push({
        couponCode,
        shopifyId: discountNode.id,
        shopifyStatus,
        localShopifyStatus,
        synced: false
      });
    }

    return {
      success: true,
      discounts: results,
      message: `Found ${results.length} discounts to sync`
    };

  } catch (error) {
    console.error('❌ Error syncing Shopify status to local:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

export async function checkAndSyncSpecificCoupon(couponCode) {
  try {
    console.log(`🔍 Checking Shopify status for coupon: ${couponCode}`);
    
    // Import database functions
    const { getCouponByCode, updateShopifyStatus } = await import('./database.js');
    
    // Get local coupon
    const localCoupon = getCouponByCode(couponCode);
    
    if (!localCoupon || !localCoupon.shopify_discount_id) {
      return {
        success: false,
        message: 'Coupon not found or not synced to Shopify'
      };
    }

    // Get Shopify status
    const shopifyStatus = await getShopifyDiscountStatus(localCoupon.shopify_discount_id);
    
    if (!shopifyStatus.success) {
      return {
        success: false,
        message: `Failed to get Shopify status: ${shopifyStatus.message}`
      };
    }

    const discount = shopifyStatus.discount;
    const shopifyDiscountStatus = discount?.status;
    
    // Map Shopify status to local status
    let newLocalStatus;
    switch (shopifyDiscountStatus) {
      case 'ACTIVE':
        newLocalStatus = 'active';
        break;
      case 'EXPIRED':
      case 'SCHEDULED':
      default:
        newLocalStatus = 'disabled';
    }

    // Update local status if different
    if (localCoupon.shopify_status !== newLocalStatus) {
      console.log(`🔄 Updating local status for ${couponCode}: ${localCoupon.shopify_status} → ${newLocalStatus}`);
      
      updateShopifyStatus(couponCode, newLocalStatus);
      
      // If Shopify is disabled and local coupon is still active, deactivate locally too
      if (newLocalStatus === 'disabled' && localCoupon.status === 'active') {
        const { deactivateLocalCoupon } = await import('./database.js');
        deactivateLocalCoupon(couponCode, 'Deactivated due to Shopify sync');
      }
      
      return {
        success: true,
        message: `Updated local status to ${newLocalStatus}`,
        updated: true,
        oldStatus: localCoupon.shopify_status,
        newStatus: newLocalStatus
      };
    }

    return {
      success: true,
      message: 'Status already in sync',
      updated: false
    };

  } catch (error) {
    console.error('❌ Error checking specific coupon:', error);
    return {
      success: false,
      message: error.message
    };
  }
}


export async function testShopifyConnection() {
  try {
    console.log('🧪 Testing Shopify connection...');

    const query = `
      query {
        shop {
          name
          email
          myshopifyDomain
          plan {
            displayName
          }
          currencyCode
        }
      }
    `;

    const response = await client.request(query);
    
    console.log('✅ Shopify connection test successful!');
    
    return {
      success: true,
      shop: response.data.shop,
      message: 'Connection successful'
    };

  } catch (error) {
    console.error('❌ Shopify connection test failed:', error);
    
    return {
      success: false,
      message: error.message,
      details: error
    };
  }
}

// Export the client as default
export default client;