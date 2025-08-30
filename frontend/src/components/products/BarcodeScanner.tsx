import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Flashlight, FlashlightOff, RotateCcw } from 'lucide-react';
import { Product } from '../../types';
import { apiClient } from '../../services/apiClient';
import LoadingSpinner from '../LoadingSpinner';

interface BarcodeScannerProps {
  onProductFound: (product: Product) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onProductFound,
  onClose,
  isOpen
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastScanTime, setLastScanTime] = useState(0);

  useEffect(() => {
    if (isOpen) {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, currentCameraIndex]);

  const initializeCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);

      if (videoDevices.length === 0) {
        throw new Error('No cameras found');
      }

      // Request camera permission and start stream
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: videoDevices[currentCameraIndex]?.deviceId,
          facingMode: currentCameraIndex === 0 ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // Check if flash is available
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      setHasFlash('torch' in capabilities);

      setIsScanning(true);
      startScanning();
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message as string : 'Failed to access camera';
      setError(errorMessage);
      console.error('Camera initialization error:', err);
    }
  }, [currentCameraIndex]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  }, [stream]);

  const toggleFlash = async () => {
    if (!stream || !hasFlash) return;

    try {
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !flashEnabled } as { torch: boolean }]
      });
      setFlashEnabled(!flashEnabled);
    } catch (err) {
      console.error('Failed to toggle flash:', err);
    }
  };

  const switchCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
    }
  };

  const startScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const scanInterval = setInterval(() => {
      if (!isScanning || !videoRef.current || !canvasRef.current) {
        clearInterval(scanInterval);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data for barcode detection
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Simple barcode detection simulation
      // In a real implementation, you would use a library like QuaggaJS or ZXing
      detectBarcode(imageData);
    }, 500); // Scan every 500ms
  }, [isScanning]);

  const detectBarcode = async (_imageData: ImageData) => {
    // This is a simplified barcode detection
    // In production, you would use a proper barcode scanning library
    
    // For demo purposes, we'll simulate finding a barcode after a few seconds
    const now = Date.now();
    if (now - lastScanTime < 3000) return; // Prevent rapid scanning
    
    // Simulate barcode detection with a mock UPC
    const mockUPC = '123456789012'; // This would come from actual barcode detection
    
    try {
      const response = await apiClient.get<Product>(`/products/barcode?upc=${mockUPC}`);
      setLastScanTime(now);
      onProductFound(response.data);
      onClose();
    } catch (err) {
      // Product not found, continue scanning
      console.log('Product not found for UPC:', mockUPC);
    }
  };

  const handleManualInput = async () => {
    const upc = prompt('Enter UPC/Barcode manually:');
    if (!upc) return;

    try {
      const response = await apiClient.get<Product>(`/products/barcode?upc=${upc}`);
      onProductFound(response.data);
      onClose();
    } catch (err) {
      alert('Product not found for the entered UPC');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
        <div className="flex items-center gap-2">
          {hasFlash && (
            <button
              onClick={toggleFlash}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {flashEnabled ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
            </button>
          )}
          
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Camera className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Camera Error</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={initializeCamera}
                className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleManualInput}
                className="block w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Enter UPC Manually
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Scanning Frame */}
                <div className="w-64 h-40 border-2 border-white rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  
                  {/* Scanning Line Animation */}
                  {isScanning && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 animate-pulse"></div>
                  )}
                </div>
                
                <p className="text-white text-center mt-4 bg-black/50 px-4 py-2 rounded-lg">
                  Position barcode within the frame
                </p>
              </div>
            </div>

            {/* Hidden canvas for image processing */}
            <canvas
              ref={canvasRef}
              className="hidden"
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-900">
        <div className="flex justify-center gap-4">
          <button
            onClick={handleManualInput}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Enter Manually
          </button>
          
          {isScanning && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 rounded-lg">
              <LoadingSpinner size="sm" />
              <span className="text-white">Scanning...</span>
            </div>
          )}
        </div>
        
        <p className="text-gray-400 text-sm text-center mt-3">
          Point your camera at a product barcode to add it to your watchlist
        </p>
      </div>
    </div>
  );
};