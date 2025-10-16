from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import io
from PIL import Image
import time
import os

# Set environment for headless operation before importing YOLO
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
os.environ['MPLBACKEND'] = 'Agg'

# YOLO import
from ultralytics import YOLO
print("YOLO successfully imported!")

app = FastAPI(
    title="STAND Backend API",
    description="FastAPI backend for STAND application with Object Detection",
    version="1.0.0"
)

# Initialize YOLO model
print("Loading YOLOv8n model...")
try:
    # Try to load existing model
    model = YOLO('yolov8n.pt')
    print("YOLO model loaded from cache successfully!")
except Exception as e:
    print(f"Model not found in cache: {e}")
    print("Downloading YOLOv8n model...")
    try:
        # Download model if not exists
        model = YOLO('yolov8n.pt')
        print("YOLO model downloaded and loaded successfully!")
    except Exception as download_error:
        print(f"Failed to download model: {download_error}")
        # Fallback to pretrained model
        model = YOLO('yolov8n.pt')
        print("YOLO model loaded with fallback method!")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://0.0.0.0:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        "https://localhost",
        "https://127.0.0.1",
        # Telefon erişimi için IP adresi
        "https://192.168.1.113",
        "http://192.168.1.113",
        # Add specific IP ranges for local development only
        "http://192.168.1.1:5173",
        "http://192.168.0.1:5173",
        "http://10.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
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
async def root():
    """Root endpoint"""
    return {"message": "Welcome to STAND Backend API"}

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="Backend is running successfully"
    )

@app.get("/api/hello", response_model=HelloResponse)
async def hello():
    """Example API endpoint"""
    return HelloResponse(
        message="Hello from FastAPI backend!",
        status="success"
    )

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
async def detect_objects(file: UploadFile = File(...)):
    """Detect objects in uploaded image using YOLO"""
    try:
        start_time = time.time()
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        
        # Read and validate file size (max 2MB)
        contents = await file.read()
        if len(contents) > 2 * 1024 * 1024:  # 2MB limit for better performance
            raise HTTPException(status_code=413, detail="File size too large. Maximum 2MB allowed")
        
        # Validate and decode image
        try:
            image = Image.open(io.BytesIO(contents))
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")
        
        # Object detection with YOLO
        try:
            detections = yolo_object_detection(image)
        except Exception as detection_error:
            raise HTTPException(status_code=500, detail=f"Object detection failed: {str(detection_error)}")
        
        # Calculate processing time and FPS
        processing_time = time.time() - start_time
        fps = 1.0 / processing_time if processing_time > 0 else 0.0
        
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
        print(f"Unexpected error in detect_objects: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during image processing")

@app.get("/api/model_info")
async def get_model_info():
    """Get information about the detection model"""
    return {
        "model_name": "YOLOv8n",
        "input_size": "640x640",
        "target_fps": 3,
        "classes": list(model.names.values()),
        "total_classes": len(model.names),
        "description": "YOLOv8n object detection model"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)