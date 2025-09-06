'use client';
import { useState } from 'react';

export default function CouponGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(10000);

  const generateCoupons = async () => {
    setIsGenerating(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/coupons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(`Successfully generated ${data.count} coupon codes!`);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Generate Coupon Codes</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Number of codes to generate:
        </label>
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          min="1"
          max="50000"
        />
      </div>
      
      <button
        onClick={generateCoupons}
        disabled={isGenerating}
        className={`w-full py-2 px-4 rounded-md text-white font-medium ${
          isGenerating 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isGenerating ? 'Generating...' : 'Generate Coupons'}
      </button>
      
      {message && (
        <div className={`mt-4 p-3 rounded-md ${
          message.includes('Error') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}