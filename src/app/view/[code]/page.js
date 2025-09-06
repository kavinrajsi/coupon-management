'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ScratchCard from '@/components/ScratchCard';

export default function ViewCoupon() {
  const params = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasScratched, setHasScratched] = useState(false);

  useEffect(() => {
    if (params.code) {
      fetchCoupon(params.code);
    }
  }, [params.code]);

  const fetchCoupon = async (code) => {
    try {
      const response = await fetch(`/api/coupons?code=${code}`);
      const data = await response.json();
      
      if (data.success && data.coupons.length > 0) {
        const couponData = data.coupons[0];
        setCoupon(couponData);
        setHasScratched(couponData.is_scratched);
      } else {
        setError('Coupon not found');
      }
    } catch (error) {
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
      }
    } catch (error) {
      console.error('Error scratching coupon:', error);
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
      <div className="max-w-2xl mx-auto pt-8">
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
        
        {/* Scratch Card */}
        <div className="flex justify-center mb-8">
          {hasScratched ? (
            // Already scratched - show the revealed card
            <div className="bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 rounded-lg shadow-lg border-4 border-yellow-500 p-8 text-center">
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
        
        {/* Coupon Info */}
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Coupon Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Code</p>
              <p className="font-mono text-lg font-bold">{coupon.code}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                coupon.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : coupon.status === 'used'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {coupon.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500">Created</p>
              <p className="font-medium">{new Date(coupon.created_date).toLocaleDateString()}</p>
            </div>
          </div>
          
          {coupon.used_date && (
            <div className="mt-4 p-3 bg-red-50 rounded-md">
              <p className="text-red-600 text-sm">
                <strong>Used:</strong> {new Date(coupon.used_date).toLocaleString()}
                {coupon.employee_code && ` by ${coupon.employee_code}`}
                {coupon.store_location && ` at Store ${coupon.store_location}`}
              </p>
            </div>
          )}
          
          {hasScratched && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-md">
              <p className="text-yellow-700 text-sm">
                <strong>Scratched:</strong> {new Date(coupon.scratched_date).toLocaleString()}
              </p>
            </div>
          )}
        </div>
        
        {/* Share button */}
        {!hasScratched && (
          <div className="text-center mt-6">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              📋 Share This Scratch Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}