# 🧪 STAND Uygulaması Test Rehberi

## ✅ YOLO Backend Test Sonuçları

**YOLO Model Durumu:** ✅ ÇALIŞIYOR
- Model: YOLOv8n
- Sınıf Sayısı: 80 farklı nesne
- İşlem Süresi: ~0.15-0.55 saniye
- FPS: 1.8-6.3

## 🔧 Test Adımları

### 1. Backend API Testi
```bash
# Health check
curl http://localhost:8000/health

# Model bilgileri
curl http://localhost:8000/api/model_info

# Test görüntüsü ile nesne algılama
curl -X POST "http://localhost:8000/api/detect" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/image.jpg"
```

### 2. Frontend Testi
1. **Browser'da açın:** http://localhost:5173
2. **Kamera izni verin**
3. **"Kamerayı Başlat" butonuna tıklayın**
4. **"🤖" butonuna tıklayarak nesne algılamayı başlatın**

### 3. Debug Bilgileri
- **Browser Console'u açın** (F12)
- **Network tab'ını kontrol edin**
- **Console log'larını takip edin**

## 🐛 Bilinen Sorunlar ve Çözümler

### Sorun 1: Nesne Algılama Çalışmıyor
**Çözüm:**
1. Browser console'da hata var mı kontrol edin
2. Network tab'ında API çağrıları başarılı mı kontrol edin
3. Kamera izinleri verilmiş mi kontrol edin

### Sorun 2: Proxy Hatası
**Çözüm:**
- Frontend container'ını yeniden başlatın:
```bash
docker compose restart frontend
```

### Sorun 3: Backend Bağlantı Hatası
**Çözüm:**
- Backend container'ını yeniden başlatın:
```bash
docker compose restart backend
```

## 📊 Test Sonuçları

### ✅ Çalışan Özellikler
- [x] YOLO model yükleme
- [x] Backend API endpoints
- [x] Frontend kamera erişimi
- [x] Docker container'lar
- [x] Proxy bağlantısı

### 🔄 Test Edilecek Özellikler
- [ ] Gerçek zamanlı nesne algılama
- [ ] Nesne bounding box'ları
- [ ] Mobil kamera geçişi
- [ ] Performance optimizasyonları

## 🎯 Sonraki Adımlar

1. **Browser'da test edin:** http://localhost:5173
2. **Console log'larını kontrol edin**
3. **Kamera ile gerçek nesneleri test edin**
4. **Sorun varsa log'ları paylaşın**

## 📞 Yardım

Sorun yaşıyorsanız:
1. Browser console log'larını kontrol edin
2. Docker container log'larını kontrol edin:
```bash
docker compose logs frontend
docker compose logs backend
```

---

**🎉 YOLO Backend başarıyla çalışıyor! Şimdi frontend'de test edin.**
