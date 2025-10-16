#!/bin/bash

# Ngrok tunnel başlatma scripti
echo "🚀 Ngrok tunnel başlatılıyor..."
echo "📱 Public URL almak için ngrok hesabı gerekli"
echo ""
echo "1. https://dashboard.ngrok.com/signup adresinden ücretsiz hesap oluşturun"
echo "2. Authtoken'ınızı alın: https://dashboard.ngrok.com/get-started/your-authtoken"
echo "3. Token'ı yapılandırın: ngrok config add-authtoken YOUR_TOKEN"
echo ""
echo "Token yapılandırıldıktan sonra bu scripti tekrar çalıştırın."
echo ""

# Ngrok'u başlat
ngrok http 443
