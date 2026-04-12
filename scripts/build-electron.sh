#!/bin/bash
set -e

echo "🍓 Building Dulce Fresita Desktop..."

# 1. Build Next.js (standalone)
echo "→ Building Next.js..."
npm run build

# 2. Copy static files + public into standalone
echo "→ Copying static files..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Create standalone-bundle (electron-builder reads from here)
echo "→ Creating standalone bundle..."
rm -rf standalone-bundle
cp -r .next/standalone standalone-bundle

# 4. Package with electron-builder
echo "→ Packaging with Electron..."
npx electron-builder --win --x64

echo "✅ Done! Check dist-electron/ for the installer"
