"use client";
import { useState, useEffect } from "react";

export default function AdminPanel() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [count, setCount] = useState(10000);
  const [expirationDate, setExpirationDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Shopify sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState("");

  const itemsPerPage = 1000;

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      console.log("🔄 Frontend: Fetching coupons...");

      const response = await fetch("/api/coupons");
      console.log("📡 Frontend: API response status:", response.status);

      const data = await response.json();
      console.log("📋 Frontend: API response data:", data);

      if (data.success) {
        console.log("✅ Frontend: Setting coupons:", data.coupons?.length || 0);
        setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      } else {
        console.error("❌ Frontend: API returned error:", data.message);
        setCoupons([]);
      }
    } catch (error) {
      console.error("❌ Frontend: Fetch error:", error);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  const generateCoupons = async () => {
    setIsGenerating(true);
    setGenerationMessage("");

    // Client-side validation
    if (count < 1 || count > 10000) {
      setGenerationMessage("Error: Please enter a number between 1 and 10,000");
      setIsGenerating(false);
      return;
    }

    if (!expirationDate) {
      setGenerationMessage("Error: Please select an expiration date");
      setIsGenerating(false);
      return;
    }

    // Check if expiration date is in the future
    const selectedDate = new Date(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      setGenerationMessage("Error: Expiration date must be in the future");
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch("/api/coupons/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count,
          expirationDate: expirationDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGenerationMessage(
          `Successfully generated ${
            data.count
          } coupon codes! 🎉 Total in database: ${
            data.totalInDatabase
          }. Expires: ${new Date(expirationDate).toLocaleDateString()}`
        );
        await fetchCoupons();
      } else {
        setGenerationMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setGenerationMessage(`Error: ${error.message}`);
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Shopify sync to create discounts
  const syncToShopify = async () => {
    setIsSyncing(true);
    setSyncMessage("");

    try {
      const response = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncAll: true }),
      });

      const data = await response.json();

      if (data.success) {
        setSyncMessage(`✅ ${data.message}`);
        await fetchCoupons(); // Refresh the list
      } else {
        setSyncMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setSyncMessage(`❌ Error: ${error.message}`);
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle column sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Sort coupons (removed filtering as requested)
  const sortedCoupons = Array.isArray(coupons)
    ? coupons.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // Handle different data types
        if (sortBy === "created_date" || sortBy === "used_date") {
          aValue = new Date(aValue || 0);
          bValue = new Date(bValue || 0);
        } else if (sortBy === "store_location") {
          // Store location is now a string, so compare as strings
          aValue = (aValue || "").toLowerCase();
          bValue = (bValue || "").toLowerCase();
        } else if (sortBy === "is_scratched") {
          aValue = aValue ? 1 : 0;
          bValue = bValue ? 1 : 0;
        } else if (typeof aValue === "string") {
          aValue = (aValue || "").toLowerCase();
          bValue = (bValue || "").toLowerCase();
        }

        if (sortOrder === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      })
    : [];

  const paginatedCoupons = sortedCoupons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCoupons.length / itemsPerPage);

  const stats = {
    total: coupons.length,
    active: coupons.filter((c) => c.status === "active").length,
    used: coupons.filter((c) => c.status === "used").length,
    scratched: coupons.filter((c) => c.is_scratched).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Coupons
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎫</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-blue-600 font-medium">
                {stats.total > 0 ? "📈 System active" : "📊 Ready to start"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Active Coupons
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.active.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600 font-medium">
                {stats.total > 0
                  ? `${((stats.active / stats.total) * 100).toFixed(
                      1
                    )}% available`
                  : "0% available"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Used Coupons
                </p>
                <p className="text-3xl font-bold text-red-600">
                  {stats.used.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🔴</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-red-600 font-medium">
                {stats.total > 0
                  ? `${((stats.used / stats.total) * 100).toFixed(1)}% redeemed`
                  : "0% redeemed"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Scratched</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.scratched.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-purple-600 font-medium">
                {stats.total > 0
                  ? `${((stats.scratched / stats.total) * 100).toFixed(
                      1
                    )}% revealed`
                  : "0% revealed"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coupon Generator & Shopify Sync */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Coupon Generator */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">⚡</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        Generate Coupons
                      </h2>
                      <p className="text-indigo-100 text-sm">
                        Create new coupon codes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <span className="flex items-center space-x-2">
                          <span>🔢</span>
                          <span>Number of Codes</span>
                        </span>
                      </label>
                      <input
                        type="number"
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                        min="1"
                        max="10000"
                        placeholder="10000"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum: 10,000 codes per batch
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <span className="flex items-center space-x-2">
                          <span>📅</span>
                          <span>Expiration Date</span>
                        </span>
                      </label>
                      <input
                        type="date"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {expirationDate
                          ? `Expires on: ${new Date(
                              expirationDate
                            ).toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}`
                          : "Select when these coupons should expire"}
                      </p>
                    </div>

                    <button
                      onClick={generateCoupons}
                      disabled={isGenerating}
                      className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 transform ${
                        isGenerating
                          ? "bg-gray-400 cursor-not-allowed scale-95"
                          : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {isGenerating ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>Generating...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center space-x-2">
                          <span>✨</span>
                          <span>Generate Coupons</span>
                        </span>
                      )}
                    </button>

                    {generationMessage && (
                      <div
                        className={`p-4 rounded-xl border-l-4 ${
                          generationMessage.includes("Error")
                            ? "bg-red-50 border-red-400 text-red-700"
                            : "bg-green-50 border-green-400 text-green-700"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {generationMessage.includes("Error") ? "❌" : "🎉"}
                          </span>
                          <span className="font-medium">
                            {generationMessage}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shopify Sync Section */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">🛍️</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        Shopify Integration
                      </h2>
                      <p className="text-green-100 text-sm">
                        Sync coupons with Shopify store
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    {/* Sync to Shopify Button */}
                    <button
                      onClick={syncToShopify}
                      disabled={isSyncing}
                      className={`w-full py-3 px-4 rounded-xl text-white font-medium transition-all duration-200 ${
                        isSyncing
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {isSyncing ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Syncing to Shopify...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center space-x-2">
                          <span>🛍️</span>
                          <span>Create Discounts in Shopify</span>
                        </span>
                      )}
                    </button>

                    {syncMessage && (
                      <div className="p-3 rounded-lg bg-gray-50 text-sm">
                        {syncMessage}
                      </div>
                    )}

                    {/* Webhook Status Info */}
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600 text-lg">ℹ️</span>
                        <div>
                          <p className="font-medium text-blue-800">
                            Shopify Integration
                          </p>
                          <p className="text-sm text-blue-600 mt-1">
                            Use &quot;Create Discounts&quot; to add new coupons
                            to Shopify.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coupons Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">📊</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        All Coupons
                      </h2>
                      <p className="text-gray-200 text-sm">
                        {sortedCoupons.length} total coupons
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading coupons...</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              onClick={() => handleSort("code")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Code</span>
                                <span className="text-gray-400">
                                  {sortBy === "code"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("status")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Status</span>
                                <span className="text-gray-400">
                                  {sortBy === "status"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              🛍️ Shopify Status
                            </th>
                            <th
                              onClick={() => handleSort("created_date")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Created</span>
                                <span className="text-gray-400">
                                  {sortBy === "created_date"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("used_date")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Used</span>
                                <span className="text-gray-400">
                                  {sortBy === "used_date"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("store_location")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Store</span>
                                <span className="text-gray-400">
                                  {sortBy === "store_location"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("employee_code")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Employee</span>
                                <span className="text-gray-400">
                                  {sortBy === "employee_code"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("is_scratched")}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Scratched</span>
                                <span className="text-gray-400">
                                  {sortBy === "is_scratched"
                                    ? sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕️"}
                                </span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedCoupons.map((coupon) => (
                            <tr
                              key={coupon.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                  {coupon.code}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                    coupon.status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {coupon.status === "active" ? "✅" : "🔴"}{" "}
                                  {coupon.status?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    !coupon.shopify_discount_id
                                      ? "bg-gray-100 text-gray-800"
                                      : coupon.shopify_status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {!coupon.shopify_discount_id
                                    ? "⭕ Not Synced"
                                    : coupon.shopify_status === "active"
                                    ? "🟢 Active"
                                    : "🔴 Disabled"}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {coupon.created_date
                                  ? new Date(
                                      coupon.created_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {coupon.used_date
                                  ? new Date(
                                      coupon.used_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {coupon.store_location || "-"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                {coupon.employee_code || "-"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    coupon.is_scratched
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {coupon.is_scratched ? "🎯 Yes" : "⭕ No"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                        <div className="text-sm text-gray-500">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                          {Math.min(
                            currentPage * itemsPerPage,
                            sortedCoupons.length
                          )}{" "}
                          of {sortedCoupons.length} coupons
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() =>
                              setCurrentPage(Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              currentPage === 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            Previous
                          </button>
                          <span className="px-3 py-2 text-sm text-gray-700">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setCurrentPage(
                                Math.min(totalPages, currentPage + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              currentPage === totalPages
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
