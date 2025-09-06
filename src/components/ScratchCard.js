'use client';
import { useState, useRef, useEffect } from 'react';

export default function ScratchCard({ couponCode, onScratch }) {
  const canvasRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scratchPercentage, setScratchPercentage] = useState(0);

  useEffect(() => {
    initializeCanvas();
  }, []);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 250 * dpr;
    canvas.style.width = '400px';
    canvas.style.height = '250px';
    
    ctx.scale(dpr, dpr);
    
    // Create scratch surface with gradient
    const gradient = ctx.createLinearGradient(0, 0, 400, 250);
    gradient.addColorStop(0, '#C0C0C0');
    gradient.addColorStop(0.5, '#A0A0A0');
    gradient.addColorStop(1, '#808080');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 250);
    
    // Add scratch surface pattern
    ctx.fillStyle = '#999';
    for (let i = 0; i < 400; i += 20) {
      for (let j = 0; j < 250; j += 20) {
        if ((i + j) % 40 === 0) {
          ctx.fillRect(i, j, 2, 2);
        }
      }
    }
    
    // Add "Scratch Here" text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', 200, 120);
    
    ctx.font = '16px Arial';
    ctx.fillText('Scratch to reveal your prize!', 200, 150);
    
    // Add coins/scratch icons
    ctx.font = '30px Arial';
    ctx.fillText('🪙', 160, 100);
    ctx.fillText('🪙', 240, 100);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getTouchPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const scratch = (x, y) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, 2 * Math.PI);
    ctx.fill();
    
    // Check scratch percentage
    checkScratchPercentage();
  };

  const checkScratchPercentage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    let transparentPixels = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparentPixels++;
    }
    
    const percentage = (transparentPixels / (canvas.width * canvas.height)) * 100;
    setScratchPercentage(percentage);
    
    if (percentage > 30 && !isRevealed) {
      setIsRevealed(true);
      onScratch(couponCode);
    }
  };

  // Mouse events
  const handleMouseDown = (e) => {
    if (isRevealed) return;
    setIsDrawing(true);
    const pos = getMousePos(e);
    scratch(pos.x, pos.y);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || isRevealed) return;
    const pos = getMousePos(e);
    scratch(pos.x, pos.y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (isRevealed) return;
    setIsDrawing(true);
    const pos = getTouchPos(e);
    scratch(pos.x, pos.y);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isDrawing || isRevealed) return;
    const pos = getTouchPos(e);
    scratch(pos.x, pos.y);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  return (
    <div className="relative">
      {/* Prize content behind the scratch surface */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 rounded-lg shadow-lg border-4 border-yellow-500">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{couponCode}</h2>
          <p className="text-lg text-gray-700 font-semibold">Congratulations!</p>
          <p className="text-sm text-gray-600 mt-2">You&apos;ve won a prize!</p>
        </div>
      </div>
      
      {/* Scratch overlay */}
      <canvas
        ref={canvasRef}
        className={`relative z-10 rounded-lg shadow-lg border-2 border-gray-300 ${
          isRevealed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      />
      
      {/* Progress indicator */}
      {!isRevealed && scratchPercentage > 0 && (
        <div className="mt-4 text-center">
          <div className="bg-gray-200 rounded-full h-3 w-64 mx-auto">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(scratchPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {scratchPercentage.toFixed(1)}% scratched
            {scratchPercentage > 25 ? ' - Almost there!' : ''}
          </p>
        </div>
      )}
      
      {/* Instructions */}
      {!isRevealed && (
        <div className="mt-4 text-center text-gray-600">
          <p className="text-sm">💡 Use your mouse or finger to scratch the card</p>
          <p className="text-xs mt-1">Scratch at least 30% to reveal your prize</p>
        </div>
      )}
    </div>
  );
}