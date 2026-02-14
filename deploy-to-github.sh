#!/usr/bin/env bash
# Deploy Playtime repo to GitHub
# Run: bash deploy-to-github.sh   (or from Git Bash)
# Requires: Git in PATH

set -e
cd "$(dirname "$0")"

if ! command -v git &>/dev/null; then
  echo "Git not found. Install Git and ensure it is in PATH."
  exit 1
fi

if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
fi

echo "Staging all files..."
git add .

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit (working tree clean)."
else
  git commit -m "Deploy to GitHub: Playtime monorepo (admin panel, mobile, web UI)"
  echo "Committed."
fi

git branch -M main

if ! git remote get-url origin &>/dev/null; then
  echo ""
  echo "No GitHub remote set. Run ONE of these (replace with your repo URL):"
  echo "  git remote add origin https://github.com/YOUR_USERNAME/Playtime.git"
  echo "  git remote add origin git@github.com:YOUR_USERNAME/Playtime.git"
  echo ""
  echo "Then push:"
  echo "  git push -u origin main"
  exit 0
fi

echo "Pushing to origin main..."
git push -u origin main
echo "Done. Deployed to GitHub."
