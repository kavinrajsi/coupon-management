import { NextResponse } from "next/server";
import {
  validateCoupon,
  getCouponByCode,
  initDatabase,
  updateShopifyStatus,
} from "@/lib/supabase";
import {
  disableShopifyDiscount,
  appendOrderNote,
  addOrderCouponLogMetafield,
} from "@/lib/shopify";

// Valid Chennai store locations
const VALID_STORE_LOCATIONS = [
  "Aminjikarai",
  "Anna Nagar East",
  "Arumbakkam",
  "Kanchipuram",
  "Kilpauk",
  "Mogappair",
  "Mylapore",
  "Nerkundram",
  "Nungambakkam",
  "Perambur",
  "Saligramam",
  "Thiruvallur",
  "Washermenpet",
  "Adyar",
  "Online Shopify",
];

export async function POST(request) {
  try {
    await initDatabase();

    const body = await request.json();
    console.log("Received request body:", body);

    const { code, employeeCode, storeLocation, orderId } = body; // ✅ orderId added

    if (!code || !employeeCode || !storeLocation || !orderId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing required fields. Please fill in all fields (coupon, employee, store, orderId).",
        },
        { status: 400 }
      );
    }

    // Validate store location
    if (!VALID_STORE_LOCATIONS.includes(storeLocation)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid store location: "${storeLocation}". Please select a valid Chennai store location.`,
        },
        { status: 400 }
      );
    }

    // First, get the coupon details
    let coupon = await getCouponByCode(code);
    console.log("Coupon found:", coupon);

    if (!coupon) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" not found in database. Please check if the coupon code is correct.`,
        couponDetails: null,
      });
    }

    if (!coupon.status) {
      console.warn(
        `⚠️ Coupon ${code} has null/undefined status, treating as inactive`
      );
      return NextResponse.json({
        success: false,
        message: `Coupon "${code}" has an invalid status in the database. Please contact system administrator.`,
        couponDetails: {
          ...coupon,
          status: coupon.status || "unknown",
        },
      });
    }

    if (coupon.status !== "active") {
      const statusMessage =
        coupon.status === "used"
          ? "This coupon has already been used."
          : coupon.status === "inactive"
          ? "This coupon has been deactivated."
          : `This coupon has status: "${coupon.status}".`;

      return NextResponse.json({
        success: false,
        message: `Coupon is not active. Current status: "${coupon.status}". ${statusMessage}`,
        couponDetails: coupon,
      });
    }

    if (coupon.used_date) {
      return NextResponse.json({
        success: false,
        message: `Coupon already used on ${new Date(
          coupon.used_date
        ).toLocaleString()} by employee ${coupon.employee_code} at ${
          coupon.store_location
        }.`,
        couponDetails: coupon,
      });
    }

    // Sync with Shopify if needed
    if (coupon.shopify_discount_id) {
      const { checkAndSyncSpecificCoupon } = await import("@/lib/shopify");
      const statusCheck = await checkAndSyncSpecificCoupon(code);

      if (statusCheck.success && statusCheck.updated) {
        console.log(
          `📋 Updated coupon status from Shopify: ${statusCheck.message}`
        );
        coupon = await getCouponByCode(code);
      }
    }

    // ✅ Pass orderId to validation
    const result = await validateCoupon(
      code,
      employeeCode,
      storeLocation,
      orderId
    );
    console.log("Validation result:", result);

    if (result.success) {
      if (result.shouldDisableShopify && result.coupon.shopify_discount_id) {
        console.log(
          `🔒 Auto-disabling Shopify discount for used coupon: ${code}`
        );

        // 📝 NEW: Add a note and a structured metafield log on the order BEFORE disabling the discount
        // 📝 NEW: Add a note and structured metafield log BEFORE disabling
        try {
          const iso = new Date().toISOString();
          const noteLine = `Coupon ${code} validated by ${employeeCode} @ ${storeLocation} on ${iso}`;

          let numericOrderId = Number(orderId);

          if (!Number.isFinite(numericOrderId)) {
            // Resolve orderId like "THQ246" to numeric ID
            const { getOrderIdByName } = await import("@/lib/shopify");
            const resolved = await getOrderIdByName(orderId);
            if (resolved?.numericId) {
              numericOrderId = Number(resolved.numericId);
              console.log(
                `🔗 Resolved order ${orderId} → numeric ID ${numericOrderId}`
              );
            }
          }

          if (Number.isFinite(numericOrderId)) {
            const noteRes = await appendOrderNote(numericOrderId, noteLine);
            if (!noteRes?.success && !noteRes?.skipped) {
              console.warn("⚠️ appendOrderNote failed:", noteRes?.message);
            }

            const metaRes = await addOrderCouponLogMetafield(numericOrderId, {
              code,
              employeeCode,
              storeLocation,
              action: "validated",
              ts: iso,
              source: "POS/API",
            });
            if (!metaRes?.success && !metaRes?.skipped) {
              console.warn(
                "⚠️ addOrderCouponLogMetafield failed:",
                metaRes?.message
              );
            }
          } else {
            console.log(
              "ℹ️ Could not resolve order ID for note/metafield:",
              orderId
            );
          }
        } catch (logErr) {
          console.warn(
            "⚠️ Failed to record order note/metafield before disabling:",
            logErr?.message || logErr
          );
        }

        // Now disable the Shopify discount
        try {
          const shopifyResult = await disableShopifyDiscount(
            result.coupon.shopify_discount_id
          );

          if (shopifyResult.success) {
            console.log("✅ Successfully disabled coupon in Shopify");
            await updateShopifyStatus(code, "disabled");

            result.shopifyDisabled = true;
            result.message += " (Also disabled in Shopify)";
          } else {
            console.warn(
              "⚠️ Failed to disable coupon in Shopify:",
              shopifyResult.message
            );
            result.shopifyDisabled = false;
            result.shopifyError = shopifyResult.message;
          }
        } catch (shopifyError) {
          console.error("❌ Error disabling coupon in Shopify:", shopifyError);
          result.shopifyDisabled = false;
          result.shopifyError = shopifyError.message;
        }
      }

      const updatedCoupon = await getCouponByCode(code);
      const normalized = {
        ...updatedCoupon,
        order_id: updatedCoupon.order_id ?? updatedCoupon.orderId,
      };
      return NextResponse.json({
        ...result,
        couponDetails: normalized,
      });
    }

    return NextResponse.json({
      ...result,
      couponDetails: coupon,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error validating coupon",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
