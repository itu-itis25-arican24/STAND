import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [showCamera, setShowCamera] = useState(false)
  const [cameras, setCameras] = useState([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [error, setError] = useState('')
  const [detections, setDetections] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [fps, setFps] = useState(0)
  const [currentFacingMode, setCurrentFacingMode] = useState('user')
  const [processingStatus, setProcessingStatus] = useState(null)
  const [isProcessingAllowed, setIsProcessingAllowed] = useState(true)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const processingIntervalRef = useRef(null)

  useEffect(() => {
    // Check device type and requirements
    const isAndroid = /Android/i.test(navigator.userAgent)
    const isChrome = /Chrome/i.test(navigator.userAgent)
    
    console.log('Device detection:', { isAndroid, isChrome, userAgent: navigator.userAgent })
    
    // Check if HTTPS is required
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setError('Mobil cihazlarda kamera erişimi için HTTPS gerekli. Lütfen güvenli bağlantı kullanın.')
    } else if (isAndroid && !isChrome) {
      setError('Android cihazlarda Chrome tarayıcı kullanmanız önerilir.')
    }
    
    // Get available cameras when component mounts
    getAvailableCameras()
  }, [])

  // Processing status monitoring - 10 saniyede bir kontrol et
  useEffect(() => {
    const fetchProcessingStatus = async () => {
      try {
        const response = await axios.get('/api/processing-status')
        const data = response.data
        setProcessingStatus(data)
        setIsProcessingAllowed(data.is_available)
      } catch (error) {
        console.error('Failed to fetch processing status:', error)
      }
    }

    // 10 saniyede bir kontrol et (dakikada 6 istek)
    const interval = setInterval(fetchProcessingStatus, 10000)
    fetchProcessingStatus() // Initial fetch

    return () => clearInterval(interval)
  }, [])

  // Prevent body scroll when camera is open
  useEffect(() => {
    if (showCamera) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    
    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [showCamera])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop processing
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current)
        processingIntervalRef.current = null
      }
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      // Backend'e işlem durdurma isteği gönder (async olmadan)
      axios.post('/api/stop-processing')
        .then(() => console.log('Processing stopped on component unmount'))
        .catch(error => console.error('Failed to stop processing on unmount:', error))
      
      // Restore body scroll
      document.body.style.overflow = 'auto'
    }
  }, [])

  const getAvailableCameras = async () => {
    try {
      console.log('Checking camera permissions...')
      console.log('User Agent:', navigator.userAgent)
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera desteği bulunamadı')
      }
      
      // Android-specific camera constraints
      const isAndroid = /Android/i.test(navigator.userAgent)
      const isChrome = /Chrome/i.test(navigator.userAgent)
      
      console.log('Device info:', { isAndroid, isChrome })
      
      let constraints = {
        video: {
          width: { ideal: 640, max: 1920 },
          height: { ideal: 480, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      }
      
      // Android Chrome için özel ayarlar
      if (isAndroid && isChrome) {
        constraints.video.facingMode = 'environment' // Arka kamera ile başla
      }
      
      console.log('Using constraints:', constraints)
      
      // First request camera permission to get device labels
      console.log('Requesting camera permission...')
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Camera permission granted, stream:', stream)
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.label)
        track.stop()
      })
      
      // Now enumerate devices with labels
      console.log('Enumerating devices...')
      const devices = await navigator.mediaDevices.enumerateDevices()
      console.log('All devices:', devices)
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      console.log('Video devices found:', videoDevices)
      
      // Android için fallback - eğer device labels yoksa gerçek kameraları test et
      if (videoDevices.length === 0 || videoDevices.every(device => !device.label)) {
        console.log('No labeled devices found, testing available cameras for Android')
        
        // Test available cameras by trying to access them
        const fallbackCameras = []
        
        // Test front camera
        try {
          const frontStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
          })
          frontStream.getTracks().forEach(track => track.stop())
          fallbackCameras.push({ 
            deviceId: 'user', 
            label: 'Ön Kamera', 
            kind: 'videoinput',
            facingMode: 'user'
          })
        } catch (e) {
          console.log('Front camera not available')
        }
        
        // Test back camera
        try {
          const backStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          })
          backStream.getTracks().forEach(track => track.stop())
          fallbackCameras.push({ 
            deviceId: 'environment', 
            label: 'Arka Kamera', 
            kind: 'videoinput',
            facingMode: 'environment'
          })
        } catch (e) {
          console.log('Back camera not available')
        }
        
        if (fallbackCameras.length > 0) {
          setCameras(fallbackCameras)
          console.log('Using fallback cameras:', fallbackCameras)
          return
        }
      }
      
      setCameras(videoDevices)
    } catch (err) {
      console.error('Error getting cameras:', err)
      let errorMessage = 'Kamera erişimi için izin gerekli.'
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Kamera izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.'
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Kamera bulunamadı.'
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Bu tarayıcı kamera desteklemiyor.'
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Kamera başka bir uygulama tarafından kullanılıyor.'
      }
      
      setError(errorMessage)
    }
  }

  const startCamera = async () => {
    try {
      setError('')
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // Android-specific camera handling
      const isAndroid = /Android/i.test(navigator.userAgent)
      const currentCamera = cameras[currentCameraIndex]
      
      let constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      }
      
      // Android için özel kamera seçimi
      if (isAndroid) {
        if (currentCamera?.facingMode) {
          // Use facingMode for fallback cameras
          constraints.video.facingMode = currentCamera.facingMode
          setCurrentFacingMode(currentCamera.facingMode)
        } else if (currentCamera?.deviceId === 'front-camera' || currentCamera?.label?.toLowerCase().includes('ön')) {
          constraints.video.facingMode = 'user'
          setCurrentFacingMode('user')
        } else if (currentCamera?.deviceId === 'back-camera' || currentCamera?.label?.toLowerCase().includes('arka')) {
          constraints.video.facingMode = 'environment'
          setCurrentFacingMode('environment')
        } else if (currentCamera?.deviceId) {
          constraints.video.deviceId = { exact: currentCamera.deviceId }
          setCurrentFacingMode('unknown')
        }
      } else {
        // Desktop için normal device ID kullan
        if (currentCamera?.deviceId) {
          constraints.video.deviceId = { exact: currentCamera.deviceId }
          setCurrentFacingMode('unknown')
        }
      }
      
      console.log('Camera constraints for', currentCamera?.label, ':', constraints)

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Stream obtained:', stream)
      streamRef.current = stream
      
      setShowCamera(true)
      
      // Video element'ini stream'e bağla - setTimeout ile DOM güncellemesini bekle
      setTimeout(() => {
        if (videoRef.current && stream) {
          console.log('Setting video srcObject')
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded, starting play')
            videoRef.current.play().catch(console.error)
          }
        } else {
          console.log('Video ref or stream not available:', { videoRef: videoRef.current, stream })
        }
      }, 100)
      
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Kameraya erişilemedi. Lütfen kamera izinlerini kontrol edin.')
    }
  }

  const stopCamera = async () => {
    // Stop processing first
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
      processingIntervalRef.current = null
    }
    
    // Backend'e işlem durdurma isteği gönder
    try {
      await axios.post('/api/stop-processing')
      console.log('Processing stopped on camera close')
      // Hemen state'i güncelle
      setIsProcessingAllowed(true)
    } catch (error) {
      console.error('Failed to stop processing on camera close:', error)
    }
    
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('Stopped track:', track.label)
      })
      streamRef.current = null
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.load()
    }
    
    // Reset states
    setShowCamera(false)
    setDetections([])
    setFps(0)
    setIsProcessing(false)
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return
    
    // Stop current stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    
    // Small delay before starting new camera
    setTimeout(async () => {
      try {
        // Android-specific camera switching
        const isAndroid = /Android/i.test(navigator.userAgent)
        const nextCamera = cameras[nextIndex]
        
        let constraints = {
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        }
        
        // Android için özel kamera seçimi
        if (isAndroid) {
          if (nextCamera?.facingMode) {
            // Use facingMode for fallback cameras
            constraints.video.facingMode = nextCamera.facingMode
            setCurrentFacingMode(nextCamera.facingMode)
          } else if (nextCamera?.deviceId === 'front-camera' || nextCamera?.label?.toLowerCase().includes('ön')) {
            constraints.video.facingMode = 'user'
            setCurrentFacingMode('user')
          } else if (nextCamera?.deviceId === 'back-camera' || nextCamera?.label?.toLowerCase().includes('arka')) {
            constraints.video.facingMode = 'environment'
            setCurrentFacingMode('environment')
          } else if (nextCamera?.deviceId) {
            constraints.video.deviceId = { exact: nextCamera.deviceId }
            setCurrentFacingMode('unknown')
          }
        } else {
          // Desktop için normal device ID kullan
          if (nextCamera?.deviceId) {
            constraints.video.deviceId = { exact: nextCamera.deviceId }
            setCurrentFacingMode('unknown')
          }
        }
        
        console.log('Switching to camera:', nextCamera?.label, 'with constraints:', constraints)

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(console.error)
          }
        }
      } catch (err) {
        console.error('Error switching camera:', err)
        setError('Kamera değiştirilemedi')
      }
    }, 200)
  }

  const getCameraLabel = (camera, index) => {
    if (camera.label) {
      // Clean up the label for better display
      let label = camera.label
      if (label.toLowerCase().includes('front') || label.toLowerCase().includes('user')) {
        return 'Ön Kamera'
      } else if (label.toLowerCase().includes('back') || label.toLowerCase().includes('environment')) {
        return 'Arka Kamera'
      }
      return label
    }
    return `Kamera ${index + 1}`
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', 0.8)
    })
  }, [])

  const sendFrameToBackend = useCallback(async (frameBlob) => {
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', frameBlob, 'frame.jpg')
      
      console.log('Sending frame to backend...', { size: frameBlob.size, type: frameBlob.type })
      
      const response = await axios.post('/api/detect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 3000, // Reduced timeout to 3 seconds
      })
      
      console.log('Backend response:', response.data)
      
      if (response.data.detections) {
        setDetections(response.data.detections)
        setFps(response.data.fps)
        console.log('Updated detections:', response.data.detections)
      }
    } catch (error) {
      console.error('Error sending frame to backend:', error)
      
      // Handle different error types with exponential backoff
      if (error.code === 'ECONNABORTED') {
        console.warn('Request timeout - backend may be overloaded')
        // Skip next few frames to reduce load
        setTimeout(() => setIsProcessing(false), 2000)
        return
      } else if (error.response?.status === 413) {
        console.warn('File too large - reducing frame quality')
      } else if (error.response?.status === 400) {
        console.warn('Invalid image format')
      } else if (error.response?.status >= 500) {
        console.warn('Backend server error')
        // Back off on server errors
        setTimeout(() => setIsProcessing(false), 1000)
        return
      } else {
        console.warn('Network error:', error.message)
      }
      
      // Don't update state on error to avoid clearing existing detections
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing])

  const startProcessing = useCallback(async () => {
    if (processingIntervalRef.current) return
    
    // Backend'e işlem başlatma isteği gönder
    try {
      const response = await axios.post('/api/start-processing')
      if (response.data.status === 'success') {
        console.log('Processing started successfully')
        // Hemen state'i güncelle
        setIsProcessingAllowed(false)
      } else if (response.data.status === 'already_active') {
        console.log('User already processing, no state change needed')
        // Kullanıcı zaten aktifse state'i değiştirme
        return
      }
    } catch (error) {
      if (error.response?.status === 429) {
        setError('Servis şu anda dolu. Lütfen daha sonra tekrar deneyin.')
        return
      }
      console.error('Failed to start processing:', error)
      return
    }
    
    // Reduced FPS to 1.3 for better performance and reduced server load
    processingIntervalRef.current = setInterval(async () => {
      const frameBlob = await captureFrame()
      if (frameBlob) {
        await sendFrameToBackend(frameBlob)
      }
    }, 1000 / 1.3) // 1.3 FPS - safe for rate limits
  }, [captureFrame, sendFrameToBackend])

  const stopProcessing = useCallback(async () => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
      processingIntervalRef.current = null
    }
    setDetections([])
    setFps(0)
    
    // Backend'e işlem durdurma isteği gönder
    try {
      await axios.post('/api/stop-processing')
      console.log('Processing stopped successfully')
      // Hemen state'i güncelle
      setIsProcessingAllowed(true)
    } catch (error) {
      console.error('Failed to stop processing:', error)
    }
  }, [])

  if (showCamera) {
    return (
      <div className="camera-view">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            backgroundColor: '#000',
            transform: currentFacingMode === 'user' ? 'scaleX(-1)' : 'none'
          }}
          onLoadedMetadata={() => {
            console.log('Video metadata loaded, ready for processing')
          }}
        />
        
        {/* Hidden canvas for frame capture */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Detection overlays */}
        <div className="detection-overlay">
          {detections.map((detection, index) => {
            // Calculate scaling factors
            const video = videoRef.current;
            if (!video) return null;
            
            const videoRect = video.getBoundingClientRect();
            const scaleX = videoRect.width / video.videoWidth;
            const scaleY = videoRect.height / video.videoHeight;
            
            // Scale bounding box coordinates to match video display size
            const scaledBbox = [
              detection.bbox[0] * scaleX,
              detection.bbox[1] * scaleY,
              detection.bbox[2] * scaleX,
              detection.bbox[3] * scaleY
            ];
            
            return (
              <div
                key={index}
                className="detection-box"
                style={{
                  left: `${scaledBbox[0]}px`,
                  top: `${scaledBbox[1]}px`,
                  width: `${scaledBbox[2] - scaledBbox[0]}px`,
                  height: `${scaledBbox[3] - scaledBbox[1]}px`,
                }}
              >
                <div className="detection-label">
                  {detection.class_name} ({Math.round(detection.confidence * 100)}%)
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="camera-controls">
          <button 
            onClick={startProcessing}
            className={`processing-btn ${isProcessing ? 'active' : ''}`}
            title={isProcessingAllowed ? "Nesne Algılamayı Başlat" : "Servis dolu - bekleyin"}
            disabled={!isProcessingAllowed}
          >
            🤖
          </button>
          
          <button 
            onClick={stopProcessing}
            className="stop-processing-btn"
            title="Nesne Algılamayı Durdur"
          >
            ⏹️
          </button>
          
          {cameras.length > 1 && (
            <button 
              onClick={switchCamera}
              className="switch-camera-btn"
              title="Kamerayı Değiştir"
            >
              🔄
            </button>
          )}
          
          <button 
            onClick={() => {
              stopProcessing()
              stopCamera()
            }}
            className="stop-camera-btn"
            title="Kamerayı Kapat"
          >
            ✕
          </button>
        </div>
        
        <div className="camera-info">
          <span>{getCameraLabel(cameras[currentCameraIndex], currentCameraIndex)}</span>
          {fps > 0 && (
            <span className="fps-info">FPS: {Math.round(fps)}</span>
          )}
          {detections.length > 0 && (
            <span className="detection-count">
              {detections.length} nesne algılandı
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="home-screen">
        <div className="logo-section">
          <div className="logo">
            <h1>📸 STAND</h1>
            <p>Kamera Uygulaması</p>
          </div>
        </div>

        {/* Processing Status Warning */}
        {processingStatus && !isProcessingAllowed && (
          <div className="processing-warning">
            <div className="warning-content">
              <div className="warning-icon">⚠️</div>
              <div className="warning-text">
                <h3>Servis Yoğunluğu</h3>
                <p>
                  Şu anda {processingStatus.current_count}/{processingStatus.max_limit} kişi işlem yapıyor.
                  Lütfen bekleyin.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="start-section">
          <button 
            onClick={startCamera}
            className="start-camera-btn"
            disabled={cameras.length === 0}
          >
            📷 Kamerayı Başlat
          </button>
          
          <button 
            onClick={getAvailableCameras}
            className="test-camera-btn"
          >
            🔍 Kameraları Test Et
          </button>
          
          {cameras.length > 0 ? (
            <div className="camera-info-section">
              <p className="camera-count">
                {cameras.length} kamera bulundu
              </p>
              <div className="camera-list">
                {cameras.map((camera, index) => (
                  <span key={camera.deviceId} className="camera-item">
                    {getCameraLabel(camera, index)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="camera-count">
              Kamera algılanamadı
            </p>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
