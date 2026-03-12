#!/usr/bin/env bash
set -euo pipefail

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$HOME/.local/bin/cloudflared}"
FRONTEND_PORT="${CF_FRONTEND_PORT:-3000}"
BACKEND_PORT="${CF_BACKEND_PORT:-3001}"
FRONTEND_LOG="${CF_QUICK_FRONTEND_LOG:-/tmp/phts-cf-quick-frontend.log}"
BACKEND_LOG="${CF_QUICK_BACKEND_LOG:-/tmp/phts-cf-quick-backend.log}"

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared binary not found at $CLOUDFLARED_BIN"
  echo "Install it first or set CLOUDFLARED_BIN"
  exit 1
fi

cleanup() {
  set +e
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" >/dev/null 2>&1
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" >/dev/null 2>&1
  wait >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

rm -f "$FRONTEND_LOG" "$BACKEND_LOG"

"$CLOUDFLARED_BIN" tunnel --url "http://localhost:${FRONTEND_PORT}" --no-autoupdate >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

"$CLOUDFLARED_BIN" tunnel --url "http://localhost:${BACKEND_PORT}" --no-autoupdate >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

extract_url() {
  local file="$1"
  rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' -N "$file" | head -n1
}

FRONTEND_URL=""
BACKEND_URL=""
for _ in {1..30}; do
  [[ -z "$FRONTEND_URL" ]] && FRONTEND_URL="$(extract_url "$FRONTEND_LOG" || true)"
  [[ -z "$BACKEND_URL" ]] && BACKEND_URL="$(extract_url "$BACKEND_LOG" || true)"
  if [[ -n "$FRONTEND_URL" && -n "$BACKEND_URL" ]]; then
    break
  fi
  sleep 1
done

echo "Quick tunnels are running."
echo "Frontend : ${FRONTEND_URL:-pending (see $FRONTEND_LOG)}"
echo "Backend  : ${BACKEND_URL:-pending (see $BACKEND_LOG)}"
echo
echo "Keep this process running. Press Ctrl+C to stop both tunnels."
echo "Logs:"
echo "  - $FRONTEND_LOG"
echo "  - $BACKEND_LOG"

wait "$FRONTEND_PID" "$BACKEND_PID"
