"use client";
import { useState } from "react";

export default function StorePanel() {
  const [formData, setFormData] = useState({
    couponCode: "",
    employeeCode: "",
    storeLocation: "Aminjikarai",
  });
  const [message, setMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [couponDetails, setCouponDetails] = useState(null);

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
      !formData.storeLocation
    ) {
      setMessage("Error: All fields are required");
      setIsValidating(false);
      return;
    }

    try {
      const requestBody = {
        code: formData.couponCode.trim().toUpperCase(),
        employeeCode: formData.employeeCode.trim(),
        storeLocation: formData.storeLocation, // Send as string instead of integer
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🏪</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Store Panel
                </h1>
                <p className="text-sm text-gray-500">
                  Validate and manage coupon codes
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                🟢 Online
              </span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Coupon Details */}
          {couponDetails && (
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>Coupon Details</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Code:</span>
                  <p className="font-mono text-lg font-bold text-gray-800">
                    {couponDetails.code || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Status:</span>
                  <p
                    className={`font-semibold ${
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
                <div>
                  <span className="text-blue-600 font-medium">Employee:</span>
                  <p className="font-semibold text-gray-800">
                    {couponDetails.employee_code || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Store:</span>
                  <p className="font-semibold text-gray-800">
                    {couponDetails.store_location || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-blue-600 font-medium">Validated:</span>
                  <p className="text-gray-700">
                    {couponDetails.used_date
                      ? new Date(couponDetails.used_date).toLocaleString()
                      : "Not used yet"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Validation Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">✅</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Coupon Validation
                    </h2>
                    <p className="text-blue-100 text-sm">
                      Enter coupon details to validate and process
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-8">

                {/* Success/Error Message */}
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-lg uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
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
