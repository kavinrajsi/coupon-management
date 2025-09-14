// src/app/view/[code]/page.js
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ScratchCard from '@/components/ScratchCard';
import QRCode from '@/components/QRCode';

export default function ViewCoupon() {
  const params = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasScratched, setHasScratched] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (params.code) {
      fetchCoupon(params.code);
    }
  }, [params.code]);

  useEffect(() => {
    // Set current URL when component mounts (client-side only)
    setCurrentUrl(window.location.href);
  }, []);

  const fetchCoupon = async (code) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/coupons?code=${code}`);
      const data = await response.json();
      
      if (data.success && data.coupons && data.coupons.length > 0) {
        const couponData = data.coupons[0];
        setCoupon(couponData);
        setHasScratched(couponData.is_scratched);
      } else {
        setError('Coupon not found');
      }
    } catch (error) {
      console.error('Error fetching coupon:', error);
      setError('Error loading coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleScratch = async (code) => {
    try {
      const response = await fetch('/api/coupons/scratch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (data.success) {
        setHasScratched(true);
        setCoupon(prev => ({ 
          ...prev, 
          is_scratched: true,
          scratched_date: new Date().toISOString()
        }));
      } else {
        console.error('Scratch error:', data.message);
      }
    } catch (error) {
      console.error('Error scratching coupon:', error);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Clipboard error:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link copied to clipboard!');
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
          <p className="text-gray-500 text-sm mt-2">Please check your coupon code and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎁 Scratch & Win! 🎁
          </h1>
          {hasScratched ? (
            <p className="text-lg text-green-600 font-semibold">
              🎉 Congratulations! Your prize has been revealed! 🎉
            </p>
          ) : (
            <p className="text-lg text-gray-600">
              You have a special surprise waiting for you!
            </p>
          )}
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Scratch Card - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2 flex justify-center">
            {hasScratched ? (
              // Already scratched - show the revealed card
              <div className="bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 rounded-lg shadow-lg border-4 border-yellow-500 p-8 text-center max-w-md w-full">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{coupon.code}</h2>
                <p className="text-lg text-gray-700 font-semibold">Congratulations!</p>
                <p className="text-sm text-gray-600 mt-2">You&apos;ve won a prize!</p>
                <div className="mt-4 text-xs text-gray-500">
                  <p>Scratched on: {new Date(coupon.scratched_date).toLocaleDateString()}</p>
                  <p>at {new Date(coupon.scratched_date).toLocaleTimeString()}</p>
                </div>
              </div>
            ) : (
              // Not scratched yet - show interactive scratch card
              <ScratchCard couponCode={coupon.code} onScratch={handleScratch} />
            )}
          </div>

          {/* QR Code Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-center space-x-2">
                  <span>📱</span>
                  <span>Share This Card</span>
                </h3>
                
                {/* QR Code */}
                {currentUrl && (
                  <div className="flex justify-center mb-4">
                    <QRCode 
                      text={currentUrl} 
                      size={180}
                      className="mx-auto"
                    />
                  </div>
                )}
                
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code to open the scratch card
                </p>
                
                {/* Share Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => copyToClipboard(currentUrl)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>📋</span>
                    <span>Copy Link</span>
                  </button>
                  
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>🔗</span>
                    <span>{showQR ? 'Hide' : 'Show'} QR Options</span>
                  </button>
                </div>

                {/* QR Options */}
                {showQR && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 space-y-2">
                      <p><strong>💡 How to use:</strong></p>
                      <p>• Open camera app on phone</p>
                      <p>• Point at QR code</p>
                      <p>• Tap the notification to open</p>
                      <p>• Share with friends & family!</p>
                    </div>
                  </div>
                )}

                {/* Coupon Code Display */}
                <div className="mt-6 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Coupon Code:</p>
                  <p className="font-mono text-lg font-bold text-gray-800 bg-white px-3 py-1 rounded border">
                    {coupon.code}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Coupon Info */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center flex items-center justify-center space-x-2">
            <span>ℹ️</span>
            <span>Coupon Information</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-600 font-medium mb-1">Code</p>
              <p className="font-mono text-lg font-bold text-blue-800">{coupon.code}</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-green-600 font-medium mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                coupon.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : coupon.status === 'used'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {coupon.status?.toUpperCase() || 'ACTIVE'}
              </span>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-purple-600 font-medium mb-1">Created</p>
              <p className="font-medium text-purple-800">
                {new Date(coupon.created_date).toLocaleDateString()}
              </p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-orange-600 font-medium mb-1">Scratched</p>
              <p className="font-medium text-orange-800">
                {hasScratched ? '✅ Yes' : '❌ No'}
              </p>
            </div>
          </div>
          
          {/* Additional Info */}
          {coupon.used_date && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-700">
                <span className="text-lg">🚫</span>
                <div>
                  <p className="font-semibold">This coupon has been used</p>
                  <p className="text-sm">
                    <strong>Used:</strong> {new Date(coupon.used_date).toLocaleString()}
                    {coupon.employee_code && (
                      <span> by {coupon.employee_code}</span>
                    )}
                    {coupon.store_location && (
                      <span> at {coupon.store_location}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {hasScratched && !coupon.used_date && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-700">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="font-semibold">Scratch card revealed!</p>
                  <p className="text-sm">
                    <strong>Scratched:</strong> {new Date(coupon.scratched_date).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instructions for sharing */}
        {!hasScratched && (
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 text-center">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              🎯 How to Share Your Scratch Card
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">📱</span>
                <p className="font-medium">Scan QR Code</p>
                <p>Use any phone camera to scan the QR code above</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">🔗</span>
                <p className="font-medium">Copy Link</p>
                <p>Click &quot;Copy Link&quot; and share via text or social media</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">🎁</span>
                <p className="font-medium">Let Them Scratch</p>
                <p>Recipients can scratch the card to reveal the prize!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}