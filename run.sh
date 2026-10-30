#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required. Install Bun before running this script."
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install uv before running this script."
  exit 1
fi

cd "$ROOT"

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Fill in the local database and model settings, then run again."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  bun install
fi

exec bun run dev:all
