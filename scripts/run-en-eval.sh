#!/usr/bin/env bash
# Runs the English retrieval benchmark against the three modules and writes reports to eval/reports.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${RAG_INTERNAL_TOKEN:?RAG_INTERNAL_TOKEN is required}"

mkdir -p eval/reports

for module in traditional nano-brain graph-rag; do
  echo "Evaluating ${module}..."
  python3 eval/run_eval.py "$module" "en" \
    --golden="eval/golden/en/${module}.jsonl" \
    --reports="eval/reports"
done

echo "Reports written to eval/reports/*-en.md and *-en-summary.json"
