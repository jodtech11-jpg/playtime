# Push this repo to GitHub. Run AFTER installing Git: https://git-scm.com/download/win
# Then restart Cursor or open a new terminal.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git not found. Install from https://git-scm.com/download/win and restart the terminal." -ForegroundColor Red
    exit 1
}

Write-Host "Pushing to https://github.com/jodtech11-jpg/playtime.git ..." -ForegroundColor Cyan
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Your repo is no longer empty." -ForegroundColor Green
} else {
    Write-Host "Push failed. You may need to sign in to GitHub (browser or token)." -ForegroundColor Yellow
}
