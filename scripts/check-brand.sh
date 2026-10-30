#!/usr/bin/env bash
# Fails when a forbidden brand token appears in the repository.
# Covers the former vendor name (Chinese) and the romanized "fufan" in any casing.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=.next
  --exclude-dir=.venv
  --exclude-dir=__pycache__
  --exclude-dir=.git
  --exclude-dir=.agent-teams
  --exclude=check-brand.sh
)

targets=("$@")
if [ "${#targets[@]}" -eq 0 ]; then
  targets=(".")
fi

matches="$(grep -rniE '赋范|fufan' "${EXCLUDES[@]}" "${targets[@]}" 2>/dev/null || true)"

if [ -n "$matches" ]; then
  echo "Brand check failed: forbidden token found (former vendor name or 'fufan')." >&2
  echo "$matches" | head -50 >&2
  total="$(printf '%s\n' "$matches" | wc -l | tr -d ' ')"
  echo "Total matching lines: $total" >&2
  exit 1
fi

echo "Brand check passed: no vendor name or 'fufan' occurrences."
