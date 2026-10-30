# CompanyBrain — Self-Hosting Guide

Operational guide for administrators deploying the repository on a macOS or Linux host. It covers
installation, database bootstrap, startup, verification, and day-two operations.

## 1. Architecture at a glance

CompanyBrain runs as local processes. One PostgreSQL instance hosts five independent databases;
three RAG modules expose HTTP APIs and MCP servers.

| Service | Default address | Process |
| --- | --- | --- |
| Web console | `http://localhost:3000` | Next.js (`apps/web`) |
| Platform API | `http://localhost:3001` | Bun + Hono (`apps/api`) |
| Agent Gateway | `http://localhost:3002` | Bun + Hono (`apps/agent-gateway`) |
| Gbrain (Nano Brain) | `http://127.0.0.1:8100` | Bun + Hono (`modules/nano-brain`) |
| Naive RAG (Traditional RAG) | `http://127.0.0.1:8101` | Python + FastAPI (`modules/traditional-rag`) |
| GraphRAG | `http://127.0.0.1:8102` | Python + FastAPI (`modules/graph-rag`) |

Expose the web console publicly. The platform API and agent gateway can sit behind the same reverse
proxy or stay on a private network. Module APIs are internal and require `RAG_INTERNAL_TOKEN`.

## 2. Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Bun | 1.2+ | Workspace package manager and runtime for TypeScript services |
| Node.js | 20+ | Required by Next.js |
| Python | 3.11+ | Managed by `uv`; no manual install needed |
| uv | 0.5+ | Runs both Python modules |
| PostgreSQL | 17 | One instance, five databases |
| pgvector | 0.8+ | Vector storage for all RAG modules |
| Apache AGE | 1.6+ | GraphRAG only; PG17 build required |

### macOS

Homebrew:

```bash
brew install bun uv postgresql@17 pgvector
brew services start postgresql@17
```

PostgreSQL runs as your login user. `bun run postgres:dev` wraps these steps.

### Linux — Debian / Ubuntu

```bash
# PostgreSQL 17 + pgvector + AGE build dependencies
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql-17 postgresql-17-pgvector \
  postgresql-server-dev-17 build-essential flex bison libreadline-dev zlib1g-dev

# Node.js (Next.js), Bun, uv
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"

sudo systemctl enable --now postgresql
```

Create the database role; the init script needs `CREATEDB`:

```bash
sudo -u postgres psql -c "CREATE ROLE companybrain LOGIN PASSWORD 'change-me' CREATEDB;"
```

Use `postgres://companybrain:change-me@localhost:5432/postgres` as `POSTGRES_ADMIN_URL`, and the
same host and credentials for the five database URLs. The default `pg_hba.conf` uses `peer` on the
Unix socket and `scram-sha-256` over `127.0.0.1`, so password auth over TCP works without edits.

### Linux — RHEL / Rocky / Fedora

```bash
sudo dnf install -y \
  https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql
sudo dnf install -y postgresql17-server postgresql17-contrib postgresql17-devel \
  pgvector_17 gcc gcc-c++ make flex bison readline-devel zlib-devel
sudo /usr/pgsql-17/bin/postgresql-17-setup initdb
sudo systemctl enable --now postgresql-17
```

Use the `EL-8` / `EL-9` / `EL-10` repository that matches the OS major version. If `pgvector_17` is
not packaged for your distribution, build pgvector from source (below).

Install Node.js, Bun, and uv as in the Debian section. PostgreSQL data lives in
`/var/lib/pgsql/17/data`; administrative `psql` commands run as the `postgres` system user.

### Build pgvector from source

```bash
git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
cd /tmp/pgvector
make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config    # RHEL: /usr/pgsql-17/bin/pg_config
sudo make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config install
```

### Apache AGE (GraphRAG only)

No distribution packages Apache AGE for PostgreSQL 17. Build the PG17 branch against the same
PostgreSQL installation:

```bash
# Debian/Ubuntu build deps are installed above.
# RHEL: sudo dnf install -y postgresql17-devel gcc make flex bison readline-devel zlib-devel
git clone --depth 1 --branch release/PG17/1.6.0 https://github.com/apache/age.git /tmp/age
cd /tmp/age
make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config    # RHEL: /usr/pgsql-17/bin/pg_config
sudo make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config install
```

macOS uses `$(brew --prefix postgresql@17)/bin/pg_config`. Verify the extension is loadable with
`psql -d postgres -c "CREATE EXTENSION age;"`.

Skip AGE only if GraphRAG is not required.

### macOS vs Linux

| Area | macOS | Linux |
| --- | --- | --- |
| Packages | Homebrew | `apt` / `dnf` |
| PostgreSQL service | `brew services` | `systemctl` (`postgresql` or `postgresql-17`) |
| Local DB auth | trust for your OS user | `peer` on socket; create a role and use TCP + password |
| `pg_config` | `$(brew --prefix postgresql@17)/bin/pg_config` | `/usr/lib/postgresql/17/bin/pg_config` or `/usr/pgsql-17/bin/pg_config` |
| Binary PATH | `/opt/homebrew/bin` | `~/.bun/bin`, `~/.local/bin` |
| Background process | `nohup` / `brew services` | systemd unit (see §8) |

## 3. Environment variables

Copy the template and edit every secret:

```bash
cp .env.example .env
chmod 600 .env
```

Never commit `.env`. The repository ignores it.

### Databases

| Variable | Purpose |
| --- | --- |
| `POSTGRES_ADMIN_URL` | Admin connection used to create databases |
| `IDENTITY_DATABASE_URL` | Users, sessions, bearer tokens |
| `NANO_BRAIN_DATABASE_URL` | Gbrain documents, pages, chunks |
| `TRADITIONAL_RAG_DATABASE_URL` | Naive RAG documents and chunks |
| `GRAPH_RAG_DATABASE_URL` | GraphRAG documents and AGE graph |
| `AGENT_DATABASE_URL` | Agent conversations, runs, LangGraph checkpoints |
| `AGENT_CHECKPOINT_SCHEMA` | LangGraph checkpoint schema (default `langgraph`) |

Each URL must point to a separate database. They may share one PostgreSQL instance.

### Service ports and internal auth

| Variable | Default | Notes |
| --- | --- | --- |
| `API_PORT` | `3001` | Platform API |
| `AGENT_GATEWAY_PORT` | `3002` | Agent Gateway |
| `NANO_BRAIN_HTTP_PORT` | `8100` | Gbrain HTTP |
| `TRADITIONAL_RAG_HTTP_PORT` | `8101` | Naive RAG HTTP |
| `GRAPH_RAG_HTTP_PORT` | `8102` | GraphRAG HTTP |
| `NANO_BRAIN_HTTP_URL` | `http://127.0.0.1:8100` | Used by the platform API |
| `TRADITIONAL_RAG_HTTP_URL` | `http://127.0.0.1:8101` | Used by the platform API |
| `GRAPH_RAG_HTTP_URL` | `http://127.0.0.1:8102` | Used by the platform API |
| `RAG_INTERNAL_TOKEN` | — | Secret shared by the platform API and modules; generate with `openssl rand -hex 24` |

### Administrator

| Variable | Notes |
| --- | --- |
| `ADMIN_USERNAME` | Username created by `bun run admin:create` |
| `ADMIN_PASSWORD` | 8–256 characters; store only in `.env` |

### Models

| Variable | Example | Purpose |
| --- | --- | --- |
| `EMBEDDING_PROVIDER` | `openai-compatible` | Only supported value |
| `EMBEDDING_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint |
| `EMBEDDING_API_KEY` | — | Secret |
| `EMBEDDING_MODEL` | `qwen/qwen3-embedding-8b` | Any OpenAI-compatible embedding model |
| `EMBEDDING_DIMENSIONS` | `1024` | Must match the database `vector(N)` columns; default 1024 |
| `AGENT_PROVIDER` | `openai-compatible` | Only supported value |
| `AGENT_BASE_URL` | `https://api.deepseek.com/v1` | Chat-completions endpoint |
| `AGENT_API_KEY` | — | Secret |
| `AGENT_MODEL` | `deepseek-flash` | Tool-calling model |
| `AGENT_TEMPERATURE` | `0` | 0–2 |
| `AGENT_STREAM_USAGE` | `false` | Enable only if the endpoint supports `stream_options` |

### Retrieval reranking (optional)

Reranking improves citation precision. When no rerank credential is configured, reranking is
skipped and every retrieved citation is returned unchanged.

| Provider | `RERANK_PROVIDER` | Default endpoint | Default model | Credential |
| --- | --- | --- | --- | --- |
| Alibaba DashScope (China region) | `dashscope` | `https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank` | `qwen3-rerank` | `DASHSCOPE_API_KEY` |
| Cohere (global) | `cohere` | `https://api.cohere.com/v2/rerank` | `rerank-v3.5` | `RERANK_API_KEY` |
| Jina AI (global) | `jina` | `https://api.jina.ai/v1/rerank` | `jina-reranker-v2-base-multilingual` | `RERANK_API_KEY` |
| Voyage AI (global) | `voyage` | `https://api.voyageai.com/v1/rerank` | `rerank-2.5` | `RERANK_API_KEY` |

Pick one provider; `RERANK_BASE_URL` and `RERANK_MODEL` are optional overrides:

```bash
# Cohere
RERANK_PROVIDER=cohere
RERANK_API_KEY=<cohere-api-key>
```

```bash
# Jina AI (jina-reranker-v3 is also available as a higher-quality model)
RERANK_PROVIDER=jina
RERANK_API_KEY=<jina-api-key>
# RERANK_MODEL=jina-reranker-v3
```

```bash
# Voyage AI
RERANK_PROVIDER=voyage
RERANK_API_KEY=<voyage-api-key>
# RERANK_MODEL=rerank-2.5-lite
```

DashScope remains the default for existing installations: keep `DASHSCOPE_API_KEY` and omit
`RERANK_PROVIDER` (or set it to `dashscope`). `RERANK_API_KEY` takes precedence over the DashScope
key when both are present.

| Variable | Default | Notes |
| --- | --- | --- |
| `RERANK_PROVIDER` | `dashscope` | `dashscope`, `cohere`, `jina`, or `voyage` |
| `RERANK_API_KEY` | — | Credential for non-DashScope providers |
| `RERANK_BASE_URL` | provider default | Override the endpoint (gateway, proxy, or self-hosted reranker) |
| `RERANK_MODEL` | provider default | Override the model |
| `RERANK_MIN_SCORE` | `0.4` | Citations below this score are dropped |
| `RERANK_TOP_N` | `5` | Citations kept after reranking |

Notes:

- Cohere trial keys are rate-limited; use a production key for real traffic.
- Jina and Voyage both offer multilingual rerankers; choose the model that matches the corpus.
- The admin console's **Test connection** action on the Integrations page uses the selected provider
  and reports probe latency.

### Document parsing (optional)

| Variable | Notes |
| --- | --- |
| `MINERU_API_KEY` | MinerU key shown in the admin console |
| `MINERU_BASE_URL` | Defaults to `https://mineru.net` |

### Chunking (optional)

| Variable | Notes |
| --- | --- |
| `CHUNK_TOKEN_MODE` | `0` = character chunking (default), `1` = tokenizer-based |
| `EMBEDDING_TOKENIZER_PATH` | Local tokenizer path used only when `CHUNK_TOKEN_MODE=1` |

## 4. Install dependencies

```bash
bun install
uv sync --project modules/traditional-rag
uv sync --project modules/graph-rag
```

`bun install` installs all workspace packages, including the web console and both TypeScript
services.

## 5. Start PostgreSQL and initialize databases

Start PostgreSQL on macOS (Homebrew helper):

```bash
bun run postgres:dev
```

The helper installs `postgresql@17` and `pgvector` when missing, starts the service, and waits for
readiness. On Linux, start the systemd unit from §2 (`postgresql` on Debian/Ubuntu,
`postgresql-17` on RHEL) and skip this command. If PostgreSQL runs on another host, skip this step
and point the database URLs at it.

Create databases and run migrations:

```bash
bun run db:init
```

This creates the five databases when missing, applies identity, Gbrain, agent gateway, Naive RAG,
and GraphRAG migrations, and installs the `vector` (and `age` for GraphRAG) extensions.

Create the administrator:

```bash
bun run admin:create
```

Exit code `2` means the username already exists; treat it as success.

## 6. Start the stack

```bash
bun run dev:all
```

This starts all six services in one terminal and prefixes each log line with the service name.
Stop everything with `Ctrl-C`.

To keep the stack running after the shell exits:

```bash
nohup ./scripts/start-dev.sh > .dev-stack.log 2>&1 &
```

Individual services:

```bash
bun run dev:api
bun run dev:nano-http
bun run dev:traditional-rag
bun run dev:graph-rag
bun run dev:agent-gateway
bun --cwd apps/web dev
```

Open `http://localhost:3000` and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### Load the demo dataset (optional)

The README screenshots and benchmark use a reproducible English demo universe (Northwind Labs, a
fictional San Francisco SaaS company). Loading it **replaces local demo data**; back up first.

```bash
# stop the running stack, then:
./scripts/reset-demo-data.sh --yes

bun run db:init
bun run admin:create
bun run dev:all          # keep this terminal open

# in a second terminal:
bun run demo:seed        # 7 documents, 3 scenarios, pre-asked chat sessions
bun run demo:eval        # writes eval/reports/*-en.md and *-en-summary.json
bun run demo:chart       # renders docs/assets/benchmarks.png
bun run demo:assets      # screenshots into docs/assets/screenshots
```

`demo:seed` uses the English corpus in `eval/corpus/en/docs/` and the query sets in
`eval/golden/en/`. The generated `eval/manifest.json` contains runtime IDs and is not committed.

## 7. Verify the deployment

### Health endpoints

```bash
curl -s http://127.0.0.1:3001/health
curl -s http://127.0.0.1:3002/health
curl -s http://127.0.0.1:8100/health
curl -s http://127.0.0.1:8101/health
curl -s http://127.0.0.1:8102/health
```

Each returns `{"status":"ok","service":"..."}`.

### Admin console

Sign in, open **Admin → Integrations** (`/admin/settings`), and confirm:

- Overall status is **Ready**.
- Model providers (answer model, embedding, rerank, document parsing) show **Connected**.
- Gbrain, Naive RAG, and GraphRAG each show **Service available**.
- Use **Test connection** to probe each provider individually.

### End-to-end smoke test

1. Upload a small Markdown or text file into one module (or create a scenario in the workspace).
2. Confirm the processing job reaches `ready` / `embedded`.
3. Ask a question whose answer is stated verbatim in the file and confirm the citation matches.

## 8. Production notes

Build and run the web console:

```bash
bun --cwd apps/web build
bun --cwd apps/web start
```

`next build` downloads Google Fonts; a network-restricted build fails on fonts, not on
TypeScript.

Service commands for a process manager (systemd, supervisord, PM2, container runtime):

```bash
bun --cwd apps/api start
bun --cwd modules/nano-brain http
uv run --project modules/traditional-rag python -m traditional_rag.http.main
uv run --project modules/graph-rag python -m graph_rag.http.main
bun --cwd apps/agent-gateway start
bun --cwd apps/web start
```

### systemd unit (Linux)

The all-in-one script is convenient for evaluation and single-VM installs, but it is a development
supervisor (file watching), not a hardened production daemon. For production, run the six commands
above under separate units or a process manager.

Example unit that keeps the whole stack running on one VM:

```ini
[Unit]
Description=CompanyBrain
Wants=network-online.target
After=network-online.target postgresql.service

[Service]
Type=simple
User=companybrain
WorkingDirectory=/opt/companybrain
EnvironmentFile=/opt/companybrain/.env
Environment=HOME=/home/companybrain
Environment=PATH=/home/companybrain/.bun/bin:/home/companybrain/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/opt/companybrain/scripts/start-dev.sh
Restart=on-failure
RestartSec=5
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now companybrain
journalctl -u companybrain -f
```

`EnvironmentFile` does not expand `$HOME` or shell syntax; use absolute paths. The service account
needs write access to the repository, `apps/web/.platform-data`, and `.graph-rag-workdir`.

### Firewall

Only port 3000 (web console) needs to be public. 3001/3002 can sit behind the same reverse proxy;
8100–8102 are internal module APIs and must not be reachable from outside the host:

```bash
sudo ufw allow 3000/tcp
# do not open 8100-8102
```

Bun's module servers bind all interfaces by default, so the firewall (or a private network) is what
keeps them internal.

Operational requirements:

- Run GraphRAG with a single worker and a persistent `GRAPH_RAG_WORKING_DIR`; LightRAG keeps local
  state per workspace.
- Put the web console behind authentication before exposing it publicly; every chat and embedding
  call is billable.
- Terminate TLS at a reverse proxy and expose only ports 3000–3002.
- Replace `RAG_INTERNAL_TOKEN` with a random value and keep it identical on the platform API and
  all modules.
- Back up all five databases plus `apps/web/.platform-data` (uploaded files and ingestion state).
- Set the same `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` everywhere; changing dimensions after
  ingestion requires re-embedding.

## 9. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `bun is required` | Bun is not on `PATH`; install it and reopen the shell |
| `uv is required` | Install `uv`; Python modules cannot start without it |
| Port already in use | Inspect with `lsof -iTCP:<port> -sTCP:LISTEN -n -P`, stop the process or change the port variable |
| `admin:create` exits 2 | Username already exists; no action needed |
| GraphRAG migration fails on `CREATE EXTENSION age` | AGE is not installed for the PostgreSQL major version in use; rebuild it against that `pg_config` |
| GraphRAG ingestion stuck in `processing` | Check the module log for LightRAG/LLM errors and that `GRAPH_RAG_WORKING_DIR` is writable |
| Embedding probe times out | The provider is slow or rate-limited; retries are built in, otherwise switch `EMBEDDING_BASE_URL`/`EMBEDDING_MODEL` |
| `next build` fails on fonts | The build host cannot reach Google Fonts; allow network access or self-host the fonts |
| `psql: FATAL: Peer authentication failed` | Debian/Ubuntu uses `peer` auth on the local socket; connect over TCP (`-h 127.0.0.1`) with the role password, or run admin commands with `sudo -u postgres psql` |
| Rerank probe returns 401 after switching providers | Set `RERANK_API_KEY` for Cohere/Jina/Voyage; `DASHSCOPE_API_KEY` is only used when `RERANK_PROVIDER=dashscope` |
| `uv sync` fails while building a wheel | Install a C toolchain and Python headers (`build-essential` + `postgresql-server-dev-17` on Debian, `gcc gcc-c++ postgresql17-devel` on RHEL) |
| Agent answers without citations | Confirm the module health indicators are green and `RAG_INTERNAL_TOKEN` matches across services |
