// src/app/view/[code]/page.js - Updated with QR Code
"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ScratchCard from "@/components/ScratchCard";
import QRCode from "@/components/QRCode";

export default function ViewCoupon() {
  const params = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasScratched, setHasScratched] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
      }
    } catch (error) {
      console.error("Error scratching coupon:", error);
    }
  };

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = currentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
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
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 max-w-6xl mx-auto">
        {/* Scratch Card */}
        <div className="flex-shrink-0">
          {hasScratched ? (
            <div className="relative w-[400px] h-[250px]">
              <div className="bg-red-500 rounded-lg shadow-lg border-4 border-red-500 p-8 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {coupon.code}
                </h2>
                <p className="text-lg text-white font-semibold pb-2">
                  Congratulations! Coupon code
                </p>
                <div className="flex justify-center mb-4">
                  <QRCode
                    text={currentUrl}
                    size={200}
                    className="border-2 border-gray-100 rounded-lg"
                  />
                </div>
                <div className="text-sm text-white/80 mt-4">
                  <p>
                    Scratched on:{" "}
                    {new Date(coupon.scratched_date).toLocaleDateString()}
                  </p>
                  <p>
                    at {new Date(coupon.scratched_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ScratchCard couponCode={coupon.code} onScratch={handleScratch} />
          )}
        </div>
      </div>
    </div>
  );
}
