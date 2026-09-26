#!/usr/bin/env bash
# configure-laptop-lid.sh
# Configures Linux systemd-logind to prevent laptop from sleeping/suspending when lid is closed.
# This allows Life System to stay online 24/7 with the laptop closed and display off.

set -e

CONF_DIR="/etc/systemd/logind.conf.d"
CONF_FILE="$CONF_DIR/life-system-lid.conf"

echo "=========================================================="
echo " Life System - 24/7 Laptop Lid Configuration"
echo "=========================================================="
echo "To keep your 24/7 server running when the laptop lid is closed,"
echo "systemd-logind must ignore the lid switch event."
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "Applying with sudo privileges..."
    sudo bash "$0" "$@"
    exit $?
fi

mkdir -p "$CONF_DIR"
cat << 'EOF' > "$CONF_FILE"
# Configured by Life System to allow 24/7 home server operation
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
LidSwitchIgnoreInhibited=no
EOF

echo "✓ Created $CONF_FILE"
echo "Restarting systemd-logind to apply changes..."
systemctl restart systemd-logind

echo ""
echo "✓ Success! You can now close your laptop lid and Life System will stay running 24/7."
echo "=========================================================="
