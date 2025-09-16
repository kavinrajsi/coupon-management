// src/components/QRCode.js - Enhanced version with better error handling
'use client';
import { useEffect, useRef, useState } from 'react';

export default function QRCode({ text, size = 200, className = '', showDownload = true }) {
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qrLibrary, setQrLibrary] = useState(null);

  // Load QR library on component mount
  useEffect(() => {
    const loadQRLibrary = async () => {
      try {
        // Try to import qrcode library
        const QRCodeLib = await import('qrcode');
        setQrLibrary(QRCodeLib.default);
        console.log('✅ QRCode library loaded successfully');
      } catch (importError) {
        console.warn('⚠️ QRCode library not available, using fallback method');
        setQrLibrary(null);
      }
    };

    loadQRLibrary();
  }, []);

  const generateQR = async (text) => {
    try {
      setIsLoading(true);
      setError(false);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;

      // Method 1: Use qrcode library if available
      if (qrLibrary) {
        try {
          await qrLibrary.toCanvas(canvas, text, {
            width: size,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'M'
          });
          setIsLoading(false);
          return;
        } catch (libError) {
          console.warn('⚠️ QRCode library failed, trying fallback:', libError);
        }
      }

      // Method 2: Online QR service fallback
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&ecc=M&margin=10`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          ctx.clearRect(0, 0, size, size);
          
          // Add white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          
          // Draw QR code
          ctx.drawImage(img, 0, 0, size, size);
          
          // Add border
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, size, size);
          
          setIsLoading(false);
        };
        
        img.onerror = () => {
          console.warn('⚠️ Online QR service failed, using text fallback');
          drawTextFallback(ctx);
        };
        
        img.src = qrUrl;
      } catch (serviceError) {
        console.warn('⚠️ QR service error:', serviceError);
        drawTextFallback(ctx);
      }

    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        drawTextFallback(ctx);
      }
    }
  };

  const drawTextFallback = (ctx) => {
    // Fallback: Draw a nice placeholder with the URL
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, size, size);
    
    // Add border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    
    // Add QR icon
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📱', size/2, size/2 - 30);
    
    // Add "QR Code" text
    ctx.font = 'bold 16px Arial';
    ctx.fillText('QR Code', size/2, size/2);
    
    // Add status
    ctx.font = '12px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Scan with camera', size/2, size/2 + 20);
    
    // Add truncated URL
    const truncatedText = text.length > 30 ? text.substring(0, 30) + '...' : text;
    ctx.font = '10px Arial';
    ctx.fillText(truncatedText, size/2, size/2 + 40);
    
    setIsLoading(false);
    setError(true);
  };

  useEffect(() => {
    if (text && (qrLibrary !== undefined)) {
      generateQR(text);
    }
  }, [text, size, qrLibrary]);

  const downloadQR = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Create download link
      const link = document.createElement('a');
      link.download = `qr-code-${text.split('/').pop() || 'coupon'}.png`;
      link.href = canvas.toDataURL('image/png');
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('❌ Error downloading QR code:', error);
      alert('Failed to download QR code. Please try again.');
    }
  };

  return (
    <div className={`qr-code-container relative ${className}`}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`border border-gray-200 rounded-lg shadow-sm transition-opacity duration-300 ${
          isLoading ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ width: size, height: size }}
        width={size}
        height={size}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg"
          style={{ width: size, height: size }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
            <div className="text-xs text-gray-600">Generating QR...</div>
          </div>
        </div>
      )}
      
      {/* Error state indicator */}
      {error && !isLoading && (
        <div className="mt-2 text-center">
          <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 inline-block">
            ⚠️ QR generated with fallback method
          </div>
        </div>
      )}

      {/* Download button */}
      {showDownload && !isLoading && (
        <div className="mt-3 text-center">
          <button
            onClick={downloadQR}
            className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>💾</span>
            <span>Download QR</span>
          </button>
        </div>
      )}

      {/* QR Code info */}
      <div className="mt-2 text-center">
        <div className="text-xs text-white-500">
          Show the QR code in store
        </div>
      </div>
    </div>
  );
}