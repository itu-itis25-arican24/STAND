<!-- 8662e9bc-7309-4d73-8fc6-f43ed7388efc 45506c25-6f41-4d58-b844-c19d9c61e75a -->
# Fullstack React + FastAPI Uygulama Kurulumu

## Proje Yapısı

```
/STAND
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py      # FastAPI app entry point
│   │   └── __init__.py
│   ├── Dockerfile       # Backend container
│   ├── requirements.txt # Python dependencies
│   └── .dockerignore
├── frontend/            # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── App.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml   # Orchestration
├── .devcontainer/       # GitHub Codespaces config
│   └── devcontainer.json
└── README.md
```

## Backend (FastAPI)

- FastAPI framework ile temel REST API
- CORS ayarları (frontend ile iletişim için)
- Health check endpoint
- Örnek API endpoint (`/api/hello`)
- Docker container içinde çalışacak (port 8000)
- Uvicorn ASGI server

**requirements.txt:**

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
```

**Dockerfile:**

- Python 3.11 slim base image
- Multi-stage build (optimal boyut)
- Non-root user (security)

## Frontend (React + Vite)

- Vite ile React kurulumu (hızlı development)
- Axios ile API iletişimi
- Basit UI: API'den veri çeken örnek component
- Development proxy ayarları (CORS için)
- Production build için GitHub Pages desteği

## Docker Setup

- `docker-compose.yml`: Backend ve frontend container'ları
- Network ayarları: container'lar arası iletişim
- Volume mapping: hot reload için
- Port mapping:
  - Frontend: 5173
  - Backend: 8000

## GitHub Codespaces Yapılandırması

- `.devcontainer/devcontainer.json`: 
  - Docker Compose kullanımı
  - Port forwarding (5173, 8000)
  - VS Code extensions (Python, ES7 React snippets)
  - Post-create komutları

## Temel Özellikler

1. Backend'de basit health check endpoint
2. Frontend'de backend'e istek atan örnek component
3. Her iki servis de hot reload destekli
4. README ile çalıştırma talimatları

## Çalıştırma

```bash
# Codespaces'te otomatik başlayacak, veya manuel:
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### To-dos

- [ ] Backend klasör yapısı ve FastAPI temel kurulumu (main.py, requirements.txt, Dockerfile)
- [ ] React + Vite frontend kurulumu (package.json, vite.config.js, temel components)
- [ ] Docker Compose yapılandırması ve container orchestration
- [ ] GitHub Codespaces devcontainer yapılandırması
- [ ] Frontend-Backend entegrasyonu ve örnek API çağrısı
- [ ] README.md ile kurulum ve çalıştırma talimatları