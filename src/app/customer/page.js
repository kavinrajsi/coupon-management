'use client';
import { useState, useEffect } from 'react';

export default function CustomerPanel() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [copiedCode, setCopiedCode] = useState('');

  const itemsPerPage = 12;

  useEffect(() => {
    fetchCoupons();
  }, []);

   const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/coupons');
      const data = await response.json();
      
      if (data.success) {
        // Filter active coupons on the client side (backup filter)
        const activeCoupons = (data.coupons || []).filter(c => c.status === 'active');
        setCoupons(activeCoupons);
      } else {
        console.error('Failed to fetch coupons:', data.message);
        setCoupons([]);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

    const copyToClipboard = async (code) => {
    const url = `${window.location.origin}/view/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (error) {
      console.error('Clipboard error:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    }
  };


  // Handle column sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Sort coupons
  const sortedCoupons = coupons
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'created_date') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      } else if (sortBy === 'is_scratched') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      } else if (typeof aValue === 'string') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const paginatedCoupons = sortedCoupons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCoupons.length / itemsPerPage);

  const copyToClipboard = async (code) => {
    const url = `${window.location.origin}/view/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    }
  };

  const stats = {
    total: coupons.length,
    scratched: coupons.filter(c => c.is_scratched).length,
    unscratched: coupons.filter(c => !c.is_scratched).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">🎁</span>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1>
                <p className="text-sm text-gray-500">Discover and share your coupon codes</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right text-sm text-gray-600">
                <p className="font-medium">Welcome Customer</p>
                <p>{new Date().toLocaleDateString()}</p>
              </div>
              <div className="h-10 w-10 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Available Coupons</p>
                <p className="text-3xl font-bold text-purple-600">{stats.total.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎫</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-purple-600 font-medium">
                {stats.total > 0 ? '🎉 Ready to explore!' : '📭 No coupons available'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Not Scratched</p>
                <p className="text-3xl font-bold text-green-600">{stats.unscratched.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-green-600 font-medium">
                {stats.total > 0 ? `${((stats.unscratched / stats.total) * 100).toFixed(1)}% ready to reveal` : '0% available'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Already Scratched</p>
                <p className="text-3xl font-bold text-orange-600">{stats.scratched.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-orange-600 font-medium">
                {stats.total > 0 ? `${((stats.scratched / stats.total) * 100).toFixed(1)}% revealed` : '0% revealed'}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">🏆</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Your Scratch Cards</h2>
                  <p className="text-purple-100 text-sm">{sortedCoupons.length} coupons available to share</p>
                </div>
              </div>
              <div className="text-white text-right">
                <p className="text-sm opacity-90">Click to sort columns</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="p-8">
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-6"></div>
                <p className="text-xl text-gray-600 mb-2">Loading your coupons...</p>
                <p className="text-sm text-gray-500">Please wait while we fetch your scratch cards</p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">🎫</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">No Coupons Available</h3>
                <p className="text-gray-600 mb-6">There are currently no active coupon codes to display.</p>
                <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-blue-700">
                    💡 Check back later or contact support for more information about available coupons.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          onClick={() => handleSort('code')}
                          className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        >
                          <div className="flex items-center space-x-2">
                            <span>🎫 Coupon Code</span>
                            <span className="text-gray-400">
                              {sortBy === 'code' ? (
                                sortOrder === 'asc' ? '↑' : '↓'
                              ) : '↕️'}
                            </span>
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('created_date')}
                          className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        >
                          <div className="flex items-center space-x-2">
                            <span>📅 Created Date</span>
                            <span className="text-gray-400">
                              {sortBy === 'created_date' ? (
                                sortOrder === 'asc' ? '↑' : '↓'
                              ) : '↕️'}
                            </span>
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('is_scratched')}
                          className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        >
                          <div className="flex items-center space-x-2">
                            <span>🎯 Status</span>
                            <span className="text-gray-400">
                              {sortBy === 'is_scratched' ? (
                                sortOrder === 'asc' ? '↑' : '↓'
                              ) : '↕️'}
                            </span>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          🔗 Share Link
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ⚡ Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedCoupons.map((coupon) => {
                        const viewUrl = `${window.location.origin}/view/${coupon.code}`;
                        return (
                          <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                                  <span className="text-white font-bold text-sm">{coupon.code.slice(0, 2)}</span>
                                </div>
                                <div>
                                  <span className="font-mono text-lg font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                                    {coupon.code}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">
                                <div className="font-medium">{new Date(coupon.created_date).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-400">{new Date(coupon.created_date).toLocaleTimeString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                coupon.is_scratched 
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {coupon.is_scratched ? '🎯 Revealed' : '✨ Ready to Scratch'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <a 
                                href={viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium transition-colors"
                              >
                                <span>🔗</span>
                                <span>View Scratch Card</span>
                                <span className="text-xs">↗</span>
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => copyToClipboard(coupon.code)}
                                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                  copiedCode === coupon.code
                                    ? 'bg-green-500 text-white transform scale-105'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:scale-105 shadow-lg'
                                }`}
                              >
                                <span>{copiedCode === coupon.code ? '✅' : '📋'}</span>
                                <span>{copiedCode === coupon.code ? 'Copied!' : 'Copy URL'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedCoupons.length)} of {sortedCoupons.length} coupons
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          currentPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                        }`}
                      >
                        ← Previous
                      </button>
                      <div className="flex items-center px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg">
                        Page {currentPage} of {totalPages}
                      </div>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          currentPage === totalPages
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                        }`}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* Help Section */}
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center space-x-2">
                    <span>💡</span>
                    <span>How to Use Your Coupons</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-purple-700">
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">1️⃣</span>
                      <div>
                        <p className="font-medium">Copy Link</p>
                        <p>Click &quot;Copy URL&quot; to get the shareable link</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">2️⃣</span>
                      <div>
                        <p className="font-medium">Share</p>
                        <p>Send the link to friends or social media</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">3️⃣</span>
                      <div>
                        <p className="font-medium">Scratch & Win</p>
                        <p>Recipients can scratch to reveal the prize</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}