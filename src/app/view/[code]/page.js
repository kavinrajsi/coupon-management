// src/app/view/[code]/page.js
"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ScratchCard from "@/components/ScratchCard";

export default function ViewCoupon() {
  const params = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasScratched, setHasScratched] = useState(false);

  useEffect(() => {
    if (params.code) {
      fetchCoupon(params.code);
    }
  }, [params.code]);

  const fetchCoupon = async (code) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/coupons?code=${code}`);
      const data = await response.json();

      if (data.success && data.coupons && data.coupons.length > 0) {
        const couponData = data.coupons[0];
        setCoupon(couponData);
        setHasScratched(couponData.is_scratched);
      } else {
        setError("Coupon not found");
      }
    } catch (error) {
      console.error("Error fetching coupon:", error);
      setError("Error loading coupon");
    } finally {
      setLoading(false);
    }
  };

  const handleScratch = async (code) => {
    try {
      const response = await fetch("/api/coupons/scratch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (data && data.success) {
        setHasScratched(true);
        setCoupon((prev) => ({
          ...prev,
          is_scratched: true,
          scratched_date: new Date().toISOString(),
        }));
      } else {
        setHasScratched(true);
        setCoupon((prev) => ({
          ...prev,
          is_scratched: true,
          scratched_date: new Date().toISOString(),
        }));
        // const errorMessage = data?.message || 'Failed to scratch coupon';
        // console.error('Scratch error:', errorMessage);
        // // Optionally show error to user
        // setError(errorMessage);
      }
    } catch (error) {
      console.error("Error scratching coupon:", error);
      // Optionally show error to user
      // setError('Network error occurred while scratching coupon');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your scratch card...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Oops!</h1>
          <p className="text-red-500">{error}</p>
          <p className="text-gray-500 text-sm mt-2">
            Please check your coupon code and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="flex justify-center">
        {hasScratched ? (
          <div className="relative w-[400px] h-[250px]">
            <div className="bg-red-500 rounded-lg shadow-lg border-4 border-red-500 rounded-lg shadow-lg p-8 text-center max-w-md w-full">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-white-800 mb-2">
                {coupon.code}
              </h2>
              <p className="text-lg text-white-700 font-semibold">
                Congratulations!
              </p>
              <p className="text-lg text-white-700 font-semibold">
                You&apos;ve won a prize!
              </p>
              <div className="text-sm text-white-600 mt-2">
                <p>
                  Scratched on:{" "}
                  {new Date(coupon.scratched_date).toLocaleDateString()}
                </p>
                <p>at {new Date(coupon.scratched_date).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        ) : (
          // Not scratched yet - show interactive scratch card
          <ScratchCard couponCode={coupon.code} onScratch={handleScratch} />
        )}
      </div>
    </div>
  );
}
