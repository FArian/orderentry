@echo off
setlocal enabledelayedexpansion

REM =========================
REM In Projekt Root wechseln
REM =========================
cd /d %~dp0..

set IMAGE_NAME=farian/orderentry

REM =========================
REM VERSION aus package.json lesen
REM =========================
for /f %%i in ('node -p "require('./package.json').version"') do set APP_VERSION=%%i

REM =========================
REM Dev Counter (einfach)
REM =========================
set DEV_SUFFIX=dv1

REM 👉 OPTIONAL: automatisch erhöhen (einfacher Ansatz)
if exist .version_counter (
    set /p DEV_SUFFIX=<.version_counter
)

echo dv%DEV_SUFFIX:~2% > .version_counter

REM FINAL VERSION
set VERSION=%APP_VERSION%.%DEV_SUFFIX%

echo =========================
echo Building Docker Image
echo Version: %VERSION%
echo =========================

REM =========================
REM BUILD
REM =========================
docker buildx build ^
  --platform linux/amd64,linux/arm64 ^
  -f docker/Dockerfile ^
  -t %IMAGE_NAME%:%VERSION% ^
  -t %IMAGE_NAME%:latest ^
  --push .

if %errorlevel% neq 0 (
    echo ❌ Build failed!
    exit /b %errorlevel%
)

echo =========================
echo ✅ Build successful: %VERSION%
echo =========================

endlocal