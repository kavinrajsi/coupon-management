// src/components/QRScanner.js - Mobile-optimized version
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export default function QRScanner({ onScan, onError, isActive = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [jsQR, setJsQR] = useState(null);
  const scanIntervalRef = useRef(null);
  const [scanCount, setScanCount] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  // Load jsQR library
  useEffect(() => {
    const loadJsQR = async () => {
      try {
        const jsQRModule = await import('jsqr');
        setJsQR(() => jsQRModule.default);
        console.log('✅ jsQR library loaded successfully');
      } catch (err) {
        console.warn('⚠️ jsQR library not available');
        setError('QR scanning library failed to load');
      }
    };
    
    loadJsQR();
  }, []);

  // Define utility functions first (no dependencies)
  const extractCouponCode = useCallback((url) => {
    try {
      console.log('🔍 Extracting coupon code from URL:', url);
      
      const match = url.match(/\/view\/([A-Z0-9]{6})/i);
      const code = match ? match[1].toUpperCase() : null;
      
      if (code && /^[A-Z]{3}\d{3}$/.test(code)) {
        console.log('✅ Valid coupon code format:', code);
        return code;
      }
      
      console.log('❌ Invalid coupon code format:', code);
      return null;
    } catch (err) {
      console.error('❌ Error extracting coupon code:', err);
      return null;
    }
  }, []);

  // Mobile-specific camera constraints
  const getMobileConstraints = useCallback((deviceId = null) => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const baseConstraints = {
      video: {
        width: { ideal: isMobile ? 720 : 1280, min: 320 },
        height: { ideal: isMobile ? 480 : 720, min: 240 },
        frameRate: { ideal: 15, max: 30 }
      }
    };

    if (deviceId) {
      baseConstraints.video.deviceId = { exact: deviceId };
    } else {
      // For mobile, explicitly request back camera
      baseConstraints.video.facingMode = { ideal: 'environment' };
    }

    console.log('📱 Camera constraints:', baseConstraints);
    return baseConstraints;
  }, []);

  // Get back camera on mobile devices
  const getBackCamera = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('📷 Available cameras:', videoDevices.map(d => ({ 
        id: d.deviceId.slice(0, 8) + '...', 
        label: d.label || 'Unknown Camera' 
      })));
      
      setDevices(videoDevices);

      // Try to find back/rear camera
      const backCamera = videoDevices.find(device => {
        const label = device.label.toLowerCase();
        return label.includes('back') || 
               label.includes('rear') || 
               label.includes('environment') ||
               label.includes('facing back');
      });

      if (backCamera) {
        console.log('📱 Found back camera:', backCamera.label);
        return backCamera.deviceId;
      }

      // If no labeled back camera, try the last camera (often back camera on mobile)
      if (videoDevices.length > 1) {
        console.log('📱 Using last camera as back camera');
        return videoDevices[videoDevices.length - 1].deviceId;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting cameras:', error);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('🛑 Stopping camera...');
    
    // Stop scanning
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📷 Stopped track:', track.label);
      });
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setVideoReady(false);
    setCameraStarting(false);
  }, []);

  // Define scanning functions before using them
  const startScanning = useCallback(() => {
    if (!isScanning && jsQR && videoReady) {
      console.log('📷 Starting QR code scanning...');
      setIsScanning(true);
      // Use slower interval for mobile to reduce CPU usage
      scanIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!video || !canvas || !jsQR || !videoReady) {
          return;
        }

        // Check if video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('⚠️ Video dimensions not ready yet');
          return;
        }

        try {
          const ctx = canvas.getContext('2d');
          
          // Set canvas size to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw current video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data for QR scanning
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setScanCount(prev => prev + 1);
          
          // Scan for QR code
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code && code.data) {
            console.log('📱 QR Code detected:', code.data);
            // Handle scan result inline to avoid circular dependency
            if (code.data && onScan) {
              const couponCode = extractCouponCode(code.data);
              console.log('🎯 Extracted coupon code:', couponCode, 'from URL:', code.data);
              
              if (couponCode) {
                console.log('✅ Valid coupon code found, calling onScan callback');
                onScan(couponCode, code.data);
                
                // Brief pause after successful scan
                setIsScanning(false);
                if (scanIntervalRef.current) {
                  clearInterval(scanIntervalRef.current);
                  scanIntervalRef.current = null;
                }
                
                // Resume scanning after 2 seconds
                setTimeout(() => {
                  if (isActive && jsQR && videoReady) {
                    console.log('🔄 Resuming scanning after successful scan');
                    setIsScanning(true);
                    // Restart the interval
                    if (!scanIntervalRef.current) {
                      scanIntervalRef.current = setInterval(arguments.callee, 500);
                    }
                  }
                }, 2000);
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Scan frame error:', err);
        }
      }, 500);
    }
  }, [isScanning, jsQR, videoReady, onScan, extractCouponCode, isActive]);

  const startCamera = useCallback(async () => {
    try {
      setCameraStarting(true);
      setError('');
      setScanCount(0);
      setVideoReady(false);

      // Stop any existing camera
      stopCamera();

      console.log('📱 Starting camera...');

      // Get back camera for mobile
      const backCameraId = selectedDevice || await getBackCamera();
      const constraints = getMobileConstraints(backCameraId);

      console.log('📷 Requesting camera with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Set up video element
      const video = videoRef.current;
      video.srcObject = stream;
      
      // Mobile-specific video settings
      video.setAttribute('playsinline', true);
      video.setAttribute('webkit-playsinline', true);
      video.muted = true;
      video.autoplay = true;

      // Wait for video to be ready
      const videoLoadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000);

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          console.log('📱 Video metadata loaded:', {
            width: video.videoWidth,
            height: video.videoHeight,
            readyState: video.readyState
          });
          resolve();
        };

        video.onerror = (e) => {
          clearTimeout(timeout);
          reject(new Error(`Video error: ${e.message}`));
        };
      });

      await video.play();
      await videoLoadPromise;

      // Wait a bit more for mobile cameras to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      setHasPermission(true);
      setVideoReady(true);
      setCameraStarting(false);

      console.log('✅ Camera started successfully');

      // Start scanning after camera is ready
      if (jsQR) {
        setTimeout(() => {
          startScanning();
        }, 500);
      }

    } catch (err) {
      console.error('❌ Camera start error:', err);
      setCameraStarting(false);
      setHasPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and refresh the page.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please check if your device has a camera.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is busy. Please close other camera apps and try again.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera constraints not supported. Trying with basic settings...');
        // Retry with basic constraints
        setTimeout(() => {
          setSelectedDevice('');
          startCamera();
        }, 1000);
      } else {
        setError(`Camera error: ${err.message}`);
      }
      
      if (onError) onError(err);
    }
  }, [selectedDevice, getBackCamera, getMobileConstraints, stopCamera, jsQR, onError, startScanning]);

  // Main effect for starting/stopping camera
  useEffect(() => {
    if (isActive && jsQR) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, jsQR, startCamera, stopCamera]);

  // Effect for device changes
  useEffect(() => {
    if (isActive && hasPermission && selectedDevice) {
      console.log('📱 Device changed, restarting camera...');
      startCamera();
    }
  }, [selectedDevice, isActive, hasPermission, startCamera]);

  const switchCamera = (deviceId) => {
    console.log('📷 Switching camera to:', deviceId);
    setSelectedDevice(deviceId);
  };

  const retryCamera = () => {
    console.log('🔄 Retrying camera...');
    setError('');
    startCamera();
  };

  if (!isActive) {
    return null;
  }

  // Show error state
  if (error && !cameraStarting) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-center">
          <div className="text-4xl mb-3">📷</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Camera Issue</h3>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          
          <button
            onClick={retryCamera}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            🔄 Try Again
          </button>
          
          <div className="mt-4 text-xs text-red-600 bg-red-100 rounded p-3">
            <p className="font-medium mb-2">📱 Mobile Troubleshooting:</p>
            <ul className="text-left space-y-1">
              <li>• Allow camera permissions in browser</li>
              <li>• Close other camera/video apps</li>
              <li>• Refresh the page</li>
              <li>• Try switching cameras above</li>
              <li>• Check if camera works in other apps</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (cameraStarting || !videoReady) {
    return (
      <div className="text-center py-8 bg-blue-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
        <p className="text-blue-700 font-medium">
          {cameraStarting ? 'Starting camera...' : 'Initializing...'}
        </p>
        <p className="text-blue-600 text-sm mt-1">
          Please wait while we access your camera
        </p>
      </div>
    );
  }

  return (
    <div className="qr-scanner-container">
      {/* Scanner Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isScanning ? 'bg-green-400 animate-pulse' : videoReady ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isScanning ? `Scanning... (${scanCount})` : videoReady ? 'Ready' : 'Starting...'}
            </span>
          </div>
          
          {devices.length > 1 && (
            <select
              value={selectedDevice}
              onChange={(e) => switchCamera(e.target.value)}
              className="text-sm bg-white border border-gray-300 rounded px-2 py-1"
            >
              <option value="">📷 Auto</option>
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <p className="text-sm text-gray-600">
          📱 Point your camera at a QR code to scan the coupon
        </p>
      </div>

      {/* Video Scanner */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
        <video
          ref={videoRef}
          className="w-full h-64 object-cover"
          playsInline
          webkit-playsinline="true"
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)' }} // Mirror for better UX
        />
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner markers */}
          <div className="absolute inset-4">
            <div className="relative w-full h-full border-2 border-blue-400 rounded-lg opacity-75">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br"></div>
            </div>
          </div>
          
          {/* Scanning line animation */}
          {isScanning && (
            <div className="absolute inset-4 flex items-center justify-center">
              <div className="h-0.5 w-3/4 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse"></div>
            </div>
          )}
          
          {/* Center target */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-2 border-white rounded-lg opacity-50"></div>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="absolute top-2 left-2 flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
            {isScanning ? 'SCANNING' : 'PAUSED'}
          </span>
        </div>
        
        {jsQR && videoReady && (
          <div className="absolute top-2 right-2">
            <span className="text-white text-xs bg-green-600 bg-opacity-75 px-2 py-1 rounded">
              jsQR READY
            </span>
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Mobile-specific instructions */}
      <div className="mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-700">
            <p className="font-medium flex items-center space-x-2">
              <span>💡</span>
              <span>Mobile Scanning Tips:</span>
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Hold phone steady, 4-8 inches from QR code</li>
              <li>• Make sure QR code is well-lit</li>
              <li>• Keep QR code within the blue frame</li>
              <li>• Wait for green scanning line</li>
              <li>• Code will auto-fill when detected</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}