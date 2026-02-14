# Connect this folder to https://github.com/jodtech11-jpg/playtime.git
# Run this script from the Playtime folder (e.g. in PowerShell or Cursor terminal).
# Requires Git for Windows: https://git-scm.com/download/win

$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/jodtech11-jpg/playtime.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed or not in PATH. Install from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path ".git")) {
    git init
    Write-Host "Initialized git repository." -ForegroundColor Green
} else {
    Write-Host "Git repository already exists." -ForegroundColor Cyan
}

$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin $repoUrl
    Write-Host "Added remote: origin -> $repoUrl" -ForegroundColor Green
} elseif ($remote -ne $repoUrl) {
    git remote set-url origin $repoUrl
    Write-Host "Updated remote: origin -> $repoUrl" -ForegroundColor Green
} else {
    Write-Host "Remote 'origin' already points to $repoUrl" -ForegroundColor Cyan
}

Write-Host "`nDone. You can now:" -ForegroundColor Green
Write-Host "  1. Add files:    git add ." 
Write-Host "  2. Commit:       git commit -m \"Initial commit\""
Write-Host "  3. Push:         git push -u origin main"
Write-Host "`n(If your default branch is 'master', use: git push -u origin master)"
