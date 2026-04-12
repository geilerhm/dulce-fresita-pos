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

# 3. Rename node_modules to bypass electron-builder filter
echo "→ Renaming node_modules → _node_modules..."
mv .next/standalone/node_modules .next/standalone/_node_modules

# 4. Package with electron-builder
echo "→ Packaging with Electron..."
npx electron-builder --win --x64

echo "✅ Done! Check dist-electron/ for the installer"
