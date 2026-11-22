@echo off
chcp 65001 >nul
echo ========================================================
echo   VoiceShield - Python AI Backendni ishga tushirish
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [DIQQAT] Tizimingizda Python topilmadi!
    echo.
    echo Python'ni rasmiy saytidan o'rnatishingiz mumkin:
    echo 👉 https://www.python.org/downloads/
    echo.
    echo O'rnatish paytida "Add python.exe to PATH" katakchasiga belgi qo'yishni unutmang!
    echo.
    echo Hozircha ilovaning Web talqinini to'g'ridan-to'g'ri ishlatish uchun:
    echo "run_app.bat" faylini oching (u mikrofondan tahlil qila oladi).
    echo.
    pause
    exit /b 1
)

echo Python topildi! Kutubxonalar tekshirilmoqda...
cd /d "%~dp0backend"
python -m pip install -r requirements.txt

echo.
echo ========================================================
echo Server ishga tushmoqda: http://localhost:8000
echo ========================================================
python main.py
pause
