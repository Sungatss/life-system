#!/usr/bin/env bash
# Start Cloudflare Tunnel to expose Life System to your phone anywhere
cd "$(dirname "$0")"

if [ ! -f ".bin/cloudflared" ]; then
    echo "Downloading cloudflared..."
    mkdir -p .bin
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o .bin/cloudflared
    chmod +x .bin/cloudflared
fi

echo "Starting public tunnel to http://127.0.0.1:8000..."
./.bin/cloudflared tunnel --url http://127.0.0.1:8000
