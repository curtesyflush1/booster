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

PROJECT_ID="${OPENMEMORY_PROJECT_ID:-booster-beacon-proj-001}"

echo "Pushing memories to $API_URL for project $PROJECT_ID ..."
curl -sS -X POST "$API_URL/projects/$PROJECT_ID/memories" \
  -H "Authorization: Bearer $OPENMEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @"$MEMORY_FILE"

echo -e "\nDone."
