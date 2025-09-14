// src/components/QRCode.js
'use client';
import { useEffect, useRef, useState } from 'react';

export default function QRCode({ text, size = 200, className = '' }) {
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const generateQR = async (text) => {
    try {
      setIsLoading(true);
      setError(false);

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Try to use the qrcode library if available
      try {
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        setIsLoading(false);
        return;
      } catch (importError) {
        console.log('QRCode library not available, using fallback method');
      }

      // Fallback method using online API
      const ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&ecc=L`;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        setIsLoading(false);
      };
      img.onerror = () => {
        // Final fallback: Draw placeholder
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, size, size);
        
        // Add border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
        
        // Add icon and text
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📱', size/2, size/2 - 20);
        
        ctx.font = '12px Arial';
        ctx.fillText('QR Code', size/2, size/2);
        ctx.fillText('Unavailable', size/2, size/2 + 15);
        
        setIsLoading(false);
        setError(true);
      };
      img.src = qrUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (text) {
      generateQR(text);
    }
  }, [text, size]);

  return (
    <div className={`qr-code-container relative ${className}`}>
      <canvas
        ref={canvasRef}
        className={`border border-gray-200 rounded-lg shadow-sm transition-opacity duration-300 ${
          isLoading ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ width: size, height: size }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg"
          style={{ width: size, height: size }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      )}
      
      {/* Error state */}
      {error && !isLoading && (
        <div className="mt-2 text-xs text-amber-600 text-center">
          ⚠️ QR code may not display properly
        </div>
      )}
    </div>
  );
}