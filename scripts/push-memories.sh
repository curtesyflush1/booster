#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root regardless of invocation directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MEMORY_FILE="$REPO_ROOT/docs/memory/booster-beacon-memories.json"
API_URL_DEFAULT="https://api.openmemory.dev"
API_URL="${OPENMEMORY_API_URL:-$API_URL_DEFAULT}"

if [[ -z "${OPENMEMORY_API_KEY:-}" ]]; then
  echo "ERROR: OPENMEMORY_API_KEY is not set." >&2
  echo "Export it, then re-run: export OPENMEMORY_API_KEY=..." >&2
  exit 1
fi

if [[ ! -f "$MEMORY_FILE" ]]; then
  echo "ERROR: Memory bundle not found at $MEMORY_FILE" >&2
  exit 1
fi

APP_NAME="${OPENMEMORY_APP_NAME:-${OPENMEMORY_PROJECT_ID:-booster-beacon}}"

echo "Pushing memories (per-item) to $API_URL/api/v1/memories/ for app '$APP_NAME' ..."

# Generate per-item memory payloads and push sequentially
TMP_MEMS="$(mktemp)"
MEMORY_FILE_PATH="$MEMORY_FILE" OPENMEMORY_APP_NAME="$APP_NAME" node -e '
  const fs = require("fs");
  const path = process.env.MEMORY_FILE_PATH;
  const appName = process.env.OPENMEMORY_APP_NAME || process.env.OPENMEMORY_PROJECT_ID || "booster-beacon";
  if (!path) {
    console.error("MEMORY_FILE_PATH env not set");
    process.exit(2);
  }
  const bundle = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!Array.isArray(bundle.items)) {
    console.error("Invalid memory bundle: missing items[]");
    process.exit(2);
  }
  const toText = (item) => {
    const title = item.title || "Untitled";
    const desc = item.summary || (item.details && item.details.summary) || "";
    return desc ? `${title} — ${desc}` : title;
  };
  for (const item of bundle.items) {
    const payload = {
      memory: toText(item),
      categories: Array.isArray(item.tags) ? item.tags : [],
      app_name: appName,
      metadata: item.details || {}
    };
    process.stdout.write(JSON.stringify(payload) + "\n");
  }
' > "$TMP_MEMS"

OK=0; FAIL=0
while IFS= read -r line; do
  if [[ -z "$line" ]]; then continue; fi
  HTTP_STATUS=$(curl -sS -o /tmp/mem.out -w "%{http_code}" -X POST "$API_URL/api/v1/memories/" \
    -H "Authorization: Bearer $OPENMEMORY_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary "$line" || true)
  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "201" ]]; then
    OK=$((OK+1)); printf ".";
  else
    FAIL=$((FAIL+1)); echo; echo "Push failed ($HTTP_STATUS): $(cat /tmp/mem.out)" >&2;
  fi
done < "$TMP_MEMS"
echo; echo "Pushed $OK memories, $FAIL failed."
rm -f "$TMP_MEMS"
