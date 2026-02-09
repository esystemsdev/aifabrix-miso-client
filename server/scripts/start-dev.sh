#!/bin/bash
# Start Development Server Script
# Kills processes on port and starts the server

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read PORT from .env file (root or server directory)
ENV_FILE="$SERVER_DIR/../.env"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$SERVER_DIR/.env"
fi

if [ -f "$ENV_FILE" ]; then
  echo "📁 Reading port from .env file: $ENV_FILE"
  ENV_PORT=$(grep '^PORT=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ' || echo "")
  if [ -n "$ENV_PORT" ] && [ "$ENV_PORT" != "" ]; then
    PORT=$ENV_PORT
    echo "📍 Using port from .env: $PORT"
  else
    PORT="3183"
    echo "⚠️  PORT not found in .env, using default: $PORT"
  fi
else
  PORT="3183"
  echo "⚠️  .env file not found, using default port: $PORT"
fi

echo "🚀 Starting Miso Test Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Port: $PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to kill process on a port (aggressive)
kill_port() {
  local port=$1
  echo "🧹 Cleaning up port $port..."
  
  # Use the kill-port script for consistency
  bash "$SCRIPT_DIR/kill-port.sh" "$port"
  
  # Additional aggressive cleanup
  pkill -9 -f "node.*dist/src/server" 2>/dev/null && sleep 1 || true
  pkill -9 -f "ts-node.*server" 2>/dev/null && sleep 1 || true
  
  # Wait a bit more to ensure port is free
  sleep 2
  
  # Final check
  if command -v lsof >/dev/null 2>&1; then
    REMAINING=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
      echo "  ⚠️  Port $port still in use, force killing..."
      for PID in $REMAINING; do
        kill -9 "$PID" 2>/dev/null || true
      done
      sleep 2
    fi
  fi
  
  echo "  ✅ Port cleanup complete"
}

# Clean up port before starting
kill_port $PORT

# Verify port is actually free before starting
echo ""
echo "🔍 Verifying port $PORT is free..."
MAX_RETRIES=5
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if command -v lsof >/dev/null 2>&1; then
    REMAINING=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -z "$REMAINING" ]; then
      echo "✅ Port $PORT is free"
      break
    else
      RETRY=$((RETRY + 1))
      echo "  ⚠️  Port still in use (attempt $RETRY/$MAX_RETRIES), waiting..."
      sleep 2
      # Try killing again
      for PID in $REMAINING; do
        kill -9 "$PID" 2>/dev/null || true
      done
    fi
  else
    break
  fi
done

# Final check - fail if port still in use
if command -v lsof >/dev/null 2>&1; then
  FINAL=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$FINAL" ]; then
    echo "❌ ERROR: Port $PORT is still in use by process(es): $FINAL"
    echo "   Please manually kill these processes: kill -9 $FINAL"
    exit 1
  fi
fi

# Change to server directory
cd "$SERVER_DIR"

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo "📋 Loading environment from .env file..."
  set -a
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

# Override PORT
export PORT=$PORT

echo ""
echo "Starting server..."
echo ""

# Start the server
if [ -f "dist/src/server.js" ]; then
  # Production mode - use compiled code
  echo "📦 Running compiled server..."
  node dist/src/server.js
else
  # Development mode - use ts-node
  echo "🔧 Running development server (ts-node)..."
  pnpm run dev
fi

