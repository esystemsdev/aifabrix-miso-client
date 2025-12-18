#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$SERVER_DIR/frontend"

# Change to frontend directory
cd "$FRONTEND_DIR"

# Use vite from frontend/node_modules (installed via pnpm)
# pnpm creates a .bin directory with symlinks
if [ -f "node_modules/.bin/vite" ]; then
  # Use the local vite binary
  ./node_modules/.bin/vite build
elif [ -f "node_modules/vite/bin/vite.js" ]; then
  # Fallback: use vite.js directly
  node node_modules/vite/bin/vite.js build
else
  # Try to find vite in pnpm structure
  VITE_BIN=$(find node_modules/.pnpm -name "vite.js" -path "*/vite/bin/vite.js" 2>/dev/null | head -1)
  if [ -n "$VITE_BIN" ]; then
    node "$VITE_BIN" build
  else
    echo "Error: vite not found. Please run 'pnpm install' in the frontend directory."
    exit 1
  fi
fi

