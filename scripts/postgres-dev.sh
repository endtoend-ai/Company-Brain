#!/usr/bin/env bash
set -euo pipefail

# macOS local PostgreSQL helper for the first phase.
# It installs postgresql@17 and pgvector via Homebrew if needed and starts PostgreSQL as a local service.
# GraphRAG additionally requires Apache AGE. Install the AGE extension for your
# local PostgreSQL before running `bun run db:init` with GRAPH_RAG_DATABASE_URL.

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required for this helper. Install PostgreSQL manually or install Homebrew first." >&2
  exit 1
fi

if ! brew list postgresql@17 >/dev/null 2>&1; then
  echo "Installing postgresql@17..."
  brew install postgresql@17
fi

if ! brew list pgvector >/dev/null 2>&1; then
  echo "Installing pgvector..."
  brew install pgvector
fi

if ! brew list apache-age >/dev/null 2>&1; then
  echo "Apache AGE is required for GraphRAG but is not installed via Homebrew."
  echo "Install apache-age for postgresql@17, then rerun bun run db:init."
fi

BREW_PREFIX="$(brew --prefix postgresql@17)"
export PATH="$BREW_PREFIX/bin:$PATH"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found after installing postgresql@17" >&2
  exit 1
fi

echo "Starting postgresql@17 via brew services..."
brew services start postgresql@17 >/dev/null

echo "Waiting for PostgreSQL..."
for _ in {1..30}; do
  if pg_isready >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    psql -d postgres -c 'SELECT version();'
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time." >&2
exit 1
