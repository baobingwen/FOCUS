@echo off
cd /d "%~dp0"

title FOCUS study-timer

echo ========================================
echo   FOCUS study-timer - local activate
echo ========================================
echo.

:: ── 第一步：构建前端 ──
if not exist "client\dist\index.html" (
    echo [1/2] building frontend...
    cd client
    call npm run build
    if %errorlevel% neq 0 (
        echo ❌ frontend build failed.
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [1/2] frontend has built, pass
)

:: ── 第二步：检测 Tailscale IP ──
set TAILSCALE_IP=
for /f "tokens=*" %%i in ('tailscale ip -4 2^>nul') do set TAILSCALE_IP=%%i

:: ── 第三步：启动服务 ──
echo [2/2] starting server...
echo.

echo ========================================
echo   starting...
echo  Local entry:   http://localhost:3001
if not "%TAILSCALE_IP%"=="" (
    echo   Phone entry:  http://%TAILSCALE_IP%:3001
)
echo   Press Ctrl+C to stop the server.
echo ========================================
echo.

cd server
node index.js

:: 如果 node 退出，暂停显示错误
echo.
if %errorlevel% neq 0 (
    echo ❌ service exited with error, error code: %errorlevel%
) else (
    echo service stopped.
)
pause
