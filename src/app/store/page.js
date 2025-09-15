"use client";
import { useState } from "react";
import QRScanner from '@/components/QRScanner';

export default function StorePanel() {
  const [formData, setFormData] = useState({
    couponCode: "",
    employeeCode: "",
    storeLocation: "Aminjikarai",
    orderId: "", // ✅ Added orderId
  });
  const [message, setMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [couponDetails, setCouponDetails] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");

  // Chennai store locations
  const storeLocations = [
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
    "Online Shopify"
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsValidating(true);
    setMessage("");
    setCouponDetails(null);

    // Client-side validation
    if (
      !formData.couponCode ||
      !formData.employeeCode ||
      !formData.storeLocation ||
      !formData.orderId
    ) {
      setMessage("Error: All fields are required");
      setIsValidating(false);
      return;
    }

    try {
      const requestBody = {
        code: formData.couponCode.trim().toUpperCase(),
        employeeCode: formData.employeeCode.trim(),
        storeLocation: formData.storeLocation,
        orderId: formData.orderId.trim(), // ✅ Added orderId
      };

      console.log("Validating coupon:", requestBody);

      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("Validation response:", data);

      setMessage(data.message);

      // Show coupon details if available
      if (data.couponDetails) {
        setCouponDetails(data.couponDetails);
      }

      if (data.success) {
        setFormData({
          couponCode: "",
          employeeCode: "",
          storeLocation: "Aminjikarai",
          orderId: "", // ✅ reset
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // Handle QR scanner results
  const handleQRScan = (couponCode, fullUrl) => {
    console.log('QR Code scanned:', { couponCode, fullUrl });
    
    // Update form with scanned coupon code
    setFormData(prev => ({
      ...prev,
      couponCode: couponCode
    }));
    
    setScannerMessage(`✅ Scanned coupon: ${couponCode}`);
    
    // Clear scanner message after 3 seconds
    setTimeout(() => {
      setScannerMessage("");
    }, 3000);

    // Auto-focus on employee code field if it's empty
    if (!formData.employeeCode) {
      const employeeInput = document.querySelector('input[placeholder="EMP001"]');
      if (employeeInput) {
        employeeInput.focus();
      }
    }
  };

  const handleScanError = (error) => {
    console.error('Scanner error:', error);
    setScannerMessage(`❌ Scanner error: ${error.message}`);
    setTimeout(() => {
      setScannerMessage("");
    }, 5000);
  };

  const toggleScanner = () => {
    setShowScanner(!showScanner);
    setScannerMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Coupon Details */}
        {couponDetails && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4">
                <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <span>📋</span>
                  <span>Coupon Details</span>
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-blue-600 font-medium text-sm">Code</p>
                    <p className="font-mono text-xl font-bold text-blue-800">
                      {couponDetails.code || "N/A"}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-green-600 font-medium text-sm">Status</p>
                    <p
                      className={`font-semibold text-lg ${
                        couponDetails.status === "used"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {couponDetails.status
                        ? couponDetails.status.toUpperCase()
                        : "UNKNOWN"}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-purple-600 font-medium text-sm">Employee</p>
                    <p className="font-semibold text-lg text-purple-800">
                      {couponDetails.employee_code || "N/A"}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-orange-600 font-medium text-sm">Store</p>
                    <p className="font-semibold text-lg text-orange-800">
                      {couponDetails.store_location || "N/A"}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-yellow-600 font-medium text-sm">Order ID</p>
                    <p className="font-semibold text-lg text-yellow-800">
                      {couponDetails.order_id ?? couponDetails.orderId ?? "N/A"}
                    </p>
                  </div>
                </div>
                
                {couponDetails.used_date && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 font-medium text-sm">Validated On:</p>
                    <p className="text-gray-800 font-semibold">
                      {new Date(couponDetails.used_date).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Scanner Section */}
          <div className="order-1 lg:order-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">📷</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">QR Code Scanner</h2>
                      <p className="text-green-100 text-sm">Scan coupon QR codes instantly</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleScanner}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showScanner
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-white text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {showScanner ? '📷 Stop Scanner' : '📱 Start Scanner'}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {scannerMessage && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    scannerMessage.includes('✅') 
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <p className="text-sm font-medium">{scannerMessage}</p>
                  </div>
                )}

                <QRScanner
                  isActive={showScanner}
                  onScan={handleQRScan}
                  onError={handleScanError}
                />

                {!showScanner && (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📱</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">QR Scanner Ready</h3>
                    <p className="text-gray-600 mb-4">
                      Click &quot;Start Scanner&quot; to begin scanning QR codes from coupon cards
                    </p>
                    <div className="bg-blue-50 rounded-lg p-4 text-left">
                      <p className="text-sm text-blue-700 font-medium">📋 How it works:</p>
                      <ul className="text-sm text-blue-600 mt-2 space-y-1">
                        <li>• Start the scanner above</li>
                        <li>• Point camera at coupon QR code</li>
                        <li>• Code will auto-fill in the form</li>
                        <li>• Complete employee, order & store info</li>
                        <li>• Validate the coupon!</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manual Validation Form */}
          <div className="order-2 lg:order-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">✅</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Manual Validation
                    </h2>
                    <p className="text-blue-100 text-sm">
                      Enter coupon details manually or use scanner
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {message && (
                  <div
                    className={`mb-6 p-4 rounded-xl border-l-4 ${
                      message.includes("Error") ||
                      message.includes("not") ||
                      message.includes("already")
                        ? "bg-red-50 border-red-400 text-red-700"
                        : "bg-green-50 border-green-400 text-green-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {message.includes("Error") ? "❌" : "✅"}
                      </span>
                      <span className="font-medium">{message}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Coupon Code Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>🎫</span>
                        <span>Coupon Code</span>
                        {formData.couponCode && (
                          <span className="text-green-600 text-xs">(Auto-filled by scanner)</span>
                        )}
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.couponCode}
                        onChange={(e) =>
                          handleInputChange("couponCode", e.target.value)
                        }
                        onKeyPress={handleKeyPress}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-lg uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800 ${
                          formData.couponCode ? 'bg-green-50 border-green-300' : ''
                        }`}
                        placeholder="ABC123"
                        maxLength="6"
                        minLength="6"
                      />
                      <div className="absolute right-3 top-3 text-gray-400">
                        <span className="text-sm">
                          {formData.couponCode.length}/6
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Employee Code Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>👤</span>
                        <span>Employee Code</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.employeeCode}
                      onChange={(e) =>
                        handleInputChange("employeeCode", e.target.value)
                      }
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                      placeholder="EMP001"
                    />
                  </div>

                  {/* Order ID Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>🧾</span>
                        <span>Order ID</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.orderId}
                      onChange={(e) =>
                        handleInputChange("orderId", e.target.value)
                      }
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                      placeholder="ORD12345"
                    />
                  </div>

                  {/* Store Location Select */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>📍</span>
                        <span>Store Location</span>
                      </span>
                    </label>
                    <select
                      value={formData.storeLocation}
                      onChange={(e) =>
                        handleInputChange("storeLocation", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                    >
                      {storeLocations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={isValidating}
                      className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 transform ${
                        isValidating
                          ? "bg-gray-400 cursor-not-allowed scale-95"
                          : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {isValidating ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>Validating...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center space-x-2">
                          <span>✨</span>
                          <span>Validate Coupon</span>
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
