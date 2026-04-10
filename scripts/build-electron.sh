#!/bin/bash
set -e

echo "🍓 Building Dulce Fresita Desktop..."

# 1. Build Next.js (standalone)
echo "→ Building Next.js..."
npm run build

# 2. Copy static files into standalone
echo "→ Copying static files..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Package with electron-builder
echo "→ Packaging with Electron..."
npx electron-builder --win --x64

echo "✅ Done! Check dist-electron/ for the installer"
