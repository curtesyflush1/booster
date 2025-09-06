#!/usr/bin/env bash

# Sync frontend icons to production and patch PWA service worker caching
# - Copies frontend/public/icons/* to ${DEPLOY_PATH}/frontend/dist/icons/ on the server
# - Patches server-side generated sw.js to avoid localhost-only API caching
#
# Usage:
#   ./scripts/sync-frontend-assets.sh            # push icons + patch sw.js on server
#   ./scripts/sync-frontend-assets.sh --icons    # only push icons
#   ./scripts/sync-frontend-assets.sh --sw       # only patch service worker
#
# Requires: deploy.env (or env vars): DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load optional project-level deploy config if present
if [[ -f "$PROJECT_ROOT/deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_ROOT/deploy.env"
  set +a
fi

DEPLOY_USER="${DEPLOY_USER:-}"
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_PATH="${DEPLOY_PATH:-}"
SSH_OPTS="${SSH_OPTS:-}"
RSYNC_OPTS_EXTRA="${RSYNC_OPTS:-}"

ONLY_ICONS=false
ONLY_SW=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icons) ONLY_ICONS=true ; shift ;;
    --sw)    ONLY_SW=true ; shift ;;
    -h|--help)
      cat << EOF
Sync frontend icons to production and patch PWA service worker caching.

Usage:
  $(basename "$0") [--icons] [--sw]

Options:
  --icons   Only sync icons
  --sw      Only patch service worker regex (localhost -> any host)
EOF
      exit 0
      ;;
    *) echo "Unknown option: $1" ; exit 1;;
  esac
done

if [[ -z "$DEPLOY_USER" || -z "$DEPLOY_HOST" || -z "$DEPLOY_PATH" ]]; then
  echo "[ERROR] Missing DEPLOY_USER, DEPLOY_HOST, or DEPLOY_PATH. Set them in deploy.env or env vars." >&2
  exit 1
fi

ICONS_SRC="$PROJECT_ROOT/frontend/public/icons"
SW_REMOTE_PATH="$DEPLOY_PATH/frontend/dist/sw.js"

sync_icons() {
  if [[ ! -d "$ICONS_SRC" ]]; then
    echo "[WARN] $ICONS_SRC not found. Create icons (icon-192.png, icon-512.png) and rerun." >&2
    return 0
  fi
  echo "[INFO] Syncing icons to $DEPLOY_HOST:$DEPLOY_PATH/frontend/dist/icons/"
  rsync -avz $RSYNC_OPTS_EXTRA \
    "$ICONS_SRC/" \
    "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/frontend/dist/icons/"
}

patch_sw() {
  echo "[INFO] Patching service worker regex on server to allow any host for /api/*"
  ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" bash -s << 'EOSSH'
set -euo pipefail
SW_FILE="$DEPLOY_PATH/frontend/dist/sw.js"
if [[ ! -f "$SW_FILE" ]]; then
  echo "[ERROR] Service worker not found: $SW_FILE" >&2
  exit 1
fi

# Replace /^https?:\/\/localhost:3000\/api\/.* /i with /^https?:\/\/[^\/]+\/api\/.* /i
# This keeps Workbox regex-based matching but removes the localhost host restriction
if grep -qE "\^https\?:\\/\\/localhost:3000\\/api\\/\.\*" "$SW_FILE"; then
  sed -i -E 's#\^https\?:\\/\\/localhost:3000\\/api\\/\.\*#^https?:\\/\\/[^/]+\\/api\\/.*#g' "$SW_FILE"
  echo "[INFO] Patched sw.js host regex successfully"
else
  echo "[WARN] Expected localhost API regex not found in sw.js; skipping patch"
fi
EOSSH
}

if [[ "$ONLY_SW" == "true" && "$ONLY_ICONS" == "true" ]]; then
  echo "[ERROR] Choose only one of --icons or --sw" >&2
  exit 1
fi

if [[ "$ONLY_ICONS" == "true" ]]; then
  sync_icons
elif [[ "$ONLY_SW" == "true" ]]; then
  patch_sw
else
  sync_icons
  patch_sw
fi

echo "[DONE] Frontend sync completed. If sw.js changed, clients may need a refresh to pick up the update."

