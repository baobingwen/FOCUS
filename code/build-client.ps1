<#
.SYNOPSIS
  构建 FOCUS 前端，供 start-local.bat 使用。
.DESCRIPTION
  每次修改前端代码后，手动运行此脚本重新构建。
  构建产物输出到 client\dist\，start-local.bat 启动服务时会使用最新的 build。
.EXAMPLE
  .\build-client.ps1
#>

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $rootDir 'client'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FOCUS FRONTEND BUILD" -ForegroundColor Cyan
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
    Write-Host "Building FRONTEND..." -ForegroundColor Yellow
    $result = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Build failed." -ForegroundColor Red
        $result | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        exit 1
    }
    Write-Host "Build succeed. Located at client\dist\" -ForegroundColor Green
}
finally {
    Pop-Location
}
