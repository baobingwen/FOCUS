@echo off
cd /d "%~dp0"

title FOCUS 学习计时器

echo ========================================
echo   FOCUS 学习计时器 — 本地启动
echo ========================================
echo.

:: ── 第一步：构建前端 ──
if not exist "client\dist\index.html" (
    echo [1/2] 构建前端...
    cd client
    call npm run build
    if %errorlevel% neq 0 (
        echo ❌ 前端构建失败
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [1/2] 前端已构建，跳过
)

:: ── 第二步：检测 Tailscale IP ──
set TAILSCALE_IP=
for /f "tokens=*" %%i in ('tailscale ip -4 2^>nul') do set TAILSCALE_IP=%%i

:: ── 第三步：启动服务 ──
echo [2/2] 启动服务端...
echo.

echo ========================================
echo   ✅ 正在启动...
echo   本地访问:  http://localhost:3001
if not "%TAILSCALE_IP%"=="" (
    echo   手机访问:  http://%TAILSCALE_IP%:3001
)
echo   按 Ctrl+C 停止服务
echo ========================================
echo.

cd server
node index.js

:: 如果 node 退出，暂停显示错误
echo.
if %errorlevel% neq 0 (
    echo ❌ 服务异常退出，错误码: %errorlevel%
) else (
    echo 服务已正常停止
)
pause
