#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root regardless of invocation directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OUTPUT_JSON="$REPO_ROOT/docs/memory/openmemory-pulled.json"
OUTPUT_SUMMARY="$REPO_ROOT/docs/memory/openmemory-pulled-summary.txt"

API_URL_DEFAULT="https://api.openmemory.dev"
API_URL="${OPENMEMORY_API_URL:-$API_URL_DEFAULT}"
APP_NAME="${OPENMEMORY_APP_NAME:-${OPENMEMORY_PROJECT_ID:-booster-beacon}}"
LIMIT="${OPENMEMORY_LIMIT:-50}"

if [[ -z "${OPENMEMORY_API_KEY:-}" ]]; then
  # Best-effort fallback: try to read from .codex/config.toml
  CONF_KEY=$(awk -F'[ ="]+' '/OPENMEMORY_API_KEY/{print $5; exit}' "$REPO_ROOT/.codex/config.toml" 2>/dev/null || true)
  if [[ -n "$CONF_KEY" ]]; then
    export OPENMEMORY_API_KEY="$CONF_KEY"
    echo "Note: Using OPENMEMORY_API_KEY from .codex/config.toml"
  else
    echo "ERROR: OPENMEMORY_API_KEY is not set." >&2
    echo "Export it, then re-run: export OPENMEMORY_API_KEY=..." >&2
    exit 1
  fi
fi

mkdir -p "$REPO_ROOT/docs/memory"

echo "Pulling memories for app '$APP_NAME' (limit=$LIMIT) from $API_URL ..."

HTTP_STATUS=$(curl -sS -o "$OUTPUT_JSON" -w "%{http_code}" \
  -H "Authorization: Bearer $OPENMEMORY_API_KEY" \
  -H "Accept: application/json" \
  "$API_URL/api/v1/memories/?app_name=$APP_NAME&limit=$LIMIT")

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "ERROR: Failed to pull memories (HTTP $HTTP_STATUS). Response saved to $OUTPUT_JSON" >&2
  exit 2
fi

# Create a quick human-readable summary (titles + first line of memory)
node - <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const out = process.argv[3];
try {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.items) ? data.items : []);
  const lines = [];
  for (const item of items) {
    const title = item.title || item.categories?.join(', ') || 'memory';
    const memory = (item.memory || '').toString().split('\n')[0];
    const when = item.created_at || item.timestamp || '';
    lines.push(`- ${title}${when ? ` (${when})` : ''}: ${memory.slice(0, 160)}`);
  }
  fs.writeFileSync(out, lines.join('\n') + (lines.length ? '\n' : ''));
  console.log(`Wrote summary: ${out}`);
} catch (e) {
  console.warn('Warning: could not create summary:', e.message);
}
NODE
  "$OUTPUT_JSON" "$OUTPUT_SUMMARY"

echo "Memories saved to $OUTPUT_JSON"
