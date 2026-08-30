<#
.SYNOPSIS
  构建 FOCUS 纯静态版并部署到 GitHub Pages。
.DESCRIPTION
  1. 调用 build-client-static.ps1 构建 client\dist-static\（vite base /FOCUS/）
  2. 同步产物到独立部署工作区 code\.deploy-static\（保留 .git 历史，gh-pages 分支）
  3. commit 全部构建产物并普通快进 push 到 FOCUS 仓库 gh-pages 分支
  部署地址：https://baobingwen.github.io/FOCUS/
  说明：独立工作区保留每次部署的 git 历史；push 为普通快进推送（非强制覆盖）；
        若远程 gh-pages 被外部改动导致 push 被拒，脚本停下提示，需手动确认后处理。
  首次使用需先在 GitHub 仓库 Settings → Pages 选择 gh-pages 分支（见 DEPLOY_STATIC.md）。
.EXAMPLE
  .\deploy-static.ps1
#>

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $rootDir 'client'
$distDir = Join-Path $clientDir 'dist-static'
$deployDir = Join-Path $rootDir '.deploy-static'
$remoteUrl = 'https://github.com/baobingwen/FOCUS.git'
$branch = 'gh-pages'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FOCUS DEPLOY (GitHub Pages)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 构建纯静态版
Write-Host "[1/2] Building static frontend..." -ForegroundColor Yellow
& (Join-Path $rootDir 'build-client-static.ps1')
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Error] Build failed." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $distDir)) {
    Write-Host "[Error] Dist dir not found: $distDir" -ForegroundColor Red
    exit 1
}

# 2. 首次使用时初始化部署工作区（保留 .git 历史）
if (-not (Test-Path (Join-Path $deployDir '.git'))) {
    Write-Host "[Info] Initializing deploy workspace: $deployDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
    Push-Location $deployDir
    try {
        git init -b $branch 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[Error] git init failed. 需要 git 2.28+（不支持 -b 时可手动 git init 后 git checkout -b $branch）。" -ForegroundColor Red
            exit 1
        }
        git remote add origin $remoteUrl
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[Error] git remote add failed." -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# 3. 同步产物到部署工作区（清空除 .git 外内容）
Write-Host "[2/2] Syncing build output to deploy workspace..." -ForegroundColor Yellow
Push-Location $deployDir
try {
    Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
    Copy-Item -Path (Join-Path $distDir '*') -Destination $deployDir -Recurse -Force

    # 无变更则跳过部署
    if (-not (git status --porcelain)) {
        Write-Host "[Info] No changes since last deploy. Skipped." -ForegroundColor Yellow
        exit 0
    }

    $version = (Get-Content (Join-Path $clientDir 'package.json') -Raw | ConvertFrom-Json).version
    git add -A
    git commit -m "deploy: FOCUS static build v$version"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] git commit failed." -ForegroundColor Red
        exit 1
    }

    # 普通快进推送（非强制覆盖）；远程分叉时被拒，停下提示手动处理
    git push origin $branch
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[Error] push 被拒绝：远程 gh-pages 存在未知改动（非快进）。" -ForegroundColor Red
        Write-Host "已保留本地部署历史（$deployDir）。确认无误后可手动执行：" -ForegroundColor Red
        Write-Host "  cd $deployDir" -ForegroundColor Red
        Write-Host "  git push --force-with-lease origin $branch" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Deploy succeed. GitHub Pages 构建约需 1 分钟。" -ForegroundColor Green
    Write-Host "URL: https://baobingwen.github.io/FOCUS/" -ForegroundColor Green
}
finally {
    Pop-Location
}
