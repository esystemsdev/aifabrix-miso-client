#!/bin/bash
# Kill process on port 3183 (or specified port)

PORT=${1:-3183}

echo "🔍 Checking for processes on port $PORT..."

# Method 1: Use lsof (most reliable)
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "⚠️  Found processes on port $PORT: $PIDS"
    for PID in $PIDS; do
      # Check if process exists
      if ps -p "$PID" >/dev/null 2>&1; then
        echo "  Killing process $PID..."
        kill -9 "$PID" 2>/dev/null || true
      fi
    done
    sleep 2
    # Verify they're gone
    REMAINING=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
      echo "  ⚠️  Some processes still running, force killing..."
      for PID in $REMAINING; do
        kill -9 "$PID" 2>/dev/null || true
      done
      sleep 1
    fi
    echo "✅ Processes killed"
  else
    echo "✅ No processes found on port $PORT"
  fi
fi

# Method 2: Use fuser as backup
if command -v fuser >/dev/null 2>&1; then
  if fuser $PORT/tcp >/dev/null 2>&1; then
    echo "⚠️  Found process via fuser, killing..."
    fuser -k $PORT/tcp 2>/dev/null || true
    sleep 1
  fi
fi

# Method 3: Kill by process pattern (aggressive)
pkill -9 -f "node.*dist/src/server" 2>/dev/null && sleep 1 || true
pkill -9 -f "ts-node.*server" 2>/dev/null && sleep 1 || true
pkill -9 -f "node.*server.*$PORT" 2>/dev/null && sleep 1 || true

# Final verification
if command -v lsof >/dev/null 2>&1; then
  FINAL_CHECK=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$FINAL_CHECK" ]; then
    echo "⚠️  WARNING: Port $PORT still in use by: $FINAL_CHECK"
    echo "   You may need to manually kill these processes"
  else
    echo "✅ Port $PORT is now free"
  fi
fi


