#!/bin/bash
# Watch script that rebuilds frontend on file changes
# Usage: ./scripts/watch-build.sh

echo "🔍 Watching for changes in frontend/src/stubs..."
echo "📦 Auto-rebuilding on file changes..."
echo ""

cd "$(dirname "$0")/.." || exit 1

# Use inotifywait if available (Linux), otherwise use polling
if command -v inotifywait &> /dev/null; then
  echo "Using inotifywait for file watching..."
  while inotifywait -r -e modify,create,delete frontend/src/stubs/ 2>/dev/null; do
    echo "🔄 Change detected, rebuilding..."
    pnpm run build:frontend
    echo "✅ Build complete"
    echo ""
  done
else
  echo "Using polling for file watching (inotifywait not available)..."
  LAST_BUILD=$(date +%s)
  while true; do
    CURRENT=$(find frontend/src/stubs/ -type f -exec stat -c %Y {} \; 2>/dev/null | sort -n | tail -1)
    if [ -n "$CURRENT" ] && [ "$CURRENT" -gt "$LAST_BUILD" ]; then
      echo "🔄 Change detected, rebuilding..."
      pnpm run build:frontend
      LAST_BUILD=$(date +%s)
      echo "✅ Build complete"
      echo ""
    fi
    sleep 2
  done
fi

