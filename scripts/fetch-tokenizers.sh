#!/usr/bin/env bash
# P7-B: download the embedding model tokenizer.json into the local vendored path so chunks can be split by token count.
# Tries ModelScope (the Qwen upstream source) first, then falls back to HuggingFace. The file is not committed (see .gitignore); run once during first setup.
# Usage: bash scripts/fetch-tokenizers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT/assets/tokenizers/qwen3-embedding-8b"
DEST="$DEST_DIR/tokenizer.json"
MODEL_MS="Qwen/Qwen3-Embedding-8B"   # ModelScope namespace/model
MODEL_HF="Qwen/Qwen3-Embedding-8B"   # HuggingFace repo
MS_URL="https://modelscope.cn/models/${MODEL_MS}/resolve/master/tokenizer.json"
HF_URL="https://huggingface.co/${MODEL_HF}/resolve/main/tokenizer.json"

mkdir -p "$DEST_DIR"

if [ -f "$DEST" ]; then
  echo "Already exists: $DEST ($(wc -c < "$DEST") bytes). Delete it and rerun to force a refresh."
  exit 0
fi

fetch() {
  local url="$1" label="$2"
  echo "Downloading from ${label}: $url"
  if curl -fsSL --max-time 120 -o "$DEST.tmp" "$url"; then
    # 校验是合法 JSON（tokenizer.json 应含 model.type）
    if python3 -c "import json,sys; d=json.load(open('$DEST.tmp')); sys.exit(0 if d.get('model',{}).get('type') else 1)" 2>/dev/null; then
      mv "$DEST.tmp" "$DEST"
      echo "Success: $DEST ($(wc -c < "$DEST") bytes, from ${label})"
      return 0
    fi
    echo "  ${label} returned content that is not a valid tokenizer.json; discarding it."
  fi
  rm -f "$DEST.tmp"
  return 1
}

if fetch "$MS_URL" "ModelScope"; then exit 0; fi
echo "ModelScope failed; falling back to HuggingFace (set HF_ENDPOINT to use a mirror)..."
HF_TRY="${HF_ENDPOINT:-https://huggingface.co}/${MODEL_HF}/resolve/main/tokenizer.json"
if fetch "$HF_TRY" "HuggingFace"; then exit 0; fi

echo "Both sources failed. Download tokenizer.json manually and place it at: $DEST" >&2
echo "(A missing file is not fatal: chunking falls back to character counts, with less precise sizing.)" >&2
exit 1
