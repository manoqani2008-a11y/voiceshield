#!/bin/bash
# VoiceShield VPS 1-Click Deployment Script for Ubuntu / Debian
set -e

echo "=== VoiceShield O'rnatish Boshlandi ==="
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv git nginx

# Papka yaratish
APP_DIR="/var/www/voiceshield"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Loyihani ko'chirish yoki git orqali olish
cd $APP_DIR

# Virtual muhit
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Systemd Servis yaratish
sudo bash -c "cat > /etc/systemd/system/voiceshield.service << 'EOF'
[Unit]
Description=VoiceShield AI Audio Protection Service
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable voiceshield
sudo systemctl restart voiceshield

echo "=== VoiceShield Servisi Muvaffaqiyatli Ishga Tushdi (Port 8000) ==="
