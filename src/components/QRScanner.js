// src/components/QRScanner.js - Enhanced version with better permission handling
'use client';
import { useEffect, useRef, useState } from 'react';

export default function QRScanner({ onScan, onError, isActive = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [permissionState, setPermissionState] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [jsQR, setJsQR] = useState(null);
  const scanIntervalRef = useRef(null);
  const [scanCount, setScanCount] = useState(0);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);

  // Load jsQR library
  useEffect(() => {
    const loadJsQR = async () => {
      try {
        const jsQRModule = await import('jsqr');
        setJsQR(() => jsQRModule.default);
        console.log('✅ jsQR library loaded successfully');
      } catch (err) {
        console.warn('⚠️ jsQR library not available, using fallback method');
      }
    };
    
    loadJsQR();
  }, []);

  // Check camera permissions when component mounts
  useEffect(() => {
    checkCameraPermissions();
  }, []);

  useEffect(() => {
    if (isActive && permissionState === 'granted') {
      initializeCamera();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive, selectedDevice, permissionState]);

  const checkCameraPermissions = async () => {
    try {
      setIsCheckingPermissions(true);
      
      // Check if navigator.permissions is available
      if ('permissions' in navigator) {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        setPermissionState(permissionStatus.state);
        
        console.log('📷 Camera permission status:', permissionStatus.state);
        
        // Listen for permission changes
        permissionStatus.onchange = () => {
          setPermissionState(permissionStatus.state);
          console.log('📷 Camera permission changed to:', permissionStatus.state);
        };
      } else {
        console.log('📷 Permissions API not available, will check during camera access');
      }
    } catch (error) {
      console.warn('⚠️ Could not check camera permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      setError('');
      setHasPermission(null);
      
      console.log('📷 Requesting camera permission...');
      
      // Simple test to request permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      setPermissionState('granted');
      
      console.log('✅ Camera permission granted');
      
    } catch (err) {
      console.error('❌ Camera permission denied:', err);
      setHasPermission(false);
      setPermissionState('denied');
      
      if (err.name === 'NotAllowedError') {
        setError('Camera access was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please check if your device has a camera.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application. Please close other camera apps.');
      } else {
        setError(`Camera error: ${err.message}`);
      }
      
      if (onError) onError(err);
    }
  };

  const initializeCamera = async () => {
    if (permissionState === 'denied') {
      setError('Camera access denied. Please reset permissions and try again.');
      return;
    }

    try {
      setError('');
      setScanCount(0);
      
      // Get available video devices
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      
      // Use selected device or default to back camera
      const deviceId = selectedDevice || getPreferredCamera(videoDevices);
      
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasPermission(true);
        setPermissionState('granted');
        
        // Wait for video to be ready before starting scan
        videoRef.current.addEventListener('loadedmetadata', () => {
          setTimeout(() => {
            startScanning();
          }, 1000);
        });
      }
    } catch (err) {
      console.error('Camera initialization error:', err);
      setHasPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setPermissionState('denied');
        setError('Camera access denied. Please click "Allow Camera Access" above to grant permission.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please check your device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is busy or unavailable. Please close other camera applications.');
      } else {
        setError('Error accessing camera: ' + err.message);
      }
      
      if (onError) onError(err);
    }
  };

  const getPreferredCamera = (devices) => {
    // Try to find back/rear camera
    const backCamera = devices.find(device => 
      device.label.toLowerCase().includes('back') || 
      device.label.toLowerCase().includes('rear') ||
      device.label.toLowerCase().includes('environment')
    );
    
    if (backCamera) {
      console.log('🎥 Using back camera:', backCamera.label);
      return backCamera.deviceId;
    }
    
    console.log('🎥 Using default camera:', devices[0]?.label || 'Unknown');
    return devices[0]?.deviceId || '';
  };

  const startScanning = () => {
    if (!isScanning && jsQR) {
      console.log('📷 Starting QR code scanning...');
      setIsScanning(true);
      scanIntervalRef.current = setInterval(scanFrame, 300);
    }
  };

  const stopScanning = () => {
    console.log('🛑 Stopping QR code scanning...');
    setIsScanning(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => {
        track.stop();
        console.log('📷 Camera track stopped:', track.label);
      });
      videoRef.current.srcObject = null;
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setScanCount(prev => prev + 1);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code && code.data) {
        console.log('📱 QR Code detected:', code.data);
        handleScanResult(code.data);
      }
    } catch (err) {
      console.warn('⚠️ Scan frame error:', err);
    }
  };

  const handleScanResult = (result) => {
    if (result && onScan) {
      const couponCode = extractCouponCode(result);
      console.log('🎯 Extracted coupon code:', couponCode, 'from URL:', result);
      
      if (couponCode) {
        console.log('✅ Valid coupon code found, calling onScan callback');
        onScan(couponCode, result);
        
        // Brief pause after successful scan
        setIsScanning(false);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        
        setTimeout(() => {
          if (isActive && jsQR) {
            console.log('🔄 Resuming scanning after successful scan');
            setIsScanning(true);
            scanIntervalRef.current = setInterval(scanFrame, 300);
          }
        }, 2000);
      }
    }
  };

  const extractCouponCode = (url) => {
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
  };

  const switchCamera = (deviceId) => {
    console.log('📷 Switching camera to:', deviceId);
    setSelectedDevice(deviceId);
    stopScanning();
  };

  if (!isActive) {
    return null;
  }

  // Show permission request UI
  if (permissionState === 'denied' || (permissionState === 'prompt' && hasPermission === false)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">📷</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Camera Access Required</h3>
          <p className="text-red-700 mb-4">
            {error || "Please allow camera access to scan QR codes"}
          </p>
          
          <button
            onClick={requestCameraPermission}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            🔓 Allow Camera Access
          </button>
          
          <div className="mt-4 text-sm text-red-600 bg-red-100 rounded p-3">
            <p className="font-medium mb-2">📋 Troubleshooting Steps:</p>
            <ul className="text-left space-y-1">
              <li>1. Click "Allow Camera Access" above</li>
              <li>2. Look for camera permission popup in browser</li>
              <li>3. Select "Allow" when prompted</li>
              <li>4. Check browser address bar for camera icon 🎥</li>
              <li>5. Refresh page if needed</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isCheckingPermissions || hasPermission === null) {
    return (
      <div className="text-center py-8 bg-blue-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
        <p className="text-blue-700 font-medium">
          {isCheckingPermissions ? 'Checking camera permissions...' : 'Requesting camera access...'}
        </p>
        <p className="text-blue-600 text-sm mt-1">
          {isCheckingPermissions ? 'Please wait...' : 'Please allow camera permissions when prompted'}
        </p>
        
        {!isCheckingPermissions && (
          <button
            onClick={requestCameraPermission}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            🔄 Request Permission
          </button>
        )}
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
              isScanning ? 'bg-green-400 animate-pulse' : hasPermission ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isScanning ? `Scanning... (${scanCount} frames)` : hasPermission ? 'Ready' : 'Initializing...'}
            </span>
          </div>
          
          {devices.length > 1 && (
            <select
              value={selectedDevice}
              onChange={(e) => switchCamera(e.target.value)}
              className="text-sm bg-white border border-gray-300 rounded px-2 py-1 min-w-32"
            >
              <option value="">📷 Auto Select</option>
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <p className="text-sm text-gray-600">
          {jsQR ? 
            '📱 Point your camera at a QR code to automatically scan the coupon' :
            '⚠️ QR scanning library loading... Manual entry available below'
          }
        </p>
      </div>

      {/* Error display */}
      {error && hasPermission !== false && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start space-x-2 text-yellow-700">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="font-medium">Camera Issue</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={initializeCamera}
            className="mt-2 bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
          >
            🔄 Try Again
          </button>
        </div>
      )}

      {/* Video Scanner */}
      {hasPermission && (
        <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
          <video
            ref={videoRef}
            className="w-full h-64 object-cover"
            playsInline
            muted
            autoPlay
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
                <div className="h-0.5 w-3/4 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse"></div>
              </div>
            )}
            
            {/* Center target */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-white rounded-lg opacity-50"></div>
            </div>
          </div>
          
          {/* Status indicators */}
          <div className="absolute top-2 left-2 flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              {isScanning ? 'SCANNING' : 'PAUSED'}
            </span>
          </div>
          
          {jsQR && (
            <div className="absolute top-2 right-2">
              <span className="text-white text-xs bg-green-600 bg-opacity-75 px-2 py-1 rounded">
                jsQR READY
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Instructions */}
      {hasPermission && (
        <div className="mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-700">
              <p className="font-medium flex items-center space-x-2">
                <span>💡</span>
                <span>Scanning Tips:</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Hold phone steady, about 6-12 inches from QR code</li>
                <li>• Ensure good lighting on the QR code</li>
                <li>• Wait for the scanning line to pass over the code</li>
                <li>• The coupon code will auto-fill when detected</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}