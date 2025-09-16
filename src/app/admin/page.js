// src/app/admin/page.js - Updated with pagination
"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

export default function AdminPanel() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, used: 0, scratched: 0 });

  // Generator state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [count, setCount] = useState(10000);
  const [expirationDate, setExpirationDate] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 100, // Reduced from 1000 for better performance
    hasNextPage: false,
    hasPrevPage: false
  });

  // Table state
  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [codeQuery, setCodeQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Shopify sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Debounce the code search input
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedQuery(codeQuery.trim().toLowerCase()),
      500 // Increased debounce time for better performance
    );
    return () => clearTimeout(t);
  }, [codeQuery]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [debouncedQuery, sortBy, sortOrder]);

  // Build local "today" for date input
  const todayLocalISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Fetch coupons with pagination
  const fetchCoupons = useCallback(async (page = 1) => {
    const controller = new AbortController();
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(debouncedQuery && { search: debouncedQuery })
      });

      const response = await fetch(`/api/coupons?${params}`, { 
        signal: controller.signal 
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data?.success) {
        setCoupons(data.coupons || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        console.error("API returned error:", data?.message);
        setCoupons([]);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Fetch error:", err);
        setCoupons([]);
      }
    } finally {
      setLoading(false);
    }
    
    return () => controller.abort();
  }, [pagination.limit, sortBy, sortOrder, debouncedQuery]);

  // Fetch statistics separately for better performance
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/coupons/stats');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCoupons(1);
    fetchStats();
  }, []);

  // Refetch when dependencies change
  useEffect(() => {
    fetchCoupons(pagination.currentPage);
  }, [sortBy, sortOrder, debouncedQuery]);

  const parseLocalDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  };

  const generateCoupons = useCallback(async () => {
    setIsGenerating(true);
    setGenerationMessage("");

    const safeCount = Number.isFinite(count) ? count : 0;
    if (safeCount < 1 || safeCount > 10000) {
      setGenerationMessage("Error: Please enter a number between 1 and 10,000");
      setIsGenerating(false);
      return;
    }

    if (!expirationDate) {
      setGenerationMessage("Error: Please select an expiration date");
      setIsGenerating(false);
      return;
    }

    const selected = parseLocalDate(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!selected || selected <= today) {
      setGenerationMessage("Error: Expiration date must be in the future");
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch("/api/coupons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: safeCount, expirationDate }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data?.success) {
        setGenerationMessage(
          `Successfully generated ${data.count} coupon codes! 🎉 Total in database: ${data.totalInDatabase}. Expires: ${selected.toLocaleDateString()}`
        );
        // Refresh both coupons and stats
        await Promise.all([
          fetchCoupons(1), // Go back to first page
          fetchStats()
        ]);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        setGenerationMessage(`Error: ${data?.message || "Unknown error"}`);
      }
    } catch (error) {
      setGenerationMessage(`Error: ${error?.message || "Unknown error"}`);
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [count, expirationDate, fetchCoupons, fetchStats]);

  // Shopify sync
  const syncToShopify = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncAll: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSyncMessage(`${data?.success ? "✅" : "❌"} ${data?.message || ""}`);
      if (data?.success) {
        await fetchCoupons(pagination.currentPage);
      }
    } catch (error) {
      setSyncMessage(`❌ Error: ${error?.message || "Unknown error"}`);
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchCoupons, pagination.currentPage]);

  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }, [sortBy]);

  // Pagination handlers
  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: page }));
      fetchCoupons(page);
    }
  }, [pagination.totalPages, fetchCoupons]);

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      goToPage(pagination.currentPage + 1);
    }
  }, [pagination.hasNextPage, pagination.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrevPage) {
      goToPage(pagination.currentPage - 1);
    }
  }, [pagination.hasPrevPage, pagination.currentPage, goToPage]);

  const ariaSortFor = (column) =>
    sortBy === column
      ? sortOrder === "asc"
        ? "ascending"
        : "descending"
      : "none";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - Using cached stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Coupons</p>
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
                <p className="text-sm font-medium text-gray-500">Active Coupons</p>
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
                  ? `${((stats.active / stats.total) * 100).toFixed(1)}% available`
                  : "0% available"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Used Coupons</p>
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
                  ? `${((stats.scratched / stats.total) * 100).toFixed(1)}% revealed`
                  : "0% revealed"}
              </div>
            </div>
          </div>
        </div>

        {/* Generator and Sync sections remain the same */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Coupon Generator */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">⚡</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Generate Coupons</h2>
                  <p className="text-indigo-100 text-sm">Create new coupon codes</p>
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
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setCount(Number.isNaN(n) ? 0 : n);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                    min="1"
                    max="10000"
                    placeholder="10000"
                    inputMode="numeric"
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
                    min={todayLocalISO}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-gray-800"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {expirationDate
                      ? `Expires on: ${parseLocalDate(expirationDate).toLocaleDateString()}`
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
                    aria-live="polite"
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
                      <span className="font-medium">{generationMessage}</span>
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
                  <h2 className="text-xl font-semibold text-white">Shopify Integration</h2>
                  <p className="text-green-100 text-sm">Sync coupons with Shopify store</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
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
                  <div aria-live="polite" className="p-3 rounded-lg bg-gray-50 text-sm">
                    {syncMessage}
                  </div>
                )}

                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 text-lg">ℹ️</span>
                    <div>
                      <p className="font-medium text-blue-800">Shopify Integration</p>
                      <p className="text-sm text-blue-600 mt-1">
                        Use "Create Discounts" to add new coupons to Shopify.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coupons Table with Pagination */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">All Coupons</h2>
                  <p className="text-gray-200 text-sm">
                    {pagination.totalCount > 0 ? (
                      <>
                        Showing {pagination.startIndex}-{pagination.endIndex} of{" "}
                        {pagination.totalCount.toLocaleString()}{" "}
                        {debouncedQuery ? "matching" : "total"} coupons
                      </>
                    ) : (
                      "No coupons found"
                    )}
                  </p>
                </div>
              </div>

              {/* Search Input */}
              <div className="w-full max-w-sm">
                <label htmlFor="codeSearch" className="sr-only">
                  Search by code
                </label>
                <div className="flex rounded-xl shadow-sm overflow-hidden">
                  <div className="relative flex-grow">
                    <input
                      id="codeSearch"
                      type="text"
                      value={codeQuery}
                      onChange={(e) => setCodeQuery(e.target.value)}
                      placeholder="Search code…"
                      className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-black"
                    />
                    <span className="absolute inset-y-0 right-2 flex items-center text-gray-400 pointer-events-none">
                      🔎
                    </span>
                  </div>
                  {codeQuery && (
                    <button
                      onClick={() => setCodeQuery("")}
                      className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
                      title="Clear"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
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
                          scope="col"
                          aria-sort={ariaSortFor("code")}
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
                          scope="col"
                          aria-sort={ariaSortFor("status")}
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
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          🛍️ Shopify Status
                        </th>
                        <th
                          scope="col"
                          aria-sort={ariaSortFor("created_date")}
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
                          scope="col"
                          aria-sort={ariaSortFor("used_date")}
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
                          scope="col"
                          aria-sort={ariaSortFor("store_location")}
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
                          scope="col"
                          aria-sort={ariaSortFor("employee_code")}
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
                          scope="col"
                          aria-sort={ariaSortFor("is_scratched")}
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
                      {coupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
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
                              ? new Date(coupon.created_date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {coupon.used_date
                              ? new Date(coupon.used_date).toLocaleDateString()
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

                {/* Enhanced Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    {/* Pagination Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-500">
                        Showing {pagination.startIndex} to {pagination.endIndex} of{" "}
                        {pagination.totalCount.toLocaleString()}{" "}
                        {debouncedQuery ? "matching" : "total"} coupons
                      </div>
                      
                      {/* Page Size Selector */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Show:</span>
                        <select
                          value={pagination.limit}
                          onChange={(e) => {
                            const newLimit = parseInt(e.target.value);
                            setPagination(prev => ({ ...prev, limit: newLimit, currentPage: 1 }));
                            fetchCoupons(1);
                          }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={250}>250</option>
                          <option value={500}>500</option>
                        </select>
                        <span className="text-sm text-gray-500">per page</span>
                      </div>
                    </div>

                    {/* Pagination Buttons */}
                    <div className="flex items-center justify-center space-x-2">
                      {/* First Page */}
                      <button
                        onClick={() => goToPage(1)}
                        disabled={pagination.currentPage === 1}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          pagination.currentPage === 1
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        ⏮️ First
                      </button>

                      {/* Previous Page */}
                      <button
                        onClick={prevPage}
                        disabled={!pagination.hasPrevPage}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          !pagination.hasPrevPage
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        ← Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                pageNum === pagination.currentPage
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Next Page */}
                      <button
                        onClick={nextPage}
                        disabled={!pagination.hasNextPage}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          !pagination.hasNextPage
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        Next →
                      </button>

                      {/* Last Page */}
                      <button
                        onClick={() => goToPage(pagination.totalPages)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          pagination.currentPage === pagination.totalPages
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Last ⏭️
                      </button>
                    </div>

                    {/* Quick Jump */}
                    {pagination.totalPages > 10 && (
                      <div className="flex items-center justify-center mt-4 space-x-2">
                        <span className="text-sm text-gray-500">Go to page:</span>
                        <input
                          type="number"
                          min="1"
                          max={pagination.totalPages}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(e.target.value);
                              if (page >= 1 && page <= pagination.totalPages) {
                                goToPage(page);
                                e.target.value = '';
                              }
                            }
                          }}
                          placeholder={pagination.currentPage.toString()}
                        />
                        <span className="text-sm text-gray-500">of {pagination.totalPages}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* No Results Message */}
                {coupons.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {debouncedQuery ? "No matching coupons found" : "No coupons available"}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {debouncedQuery 
                        ? `No coupons match "${debouncedQuery}". Try a different search term.`
                        : "Generate some coupons to get started."
                      }
                    </p>
                    {debouncedQuery && (
                      <button
                        onClick={() => setCodeQuery("")}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}