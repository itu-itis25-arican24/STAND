from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List
import io
from PIL import Image
import time
import os
import logging
import threading
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Set environment for headless operation before importing YOLO
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
os.environ['MPLBACKEND'] = 'Agg'

# YOLO import
from ultralytics import YOLO
print("YOLO successfully imported!")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Basit işlem limiti sistemi
MAX_ACTIVE_PROCESSING = 1  # Test için maksimum 1 kişi aynı anda işlem yapabilir
current_processing_count = 0
processing_lock = threading.Lock()
active_users = set()  # Aktif kullanıcıları takip et
user_last_seen = {}  # Kullanıcıların son görülme zamanları

def cleanup_inactive_users():
    """Aktif olmayan kullanıcıları temizle"""
    global current_processing_count, active_users, user_last_seen
    current_time = time.time()
    
    with processing_lock:
        inactive_users = []
        for user_id in list(active_users):
            last_seen = user_last_seen.get(user_id, 0)
            # 5 saniye boyunca detect isteği gelmemişse kullanıcıyı temizle
            # Detect istekleri 1.3 FPS'de geliyor, 5 saniye güvenli
            if current_time - last_seen > 5:
                inactive_users.append(user_id)
        
        for user_id in inactive_users:
            active_users.discard(user_id)
            user_last_seen.pop(user_id, None)
            current_processing_count = max(0, current_processing_count - 1)
            logger.info(f"Cleaned up inactive user {user_id}. Current count: {current_processing_count}")

app = FastAPI(
    title="STAND Backend API",
    description="FastAPI backend for STAND application with Object Detection",
    version="1.0.0",
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None  # Disable ReDoc in production
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add trusted host middleware - Allow all hosts for ngrok
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Allow all hosts for ngrok compatibility
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# Initialize YOLO model
print("Loading YOLOv8n model...")
import os

# Model dosyası için volume path
MODEL_PATH = '/app/models/yolov8n.pt'
os.makedirs('/app/models', exist_ok=True)

try:
    # Önce volume'da model var mı kontrol et
    if os.path.exists(MODEL_PATH):
        print(f"Loading model from volume: {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        print("YOLO model loaded from volume successfully!")
    else:
        print("Model not found in volume, downloading...")
        # Model dosyasını indir ve volume'a kaydet
        model = YOLO('yolov8n.pt')
        # Model dosyasını volume'a kopyala
        import shutil
        shutil.copy('yolov8n.pt', MODEL_PATH)
        print(f"YOLO model downloaded and saved to volume: {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")
    # Fallback: direkt YOLO kullan
    model = YOLO('yolov8n.pt')
    print("YOLO model loaded with fallback method!")

# CORS middleware for frontend communication - SECURE CONFIGURATION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development only
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        # Local network access
        "http://192.168.1.113:5173",  # User's local IP
        # Ngrok domains (will be added dynamically)
        "https://*.ngrok.io",
        "https://*.ngrok-free.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Reduced methods
    allow_headers=["Content-Type", "Authorization"],  # Reduced headers
)

# Response models
class HelloResponse(BaseModel):
    message: str
    status: str

class HealthResponse(BaseModel):
    status: str
    message: str

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] in original image coordinates

class DetectionResponse(BaseModel):
    detections: List[Detection]
    processing_time: float
    fps: float
    timestamp: float


@app.get("/", response_model=Dict[str, str])
@limiter.limit("360/minute")  # Rate limiting
async def root(request: Request):
    """Root endpoint"""
    return {"message": "Welcome to STAND Backend API"}

@app.get("/health", response_model=HealthResponse)
@limiter.limit("360/minute")  # Rate limiting
async def health_check(request: Request):
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="Backend is running successfully"
    )

@app.get("/api/hello", response_model=HelloResponse)
@limiter.limit("360/minute")  # Rate limiting
async def hello(request: Request):
    """Example API endpoint"""
    return HelloResponse(
        message="Hello from FastAPI backend!",
        status="success"
    )


@app.post("/api/start-processing")
@limiter.limit("360/minute")
async def start_processing(request: Request):
    """İşlem başlatma endpoint'i"""
    global current_processing_count, active_users, user_last_seen
    
    # Kullanıcı ID'sini oluştur (IP + User-Agent hash)
    client_ip = request.headers.get("x-forwarded-for", request.client.host)
    user_agent = request.headers.get("user-agent", "")
    user_id = f"{client_ip}_{hash(user_agent) % 10000}"
    
    # Önce aktif olmayan kullanıcıları temizle
    cleanup_inactive_users()
    
    with processing_lock:
        # Eğer kullanıcı zaten aktifse, count'u değiştirme
        if user_id in active_users:
            user_last_seen[user_id] = time.time()  # Son görülme zamanını güncelle
            return {
                "status": "already_active",
                "message": "User already processing",
                "current_count": current_processing_count,
                "max_limit": MAX_ACTIVE_PROCESSING
            }
        
        if current_processing_count >= MAX_ACTIVE_PROCESSING:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Service at capacity",
                    "message": "Maximum processing limit reached. Please wait.",
                    "current_count": current_processing_count,
                    "max_limit": MAX_ACTIVE_PROCESSING
                }
            )
        
        current_processing_count += 1
        active_users.add(user_id)
        user_last_seen[user_id] = time.time()
        logger.info(f"Processing started for user {user_id}. Current count: {current_processing_count}")
        
        return {
            "status": "success",
            "message": "Processing started",
            "current_count": current_processing_count,
            "max_limit": MAX_ACTIVE_PROCESSING
        }

@app.post("/api/stop-processing")
@limiter.limit("360/minute")
async def stop_processing(request: Request):
    """İşlem durdurma endpoint'i"""
    global current_processing_count, active_users, user_last_seen
    
    # Kullanıcı ID'sini oluştur (IP + User-Agent hash)
    client_ip = request.headers.get("x-forwarded-for", request.client.host)
    user_agent = request.headers.get("user-agent", "")
    user_id = f"{client_ip}_{hash(user_agent) % 10000}"
    
    with processing_lock:
        # Eğer kullanıcı aktifse, count'u azalt
        if user_id in active_users:
            current_processing_count -= 1
            active_users.remove(user_id)
            user_last_seen.pop(user_id, None)
            logger.info(f"Processing stopped for user {user_id}. Current count: {current_processing_count}")
        else:
            logger.info(f"User {user_id} was not active, no count change")
        
        return {
            "status": "success",
            "message": "Processing stopped",
            "current_count": current_processing_count,
            "max_limit": MAX_ACTIVE_PROCESSING
        }

@app.get("/api/processing-status")
@limiter.limit("360/minute")
async def get_processing_status(request: Request):
    """İşlem durumu endpoint'i"""
    # Aktif olmayan kullanıcıları temizle
    cleanup_inactive_users()
    
    return {
        "current_count": current_processing_count,
        "max_limit": MAX_ACTIVE_PROCESSING,
        "is_available": current_processing_count < MAX_ACTIVE_PROCESSING,
        "timestamp": time.time()
    }


def yolo_object_detection(image: Image.Image) -> List[Detection]:
    """YOLO object detection"""
    # Run YOLO inference
    results = model(image, verbose=False)
    
    detections = []
    if len(results) > 0:
        result = results[0]
        if result.boxes is not None:
            boxes = result.boxes.xyxy.cpu().numpy()
            confidences = result.boxes.conf.cpu().numpy()
            class_ids = result.boxes.cls.cpu().numpy().astype(int)
            
            for i in range(len(boxes)):
                if confidences[i] > 0.5:  # Confidence threshold
                    detection = Detection(
                        class_id=int(class_ids[i]),
                        class_name=model.names[class_ids[i]],
                        confidence=float(confidences[i]),
                        bbox=boxes[i].tolist()
                    )
                    detections.append(detection)
    
    return detections


@app.post("/api/detect", response_model=DetectionResponse)
@limiter.limit("360/minute")  # Strict rate limiting for AI processing
async def detect_objects(request: Request, file: UploadFile = File(...)):
    """Detect objects in uploaded image using YOLO"""
    try:
        start_time = time.time()
        
        # Kullanıcı ID'sini oluştur ve son görülme zamanını güncelle
        client_ip = request.headers.get("x-forwarded-for", request.client.host)
        user_agent = request.headers.get("user-agent", "")
        user_id = f"{client_ip}_{hash(user_agent) % 10000}"
        user_last_seen[user_id] = time.time()
        
        # Enhanced file validation
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Validate file extension
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        file_ext = os.path.splitext(file.filename.lower())[1]
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Invalid file type. Only image files are allowed")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        
        # Read and validate file size (max 5MB for security)
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(status_code=413, detail="File size too large. Maximum 5MB allowed")
        
        if len(contents) < 100:  # Minimum file size
            raise HTTPException(status_code=400, detail="File too small")
        
        # Validate and decode image
        try:
            image = Image.open(io.BytesIO(contents))
            # Validate image dimensions
            if image.width > 4096 or image.height > 4096:
                raise HTTPException(status_code=400, detail="Image dimensions too large")
            if image.width < 32 or image.height < 32:
                raise HTTPException(status_code=400, detail="Image dimensions too small")
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
        except Exception as e:
            logger.warning(f"Invalid image format from {request.client.host}: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Object detection with YOLO
        try:
            detections = yolo_object_detection(image)
        except Exception as detection_error:
            logger.error(f"Object detection failed: {str(detection_error)}")
            raise HTTPException(status_code=500, detail="Object detection service temporarily unavailable")
        
        # Calculate processing time and FPS
        processing_time = time.time() - start_time
        fps = 1.0 / processing_time if processing_time > 0 else 0.0
        
        logger.info(f"Detection completed in {processing_time:.3f}s for {request.client.host}")
        
        return DetectionResponse(
            detections=detections,
            processing_time=round(processing_time, 3),
            fps=round(fps, 1),
            timestamp=time.time()
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in detect_objects from {request.client.host}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Model info endpoint removed for security reasons
# @app.get("/api/model_info")
# async def get_model_info():
#     """Get information about the detection model"""
#     return {
#         "model_name": "YOLOv8n",
#         "input_size": "640x640",
#         "target_fps": 3,
#         "classes": list(model.names.values()),
#         "total_classes": len(model.names),
#         "description": "YOLOv8n object detection model"
#     }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)