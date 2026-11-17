@echo off
echo ======================================================================
echo    Memulai Server BarberFlow (Backend API + Frontend Web)
echo ======================================================================
echo Membuka Backend API di port 3000...
start "BarberFlow Backend API" cmd /k "npm run dev:api"

echo Membuka Frontend Web di port 5173...
start "BarberFlow Frontend Web" cmd /k "npm run dev:web"

echo.
echo ======================================================================
echo  Kedua server telah dibuka di jendela terpisah!
echo  Buka peramban di: http://localhost:5173
echo ======================================================================
