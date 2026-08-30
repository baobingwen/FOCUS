<#
.SYNOPSIS
  构建 FOCUS 前端纯静态版（无后端，数据存浏览器 IndexedDB）。
.DESCRIPTION
  每次修改前端代码后，手动运行此脚本重新构建纯静态版。
  构建产物输出到 client\dist-static\，可部署到任意静态托管（如 GitHub Pages）。
.EXAMPLE
  .\build-client-static.ps1
#>

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $rootDir 'client'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FOCUS FRONTEND BUILD (STATIC)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 确认 client 目录存在
if (-not (Test-Path $clientDir)) {
    Write-Host "[Error] Dir. client not found: $clientDir" -ForegroundColor Red
    exit 1
}

# 进入 client 目录并 build
Push-Location $clientDir
try {
    Write-Host "Building FRONTEND (static, no backend)..." -ForegroundColor Yellow
    $result = npm run build:static 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Build failed." -ForegroundColor Red
        $result | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        exit 1
    }
    Write-Host "Build succeed. Located at client\dist-static\" -ForegroundColor Green
}
finally {
    Pop-Location
}
