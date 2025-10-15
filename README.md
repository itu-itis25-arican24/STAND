# 🚀 STAND - Fullstack React + FastAPI Application

Modern bir fullstack web uygulaması - React frontend ve FastAPI backend ile Docker containerization.

## 🏗️ Teknoloji Stack

### Frontend
- **React 18** - Modern UI framework
- **Vite** - Hızlı build tool ve dev server
- **Axios** - HTTP client
- **Modern CSS** - Responsive tasarım

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **CORS** - Cross-origin resource sharing

### DevOps & Development
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **GitHub Codespaces** - Cloud development environment

## 📁 Proje Yapısı

```
STAND/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Ana FastAPI uygulaması
│   │   └── __init__.py
│   ├── Dockerfile          # Backend container
│   ├── requirements.txt    # Python bağımlılıkları
│   └── .dockerignore
├── frontend/               # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.jsx         # Ana React component
│   │   ├── main.jsx        # React entry point
│   │   └── App.css         # Stil dosyaları
│   ├── index.html
│   ├── package.json        # Node.js bağımlılıkları
│   ├── vite.config.js      # Vite yapılandırması
│   └── Dockerfile          # Frontend container
├── .devcontainer/          # GitHub Codespaces yapılandırması
│   ├── devcontainer.json
│   └── docker-compose.override.yml
├── docker-compose.yml      # Container orchestration
└── README.md
```

## 🚀 Hızlı Başlangıç

### GitHub Codespaces ile (Önerilen)

1. **Codespaces'i başlatın:**
   ```bash
   # GitHub repo'yu Codespaces'te açın
   # Otomatik olarak devcontainer kurulumu yapılacak
   ```

2. **Servisleri başlatın:**
   ```bash
   docker-compose up --build
   ```

3. **Uygulamaya erişin:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Yerel Geliştirme Ortamında

1. **Önkoşullar:**
   ```bash
   # Docker ve Docker Compose kurulu olmalı
   docker --version
   docker-compose --version
   ```

2. **Repository'yi klonlayın:**
   ```bash
   git clone <repository-url>
   cd STAND
   ```

3. **Servisleri başlatın:**
   ```bash
   docker-compose up --build
   ```

4. **Uygulamayı test edin:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000

## 🔧 Geliştirme

### Backend Geliştirme

Backend kodunu düzenlediğinizde, Docker container otomatik olarak yeniden başlayacak (hot reload).

```python
# backend/app/main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/hello")
async def hello():
    return {"message": "Hello from FastAPI!"}
```

### Frontend Geliştirme

Frontend kodunu düzenlediğinizde, Vite dev server otomatik olarak sayfayı yenileyecek.

```jsx
// frontend/src/App.jsx
import React from 'react';

function App() {
  return <h1>Hello from React!</h1>;
}

export default App;
```

### Yeni API Endpoint Ekleme

1. **Backend'de endpoint tanımlayın:**
   ```python
   @app.get("/api/users")
   async def get_users():
       return {"users": ["user1", "user2"]}
   ```

2. **Frontend'de API çağrısı yapın:**
   ```jsx
   const response = await axios.get('/api/users');
   console.log(response.data);
   ```

## 📡 API Endpoints

### Mevcut Endpoints

- `GET /` - Ana sayfa
- `GET /health` - Sağlık kontrolü
- `GET /api/hello` - Örnek API endpoint
- `GET /docs` - Swagger UI (FastAPI otomatik dokümantasyon)

### API Kullanımı

```bash
# Health check
curl http://localhost:8000/health

# Hello endpoint
curl http://localhost:8000/api/hello
```

## 🐳 Docker Komutları

```bash
# Tüm servisleri başlat
docker-compose up

# Background'da başlat
docker-compose up -d

# Servisleri durdur
docker-compose down

# Logları görüntüle
docker-compose logs

# Container'ları yeniden build et
docker-compose up --build

# Sadece backend'i başlat
docker-compose up backend

# Sadece frontend'i başlat
docker-compose up frontend
```

## 🛠️ Yapılandırma

### Port Yapılandırması

- **Frontend:** 5173
- **Backend:** 8000

### Environment Variables

```bash
# Frontend
VITE_API_URL=http://localhost:8000

# Backend
PYTHONPATH=/app
PYTHONUNBUFFERED=1
```

## 🔍 Debugging

### Container Logları

```bash
# Backend logları
docker-compose logs backend

# Frontend logları
docker-compose logs frontend

# Tüm loglar
docker-compose logs
```

### Container İçine Girme

```bash
# Backend container'ına gir
docker-compose exec backend bash

# Frontend container'ına gir
docker-compose exec frontend sh
```

## 📦 Production Build

### Frontend Build

```bash
cd frontend
npm run build
```

### Backend Production

```bash
# Docker image'ı build et
docker build -t stand-backend ./backend

# Production container'ı çalıştır
docker run -p 8000:8000 stand-backend
```

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🆘 Sorun Giderme

### Yaygın Sorunlar

1. **Port zaten kullanımda:**
   ```bash
   # Port'ları kontrol edin
   lsof -i :5173
   lsof -i :8000
   
   # Çakışan servisleri durdurun
   docker-compose down
   ```

2. **Container build hatası:**
   ```bash
   # Cache'i temizleyin
   docker-compose build --no-cache
   
   # Volume'ları temizleyin
   docker-compose down -v
   ```

3. **CORS hatası:**
   - Backend'de CORS ayarlarını kontrol edin
   - Frontend URL'ini backend CORS ayarlarına ekleyin

### Yardım

Sorun yaşıyorsanız:
1. GitHub Issues'da sorun bildirin
2. Docker loglarını kontrol edin
3. Network bağlantısını test edin

---

**🎉 Geliştirme keyifli olsun!**



