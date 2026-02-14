# Deploy Playtime repo to GitHub
# Run in PowerShell from this folder, or: .\deploy-to-github.ps1
# Requires: Git installed and in PATH

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git not found. Install Git from https://git-scm.com and ensure it is in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Cyan
    git init
}

Write-Host "Staging all files..." -ForegroundColor Cyan
git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit (working tree clean)." -ForegroundColor Yellow
} else {
    git commit -m "Deploy to GitHub: Playtime monorepo (admin panel, mobile, web UI)"
    Write-Host "Committed." -ForegroundColor Green
}

git branch -M main

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host ""
    Write-Host "No GitHub remote set. Run ONE of these (replace with your repo URL):" -ForegroundColor Yellow
    Write-Host '  git remote add origin https://github.com/YOUR_USERNAME/Playtime.git' -ForegroundColor White
    Write-Host '  git remote add origin git@github.com:YOUR_USERNAME/Playtime.git' -ForegroundColor White
    Write-Host ""
    Write-Host "Then push:" -ForegroundColor Yellow
    Write-Host '  git push -u origin main' -ForegroundColor White
    exit 0
}

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push -u origin main
Write-Host "Done. Deployed to GitHub." -ForegroundColor Green
