#!/usr/bin/env bash
# run-tunnel.sh - 24/7 Cloudflare Tunnel Runner for Life System
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Load environment variables if .env exists
if [ -f "$DIR/.env" ]; then
    # shellcheck disable=SC1091
    source "$DIR/.env"
fi

CLOUDFLARED="$DIR/.bin/cloudflared"

if [ ! -f "$CLOUDFLARED" ]; then
    echo "[tunnel] Downloading cloudflared binary..."
    mkdir -p "$DIR/.bin"
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$CLOUDFLARED"
    chmod +x "$CLOUDFLARED"
fi

# 1. If persistent named tunnel token is provided
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "[tunnel] Starting permanent Cloudflare Named Tunnel with token..."
    exec "$CLOUDFLARED" tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
fi

# 2. Fallback: Quick Tunnel (trycloudflare.com)
echo "[tunnel] No CLOUDFLARE_TUNNEL_TOKEN found in .env."
echo "[tunnel] Launching Quick Tunnel to http://127.0.0.1:8000..."
echo "[tunnel] (To use a permanent 24/7 domain, add CLOUDFLARE_TUNNEL_TOKEN to .env)"

LOG_FILE="$DIR/tunnel.log"
URL_FILE="$DIR/CURRENT_URL.txt"

# Run cloudflared, tee to log, and monitor for the generated trycloudflare URL in background
rm -f "$LOG_FILE"
"$CLOUDFLARED" tunnel --url http://127.0.0.1:8000 --logfile "$LOG_FILE" &
CF_PID=$!

# Trap signals to forward to child process
trap 'kill "$CF_PID" 2>/dev/null || true; exit 0' SIGINT SIGTERM EXIT

# Monitor logfile to extract and store public URL
for _ in $(seq 1 30); do
    if [ -f "$LOG_FILE" ]; then
        FOUND_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)
        if [ -n "$FOUND_URL" ]; then
            echo "$FOUND_URL" > "$URL_FILE"
            echo "=========================================================="
            echo "[tunnel] Public Quick URL: $FOUND_URL"
            echo "[tunnel] Saved to: $URL_FILE"
            echo "=========================================================="
            break
        fi
    fi
    sleep 1
done

wait "$CF_PID"
