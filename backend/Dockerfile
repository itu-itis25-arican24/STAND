# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (including OpenCV/YOLO requirements)
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libgomp1 \
    libgthread-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for headless YOLO operation
ENV QT_QPA_PLATFORM=offscreen
ENV MPLBACKEND=Agg

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]