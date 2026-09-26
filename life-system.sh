#!/usr/bin/env bash
# life-system.sh - 24/7 Management Tool for Life System
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
ENV_FILE="$DIR/.env"
URL_FILE="$DIR/CURRENT_URL.txt"

print_usage() {
    echo "Usage: ./life-system.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup         - Install 24/7 background systemd services and start them"
    echo "  start         - Start Life System and tunnel in background"
    echo "  stop          - Stop Life System and tunnel"
    echo "  restart       - Restart Life System and tunnel"
    echo "  status        - Show active status of application and tunnel"
    echo "  logs          - Follow live logs (press Ctrl+C to exit)"
    echo "  url           - Show current public web URL"
    echo "  build         - Rebuild the production frontend bundle"
    echo "  set-token <T> - Set your permanent Cloudflare Tunnel token in .env"
    echo "  keep-awake    - Configure laptop to run with lid closed (sudo)"
    echo ""
}

cmd_build() {
    echo "Building frontend production bundle..."
    cd "$DIR/frontend"
    npm run build
    echo "✓ Build complete."
}

cmd_setup() {
    echo "=========================================================="
    echo " Installing Life System 24/7 Background Service"
    echo "=========================================================="

    # 1. Build frontend
    cmd_build

    # 2. Ensure .env exists
    if [ ! -f "$ENV_FILE" ]; then
        echo "Creating default .env from .env.example..."
        cp "$DIR/.env.example" "$ENV_FILE"
    fi

    # 3. Create systemd user service directory
    mkdir -p "$SYSTEMD_USER_DIR"

    # 4. Install service units
    cp "$DIR/services/life-system.service" "$SYSTEMD_USER_DIR/life-system.service"
    cp "$DIR/services/life-system-tunnel.service" "$SYSTEMD_USER_DIR/life-system-tunnel.service"

    # 5. Reload daemon
    echo "Reloading systemd user daemon..."
    systemctl --user daemon-reload

    # 6. Enable systemd linger so services run without an active login session
    echo "Enabling user linger (ensures 24/7 boot execution)..."
    loginctl enable-linger "$USER" 2>/dev/null || true

    # 7. Enable and start services
    echo "Enabling and starting life-system and life-system-tunnel..."
    systemctl --user enable life-system.service life-system-tunnel.service
    systemctl --user restart life-system.service life-system-tunnel.service

    echo ""
    echo "✓ Setup complete! Life System is now configured to run 24/7."
    echo ""
    cmd_status
}

cmd_start() {
    echo "Starting Life System services..."
    systemctl --user start life-system.service life-system-tunnel.service
    cmd_status
}

cmd_stop() {
    echo "Stopping Life System services..."
    systemctl --user stop life-system-tunnel.service life-system.service
    echo "✓ Services stopped."
}

cmd_restart() {
    echo "Restarting Life System services..."
    systemctl --user restart life-system.service life-system-tunnel.service
    cmd_status
}

cmd_status() {
    echo "====================== Service Status ======================"
    systemctl --user status life-system.service --no-pager -l || true
    echo "------------------------------------------------------------"
    systemctl --user status life-system-tunnel.service --no-pager -l || true
    echo "============================================================"
    cmd_url
}

cmd_logs() {
    journalctl --user -u life-system.service -u life-system-tunnel.service -f
}

cmd_url() {
    echo ""
    echo "🌐 Access Details:"
    echo "  Local Network: http://127.0.0.1:8000"
    
    if [ -f "$ENV_FILE" ]; then
        TOKEN=$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
        DOMAIN=$(grep -E '^CUSTOM_DOMAIN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
        if [ -n "$DOMAIN" ]; then
            echo "  Permanent 24/7 Domain: https://$DOMAIN"
        fi
    fi

    if [ -f "$URL_FILE" ]; then
        echo "  Active Tunnel URL: $(cat "$URL_FILE")"
    else
        echo "  Tunnel URL: starting / check './life-system.sh logs'"
    fi
    echo ""
}

cmd_set_token() {
    TOKEN="$1"
    if [ -z "$TOKEN" ]; then
        echo "Error: Token cannot be empty. Usage: ./life-system.sh set-token <YOUR_CLOUDFLARE_TOKEN>"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        cp "$DIR/.env.example" "$ENV_FILE"
    fi

    if grep -q "^CLOUDFLARE_TUNNEL_TOKEN=" "$ENV_FILE"; then
        sed -i "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$TOKEN|" "$ENV_FILE"
    else
        echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN" >> "$ENV_FILE"
    fi

    echo "✓ Cloudflare Tunnel token saved in .env"
    echo "Restarting tunnel service..."
    systemctl --user restart life-system-tunnel.service
    echo "✓ Tunnel restarted with your permanent token."
}

case "$1" in
    setup)
        cmd_setup
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    url)
        cmd_url
        ;;
    build)
        cmd_build
        ;;
    set-token)
        cmd_set_token "$2"
        ;;
    keep-awake)
        bash "$DIR/scripts/configure-laptop-lid.sh"
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
