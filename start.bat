@echo off
setlocal enabledelayedexpansion
:: =============================================================================
:: z2Lab OrderEntry — Start Script (Windows)
:: =============================================================================
::
:: Usage:
::   start.bat               — use prebuilt image (pull if needed)
::   start.bat --build       — force local build
::   start.bat --compose     — use docker compose (detached)
::   start.bat --sqlserver   — start with SQL Server
::   start.bat --stop        — stop running container
::   start.bat --logs        — follow container logs
::   start.bat --help        — show this help
::
:: Environment (set before running):
::   set IMAGE=farian/orderentry:latest
::   set PORT=3000
::   set FHIR_URL=https://hapi.fhir.org/baseR4
::   set AUTH_SECRET=your-secret-here
:: =============================================================================

:: ── Defaults ─────────────────────────────────────────────────────────────────
if not defined IMAGE                     set IMAGE=farian/orderentry:latest
if not defined PORT                      set PORT=3000
if not defined ORDERENTRY_FHIR__BASE_URL set ORDERENTRY_FHIR__BASE_URL=https://hapi.fhir.org/baseR4
if not defined ORDERENTRY_AUTH__SECRET   set ORDERENTRY_AUTH__SECRET=dev-only-change-in-production!!
set CONTAINER_NAME=orderentry

:: ── Flag parsing ──────────────────────────────────────────────────────────────
set FLAG_BUILD=0
set FLAG_COMPOSE=0
set FLAG_SQLSERVER=0
set FLAG_STOP=0
set FLAG_LOGS=0

for %%A in (%*) do (
    if "%%A"=="--build"      set FLAG_BUILD=1
    if "%%A"=="--compose"    set FLAG_COMPOSE=1
    if "%%A"=="--sqlserver"  set FLAG_SQLSERVER=1 & set FLAG_COMPOSE=1
    if "%%A"=="--stop"       set FLAG_STOP=1
    if "%%A"=="--logs"       set FLAG_LOGS=1
    if "%%A"=="--help"       goto :help
    if "%%A"=="-h"           goto :help
)

:: ── Check Docker ──────────────────────────────────────────────────────────────
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Start Docker Desktop and try again.
    exit /b 1
)

:: ── Stop ──────────────────────────────────────────────────────────────────────
if %FLAG_STOP%==1 (
    echo [INFO]  Stopping OrderEntry...
    docker stop %CONTAINER_NAME% >nul 2>&1
    docker rm   %CONTAINER_NAME% >nul 2>&1
    echo [OK]    Container stopped.
    exit /b 0
)

:: ── Logs ──────────────────────────────────────────────────────────────────────
if %FLAG_LOGS%==1 (
    docker logs -f %CONTAINER_NAME%
    exit /b 0
)

:: ── Docker Compose mode ───────────────────────────────────────────────────────
if %FLAG_COMPOSE%==1 (
    set COMPOSE_FILES=-f docker/docker-compose.yml
    if %FLAG_BUILD%==1      set COMPOSE_FILES=!COMPOSE_FILES! -f docker/docker-compose.build.yml
    if %FLAG_SQLSERVER%==1  set COMPOSE_FILES=!COMPOSE_FILES! -f docker/docker-compose.sqlserver.yml

    echo.
    echo [INFO]  Starting with Docker Compose...
    echo [INFO]  Files: !COMPOSE_FILES!

    if %FLAG_BUILD%==1 (
        echo [INFO]  Building image locally...
        :: Try to get git info (optional — fails gracefully if git not installed)
        for /f %%i in ('git rev-parse --short HEAD 2^>nul') do set GIT_COMMIT=%%i
        for /f %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set GIT_BRANCH=%%i
        for /f %%i in ('git rev-list --count HEAD 2^>nul') do set GIT_COUNT=%%i

        docker compose !COMPOSE_FILES! build
        if %errorlevel% neq 0 (
            echo [ERROR] Build failed. Check output above.
            exit /b 1
        )
        echo [OK]    Build complete.
    )

    docker compose !COMPOSE_FILES! up -d
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to start containers.
        exit /b 1
    )

    echo.
    echo [OK]    OrderEntry started!
    echo         URL:    http://localhost:%PORT%
    echo         Login:  admin / Admin1234!  (change after first login!)
    echo         Logs:   docker compose !COMPOSE_FILES! logs -f
    echo         Stop:   docker compose !COMPOSE_FILES! down
    echo         Health: http://localhost:%PORT%/api/health/db
    exit /b 0
)

:: ── Standalone mode (docker run) ──────────────────────────────────────────────
echo.
echo ============================================
echo  z2Lab OrderEntry Starter (Windows)
echo ============================================

:: Check if image exists locally
docker image inspect %IMAGE% >nul 2>&1
set IMAGE_EXISTS=%errorlevel%

if %FLAG_BUILD%==1 (
    echo [INFO]  Building image (--build flag)...
    set IMAGE_EXISTS=1
)

if %IMAGE_EXISTS% neq 0 (
    if %FLAG_BUILD%==1 (
        echo [INFO]  Building from source...
    ) else (
        echo [WARN]  Image '%IMAGE%' not found locally. Building...
    )

    :: Get git info (optional)
    set GIT_COMMIT=
    set GIT_BRANCH=
    set GIT_COUNT=0
    for /f %%i in ('git rev-parse --short HEAD 2^>nul') do set GIT_COMMIT=%%i
    for /f %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set GIT_BRANCH=%%i
    for /f %%i in ('git rev-list --count HEAD 2^>nul') do set GIT_COUNT=%%i

    docker build ^
        -f docker/Dockerfile ^
        --build-arg GIT_COMMIT=%GIT_COMMIT% ^
        --build-arg GIT_BRANCH=%GIT_BRANCH% ^
        --build-arg GIT_COUNT=%GIT_COUNT% ^
        -t %IMAGE% ^
        .

    if %errorlevel% neq 0 (
        echo [ERROR] Build failed!
        exit /b 1
    )
    echo [OK]    Image built: %IMAGE%
) else (
    echo [INFO]  Using existing image: %IMAGE%
)

:: Stop existing container
docker ps -q --filter "name=%CONTAINER_NAME%" >nul 2>&1
for /f %%i in ('docker ps -q --filter "name=%CONTAINER_NAME%"') do (
    echo [WARN]  Stopping existing container...
    docker stop %CONTAINER_NAME% >nul 2>&1
    docker rm   %CONTAINER_NAME% >nul 2>&1
)

:: Create data directories
if not exist data  mkdir data
if not exist logs  mkdir logs

echo [INFO]  Starting container...
docker run -d ^
    --name %CONTAINER_NAME% ^
    --restart unless-stopped ^
    -p %PORT%:3000 ^
    -e "ORDERENTRY_AUTH__SECRET=%ORDERENTRY_AUTH__SECRET%" ^
    -e "ORDERENTRY_FHIR__BASE_URL=%ORDERENTRY_FHIR__BASE_URL%" ^
    -e "ORDERENTRY_DB__PROVIDER=sqlite" ^
    -e "DATABASE_URL=file:/app/data/orderentry.db" ^
    -e "ORDERENTRY_LOG__LEVEL=info" ^
    -e "ORDERENTRY_LOG__FILE=/app/logs/zetlab.log" ^
    -e "ORDERENTRY_FHIR__SEED_ENABLED=true" ^
    -e "ORDERENTRY_FHIR__SEED_DEMO=false" ^
    -e "ORDERENTRY_LAB__INTERNAL_ORG_IDS=zlz,zetlab,zlz-notfall" ^
    -e "ORDERENTRY_SNOMED__ROLE_INTERNAL=159418007,159011000" ^
    -e "ORDERENTRY_SNOMED__ROLE_ORG_ADMIN=224608005,394572006" ^
    -e "ORDERENTRY_SNOMED__ROLE_PHYSICIAN=309343006,59058001,106289002" ^
    -e "ORDERENTRY_SNOMED__ORG_LABORATORY=708175003" ^
    -e "ORDERENTRY_SNOMED__ORG_HOSPITAL=22232009" ^
    -e "ORDERENTRY_SNOMED__ORG_OUTPATIENT=33022008" ^
    -e "ORDERENTRY_SNOMED__ORG_HOLDING=224891009" ^
    -v "%cd%\data:/app/data" ^
    -v "%cd%\logs:/app/logs" ^
    %IMAGE%

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start container!
    exit /b 1
)

echo.
echo [OK]    OrderEntry is running!
echo         URL:    http://localhost:%PORT%
echo         Login:  admin / Admin1234!  (change after first login!)
echo         Logs:   start.bat --logs
echo         Stop:   start.bat --stop
echo         Health: http://localhost:%PORT%/api/health/db
echo.
exit /b 0

:: ── Help ──────────────────────────────────────────────────────────────────────
:help
echo.
echo z2Lab OrderEntry — Start Script (Windows)
echo.
echo Usage:
echo   start.bat               use prebuilt image (pull if needed)
echo   start.bat --build       force local build from source
echo   start.bat --compose     use docker compose (recommended)
echo   start.bat --sqlserver   start with SQL Server (compose mode)
echo   start.bat --stop        stop running container
echo   start.bat --logs        follow container logs
echo   start.bat --help        show this help
echo.
echo Environment (set before running):
echo   set IMAGE=farian/orderentry:latest
echo   set PORT=3000
echo   set FHIR_URL=https://hapi.fhir.org/baseR4
echo   set AUTH_SECRET=your-secret-here
echo.
exit /b 0
