#!/usr/bin/env bash
set -euo pipefail

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
CONFIG_FILE="${CF_CONFIG_FILE:-$HOME/.cloudflared/config-phts.yml}"
TUNNEL_NAME="${CF_TUNNEL_NAME:-phts-dev}"

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared binary not found at $CLOUDFLARED_BIN"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: config file not found: $CONFIG_FILE"
  echo "Run: bash scripts/cloudflare/setup-native-tunnel.sh"
  exit 1
fi

exec "$CLOUDFLARED_BIN" tunnel --config "$CONFIG_FILE" run "$TUNNEL_NAME"
