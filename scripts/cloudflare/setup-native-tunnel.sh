#!/usr/bin/env bash
set -euo pipefail

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
TUNNEL_NAME="${CF_TUNNEL_NAME:-phts-dev}"
ZONE_DOMAIN="${CF_ZONE_DOMAIN:-}"
APP_SUBDOMAIN="${CF_APP_SUBDOMAIN:-app}"
API_SUBDOMAIN="${CF_API_SUBDOMAIN:-api}"
FRONTEND_ORIGIN_PORT="${CF_FRONTEND_PORT:-3000}"
BACKEND_ORIGIN_PORT="${CF_BACKEND_PORT:-3001}"

if [[ -z "$ZONE_DOMAIN" ]]; then
  echo "ERROR: CF_ZONE_DOMAIN is required (example: example.com)"
  exit 1
fi

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared binary not found at $CLOUDFLARED_BIN"
  echo "Install it first, or set CLOUDFLARED_BIN"
  exit 1
fi

mkdir -p "$HOME/.cloudflared"

CERT_FILE="$HOME/.cloudflared/cert.pem"
if [[ ! -f "$CERT_FILE" ]]; then
  echo "No Cloudflare cert found. Starting browser login..."
  "$CLOUDFLARED_BIN" tunnel login
fi

TUNNEL_ID=""
if "$CLOUDFLARED_BIN" tunnel info "$TUNNEL_NAME" >/tmp/phts-cf-tunnel-info.txt 2>/dev/null; then
  TUNNEL_ID=$(grep -Eo '[0-9a-fA-F-]{36}' /tmp/phts-cf-tunnel-info.txt | head -n1 || true)
fi

if [[ -z "$TUNNEL_ID" ]]; then
  echo "Creating tunnel: $TUNNEL_NAME"
  CREATE_OUTPUT=$("$CLOUDFLARED_BIN" tunnel create "$TUNNEL_NAME")
  TUNNEL_ID=$(echo "$CREATE_OUTPUT" | grep -Eo '[0-9a-fA-F-]{36}' | head -n1 || true)
fi

if [[ -z "$TUNNEL_ID" ]]; then
  echo "ERROR: Could not resolve tunnel ID for $TUNNEL_NAME"
  exit 1
fi

CREDENTIALS_FILE="$HOME/.cloudflared/${TUNNEL_ID}.json"
CONFIG_FILE="$HOME/.cloudflared/config-phts.yml"
APP_HOST="${APP_SUBDOMAIN}.${ZONE_DOMAIN}"
API_HOST="${API_SUBDOMAIN}.${ZONE_DOMAIN}"

if [[ ! -f "$CREDENTIALS_FILE" ]]; then
  echo "ERROR: credentials file not found: $CREDENTIALS_FILE"
  exit 1
fi

cat > "$CONFIG_FILE" <<CFG
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDENTIALS_FILE}

ingress:
  - hostname: ${APP_HOST}
    service: http://127.0.0.1:${FRONTEND_ORIGIN_PORT}
  - hostname: ${API_HOST}
    service: http://127.0.0.1:${BACKEND_ORIGIN_PORT}
  - service: http_status:404
CFG

"$CLOUDFLARED_BIN" tunnel route dns "$TUNNEL_NAME" "$APP_HOST"
"$CLOUDFLARED_BIN" tunnel route dns "$TUNNEL_NAME" "$API_HOST"

echo
echo "Cloudflare tunnel is configured."
echo "Tunnel name : $TUNNEL_NAME"
echo "Tunnel ID   : $TUNNEL_ID"
echo "Config file : $CONFIG_FILE"
echo "App URL     : https://$APP_HOST"
echo "API URL     : https://$API_HOST"
echo
echo "Next steps:"
echo "1) Start app services (frontend:3000, backend:3001)"
echo "2) Run tunnel: bash scripts/cloudflare/run-native-tunnel.sh"
echo "3) Add backend env FRONTEND_URL to include https://$APP_HOST"
