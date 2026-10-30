# FF-CompanyBrain

FF-CompanyBrain 是一个本地运行的多知识库链路平台。它把多个相互独立的 RAG 模块放在同一个产品工作台中，通过统一 API、统一身份系统和 Agent Gateway 组织起来。

当前平台包含三条知识链路：

- Nano Brain：TypeScript 实现，第一阶段的主要完整链路。
- Traditional RAG：Python / FastAPI 实现，面向文档、chunk、表格和混合检索。
- GraphRAG：Python / FastAPI 实现，面向图谱式证据检索和 LightRAG 工作空间。

平台只有一个管理员层级。管理员拥有所有知识库链路的完整管理权限，不设计链路管理员、局部管理员或多级管理员。

## 目录结构

```txt
apps/
  api/                 统一平台 API，负责身份鉴权和模块 HTTP 分发
  web/                 Next.js 前端控制台
  agent-gateway/       Agent Gateway，负责会话、SSE、MCP 工具编排

modules/
  nano-brain/          Nano Brain HTTP API 与 MCP Server
  traditional-rag/     Traditional RAG HTTP API 与 MCP Server
  graph-rag/           GraphRAG HTTP API 与 MCP Server

packages/
  contracts/           平台共享类型
  gateway/             模块注册与 HTTP 分发
  identity/            用户、登录、Bearer Token、管理员标记

scripts/
  postgres-dev.sh      macOS 本地 PostgreSQL/pgvector 辅助脚本
  init-db.ts           创建并迁移所有数据库
  create-admin.ts      创建默认管理员
  start-dev.sh         统一启动本地全栈服务
  deploy.sh            统一部署预检脚本
```

## 技术栈

```txt
前端：Next.js
统一后端：Bun / TypeScript + Hono
包管理：Bun workspaces
Python 模块：uv + FastAPI
Agent 层：LangChain / LangGraph
数据库：PostgreSQL，多 database
向量：pgvector
认证：用户名密码 + Bearer Token
embedding：OpenRouter OpenAI-compatible API
运行方式：纯本地进程
```

## 服务拓扑

本地默认端口如下：

| 服务 | 默认地址 | 说明 |
| --- | --- | --- |
| Web | `http://localhost:3000` | Next.js 前端 |
| API | `http://localhost:3001` | 统一平台 API |
| Agent Gateway | `http://localhost:3002` | Agent 会话、SSE、运行追溯 |
| Nano Brain HTTP | `http://127.0.0.1:8100` | Nano Brain 模块 HTTP 服务 |
| Traditional RAG HTTP | `http://127.0.0.1:8101` | Traditional RAG 模块 HTTP 服务 |
| GraphRAG HTTP | `http://127.0.0.1:8102` | GraphRAG 模块 HTTP 服务 |

模块边界非常重要：

- 前端只访问统一 API 和 Agent Gateway。
- 统一 API 不直接操作模块数据库。
- Agent Gateway 不直接实现 RAG 业务逻辑，只通过模块 MCP Server 编排工具。
- 每个 RAG 模块拥有独立上传、处理、检索和维护链路。
- 平台不强制所有模块使用同一种数据库，只要求边界清晰。

## 环境准备

需要安装：

- Bun
- uv
- PostgreSQL 17
- pgvector
- Python 3.11+

macOS 本地 PostgreSQL 可使用：

```bash
bun run postgres:dev
```

GraphRAG 如需完整本地能力，还需要为 PostgreSQL 安装 Apache AGE。`postgres-dev.sh` 会提示但不会自动完成 AGE 编译安装。

## 环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

然后编辑 `.env`。关键变量如下：

```txt
POSTGRES_ADMIN_URL
IDENTITY_DATABASE_URL
NANO_BRAIN_DATABASE_URL
TRADITIONAL_RAG_DATABASE_URL
GRAPH_RAG_DATABASE_URL
AGENT_DATABASE_URL
AGENT_CHECKPOINT_SCHEMA

API_PORT
AGENT_GATEWAY_PORT

RAG_INTERNAL_TOKEN
NANO_BRAIN_HTTP_PORT
NANO_BRAIN_HTTP_URL
TRADITIONAL_RAG_HTTP_PORT
TRADITIONAL_RAG_HTTP_URL
GRAPH_RAG_HTTP_PORT
GRAPH_RAG_HTTP_URL

ADMIN_USERNAME
ADMIN_PASSWORD

EMBEDDING_PROVIDER
EMBEDDING_BASE_URL
EMBEDDING_API_KEY
EMBEDDING_MODEL

AGENT_PROVIDER
AGENT_BASE_URL
AGENT_API_KEY
AGENT_MODEL
AGENT_TEMPERATURE
AGENT_STREAM_USAGE
```

注意：

- `EMBEDDING_API_KEY`、`AGENT_API_KEY`、`ADMIN_PASSWORD` 只能保存在本地 `.env`，禁止提交。
- `AGENT_DATABASE_URL` 可以和其他数据库位于同一个 PostgreSQL 实例，但必须是独立 database。
- `RAG_INTERNAL_TOKEN` 用于统一 API 调用模块 HTTP 服务，部署时必须改成非默认值。

## 首次启动

推荐流程：

```bash
cp .env.example .env
# 编辑 .env

bun install
bun run postgres:dev
bun run db:init
bun run admin:create
bun run dev:all
```

打开：

```txt
http://localhost:3000
```

`bun run dev:all` 会在一个终端中启动完整本地服务栈：

- `apps/api`
- `modules/nano-brain` HTTP
- `modules/traditional-rag` HTTP
- `modules/graph-rag` HTTP
- `apps/agent-gateway`
- `apps/web`

按 `Ctrl-C` 会停止所有由脚本启动的子进程。

也可以按服务单独启动：

```bash
bun run dev:api
bun run dev:nano-http
bun run dev:traditional-rag
bun run dev:graph-rag
bun run dev:agent-gateway
bun --cwd apps/web dev
```

## 数据库初始化

创建并迁移所有数据库：

```bash
bun run db:init
```

该命令会：

- 读取 `POSTGRES_ADMIN_URL`
- 按各模块 database URL 自动创建缺失 database
- 迁移 identity 数据库
- 迁移 Nano Brain 数据库
- 迁移 Agent Gateway 数据库
- 运行 Traditional RAG 数据库迁移
- 运行 GraphRAG 数据库迁移

创建管理员：

```bash
bun run admin:create
```

默认从 `.env` 读取：

```txt
ADMIN_USERNAME
ADMIN_PASSWORD
```

也可以临时指定：

```bash
bun run scripts/create-admin.ts --username=admin --password=your-password
```

如果管理员已存在，脚本会以状态码 `2` 退出；统一部署脚本会将这个状态视为可继续。

## 统一启动脚本

```bash
bun run dev:all
```

等价于：

```bash
./scripts/start-dev.sh
```

查看帮助：

```bash
./scripts/start-dev.sh --help
```

这个脚本用于本地开发，不是生产守护进程管理器。生产环境建议用 systemd、supervisord、Docker Compose、PM2 或平台自身的 process manager 启动各服务。

## 统一部署预检脚本

```bash
bun run deploy
```

等价于：

```bash
./scripts/deploy.sh
```

默认执行：

1. `bun install --frozen-lockfile`
2. `uv sync --project modules/traditional-rag`
3. `uv sync --project modules/graph-rag`
4. `bun x tsc --noEmit`
5. `bun --cwd apps/web build`
6. `bun run db:init`
7. `bun run admin:create`

可选参数：

```bash
./scripts/deploy.sh --skip-install
./scripts/deploy.sh --skip-db
./scripts/deploy.sh --skip-admin
./scripts/deploy.sh --skip-web-build
```

常用预检：

```bash
./scripts/deploy.sh --skip-install --skip-db --skip-admin
```

这会执行 TypeScript 检查和前端构建，但不会安装依赖、修改数据库或创建管理员。

部署脚本完成后，生产进程可分别使用：

```bash
bun --cwd apps/api start
bun --cwd modules/nano-brain http
uv run --project modules/traditional-rag python -m traditional_rag.http.main
uv run --project modules/graph-rag python -m graph_rag.http.main
bun --cwd apps/agent-gateway start
bun --cwd apps/web start
```

## Deployment

For production self-hosting, environment setup, and day-two operations, see the
[deployment guide](./docs/DEPLOYMENT.md).

## 前端工作台

前端位于 `apps/web`，使用 Next.js App Router。

当前工作台按模块隔离：

- `nano-brain`：Nano Brain 总览、Source、Page、Capture、Search、Graph、Facts、Dream
- `传统 RAG`：Source、文档上传、处理状态、Search、Table Query
- `GraphRAG`：Source、Documents、Search / Ask
- `Agent`：公共 Agent Chat，可服务于不同模块

布局分层：

- Next.js：路由、渲染、数据边界
- 组件系统：`PageShell`、`Toolbar`、`Panel`、`FormSection`、`TwoColumnLayout`
- 布局规则：`apps/web/app/workspace.css` 和 `globals.css`
- 功能实现：各 workspace 业务组件

组件策略：

- 项目自研页面骨架和控制台布局组件。
- 使用 `@base-ui/react` 作为 headless 交互原语来源。
- 暂不引入 MUI、Mantine、Ant Design 这类完整视觉组件库。

## Agent Gateway

Agent Gateway 位于 `apps/agent-gateway`。

职责：

- 管理 Agent conversation
- 创建 run 记录
- 通过 SSE 返回增量事件
- 读取 checkpoint messages
- 按 active module 加载对应 MCP tools

MCP Server 不需要在 `dev:all` 中单独常驻启动。Agent Gateway 会在需要时通过 stdio 启动模块 MCP Server：

- Nano Brain MCP：`modules/nano-brain`
- Traditional RAG MCP：`modules/traditional-rag`
- GraphRAG MCP：`modules/graph-rag`

## 常用开发命令

```bash
# 安装依赖
bun install

# 类型检查
bun x tsc --noEmit

# 前端构建
bun --cwd apps/web build

# 启动本地 PostgreSQL
bun run postgres:dev

# 初始化数据库
bun run db:init

# 创建管理员
bun run admin:create

# 统一启动本地服务
bun run dev:all

# 部署预检
bun run deploy
```

## 排障

### 端口被占用

检查端口：

```bash
lsof -iTCP:3000 -sTCP:LISTEN -n -P
lsof -iTCP:3001 -sTCP:LISTEN -n -P
lsof -iTCP:3002 -sTCP:LISTEN -n -P
```

修改 `.env` 中对应端口，或停止占用进程。

### `next/font` 构建失败

`apps/web` 使用 Google Fonts。`next build` 需要访问 Google Fonts 下载字体。如果网络受限，构建会失败。解决方式：

- 确保构建环境可以访问 Google Fonts。
- 或后续改为本地字体文件。

### `uv` 命令不存在

Traditional RAG 和 GraphRAG 使用 `uv` 管理 Python 环境。安装 `uv` 后再运行：

```bash
uv sync --project modules/traditional-rag
uv sync --project modules/graph-rag
```

### 管理员已存在

`bun run admin:create` 如果发现用户名已存在，会以状态码 `2` 退出。这不是数据库损坏。统一部署脚本会把该状态视为可继续。

### GraphRAG 数据库迁移失败

GraphRAG 可能依赖 PostgreSQL 扩展。确认：

- `GRAPH_RAG_DATABASE_URL` 指向独立 database。
- PostgreSQL 已安装所需扩展。
- `.graph-rag-workdir` 可写。

## 参考文档

- [顶层架构](./docs/ARCHITECTURE.md)
- [服务边界](./docs/SERVICE_BOUNDARIES.md)
- [统一 API 文档](./docs/API.md)
- [Nano Brain PRD](./modules/nano-brain/docs/PRD.md)
- [Nano Brain 架构](./modules/nano-brain/docs/ARCHITECTURE.md)
- [Nano Brain API](./modules/nano-brain/docs/API.md)
- [Traditional RAG API](./modules/traditional-rag/docs/API.md)
- [GraphRAG API](./modules/graph-rag/docs/API.md)
