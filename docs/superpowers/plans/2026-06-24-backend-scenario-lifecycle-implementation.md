# Backend Scenario Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform orchestration backend that connects frontstage scenario templates, scenario instances, processing tasks, knowledge space objects, and company brain chat to the existing Nano Brain, Traditional RAG, GraphRAG, and Agent Gateway services.

**Architecture:** Keep the existing service boundary: `apps/api` owns platform HTTP APIs and authentication; `packages/gateway` calls module HTTP APIs; each RAG module owns its own documents, indexing, search, and permissions. Add a new `packages/platform` package that stores only platform-level business metadata and orchestration state: templates, scenario instances, source bindings, processing tasks, knowledge projections, deliverables, and scenario-aware chat scope. Module adapters are mode-aware: `PLATFORM_MODULE_MODE=mock` returns stable synthetic module references for product-chain verification, and `PLATFORM_MODULE_MODE=real` calls existing module APIs through `packages/gateway`. Extend Agent Gateway to support a company-brain scope without directly touching module databases.

**Tech Stack:** Bun workspaces, Hono, PostgreSQL via `pg`, TypeScript packages, Python FastAPI RAG modules behind HTTP/MCP adapters, Bun tests, existing `scripts/init-db.ts` migration runner, existing `packages/gateway` module proxy.

---

## Related Admin And Product Depth Plan

This backend scenario lifecycle plan must be implemented together with `docs/superpowers/plans/2026-06-25-admin-operations-console-product-depth-implementation.md`.

That companion plan adds the admin-side product depth layer: retrieval strategy profiles, processing pipeline observability, relationship graph explorer snapshots, quality test benches, template governance, and advanced frontstage controls. If a backend feature creates or processes knowledge, it must expose enough product-level status, configuration, or diagnostics for the admin console to manage it.

## Existing Backend Adaptation Contract

This plan treats the already-tested backend RAG chains as completed product capabilities. The implementation must adapt those capabilities into the new frontstage product model and only add the platform backend objects that the redesigned frontend requires.

1. **Existing module chains are source of truth.** Nano Brain, Traditional RAG, GraphRAG, and Agent Gateway keep owning their existing ingestion, indexing, retrieval, question answering, permissions, and MCP/tool execution behavior.
2. **Do not reimplement tested module behavior in the platform layer.** Platform code must not duplicate document parsing, vector search, graph extraction, wiki page generation, module-level search, or module-level ask logic that already exists behind module APIs.
3. **Use gateway/module APIs as the integration surface.** New platform features call the existing module HTTP APIs through `packages/gateway` or the existing Agent Gateway contract. `apps/api` and `packages/platform` must not import module core code or read/write module databases directly.
4. **Store product metadata and module references only.** The platform database stores scenario templates, scenario instances, tasks, source bindings, knowledge projections, deliverables, statuses, and references such as `module_id`, `source_id`, `document_id`, `job_id`, `page_id`, or `conversation_id`. The module database remains the owner of the real indexed data.
5. **Every new frontend capability must land in one of two buckets.** If it is already supported by an existing module chain, build a module adapter and route to that chain. If it is a new product concept, add only the minimum platform backend object/API needed to orchestrate it.
6. **Do not fake completion states.** A scenario, task, knowledge item, or chat scope can show `ready` only after the backing module call has returned the required source/document/job/page/conversation reference. Unsupported or deferred behavior must be marked as `needs_input`, `waiting_review`, `failed`, or explicitly scheduled as a later phase.
7. **Frontend language is business-facing; backend integration remains technical.** The frontend can describe templates as "personal knowledge wiki", "customer support assistant", or "domain relationship analysis"; the backend maps those templates to Nano Brain, Traditional RAG, GraphRAG, or company-brain Agent Gateway scopes.

## Mock-Real Execution Strategy

The backend must support a local mode that proves the full product chain without requiring real RAG service configuration. This is not a separate fake API. It is the same platform API, database, worker, scenario lifecycle, task lifecycle, knowledge projection, and chat-scope contract, with only the final module adapter call swapped.

1. **Default to mock module execution.** If `PLATFORM_MODULE_MODE` is not set, platform code must behave as `PLATFORM_MODULE_MODE=mock`. Local frontend development should not require `NANO_BRAIN_HTTP_URL`, `TRADITIONAL_RAG_HTTP_URL`, `GRAPH_RAG_HTTP_URL`, module database credentials, model keys, or `RAG_INTERNAL_TOKEN`.
2. **Keep the product chain real in both modes.** `POST /platform/scenarios`, task creation, worker status updates, source bindings, knowledge objects, and chat-scope creation must execute against real platform code and the platform database in both mock and real mode.
3. **Mock mode returns stable module-shaped references.** Mock adapters must return deterministic IDs that match the same reference fields used by real adapters, such as `source_id`, `document_id`, `job_id`, `page_id`, and `conversation_id`. This lets the frontend and platform database be debugged before real module services are configured.
4. **Real mode is the only place that calls RAG module APIs.** Real adapters call Nano Brain, Traditional RAG, and GraphRAG through `packages/gateway`. No other platform code calls module APIs directly.
5. **Switching modes must not change frontend or platform contracts.** The same scenario template, task status, source binding, knowledge object, and chat scope payloads must be produced in mock and real mode. Only adapter internals and returned module reference IDs differ.
6. **Smoke tests run in mock mode first.** The mandatory smoke path should prove auth, template listing, scenario creation, worker processing, task readiness, knowledge listing, and chat-scope creation with `PLATFORM_MODULE_MODE=mock`. Real module smoke tests are optional until module configuration is available.
7. **Mock data must be obviously synthetic but structurally accurate.** IDs should use prefixes like `mock_nano_source_`, `mock_traditional_job_`, and `mock_graph_document_`. User-facing messages should not say the real RAG module indexed the data unless `PLATFORM_MODULE_MODE=real`.

## Delivery Demo Data Strategy

The project needs a reusable data pack that makes every frontend and backend chain testable during delivery. Treat this as product evidence data, not as one-off fixture text.

1. **Generate realistic business assets per official template.** Every official template must have multiple scenario blueprints and multiple file assets: Markdown notes, policy PDFs, CSV/XLSX-like tables, questionnaire CSVs, support ticket exports, contract text, relationship JSON, and research briefs.
2. **Use one canonical data catalog.** The canonical source is `packages/platform/src/demo-data.ts`. Frontend fixtures, platform seed scripts, smoke tests, and delivery docs should derive from this catalog so names, IDs, scenarios, tasks, and knowledge objects stay consistent.
3. **Data volume should stress real product surfaces.** The seed should create at least 30 scenario instances, at least 120 uploaded asset records, at least 30 processing tasks, and at least 30 knowledge projections across Wiki, document evidence, relationship, and artifact modes.
4. **Product-facing UI should not label the data as fake.** Scenario names, customer names, document titles, policy clauses, support cases, and relationship objects should read like normal enterprise sample data. Internal scripts may keep source/provenance metadata for maintainability, but user-facing surfaces should not display "mock", "fake", "fixture", or "synthetic".
5. **Generated files must be reusable for uploads.** The data generator writes a physical asset tree under `_demo-data/companybrain/` with a manifest. The platform seed script uses the same manifest to submit scenario creation requests and drive the worker.
6. **No external network dependency for baseline delivery.** The baseline generator creates realistic owned sample assets locally. Optional public-document downloads can be added later only with a manifest that records URL, license/source, retrieval date, and checksum.
7. **Every official template needs a demo walkthrough.** The walkthrough includes realistic sample input assets, processing preview, sample question, sample answer, source citations, and result highlights. It is stored as product metadata and returned with template APIs so frontstage template detail pages can show value before creation.
8. **Mock-real mode still applies.** In `PLATFORM_MODULE_MODE=mock`, generated data drives the real platform chain and returns deterministic module references. In `PLATFORM_MODULE_MODE=real`, the same generated assets can be sent to actual module APIs for ingestion debugging.

## Upload Asset Lifecycle Contract

`uploaded_files` in scenario creation is not enough for a SaaS product. The platform must own a durable upload asset record before a worker sends content to any RAG module.

1. **Asset records are product objects.** Store file name, MIME type, size, checksum, owner, scenario binding, processing status, storage key, visibility, and archive state in platform tables.
2. **Storage is replaceable.** Local development writes files under `_runtime/platform-assets/`. Production can replace that with object storage without changing platform API payloads.
3. **Scenario creation may reference existing assets or create new upload placeholders.** The API accepts both `uploaded_files` metadata for local/demo flows and `asset_ids` for real upload flows. The worker reads asset records, not raw request bodies.
4. **Every asset has lifecycle actions.** Assets can be ready, parsing, linked, needs input, failed, archived, or deleted. Retry/reprocess must create task events and preserve the previous asset record for audit.
5. **User surfaces stay business-facing.** Frontstage users see "资料已接收 / 正在整理 / 需要补充 / 已可使用"; admin sees storage key, checksum, source binding, parser stage, and failure detail.

## Real-Mode Adapter Contract Matrix

Before real RAG services are configured, the platform must still define the exact contract it will expect from each module. This prevents local mock mode from drifting away from real integration.

| Module | Platform Adapter Input | Required Real Response Fields | Stored Platform Reference |
| --- | --- | --- | --- |
| Traditional RAG | source name, asset text or file path, MIME type, scenario/task ids | `source_id`, `document_id`, `job_id`, `status` | `module_id=traditional-rag`, `source_id`, `document_id`, `job_id` |
| GraphRAG | source name, relationship-ready text, scenario/task ids | `source_id`, `document_id`, `status`, optional `graph_id` | `module_id=graph-rag`, `source_id`, `document_id`, `graph_id` |
| Nano Brain | source name, page title, page body, scenario/task ids | `source_id`, `page_id`, `status` | `module_id=nano-brain`, `source_id`, `page_id` |
| Company Brain | scope type, allowed module bindings, scenario id | `conversation_id`, `active_module`, `metadata` | `active_module=company-brain`, `conversation_id`, scope metadata |

Contract tests must assert that mock adapters and real adapter request builders produce the same platform-facing reference shape. Real smoke tests can be skipped when module URLs are missing, but the contract matrix tests must always run.

## Backend Design Decisions

1. **Do not merge the three RAG modules.** Traditional RAG, GraphRAG, and Nano Brain stay independent. Platform code stores bindings like `module_id + source_id + document_id`, not module internals.
2. **Add a platform orchestration database.** Use `PLATFORM_DATABASE_URL` and a new `packages/platform` package. Do not overload identity or agent gateway tables.
3. **Scenario templates are evidence-gated business recipes.** They map frontstage template IDs to one or more backend module plans, but the frontend never sees technical module names. A template cannot be marked `official` unless it has at least two evidence sources, a product form, lifecycle metadata, limitations, and a default module plan.
4. **Scenario instances are real runtime objects.** A user creates an instance from a template; the backend creates tasks, module sources, source bindings, and eventually knowledge projections.
5. **Processing tasks are the front/back bridge.** Every upload, source binding, admin review, retry, and publish action updates a task with business-facing status and message.
6. **Knowledge space is a projection, not a module database browser.** It indexes user-consumable results: wiki pages, document evidence, relationship objects, and generated artifacts.
7. **Company brain chat needs scope routing.** Chat should accept global, scenario, and knowledge-object scopes; the backend translates those scopes into allowed module tools/sources.
8. **Admin review is a gate, not a separate product.** Some templates can enter `waiting_review`; admin approval triggers processing. Ordinary users only see business status and next action.
9. **Mock-real switching belongs inside module adapters.** Platform services and API routes must depend on the adapter facade, not on mock-specific or real-specific implementations.

## Official Template Evidence Gate

Use `_research/official-template-best-practice-research.md` as the source-of-truth research note for initial template approval.

Template states:

- `official`: evidence-backed, visible by default in frontstage.
- `candidate`: promising but still under product validation.
- `experimental`: internal exploration, not shown as official best practice.
- `custom`: user-created recipe.
- `paused`: hidden because quality, compliance, or assumptions changed.
- `archived`: kept for history, unavailable for new scenarios.

Backend rules:

1. `official` templates require `evidenceSources.length >= 2`.
2. `official` templates require `productForms.length >= 1`.
3. `official` templates require at least one limitation so the UI can explain boundaries.
4. `official` templates require `demoWalkthrough` with at least two sample inputs and two citations.
5. Only `official` and `candidate` templates can have default module plans. `experimental` and `custom` templates must be explicit user/admin drafts.
6. API responses can expose business-facing evidence labels, but not internal module names as primary copy.

## Existing Backend Facts To Preserve

- `docs/ARCHITECTURE.md` says `apps/api` must not import RAG module core or access module databases.
- `docs/SERVICE_BOUNDARIES.md` says `apps/api -> packages/gateway -> modules/* HTTP API`.
- `packages/gateway/src/index.ts` already injects `X-FF-User-Id`, `X-FF-Username`, `X-FF-Is-Admin`, and `X-FF-Internal-Token`.
- Traditional RAG has source/document/job/search/table APIs and async document jobs.
- GraphRAG has source/document/search/ask APIs and synchronous LightRAG ingestion for text/upload.
- Nano Brain has sources/pages/search/ask/fact submissions/dream APIs.
- Agent Gateway already has per-module MCP loading and also has `loadCompanyBrainMcpTools`, but the active conversation model still needs a product-level company-brain scope.

## Target User Journey

```text
Frontstage template detail
  -> POST /platform/scenarios
  -> scenario instance created
  -> processing task created
  -> optional admin review
  -> worker creates/binds module sources through mode-aware adapters
  -> mock mode returns stable synthetic module refs, or real mode uploads/writes user data into target module(s)
  -> task status becomes ready or needs_input/failed
  -> knowledge projections become visible
  -> /platform/chat can answer within global or scenario scope
```

---

### Task 0: Execution Guard And Current-State Snapshot

**Files:**
- No source edits.

- [ ] **Step 1: Confirm branch and dirty worktree**

Run:

```bash
git branch --show-current
git status --short
```

Expected:

- Branch name is printed.
- Existing dirty frontend/backend changes remain visible.
- Do not use `git reset`, `git checkout --`, or any destructive cleanup command.

- [ ] **Step 2: Confirm backend SSOT files exist**

Run:

```bash
test -f _product/PRODUCT_REDESIGN.md
test -f docs/SERVICE_BOUNDARIES.md
test -f docs/API.md
test -f docs/superpowers/specs/2026-06-24-frontstage-saas-product-design.md
```

Expected:

- All commands exit 0.

- [ ] **Step 3: Confirm module API docs exist**

Run:

```bash
test -f modules/nano-brain/docs/API.md
test -f modules/traditional-rag/docs/API.md
test -f modules/graph-rag/docs/API.md
```

Expected:

- All commands exit 0.

---

### Task 1: Platform Package, Contracts, And Migration Skeleton

**Files:**
- Create: `packages/platform/package.json`
- Create: `packages/platform/src/db.ts`
- Create: `packages/platform/src/errors.ts`
- Create: `packages/platform/src/types.ts`
- Create: `packages/platform/src/migrations.ts`
- Create: `packages/platform/src/index.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `scripts/init-db.ts`

- [ ] **Step 1: Create `packages/platform/package.json`**

```json
{
  "name": "@ff/platform",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@ff/contracts": "workspace:*",
    "@ff/gateway": "workspace:*",
    "pg": "latest"
  },
  "devDependencies": {
    "@types/pg": "latest"
  }
}
```

- [ ] **Step 2: Add platform DB helper**

Create `packages/platform/src/db.ts`:

```ts
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPlatformDatabaseUrl(): string {
  const url = process.env.PLATFORM_DATABASE_URL;
  if (!url) throw new Error("PLATFORM_DATABASE_URL is required");
  return url;
}

export function getPlatformPool(): pg.Pool {
  if (!pool) pool = new Pool({ connectionString: getPlatformDatabaseUrl() });
  return pool;
}

export async function closePlatformPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
```

- [ ] **Step 3: Add platform error type**

Create `packages/platform/src/errors.ts`:

```ts
export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_input"
      | "not_found"
      | "forbidden"
      | "duplicate"
      | "unsupported_template"
      | "unsupported_status"
      | "module_error"
      | "internal_error",
    public readonly status = 400
  ) {
    super(message);
    this.name = "PlatformError";
  }
}
```

- [ ] **Step 4: Extend contracts with platform-safe types**

Modify `packages/contracts/src/index.ts`:

```ts
export type UserContext = {
  userId: string;
  username: string;
  isAdmin: boolean;
};

export type ModuleId = "nano-brain" | "traditional-rag" | "graph-rag";

export type AgentScopeId = ModuleId | "company-brain";

export type HealthResponse = {
  status: "ok" | "error";
  service: string;
};

export type Visibility = "private" | "team" | "company";

export type ProcessingStatus =
  | "draft"
  | "submitted"
  | "waiting_review"
  | "processing"
  | "needs_input"
  | "ready"
  | "failed"
  | "archived";

export type ScenarioTemplateKind =
  | "compiled_knowledge"
  | "document_evidence"
  | "relationship_knowledge"
  | "hybrid";

export type KnowledgeObjectMode = "wiki" | "document" | "relationship" | "artifact";
```

- [ ] **Step 5: Add platform domain types**

Create `packages/platform/src/types.ts`:

```ts
import type { KnowledgeObjectMode, ModuleId, ProcessingStatus, ScenarioTemplateKind, UserContext, Visibility } from "@ff/contracts";

export type TemplateDemoWalkthrough = {
  scenarioName: string;
  sampleInputs: Array<{
    title: string;
    fileName: string;
    fileType: "md" | "pdf" | "csv" | "txt" | "json";
    description: string;
  }>;
  processingPreview: string[];
  sampleQuestion: string;
  sampleAnswer: string;
  citations: Array<{
    label: string;
    source: string;
    excerpt: string;
  }>;
  resultHighlights: string[];
};

export type ScenarioTemplate = {
  id: string;
  name: string;
  kind: ScenarioTemplateKind;
  state: "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
  evidenceLevel: "validated" | "partial" | "internal_only";
  evidenceSources: string[];
  productForms: Array<"chat" | "embedded_assistant" | "knowledge_portal" | "document_review" | "report_generator" | "graph_explorer" | "task_workflow" | "hybrid">;
  limitations: string[];
  headline: string;
  description: string;
  requiredInputs: string[];
  acceptedFileTypes: string[];
  outputCapabilities: string[];
  demoWalkthrough: TemplateDemoWalkthrough;
  needsAdminReview: boolean;
  defaultVisibility: Visibility;
  modulePlan: TemplateModulePlan[];
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateModulePlan = {
  moduleId: ModuleId;
  sourcePurpose: "primary" | "evidence" | "relationship" | "wiki" | "supporting";
  createSourceName: string;
  ingestMode: "nano_page" | "traditional_document" | "graph_document";
  required: boolean;
};

export type ScenarioInstance = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  ownerUserId: string;
  ownerUsername: string;
  visibility: Visibility;
  status: ProcessingStatus;
  businessOptions: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ScenarioSourceBinding = {
  id: string;
  scenarioId: string;
  moduleId: ModuleId;
  moduleSourceId: string;
  sourcePurpose: TemplateModulePlan["sourcePurpose"];
  displayName: string;
  status: ProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProcessingTask = {
  id: string;
  scenarioId: string;
  templateId: string;
  userId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  userMessage: string;
  nextActions: string[];
  error: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KnowledgeObject = {
  id: string;
  scenarioId: string;
  mode: KnowledgeObjectMode;
  title: string;
  summary: string;
  sourceLabel: string;
  moduleId: ModuleId | null;
  moduleObjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateScenarioInput = {
  templateId: string;
  name: string;
  description?: string;
  visibility?: Visibility;
  uploadedFiles?: { name: string; type: string; size: number }[];
  businessOptions?: Record<string, unknown>;
};

export type PlatformAuthzInput = {
  user: UserContext;
  ownerUserId: string;
  visibility: Visibility;
};
```

- [ ] **Step 6: Add migration skeleton**

Create `packages/platform/src/migrations.ts`:

```ts
import { getPlatformPool } from "./db";

export async function migratePlatformDatabase(): Promise<void> {
  const pool = getPlatformPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenario_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('compiled_knowledge', 'document_evidence', 'relationship_knowledge', 'hybrid')),
        state TEXT NOT NULL CHECK (state IN ('official', 'candidate', 'experimental', 'custom', 'paused', 'archived')),
        evidence_level TEXT NOT NULL CHECK (evidence_level IN ('validated', 'partial', 'internal_only')),
        evidence_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        product_forms JSONB NOT NULL DEFAULT '[]'::jsonb,
        limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
        demo_walkthrough JSONB NOT NULL DEFAULT '{}'::jsonb,
        headline TEXT NOT NULL,
      description TEXT NOT NULL,
      required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
      accepted_file_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      output_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      needs_admin_review BOOLEAN NOT NULL DEFAULT FALSE,
      default_visibility TEXT NOT NULL CHECK (default_visibility IN ('private', 'team', 'company')),
      module_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (jsonb_typeof(required_inputs) = 'array'),
        CHECK (jsonb_typeof(accepted_file_types) = 'array'),
        CHECK (jsonb_typeof(evidence_sources) = 'array'),
        CHECK (jsonb_typeof(product_forms) = 'array'),
        CHECK (jsonb_typeof(limitations) = 'array'),
        CHECK (jsonb_typeof(demo_walkthrough) = 'object'),
      CHECK (jsonb_typeof(output_capabilities) = 'array'),
      CHECK (jsonb_typeof(module_plan) = 'array')
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenario_instances (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES scenario_templates(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      owner_username TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'company')),
      status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'waiting_review', 'processing', 'needs_input', 'ready', 'failed', 'archived')),
      business_options JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(business_options) = 'object')
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scenario_instances_owner_updated
    ON scenario_instances (owner_user_id, updated_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenario_source_bindings (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL CHECK (module_id IN ('nano-brain', 'traditional-rag', 'graph-rag')),
      module_source_id TEXT NOT NULL,
      source_purpose TEXT NOT NULL CHECK (source_purpose IN ('primary', 'evidence', 'relationship', 'wiki', 'supporting')),
      display_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'waiting_review', 'processing', 'needs_input', 'ready', 'failed', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (scenario_id, module_id, module_source_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS processing_tasks (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES scenario_templates(id),
      user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'waiting_review', 'processing', 'needs_input', 'ready', 'failed', 'archived')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      current_step TEXT NOT NULL,
      user_message TEXT NOT NULL,
      next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      error JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(next_actions) = 'array'),
      CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
      CHECK (jsonb_typeof(metadata) = 'object')
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_processing_tasks_user_updated
    ON processing_tasks (user_id, updated_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS processing_task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES processing_tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(metadata) = 'object')
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_objects (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('wiki', 'document', 'relationship', 'artifact')),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_label TEXT NOT NULL,
      module_id TEXT CHECK (module_id IN ('nano-brain', 'traditional-rag', 'graph-rag')),
      module_object_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(metadata) = 'object')
    );
  `);
}
```

- [ ] **Step 7: Export package APIs**

Create `packages/platform/src/index.ts`:

```ts
export { closePlatformPool, getPlatformPool } from "./db";
export { PlatformError } from "./errors";
export { migratePlatformDatabase } from "./migrations";
export type {
  CreateScenarioInput,
  KnowledgeObject,
  PlatformAuthzInput,
  ProcessingTask,
  ScenarioInstance,
  ScenarioSourceBinding,
  ScenarioTemplate,
  TemplateModulePlan
} from "./types";
```

- [ ] **Step 8: Add platform DB migration to `scripts/init-db.ts`**

Modify imports:

```ts
import { closePlatformPool, migratePlatformDatabase } from '@ff/platform';
```

Add:

```ts
const platformUrl = getRequiredEnv('PLATFORM_DATABASE_URL');
const platformDatabaseName = databaseNameFromUrl(platformUrl);
```

After identity database creation:

```ts
await createDatabaseIfMissing(adminClient, platformDatabaseName);
```

After identity migration:

```ts
await migratePlatformDatabase();
await closePlatformPool();
console.log('platform database migrated');
```

- [ ] **Step 9: Run type-level package checks**

Run:

```bash
bun test packages/platform/src/index.ts
```

Expected:

- Bun can load the new package entry without syntax errors.

- [ ] **Step 10: Commit Task 1**

```bash
git add packages/contracts/src/index.ts packages/platform scripts/init-db.ts
git commit -m "feat: add platform orchestration database"
```

---

### Task 2: Official Template Registry And Module Routing Policy

**Files:**
- Create: `packages/platform/src/templates.ts`
- Create: `packages/platform/src/templates.test.ts`
- Modify: `packages/platform/src/index.ts`

- [ ] **Step 1: Write failing template policy tests**

Create `packages/platform/src/templates.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  OFFICIAL_TEMPLATE_IDS,
  getScenarioTemplate,
  listScenarioTemplates,
  modulePlanForTemplate,
  seedScenarioTemplatesSqlRows,
  validateOfficialTemplateEvidence
} from "./templates";

describe("platform scenario templates", () => {
  test("contains the approved ten templates", () => {
    expect(OFFICIAL_TEMPLATE_IDS).toEqual([
      "personal-wiki",
      "team-handbook",
      "policy-evidence",
      "contract-playbook",
      "rfp-security",
      "customer-360",
      "risk-investigation",
      "domain-relationship",
      "support-agent",
      "research-guide"
    ]);
    expect(listScenarioTemplates()).toHaveLength(10);
  });

  test("personal wiki routes to Nano Brain", () => {
    expect(modulePlanForTemplate("personal-wiki")).toEqual([
      {
        moduleId: "nano-brain",
        sourcePurpose: "wiki",
        createSourceName: "scenario/personal-wiki",
        ingestMode: "nano_page",
        required: true
      }
    ]);
  });

  test("contract playbook routes to document evidence", () => {
    expect(modulePlanForTemplate("contract-playbook")[0]?.moduleId).toBe("traditional-rag");
    expect(modulePlanForTemplate("contract-playbook")[0]?.ingestMode).toBe("traditional_document");
  });

  test("customer 360 is hybrid but relationship is primary", () => {
    const plan = modulePlanForTemplate("customer-360");
    expect(plan.map((item) => item.moduleId)).toEqual(["graph-rag", "traditional-rag", "nano-brain"]);
    expect(plan[0].sourcePurpose).toBe("relationship");
  });

  test("seed rows are serializable", () => {
    const rows = seedScenarioTemplatesSqlRows();
    const wiki = rows.find((row) => row.id === "personal-wiki");

    expect(wiki?.name).toBe("个人知识 Wiki");
    expect(JSON.parse(wiki?.modulePlanJson ?? "[]")[0].moduleId).toBe("nano-brain");
  });

  test("official templates have enough best-practice evidence", () => {
    for (const template of listScenarioTemplates()) {
      expect(validateOfficialTemplateEvidence(template)).toBe(true);
      expect(template.evidenceSources.length).toBeGreaterThanOrEqual(2);
      expect(template.productForms.length).toBeGreaterThanOrEqual(1);
      expect(template.limitations.length).toBeGreaterThanOrEqual(1);
      expect(template.demoWalkthrough.sampleInputs.length).toBeGreaterThanOrEqual(2);
      expect(template.demoWalkthrough.citations.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("unknown template returns undefined", () => {
    expect(getScenarioTemplate("unknown")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
bun test packages/platform/src/templates.test.ts
```

Expected:

- Fails because `templates.ts` does not exist.

- [ ] **Step 3: Implement template registry**

Create `packages/platform/src/templates.ts` with:

```ts
import type { ScenarioTemplate, TemplateModulePlan } from "./types";

export const OFFICIAL_TEMPLATE_IDS = [
  "personal-wiki",
  "team-handbook",
  "policy-evidence",
  "contract-playbook",
  "rfp-security",
  "customer-360",
  "risk-investigation",
  "domain-relationship",
  "support-agent",
  "research-guide"
] as const;

const now = new Date("2026-06-24T00:00:00.000Z");

function officialEvidence(productForms: ScenarioTemplate["productForms"], limitations: string[]) {
  return {
    state: "official" as const,
    evidenceLevel: "validated" as const,
    evidenceSources: [
      "_research/official-template-best-practice-research.md",
      "https://docs.dify.ai/en/use-dify/knowledge/knowledge-pipeline/create-knowledge-pipeline",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html"
    ],
    productForms,
    limitations
  };
}

function demoWalkthroughForTemplate(id: string): ScenarioTemplate["demoWalkthrough"] {
  const names: Record<string, string> = {
    "personal-wiki": "张磊销售笔记知识 Wiki",
    "team-handbook": "销售新人上手手册",
    "policy-evidence": "差旅报销制度问答",
    "contract-playbook": "SaaS 订阅合同审阅",
    "rfp-security": "华东银行安全问卷响应",
    "customer-360": "Northwind Labs 续约简报",
    "risk-investigation": "云启网络关系风险尽调",
    "domain-relationship": "医疗客户关系知识库",
    "support-agent": "订单与发票客服代理",
    "research-guide": "医疗行业复购研究指南"
  };
  const questions: Record<string, string> = {
    "customer-360": "Northwind Labs 这个客户当前续约风险和机会是什么？",
    "support-agent": "客户说订单延迟三天，应该怎么回复？",
    "contract-playbook": "这份合同有哪些高风险条款，应该怎么改？"
  };

  return {
    scenarioName: names[id] ?? "业务场景样例",
    sampleInputs: [
      { title: "主要业务资料", fileName: `${id}-source.pdf`, fileType: "pdf", description: "用户创建场景时会上传或选择的核心资料。" },
      { title: "结构化业务表", fileName: `${id}-records.csv`, fileType: "csv", description: "用于补充对象、时间、状态、负责人和业务字段。" }
    ],
    processingPreview: ["读取资料", "整理知识结构", "生成答案、引用和成品预览"],
    sampleQuestion: questions[id] ?? "这个模板创建后能回答什么问题？",
    sampleAnswer: "系统会基于已处理资料给出业务结论、下一步建议和引用来源。回答不会只返回单轮问答结果，而是同时展示可追问依据和可复用成品。",
    citations: [
      { label: "业务资料", source: `${id}-source.pdf`, excerpt: "关键结论来自用户上传的正式资料。" },
      { label: "业务表", source: `${id}-records.csv`, excerpt: "结构化字段用于补充对象、状态和负责人。" }
    ],
    resultHighlights: ["展示样例答案", "展示引用来源", "展示可复用成品"]
  };
}

const plans: Record<string, TemplateModulePlan[]> = {
  "personal-wiki": [
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/personal-wiki", ingestMode: "nano_page", required: true }
  ],
  "team-handbook": [
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/team-handbook", ingestMode: "nano_page", required: true }
  ],
  "policy-evidence": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/policy-evidence", ingestMode: "traditional_document", required: true }
  ],
  "contract-playbook": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/contract-playbook", ingestMode: "traditional_document", required: true }
  ],
  "rfp-security": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/rfp-security", ingestMode: "traditional_document", required: true },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/rfp-approved-answers", ingestMode: "nano_page", required: false }
  ],
  "customer-360": [
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/customer-360-relations", ingestMode: "graph_document", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/customer-360-docs", ingestMode: "traditional_document", required: false },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/customer-360-notes", ingestMode: "nano_page", required: false }
  ],
  "risk-investigation": [
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/risk-investigation", ingestMode: "graph_document", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/risk-evidence", ingestMode: "traditional_document", required: false }
  ],
  "domain-relationship": [
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/domain-relationship", ingestMode: "graph_document", required: true }
  ],
  "support-agent": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/support-docs", ingestMode: "traditional_document", required: true },
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/support-objects", ingestMode: "graph_document", required: false }
  ],
  "research-guide": [
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/research-guide", ingestMode: "nano_page", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/research-sources", ingestMode: "traditional_document", required: false }
  ]
};

const templates: ScenarioTemplate[] = [
  template("personal-wiki", "个人知识 Wiki", "compiled_knowledge", "把个人笔记、Markdown 和资料包整理成可浏览、可追问的个人知识空间。", ["Markdown 笔记", "PDF 资料", "网页摘录"], ["md", "txt", "pdf"], ["Wiki 条目", "来源问答", "主题综述"], false, "private"),
  template("team-handbook", "团队知识手册", "compiled_knowledge", "把团队资料、会议纪要和项目复盘整理成可分享的团队手册。", ["会议纪要", "项目复盘", "FAQ 文档"], ["md", "docx", "pdf"], ["章节手册", "按章节提问", "团队分享"], true, "team"),
  template("policy-evidence", "制度政策证据问答", "document_evidence", "让员工获得带原文依据的制度、流程和报销答复。", ["制度 PDF", "流程文档", "公告"], ["pdf", "docx", "xlsx"], ["制度答复", "原文依据", "审批提示"], true, "company"),
  template("contract-playbook", "合同 Playbook 审阅", "document_evidence", "上传合同并按公司审阅规则生成风险条款、缺失条款和替换建议。", ["合同文本", "条款库", "风险清单"], ["pdf", "docx", "txt"], ["风险条款", "替换建议", "审阅报告"], true, "team"),
  template("rfp-security", "RFP / 安全问卷响应", "document_evidence", "导入客户问卷，生成可信答案草稿、待确认项和引用依据。", ["客户问卷", "历史答案库", "安全白皮书"], ["xlsx", "csv", "pdf", "docx"], ["答案草稿", "待审核清单", "答案导出"], true, "team"),
  template("customer-360", "客户 360 简报", "hybrid", "输入客户名，生成会前客户简报、风险信号、机会信号和下一步建议。", ["客户档案", "会议记录", "合同", "项目记录"], ["pdf", "docx", "xlsx", "txt"], ["客户简报", "关系线索", "行动建议"], true, "team"),
  template("risk-investigation", "关系风险尽调", "relationship_knowledge", "围绕公司、供应商或项目追踪关系链、风险事件和证据链。", ["尽调报告", "合同", "访谈记录"], ["pdf", "docx", "xlsx", "txt"], ["关系链", "风险清单", "尽调报告"], true, "team"),
  template("domain-relationship", "垂域关系知识库", "relationship_knowledge", "为医疗、金融、制造、供应链等领域资料建立关键对象和关系问答能力。", ["领域 PDF", "标准文档", "项目资料"], ["pdf", "docx", "xlsx", "csv", "txt"], ["领域对象", "关系线索", "分析报告"], true, "team"),
  template("support-agent", "智能客服知识代理", "hybrid", "把帮助中心和售后流程封装成可嵌入网页的客服知识代理。", ["帮助文档", "售后流程", "FAQ"], ["pdf", "docx", "txt", "html"], ["客服问答组件", "转人工建议", "知识缺口"], true, "team"),
  template("research-guide", "研究报告 / 学习指南", "compiled_knowledge", "把资料包整理成研究报告、学习指南、摘要和带引用版本。", ["研究资料包", "网页摘录", "报告"], ["pdf", "docx", "md", "txt", "html"], ["研究报告", "学习指南", "引用来源"], false, "private")
];

function template(
  id: string,
  name: string,
  kind: ScenarioTemplate["kind"],
  headline: string,
  requiredInputs: string[],
  acceptedFileTypes: string[],
  outputCapabilities: string[],
  needsAdminReview: boolean,
  defaultVisibility: ScenarioTemplate["defaultVisibility"]
): ScenarioTemplate {
  return {
    id,
    name,
    kind,
    ...officialEvidence(productFormsForTemplate(id), limitationsForTemplate(id)),
    headline,
    description: headline,
    requiredInputs,
    acceptedFileTypes,
    outputCapabilities,
    demoWalkthrough: demoWalkthroughForTemplate(id),
    needsAdminReview,
    defaultVisibility,
    modulePlan: plans[id] ?? [],
    createdAt: now,
    updatedAt: now
  };
}

function productFormsForTemplate(id: string): ScenarioTemplate["productForms"] {
  const forms: Record<string, ScenarioTemplate["productForms"]> = {
    "personal-wiki": ["knowledge_portal", "chat"],
    "team-handbook": ["knowledge_portal", "task_workflow"],
    "policy-evidence": ["chat", "knowledge_portal"],
    "contract-playbook": ["document_review", "task_workflow"],
    "rfp-security": ["document_review", "report_generator"],
    "customer-360": ["report_generator", "graph_explorer", "hybrid"],
    "risk-investigation": ["graph_explorer", "report_generator"],
    "domain-relationship": ["graph_explorer", "knowledge_portal", "hybrid"],
    "support-agent": ["embedded_assistant", "chat", "task_workflow"],
    "research-guide": ["report_generator", "knowledge_portal"]
  };
  return forms[id] ?? ["hybrid"];
}

function limitationsForTemplate(id: string): string[] {
  const limitations: Record<string, string[]> = {
    "personal-wiki": ["不适合直接生成未经复核的对外正式文件。"],
    "team-handbook": ["需要管理员复核后再作为团队统一口径发布。"],
    "policy-evidence": ["制度类答案必须保留引用，不应替代 HR 或法务最终解释。"],
    "contract-playbook": ["只能作为合同初筛和条款建议，不能替代法律审阅。"],
    "rfp-security": ["客户问卷答案需要责任人确认后才能对外发送。"],
    "customer-360": ["客户判断依赖数据新鲜度，过期 CRM 或会议记录会降低可靠性。"],
    "risk-investigation": ["关系线索需要证据支撑，低置信关系不能直接作为结论。"],
    "domain-relationship": ["垂域实体和关系类型需要管理员按领域配置后效果更稳定。"],
    "support-agent": ["上线前需要测试拒答、转人工和知识缺口处理。"],
    "research-guide": ["适合内部研究和学习材料，不应直接当作无引用的正式报告。"]
  };
  return limitations[id] ?? ["需要管理员确认适用边界。"];
}

export function listScenarioTemplates(): ScenarioTemplate[] {
  return templates;
}

export function getScenarioTemplate(id: string): ScenarioTemplate | undefined {
  return templates.find((item) => item.id === id);
}

export function validateOfficialTemplateEvidence(template: ScenarioTemplate): true {
  if (template.state !== "official") return true;
  if (template.evidenceLevel !== "validated") throw new Error(`${template.id} official template must be validated`);
  if (template.evidenceSources.length < 2) throw new Error(`${template.id} official template needs at least two evidence sources`);
  if (template.productForms.length < 1) throw new Error(`${template.id} official template needs product form metadata`);
  if (template.limitations.length < 1) throw new Error(`${template.id} official template needs limitation metadata`);
  if (template.demoWalkthrough.sampleInputs.length < 2) throw new Error(`${template.id} official template needs demo sample inputs`);
  if (template.demoWalkthrough.citations.length < 2) throw new Error(`${template.id} official template needs demo citations`);
  if (template.modulePlan.length < 1) throw new Error(`${template.id} official template needs a module plan`);
  return true;
}

export function modulePlanForTemplate(id: string): TemplateModulePlan[] {
  return getScenarioTemplate(id)?.modulePlan ?? [];
}

export function seedScenarioTemplatesSqlRows() {
  return templates.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    state: item.state,
    evidenceLevel: item.evidenceLevel,
    evidenceSourcesJson: JSON.stringify(item.evidenceSources),
    productFormsJson: JSON.stringify(item.productForms),
    limitationsJson: JSON.stringify(item.limitations),
    demoWalkthroughJson: JSON.stringify(item.demoWalkthrough),
    headline: item.headline,
    description: item.description,
    requiredInputsJson: JSON.stringify(item.requiredInputs),
    acceptedFileTypesJson: JSON.stringify(item.acceptedFileTypes),
    outputCapabilitiesJson: JSON.stringify(item.outputCapabilities),
    needsAdminReview: item.needsAdminReview,
    defaultVisibility: item.defaultVisibility,
    modulePlanJson: JSON.stringify(item.modulePlan)
  }));
}
```

- [ ] **Step 4: Export template APIs**

Modify `packages/platform/src/index.ts`:

```ts
export {
  OFFICIAL_TEMPLATE_IDS,
  getScenarioTemplate,
  listScenarioTemplates,
  modulePlanForTemplate,
  seedScenarioTemplatesSqlRows,
  validateOfficialTemplateEvidence
} from "./templates";
```

- [ ] **Step 5: Seed templates in migration**

Modify `packages/platform/src/migrations.ts`:

```ts
import { seedScenarioTemplatesSqlRows } from "./templates";
```

After creating `scenario_templates`, add:

```ts
for (const row of seedScenarioTemplatesSqlRows()) {
  await pool.query(
      `
        INSERT INTO scenario_templates (
          id, name, kind, state, evidence_level, evidence_sources, product_forms, limitations, demo_walkthrough,
          headline, description, required_inputs, accepted_file_types, output_capabilities,
          needs_admin_review, default_visibility, module_plan
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, $17::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          kind = EXCLUDED.kind,
          state = EXCLUDED.state,
          evidence_level = EXCLUDED.evidence_level,
          evidence_sources = EXCLUDED.evidence_sources,
          product_forms = EXCLUDED.product_forms,
          limitations = EXCLUDED.limitations,
          demo_walkthrough = EXCLUDED.demo_walkthrough,
          headline = EXCLUDED.headline,
        description = EXCLUDED.description,
        required_inputs = EXCLUDED.required_inputs,
        accepted_file_types = EXCLUDED.accepted_file_types,
        output_capabilities = EXCLUDED.output_capabilities,
        needs_admin_review = EXCLUDED.needs_admin_review,
        default_visibility = EXCLUDED.default_visibility,
        module_plan = EXCLUDED.module_plan,
        updated_at = now()
    `,
    [
        row.id,
        row.name,
        row.kind,
        row.state,
        row.evidenceLevel,
        row.evidenceSourcesJson,
        row.productFormsJson,
        row.limitationsJson,
        row.demoWalkthroughJson,
        row.headline,
        row.description,
      row.requiredInputsJson,
      row.acceptedFileTypesJson,
      row.outputCapabilitiesJson,
      row.needsAdminReview,
      row.defaultVisibility,
      row.modulePlanJson
    ]
  );
}
```

- [ ] **Step 6: Run tests**

```bash
bun test packages/platform/src/templates.test.ts
```

Expected:

- 6 tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/platform/src/templates.ts packages/platform/src/templates.test.ts packages/platform/src/index.ts packages/platform/src/migrations.ts
git commit -m "feat: register official scenario templates"
```

---

### Task 3: Scenario, Task, And Knowledge Core Services

**Files:**
- Create: `packages/platform/src/access.ts`
- Create: `packages/platform/src/scenarios.ts`
- Create: `packages/platform/src/tasks.ts`
- Create: `packages/platform/src/knowledge.ts`
- Create: `packages/platform/src/scenarios.test.ts`
- Modify: `packages/platform/src/index.ts`

- [ ] **Step 1: Write service behavior tests**

Create `packages/platform/src/scenarios.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createScenarioDraftData, canReadScenario, taskStatusView, knowledgeModeForTemplate } from "./scenarios";

const user = { userId: "u1", username: "alice", isAdmin: false };
const other = { userId: "u2", username: "bob", isAdmin: false };
const admin = { userId: "admin", username: "admin", isAdmin: true };

describe("scenario lifecycle core", () => {
  test("creates submitted task for no-review templates", () => {
    const draft = createScenarioDraftData(user, {
      templateId: "personal-wiki",
      name: "Alice Wiki",
      uploadedFiles: [{ name: "notes.md", type: "text/markdown", size: 128 }]
    });

    expect(draft.instance.status).toBe("submitted");
    expect(draft.task.status).toBe("submitted");
    expect(draft.task.userMessage).toBe("资料已提交，等待系统整理。");
  });

  test("creates waiting_review task for guarded templates", () => {
    const draft = createScenarioDraftData(user, {
      templateId: "customer-360",
      name: "重点客户续约场景"
    });

    expect(draft.instance.status).toBe("waiting_review");
    expect(draft.task.status).toBe("waiting_review");
    expect(draft.task.userMessage).toBe("场景已提交，等待管理员确认资料范围。");
  });

  test("scenario read access follows visibility and admin rules", () => {
    expect(canReadScenario(user, { ownerUserId: "u1", visibility: "private" })).toBe(true);
    expect(canReadScenario(other, { ownerUserId: "u1", visibility: "private" })).toBe(false);
    expect(canReadScenario(other, { ownerUserId: "u1", visibility: "team" })).toBe(true);
    expect(canReadScenario(admin, { ownerUserId: "u1", visibility: "private" })).toBe(true);
  });

  test("task status maps to business-facing view", () => {
    expect(taskStatusView("needs_input")).toEqual({
      label: "需要补充资料",
      nextActions: ["补充资料", "联系管理员"]
    });
  });

  test("template maps to knowledge object mode", () => {
    expect(knowledgeModeForTemplate("personal-wiki")).toBe("wiki");
    expect(knowledgeModeForTemplate("policy-evidence")).toBe("document");
    expect(knowledgeModeForTemplate("customer-360")).toBe("relationship");
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
bun test packages/platform/src/scenarios.test.ts
```

Expected:

- Fails because core service files do not exist.

- [ ] **Step 3: Implement access helpers**

Create `packages/platform/src/access.ts`:

```ts
import type { UserContext, Visibility } from "@ff/contracts";

export function canReadScenario(
  user: UserContext,
  scenario: { ownerUserId: string; visibility: Visibility }
): boolean {
  if (user.isAdmin) return true;
  if (scenario.ownerUserId === user.userId) return true;
  return scenario.visibility === "team" || scenario.visibility === "company";
}

export function canManageScenario(
  user: UserContext,
  scenario: { ownerUserId: string }
): boolean {
  return user.isAdmin || scenario.ownerUserId === user.userId;
}
```

- [ ] **Step 4: Implement pure scenario helpers**

Create `packages/platform/src/scenarios.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { KnowledgeObjectMode, ProcessingStatus, UserContext } from "@ff/contracts";
import { PlatformError } from "./errors";
import { getScenarioTemplate } from "./templates";
import type { CreateScenarioInput, ProcessingTask, ScenarioInstance } from "./types";

export { canReadScenario, canManageScenario } from "./access";

export function taskStatusView(status: ProcessingStatus): { label: string; nextActions: string[] } {
  const map: Record<ProcessingStatus, { label: string; nextActions: string[] }> = {
    draft: { label: "草稿", nextActions: ["继续补充资料", "删除"] },
    submitted: { label: "已提交", nextActions: ["查看详情", "撤回"] },
    waiting_review: { label: "等待管理员确认", nextActions: ["查看等待原因"] },
    processing: { label: "资料处理中", nextActions: ["查看进度"] },
    needs_input: { label: "需要补充资料", nextActions: ["补充资料", "联系管理员"] },
    ready: { label: "已可使用", nextActions: ["打开场景", "开始提问"] },
    failed: { label: "处理失败", nextActions: ["查看原因", "重试", "联系管理员"] },
    archived: { label: "已归档", nextActions: ["查看历史"] }
  };
  return map[status];
}

export function knowledgeModeForTemplate(templateId: string): KnowledgeObjectMode {
  const template = getScenarioTemplate(templateId);
  if (!template) throw new PlatformError("模板不存在", "not_found", 404);
  if (template.kind === "compiled_knowledge") return "wiki";
  if (template.kind === "document_evidence") return "document";
  if (template.kind === "relationship_knowledge") return "relationship";
  if (template.id === "customer-360" || template.id === "risk-investigation" || template.id === "domain-relationship") return "relationship";
  return "artifact";
}

export function createScenarioDraftData(user: UserContext, input: CreateScenarioInput): {
  instance: ScenarioInstance;
  task: ProcessingTask;
} {
  const template = getScenarioTemplate(input.templateId);
  if (!template) throw new PlatformError("模板不存在", "not_found", 404);
  const now = new Date();
  const scenarioId = randomUUID();
  const status: ProcessingStatus = template.needsAdminReview ? "waiting_review" : "submitted";
  const view = taskStatusView(status);

  const instance: ScenarioInstance = {
    id: scenarioId,
    templateId: template.id,
    name: input.name.trim(),
    description: input.description?.trim() || template.headline,
    ownerUserId: user.userId,
    ownerUsername: user.username,
    visibility: input.visibility ?? template.defaultVisibility,
    status,
    businessOptions: input.businessOptions ?? {},
    createdAt: now,
    updatedAt: now
  };

  const task: ProcessingTask = {
    id: randomUUID(),
    scenarioId,
    templateId: template.id,
    userId: user.userId,
    status,
    progress: status === "waiting_review" ? 5 : 8,
    currentStep: view.label,
    userMessage: status === "waiting_review"
      ? "场景已提交，等待管理员确认资料范围。"
      : "资料已提交，等待系统整理。",
    nextActions: view.nextActions,
    error: null,
    createdAt: now,
    updatedAt: now
  };

  return { instance, task };
}
```

- [ ] **Step 5: Implement DB-backed scenarios service**

Append to `packages/platform/src/scenarios.ts`:

```ts
import { getPlatformPool } from "./db";

export async function createScenario(user: UserContext, input: CreateScenarioInput) {
  const draft = createScenarioDraftData(user, input);
  const pool = getPlatformPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO scenario_instances (
          id, template_id, name, description, owner_user_id, owner_username,
          visibility, status, business_options, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
      `,
      [
        draft.instance.id,
        draft.instance.templateId,
        draft.instance.name,
        draft.instance.description,
        draft.instance.ownerUserId,
        draft.instance.ownerUsername,
        draft.instance.visibility,
        draft.instance.status,
        JSON.stringify(draft.instance.businessOptions),
        draft.instance.createdAt,
        draft.instance.updatedAt
      ]
    );
    await client.query(
      `
        INSERT INTO processing_tasks (
          id, scenario_id, template_id, user_id, status, progress,
          current_step, user_message, next_actions, error, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
      `,
      [
        draft.task.id,
        draft.task.scenarioId,
        draft.task.templateId,
        draft.task.userId,
        draft.task.status,
        draft.task.progress,
        draft.task.currentStep,
        draft.task.userMessage,
        JSON.stringify(draft.task.nextActions),
        draft.task.error,
        draft.task.createdAt,
        draft.task.updatedAt
      ]
    );
    await client.query(
      `
        INSERT INTO processing_task_events (id, task_id, status, message)
        VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), draft.task.id, draft.task.status, draft.task.userMessage]
    );
    await client.query("COMMIT");
    return draft;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 6: Implement tasks service**

Create `packages/platform/src/tasks.ts`:

```ts
import type { ProcessingStatus, UserContext } from "@ff/contracts";
import { randomUUID } from "node:crypto";
import { getPlatformPool } from "./db";
import { PlatformError } from "./errors";
import { taskStatusView } from "./scenarios";

export async function updateProcessingTask(input: {
  taskId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep?: string;
  userMessage?: string;
  error?: Record<string, unknown> | null;
}) {
  const view = taskStatusView(input.status);
  const pool = getPlatformPool();
  const result = await pool.query(
    `
      UPDATE processing_tasks
      SET status = $2,
          progress = $3,
          current_step = $4,
          user_message = $5,
          next_actions = $6::jsonb,
          error = $7,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      input.taskId,
      input.status,
      input.progress,
      input.currentStep ?? view.label,
      input.userMessage ?? view.label,
      JSON.stringify(view.nextActions),
      input.error ? JSON.stringify(input.error) : null
    ]
  );
  if (!result.rows[0]) throw new PlatformError("处理任务不存在", "not_found", 404);
  await pool.query(
    `INSERT INTO processing_task_events (id, task_id, status, message, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [randomUUID(), input.taskId, input.status, input.userMessage ?? view.label, JSON.stringify(input.error ?? {})]
  );
  return result.rows[0];
}

export async function listProcessingTasks(user: UserContext) {
  const pool = getPlatformPool();
  const result = await pool.query(
    user.isAdmin
      ? `SELECT * FROM processing_tasks ORDER BY updated_at DESC LIMIT 100`
      : `SELECT * FROM processing_tasks WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    user.isAdmin ? [] : [user.userId]
  );
  return result.rows;
}
```

- [ ] **Step 7: Implement knowledge projection service**

Create `packages/platform/src/knowledge.ts`:

```ts
import type { KnowledgeObjectMode, ModuleId } from "@ff/contracts";
import { randomUUID } from "node:crypto";
import { getPlatformPool } from "./db";

export async function createKnowledgeObject(input: {
  scenarioId: string;
  mode: KnowledgeObjectMode;
  title: string;
  summary: string;
  sourceLabel: string;
  moduleId?: ModuleId | null;
  moduleObjectId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const pool = getPlatformPool();
  const result = await pool.query(
    `
      INSERT INTO knowledge_objects (
        id, scenario_id, mode, title, summary, source_label, module_id, module_object_id, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING *
    `,
    [
      randomUUID(),
      input.scenarioId,
      input.mode,
      input.title,
      input.summary,
      input.sourceLabel,
      input.moduleId ?? null,
      input.moduleObjectId ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
  return result.rows[0];
}

export async function listKnowledgeObjects(input: { userId: string; isAdmin: boolean }) {
  const pool = getPlatformPool();
  const result = await pool.query(
    input.isAdmin
      ? `SELECT ko.* FROM knowledge_objects ko ORDER BY ko.updated_at DESC LIMIT 100`
      : `
          SELECT ko.*
          FROM knowledge_objects ko
          JOIN scenario_instances si ON si.id = ko.scenario_id
          WHERE si.owner_user_id = $1 OR si.visibility IN ('team', 'company')
          ORDER BY ko.updated_at DESC
          LIMIT 100
        `,
    input.isAdmin ? [] : [input.userId]
  );
  return result.rows;
}
```

- [ ] **Step 8: Export services**

Modify `packages/platform/src/index.ts`:

```ts
export { canManageScenario, canReadScenario } from "./access";
export { createScenario, createScenarioDraftData, knowledgeModeForTemplate, taskStatusView } from "./scenarios";
export { listProcessingTasks, updateProcessingTask } from "./tasks";
export { createKnowledgeObject, listKnowledgeObjects } from "./knowledge";
```

- [ ] **Step 9: Run tests**

```bash
bun test packages/platform/src/scenarios.test.ts packages/platform/src/templates.test.ts
```

Expected:

- All tests pass.

- [ ] **Step 10: Commit Task 3**

```bash
git add packages/platform/src/access.ts packages/platform/src/scenarios.ts packages/platform/src/tasks.ts packages/platform/src/knowledge.ts packages/platform/src/scenarios.test.ts packages/platform/src/index.ts
git commit -m "feat: add scenario lifecycle services"
```

---

### Task 4: Platform HTTP API In `apps/api`

**Files:**
- Create: `apps/api/src/routes/platform.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/errors.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Map platform errors**

Modify `apps/api/src/lib/errors.ts`:

```ts
import { PlatformError } from '@ff/platform';
```

Inside `handleError`, before the unknown error branch:

```ts
if (error instanceof PlatformError) {
  return c.json({ error: error.code, message: error.message }, error.status as any);
}
```

- [ ] **Step 2: Create platform router**

Create `apps/api/src/routes/platform.ts`:

```ts
import { Hono } from "hono";
import {
  createScenario,
  getScenarioTemplate,
  listKnowledgeObjects,
  listProcessingTasks,
  listScenarioTemplates
} from "@ff/platform";
import { protectedRoute } from "../lib/route";

export const platformRouter = new Hono();

platformRouter.get(
  "/platform/templates",
  protectedRoute("读取场景模板失败", async (c) => {
    return c.json({ templates: listScenarioTemplates().map(toPublicTemplate) });
  })
);

platformRouter.get(
  "/platform/templates/:templateId",
  protectedRoute("读取场景模板失败", async (c) => {
    const template = getScenarioTemplate(c.req.param("templateId"));
    if (!template) return c.json({ error: "not_found", message: "模板不存在" }, 404);
    return c.json({ template: toPublicTemplate(template) });
  })
);

platformRouter.post(
  "/platform/scenarios",
  protectedRoute("创建场景失败", async (c, user) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await createScenario(user, {
      templateId: body.template_id,
      name: body.name,
      description: body.description,
      visibility: body.visibility,
      uploadedFiles: body.uploaded_files,
      businessOptions: body.business_options
    });
    return c.json({
      scenario: toPublicScenario(result.instance),
      task: toPublicTask(result.task)
    }, 201);
  })
);

platformRouter.get(
  "/platform/tasks",
  protectedRoute("读取任务中心失败", async (c, user) => {
    const tasks = await listProcessingTasks(user);
    return c.json({ tasks: tasks.map(toSnakeObject) });
  })
);

platformRouter.get(
  "/platform/knowledge",
  protectedRoute("读取知识空间失败", async (c, user) => {
    const objects = await listKnowledgeObjects({ userId: user.userId, isAdmin: user.isAdmin });
    return c.json({ objects: objects.map(toSnakeObject) });
  })
);

function toPublicTemplate(template: any) {
  return {
    id: template.id,
      name: template.name,
      kind: template.kind,
      state: template.state,
      evidence_level: template.evidenceLevel,
      evidence_sources: template.evidenceSources,
      product_forms: template.productForms,
      limitations: template.limitations,
      demo_walkthrough: template.demoWalkthrough,
      headline: template.headline,
    description: template.description,
    required_inputs: template.requiredInputs,
    accepted_file_types: template.acceptedFileTypes,
    output_capabilities: template.outputCapabilities,
    needs_admin_review: template.needsAdminReview,
    default_visibility: template.defaultVisibility
  };
}

function toPublicScenario(scenario: any) {
  return {
    id: scenario.id,
    template_id: scenario.templateId,
    name: scenario.name,
    description: scenario.description,
    owner_user_id: scenario.ownerUserId,
    owner_username: scenario.ownerUsername,
    visibility: scenario.visibility,
    status: scenario.status,
    business_options: scenario.businessOptions,
    created_at: scenario.createdAt,
    updated_at: scenario.updatedAt
  };
}

function toPublicTask(task: any) {
  return {
    id: task.id,
    scenario_id: task.scenarioId,
    template_id: task.templateId,
    user_id: task.userId,
    status: task.status,
    progress: task.progress,
    current_step: task.currentStep,
    user_message: task.userMessage,
    next_actions: task.nextActions,
    error: task.error,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

function toSnakeObject(row: any) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = value;
  }
  return out;
}
```

- [ ] **Step 3: Mount platform router**

Modify `apps/api/src/app.ts`:

```ts
import { platformRouter } from './routes/platform';
```

In `createApp()`:

```ts
app.route('/', platformRouter);
```

- [ ] **Step 4: Document platform APIs**

Append to `docs/API.md`:

````md
## Platform Scenario APIs

The platform namespace stores business orchestration metadata only. It does not access RAG module databases directly.

### GET `/platform/templates`

Lists official scenario templates with evidence metadata and pre-create walkthroughs: `state`, `evidence_level`, `evidence_sources`, `product_forms`, `limitations`, and `demo_walkthrough`.

### GET `/platform/templates/:templateId`

Reads one scenario template.

### POST `/platform/scenarios`

Creates a scenario instance from a template and creates its first processing task.

Request:

```json
{
  "template_id": "personal-wiki",
  "name": "张磊的销售笔记 Wiki",
  "visibility": "private",
  "uploaded_files": [{ "name": "客户复盘.md", "type": "text/markdown", "size": 1024 }],
  "business_options": { "整理粒度": "标准" }
}
```

### GET `/platform/tasks`

Lists visible processing tasks.

### GET `/platform/knowledge`

Lists user-consumable knowledge projections.
````

- [ ] **Step 5: Run build/test**

```bash
bun test packages/platform/src/templates.test.ts packages/platform/src/scenarios.test.ts
bun --cwd apps/api test
```

If `apps/api` has no test script, run:

```bash
bun test apps/api/src/app.ts
```

Expected:

- Type loading succeeds.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/api/src/routes/platform.ts apps/api/src/app.ts apps/api/src/lib/errors.ts docs/API.md
git commit -m "feat: expose platform scenario api"
```

---

### Task 4A: Durable Upload Asset Lifecycle

**Files:**
- Modify: `packages/platform/src/migrations.ts`
- Create: `packages/platform/src/assets.ts`
- Create: `packages/platform/src/assets.test.ts`
- Modify: `packages/platform/src/scenarios.ts`
- Modify: `packages/platform/src/index.ts`
- Modify: `apps/api/src/routes/platform.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Write upload asset tests**

Create `packages/platform/src/assets.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  archiveUploadAsset,
  buildLocalAssetStorageKey,
  createUploadAssetRecord,
  createUploadAssetRecords,
  markUploadAssetForReprocess,
  normalizeUploadedFileName
} from "./assets";

describe("platform upload assets", () => {
  test("normalizes uploaded file names and storage keys", () => {
    expect(normalizeUploadedFileName("../客户 复盘.md")).toBe("客户-复盘.md");
    expect(buildLocalAssetStorageKey("asset_1", "客户 复盘.md")).toBe("_runtime/platform-assets/asset_1/客户-复盘.md");
  });

  test("creates durable asset records from upload metadata", () => {
    const records = createUploadAssetRecords({
      userId: "user1",
      scenarioId: "scenario1",
      files: [
        { name: "客户复盘.md", type: "text/markdown", size: 1200 },
        { name: "合同.pdf", type: "application/pdf", size: 2048 }
      ]
    });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      ownerUserId: "user1",
      scenarioId: "scenario1",
      status: "ready",
      archivedAt: null
    });
    expect(records[0].storageKey).toContain("_runtime/platform-assets/");
  });

  test("archives asset without deleting audit metadata", () => {
    const asset = createUploadAssetRecord({
      userId: "user1",
      scenarioId: "scenario1",
      name: "客户复盘.md",
      type: "text/markdown",
      size: 1200
    });
    const archived = archiveUploadAsset(asset, "不再用于本场景");
    expect(archived.status).toBe("archived");
    expect(archived.archiveReason).toBe("不再用于本场景");
    expect(archived.storageKey).toBe(asset.storageKey);
  });

  test("repository exposes a reprocess lifecycle action", () => {
    expect(typeof markUploadAssetForReprocess).toBe("function");
  });
});
```

- [ ] **Step 2: Add upload asset table**

Append to `migratePlatformDatabase()` in `packages/platform/src/migrations.ts`:

```ts
await pool.query(`
  CREATE TABLE IF NOT EXISTS upload_assets (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    scenario_id TEXT REFERENCES scenario_instances(id) ON DELETE SET NULL,
    original_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    checksum TEXT,
    storage_key TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'company')) DEFAULT 'private',
    status TEXT NOT NULL CHECK (status IN ('reserved', 'ready', 'parsing', 'linked', 'needs_input', 'failed', 'archived', 'deleted')),
    parser_status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
  );
`);

await pool.query(`CREATE INDEX IF NOT EXISTS upload_assets_owner_idx ON upload_assets(owner_user_id, created_at DESC)`);
await pool.query(`CREATE INDEX IF NOT EXISTS upload_assets_scenario_idx ON upload_assets(scenario_id, status)`);
```

- [ ] **Step 3: Implement asset lifecycle helpers**

Create `packages/platform/src/assets.ts`:

```ts
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type UploadAssetStatus = "reserved" | "ready" | "parsing" | "linked" | "needs_input" | "failed" | "archived" | "deleted";

export type UploadedFileInput = {
  name: string;
  type: string;
  size: number;
  textContent?: string;
};

export type UploadAssetRecord = {
  id: string;
  ownerUserId: string;
  scenarioId: string | null;
  originalName: string;
  normalizedName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  storageKey: string;
  visibility: "private" | "team" | "company";
  status: UploadAssetStatus;
  parserStatus: "pending" | "ready" | "failed";
  failureReason: string | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export function createUploadAssetRecords(input: {
  userId: string;
  scenarioId?: string | null;
  visibility?: UploadAssetRecord["visibility"];
  files: UploadedFileInput[];
}): UploadAssetRecord[] {
  return input.files.map((file) => createUploadAssetRecord({
    userId: input.userId,
    scenarioId: input.scenarioId ?? null,
    visibility: input.visibility ?? "private",
    ...file
  }));
}

export function createUploadAssetRecord(input: UploadedFileInput & {
  userId: string;
  scenarioId?: string | null;
  visibility?: UploadAssetRecord["visibility"];
}): UploadAssetRecord {
  if (!input.name.trim()) throw new Error("uploaded file name is required");
  if (!input.type.trim()) throw new Error("uploaded file mime type is required");
  if (!Number.isFinite(input.size) || input.size < 0) throw new Error("uploaded file size must be non-negative");
  const id = `asset_${randomUUID()}`;
  const normalizedName = normalizeUploadedFileName(input.name);
  const checksum = input.textContent ? createHash("sha256").update(input.textContent).digest("hex") : null;
  const now = new Date();
  return {
    id,
    ownerUserId: input.userId,
    scenarioId: input.scenarioId ?? null,
    originalName: input.name,
    normalizedName,
    mimeType: input.type,
    sizeBytes: input.size,
    checksum,
    storageKey: buildLocalAssetStorageKey(id, normalizedName),
    visibility: input.visibility ?? "private",
    status: "ready",
    parserStatus: "pending",
    failureReason: null,
    archiveReason: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
}

export function archiveUploadAsset(asset: UploadAssetRecord, reason: string): UploadAssetRecord {
  return {
    ...asset,
    status: "archived",
    archiveReason: reason,
    archivedAt: new Date(),
    updatedAt: new Date()
  };
}

export async function insertUploadAsset(pool: Pool, asset: UploadAssetRecord): Promise<UploadAssetRecord> {
  await pool.query(
    `
      INSERT INTO upload_assets (
        id, owner_user_id, scenario_id, original_name, normalized_name, mime_type,
        size_bytes, checksum, storage_key, visibility, status, parser_status,
        failure_reason, archive_reason, created_at, updated_at, archived_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `,
    [
      asset.id,
      asset.ownerUserId,
      asset.scenarioId,
      asset.originalName,
      asset.normalizedName,
      asset.mimeType,
      asset.sizeBytes,
      asset.checksum,
      asset.storageKey,
      asset.visibility,
      asset.status,
      asset.parserStatus,
      asset.failureReason,
      asset.archiveReason,
      asset.createdAt,
      asset.updatedAt,
      asset.archivedAt
    ]
  );
  return asset;
}

export async function archiveUploadAssetById(pool: Pool, input: {
  assetId: string;
  userId: string;
  isAdmin: boolean;
  reason: string;
}): Promise<void> {
  const result = await pool.query(
    `
      UPDATE upload_assets
      SET status = 'archived',
          archive_reason = $2,
          archived_at = now(),
          updated_at = now()
      WHERE id = $1
        AND status <> 'deleted'
        AND ($3::boolean = true OR owner_user_id = $4)
    `,
    [input.assetId, input.reason, input.isAdmin, input.userId]
  );
  if (result.rowCount !== 1) throw new Error("upload asset not found or not manageable");
}

export async function markUploadAssetForReprocess(pool: Pool, input: {
  assetId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<void> {
  const result = await pool.query(
    `
      UPDATE upload_assets
      SET status = 'ready',
          parser_status = 'pending',
          failure_reason = NULL,
          archive_reason = NULL,
          updated_at = now()
      WHERE id = $1
        AND status IN ('ready', 'linked', 'needs_input', 'failed')
        AND ($2::boolean = true OR owner_user_id = $3)
    `,
    [input.assetId, input.isAdmin, input.userId]
  );
  if (result.rowCount !== 1) throw new Error("upload asset not found or not reprocessable");
}

export function normalizeUploadedFileName(name: string): string {
  const lastSegment = name.split(/[\\/]/).filter(Boolean).at(-1) ?? "asset";
  return lastSegment
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._\-\u4e00-\u9fa5]/g, "")
    .slice(0, 120) || "asset";
}

export function buildLocalAssetStorageKey(assetId: string, fileName: string): string {
  return `_runtime/platform-assets/${assetId}/${normalizeUploadedFileName(fileName)}`;
}
```

- [ ] **Step 4: Let scenario creation bind existing asset IDs**

Modify `packages/platform/src/scenarios.ts` imports:

```ts
import { createUploadAssetRecords, insertUploadAsset, type UploadedFileInput } from "./assets";
import { getPlatformPool } from "./db";
```

Modify `packages/platform/src/scenarios.ts` scenario creation input:

```ts
export type CreateScenarioInput = {
  templateId: string;
  name: string;
  description?: string;
  visibility?: ScenarioVisibility;
  uploadedFiles?: UploadedFileInput[];
  assetIds?: string[];
  businessOptions?: Record<string, unknown>;
};
```

Inside `createScenario`, after the scenario instance is created:

```ts
const uploadAssets = createUploadAssetRecords({
  userId: user.userId,
  scenarioId: instance.id,
  visibility: instance.visibility,
  files: input.uploadedFiles ?? []
});
await Promise.all(uploadAssets.map((asset) => insertUploadAsset(getPlatformPool(), asset)));

const boundAssetIds = [...(input.assetIds ?? []), ...uploadAssets.map((asset) => asset.id)];
const task = await createProcessingTask({
  scenarioId: instance.id,
  templateId: template.id,
  userId: user.userId,
  uploadedFiles: input.uploadedFiles ?? [],
  assetIds: boundAssetIds,
  status: template.needsAdminReview ? "waiting_review" : "submitted"
});
```

- [ ] **Step 5: Export asset helpers**

Modify `packages/platform/src/index.ts`:

```ts
export {
  archiveUploadAsset,
  archiveUploadAssetById,
  buildLocalAssetStorageKey,
  createUploadAssetRecord,
  createUploadAssetRecords,
  insertUploadAsset,
  markUploadAssetForReprocess,
  normalizeUploadedFileName,
  type UploadedFileInput,
  type UploadAssetRecord,
  type UploadAssetStatus
} from "./assets";
```

- [ ] **Step 6: Add asset API shape**

Modify `apps/api/src/routes/platform.ts` imports:

```ts
import {
  archiveUploadAssetById,
  createUploadAssetRecord,
  getPlatformPool,
  insertUploadAsset,
  markUploadAssetForReprocess
} from "@ff/platform";
```

Modify `POST /platform/scenarios` so it passes existing asset references:

```ts
const result = await createScenario(user, {
  templateId: body.template_id,
  name: body.name,
  description: body.description,
  visibility: body.visibility,
  uploadedFiles: body.uploaded_files,
  assetIds: body.asset_ids,
  businessOptions: body.business_options
});
```

Add local asset reservation endpoints:

```ts
platformRouter.post(
  "/platform/assets",
  protectedRoute("创建上传资产失败", async (c, user) => {
    const body = await c.req.json().catch(() => ({}));
    const asset = createUploadAssetRecord({
      userId: user.userId,
      scenarioId: body.scenario_id ?? null,
      name: body.name,
      type: body.type,
      size: body.size,
      textContent: body.text_content,
      visibility: body.visibility ?? "private"
    });
    await insertUploadAsset(getPlatformPool(), asset);
    return c.json({ asset: toSnakeObject(asset) }, 201);
  })
);

platformRouter.post(
  "/platform/assets/:assetId/archive",
  protectedRoute("归档上传资产失败", async (c, user) => {
    const body = await c.req.json().catch(() => ({}));
    await archiveUploadAssetById(getPlatformPool(), {
      assetId: c.req.param("assetId"),
      userId: user.userId,
      isAdmin: user.isAdmin,
      reason: body.reason ?? "用户归档资料"
    });
    return c.json({ ok: true });
  })
);

platformRouter.post(
  "/platform/assets/:assetId/reprocess",
  protectedRoute("重新处理上传资产失败", async (c, user) => {
    await markUploadAssetForReprocess(getPlatformPool(), {
      assetId: c.req.param("assetId"),
      userId: user.userId,
      isAdmin: user.isAdmin
    });
    return c.json({ ok: true });
  })
);
```

- [ ] **Step 7: Document asset APIs**

Append to `docs/API.md`:

````md
### POST `/platform/assets`

Creates a durable upload asset record for local/demo and future object-storage flows.

Request:

```json
{
  "name": "客户复盘.md",
  "type": "text/markdown",
  "size": 1200,
  "text_content": "# 客户复盘",
  "visibility": "private"
}
```

### POST `/platform/scenarios`

Scenario creation accepts either `uploaded_files` for inline local/demo metadata, `asset_ids` for assets created earlier, or both.

### POST `/platform/assets/:assetId/archive`

Archives an upload asset while preserving storage key and audit metadata.

### POST `/platform/assets/:assetId/reprocess`

Marks an existing upload asset for reprocessing and resets parser status to pending.
````

- [ ] **Step 8: Run tests**

```bash
bun test packages/platform/src/assets.test.ts packages/platform/src/scenarios.test.ts
bun --cwd apps/api test || bun test apps/api/src/app.ts
```

Expected:

- Asset lifecycle tests pass.
- Scenario creation still accepts `uploaded_files`.
- API route module loads with asset endpoints.

- [ ] **Step 9: Commit Task 4A**

```bash
git add packages/platform/src/migrations.ts packages/platform/src/assets.ts packages/platform/src/assets.test.ts packages/platform/src/scenarios.ts packages/platform/src/index.ts apps/api/src/routes/platform.ts docs/API.md
git commit -m "feat: add upload asset lifecycle"
```

---

### Task 5: Module Ingestion Adapters

**Files:**
- Create: `packages/platform/src/module-adapters.ts`
- Create: `packages/platform/src/module-adapters.test.ts`
- Modify: `packages/platform/src/index.ts`

- [ ] **Step 1: Write adapter tests for request builders and mock-real switching**

Create `packages/platform/src/module-adapters.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildCreateSourceRequest,
    buildIngestRequest,
    createMockModuleSource,
    ingestTextIntoMockModule,
    platformReferenceFromIngestResult,
    platformReferenceFromRealResponse,
    resolveModuleExecutionMode
  } from "./module-adapters";

describe("module adapter request builders", () => {
  test("builds Nano page ingest request", () => {
    expect(buildIngestRequest({
      moduleId: "nano-brain",
      ingestMode: "nano_page",
      sourceId: "src1",
      file: { name: "notes.md", text: "# 客户复盘" }
    })).toEqual({
      method: "POST",
      path: "/nano/pages",
      body: {
        source_id: "src1",
        slug: "notes-md",
        title: "notes.md",
        body: "# 客户复盘",
        content_type: "markdown"
      }
    });
  });

  test("builds Traditional multipart document request", () => {
    const request = buildIngestRequest({
      moduleId: "traditional-rag",
      ingestMode: "traditional_document",
      sourceId: "src2",
      file: { name: "policy.md", text: "# 制度" }
    });

    expect(request.method).toBe("POST");
    expect(request.path).toBe("/traditional/documents");
    expect(request.body).toBeUndefined();
    expect(request.rawBody).toBeInstanceOf(FormData);
  });

  test("builds Graph text ingest request", () => {
    expect(buildIngestRequest({
      moduleId: "graph-rag",
      ingestMode: "graph_document",
      sourceId: "src3",
      file: { name: "关系资料.txt", text: "A 负责 B" }
    })).toMatchObject({
      method: "POST",
      path: "/graph/documents/text",
      body: {
        source_id: "src3",
        title: "关系资料.txt",
        text: "A 负责 B"
      }
    });
  });

  test("builds module-specific source request", () => {
    expect(buildCreateSourceRequest("graph-rag", "scenario/customer-360", "客户关系资料")).toEqual({
      method: "POST",
      path: "/graph/sources",
      body: {
        name: "scenario/customer-360",
        kind: "private",
        description: "客户关系资料"
      }
    });
  });

  test("defaults to mock module execution mode", () => {
    expect(resolveModuleExecutionMode({})).toBe("mock");
  });

  test("allows real module execution mode", () => {
    expect(resolveModuleExecutionMode({ PLATFORM_MODULE_MODE: "real" })).toBe("real");
  });

  test("rejects invalid module execution mode", () => {
    expect(() => resolveModuleExecutionMode({ PLATFORM_MODULE_MODE: "fixture" })).toThrow("PLATFORM_MODULE_MODE");
  });

  test("mock source IDs are stable and module-shaped", () => {
    const first = createMockModuleSource({
      moduleId: "graph-rag",
      sourceName: "scenario/customer-360/abc",
      description: "客户关系资料"
    });
    const second = createMockModuleSource({
      moduleId: "graph-rag",
      sourceName: "scenario/customer-360/abc",
      description: "客户关系资料"
    });

    expect(first.sourceId).toBe(second.sourceId);
    expect(first.sourceId.startsWith("mock_graph_source_")).toBe(true);
    expect(first.body).toMatchObject({
      source: {
        id: first.sourceId,
        module_id: "graph-rag",
        mode: "mock"
      }
    });
  });

    test("mock ingest returns module-specific object references", () => {
      const nano = ingestTextIntoMockModule({
      moduleId: "nano-brain",
      ingestMode: "nano_page",
      sourceId: "mock_nano_source_1",
      file: { name: "notes.md", text: "# Notes" }
    });
    const traditional = ingestTextIntoMockModule({
      moduleId: "traditional-rag",
      ingestMode: "traditional_document",
      sourceId: "mock_traditional_source_1",
      file: { name: "policy.pdf", text: "policy" }
    });
    const graph = ingestTextIntoMockModule({
      moduleId: "graph-rag",
      ingestMode: "graph_document",
      sourceId: "mock_graph_source_1",
      file: { name: "relations.txt", text: "A -> B" }
    });

    expect(nano.moduleObjectId.startsWith("mock_nano_page_")).toBe(true);
    expect(nano.status).toBe("ready");
    expect(traditional.moduleObjectId.startsWith("mock_traditional_job_")).toBe(true);
    expect(traditional.status).toBe("submitted");
    expect(graph.moduleObjectId.startsWith("mock_graph_document_")).toBe(true);
      expect(graph.status).toBe("ready");
    });

    test("mock and real ingest responses normalize to the same platform reference shape", () => {
      const mock = ingestTextIntoMockModule({
        moduleId: "traditional-rag",
        ingestMode: "traditional_document",
        sourceId: "mock_traditional_source_1",
        file: { name: "policy.pdf", text: "policy" }
      });
      expect(platformReferenceFromIngestResult({
        moduleId: "traditional-rag",
        ingestMode: "traditional_document",
        sourceId: "mock_traditional_source_1",
        result: mock
      })).toEqual({
        moduleId: "traditional-rag",
        sourceId: "mock_traditional_source_1",
        moduleObjectId: mock.moduleObjectId,
        objectKind: "job",
        status: "submitted"
      });
      expect(platformReferenceFromRealResponse({
        moduleId: "graph-rag",
        ingestMode: "graph_document",
        sourceId: "graph_source_1",
        body: { document_id: "graph_document_1", status: "ready" }
      })).toEqual({
        moduleId: "graph-rag",
        sourceId: "graph_source_1",
        moduleObjectId: "graph_document_1",
        objectKind: "document",
        status: "ready"
      });
    });
  });
```

- [ ] **Step 2: Implement adapter builders**

Create `packages/platform/src/module-adapters.ts`:

```ts
import { createHash } from "node:crypto";
import type { ModuleId } from "@ff/contracts";
import type { TemplateModulePlan } from "./types";

export type ModuleRequest = {
  method: string;
  path: string;
  body?: unknown;
  rawBody?: BodyInit;
  contentType?: string;
};

export type IngestFile = {
  name: string;
  text: string;
};

export type ModuleExecutionMode = "mock" | "real";

export type ModuleSourceResult = {
  sourceId: string;
  body: unknown;
  mode: ModuleExecutionMode;
};

export type ModuleIngestResult = {
  moduleObjectId: string;
  body: unknown;
  mode: ModuleExecutionMode;
  status: "submitted" | "ready";
};

export type PlatformModuleReference = {
  moduleId: ModuleId;
  sourceId: string;
  moduleObjectId: string;
  objectKind: "page" | "document" | "job";
  status: "submitted" | "ready";
};

export function resolveModuleExecutionMode(env: Record<string, string | undefined> = process.env): ModuleExecutionMode {
  const raw = env.PLATFORM_MODULE_MODE ?? "mock";
  if (raw === "mock" || raw === "real") return raw;
  throw new Error("PLATFORM_MODULE_MODE must be either mock or real");
}

export function buildCreateSourceRequest(moduleId: ModuleId, name: string, description: string): ModuleRequest {
  const prefix = modulePrefix(moduleId);
  return {
    method: "POST",
    path: `/${prefix}/sources`,
    body: {
      name,
      kind: "private",
      description
    }
  };
}

export function buildIngestRequest(input: {
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  file: IngestFile;
}): ModuleRequest {
  if (input.ingestMode === "nano_page") {
    return {
      method: "POST",
      path: "/nano/pages",
      body: {
        source_id: input.sourceId,
        slug: slugify(input.file.name),
        title: input.file.name,
        body: input.file.text,
        content_type: "markdown"
      }
    };
  }
  if (input.ingestMode === "graph_document") {
    return {
      method: "POST",
      path: "/graph/documents/text",
      body: {
        source_id: input.sourceId,
        title: input.file.name,
        text: input.file.text,
        metadata: { ingest_type: "scenario" }
      }
    };
  }
  return {
    method: "POST",
    path: "/traditional/documents",
    rawBody: buildDocumentForm(input.sourceId, input.file)
  };
}

function modulePrefix(moduleId: ModuleId): "nano" | "traditional" | "graph" {
  if (moduleId === "nano-brain") return "nano";
  if (moduleId === "traditional-rag") return "traditional";
  return "graph";
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "page";
}

function buildDocumentForm(sourceId: string, file: IngestFile): FormData {
  const form = new FormData();
  form.set("source_id", sourceId);
  form.set("file", new Blob([file.text], { type: mimeTypeForName(file.name) }), file.name);
  return form;
}

function mimeTypeForName(name: string): string {
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function stableId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
```

- [ ] **Step 3: Add mode-aware runtime adapter functions**

Append to `packages/platform/src/module-adapters.ts`:

```ts
import type { UserContext } from "@ff/contracts";
import { callModuleJson } from "@ff/gateway";

export function createMockModuleSource(input: {
  moduleId: ModuleId;
  sourceName: string;
  description: string;
}): ModuleSourceResult {
  const prefix = modulePrefix(input.moduleId);
  const sourceId = `mock_${prefix}_source_${stableId(`${input.moduleId}:${input.sourceName}`)}`;
  return {
    sourceId,
    mode: "mock",
    body: {
      source: {
        id: sourceId,
        source_id: sourceId,
        module_id: input.moduleId,
        name: input.sourceName,
        description: input.description,
        mode: "mock"
      }
    }
  };
}

export function ingestTextIntoMockModule(input: {
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  file: IngestFile;
}): ModuleIngestResult {
  const objectId = mockObjectId(input);
  const status = input.ingestMode === "traditional_document" ? "submitted" : "ready";
  return {
    moduleObjectId: objectId,
    mode: "mock",
    status,
    body: {
      id: objectId,
      source_id: input.sourceId,
      module_id: input.moduleId,
      mode: "mock",
      status,
      title: input.file.name,
      page_id: input.ingestMode === "nano_page" ? objectId : undefined,
      job_id: input.ingestMode === "traditional_document" ? objectId : undefined,
      document_id: input.ingestMode === "graph_document" ? objectId : undefined
    }
  };
}

export async function createModuleSource(input: {
  user: UserContext;
  moduleId: ModuleId;
  sourceName: string;
  description: string;
}): Promise<ModuleSourceResult> {
  if (resolveModuleExecutionMode() === "mock") {
    return createMockModuleSource(input);
  }

  const request = buildCreateSourceRequest(input.moduleId, input.sourceName, input.description);
  const response = await callModuleJson<any>(input.moduleId, {
    method: request.method,
    path: request.path,
    body: request.body,
    user: input.user
  });
  const sourceId = response.body?.source?.id ?? response.body?.source_id ?? response.body?.id;
  if (!sourceId) throw new Error(`模块 ${input.moduleId} 创建 source 后未返回 source.id/source_id/id`);
  return { sourceId, body: response.body, mode: "real" };
}

export async function ingestTextIntoModule(input: {
  user: UserContext;
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  file: IngestFile;
}): Promise<ModuleIngestResult> {
  if (resolveModuleExecutionMode() === "mock") {
    return ingestTextIntoMockModule(input);
  }

  const request = buildIngestRequest(input);
  const response = await callModuleJson(input.moduleId, {
    method: request.method,
    path: request.path,
    body: request.body,
    rawBody: request.rawBody,
    contentType: request.contentType,
    user: input.user
  });
  return {
    moduleObjectId: extractModuleObjectId(response.body, input.ingestMode),
    body: response.body,
    mode: "real",
    status: input.ingestMode === "traditional_document" ? "submitted" : "ready"
    };
  }

export function platformReferenceFromIngestResult(input: {
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  result: ModuleIngestResult;
}): PlatformModuleReference {
  return {
    moduleId: input.moduleId,
    sourceId: input.sourceId,
    moduleObjectId: input.result.moduleObjectId,
    objectKind: objectKindForIngestMode(input.ingestMode),
    status: input.result.status
  };
}

export function platformReferenceFromRealResponse(input: {
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  body: unknown;
}): PlatformModuleReference {
  return {
    moduleId: input.moduleId,
    sourceId: input.sourceId,
    moduleObjectId: extractModuleObjectId(input.body, input.ingestMode),
    objectKind: objectKindForIngestMode(input.ingestMode),
    status: input.ingestMode === "traditional_document" ? "submitted" : "ready"
  };
}

function objectKindForIngestMode(ingestMode: TemplateModulePlan["ingestMode"]): PlatformModuleReference["objectKind"] {
  if (ingestMode === "nano_page") return "page";
  if (ingestMode === "traditional_document") return "job";
  return "document";
}

function mockObjectId(input: {
  moduleId: ModuleId;
  ingestMode: TemplateModulePlan["ingestMode"];
  sourceId: string;
  file: IngestFile;
}): string {
  const suffix = stableId(`${input.moduleId}:${input.ingestMode}:${input.sourceId}:${input.file.name}:${input.file.text}`);
  if (input.ingestMode === "nano_page") return `mock_nano_page_${suffix}`;
  if (input.ingestMode === "traditional_document") return `mock_traditional_job_${suffix}`;
  return `mock_graph_document_${suffix}`;
}

function extractModuleObjectId(body: unknown, ingestMode: TemplateModulePlan["ingestMode"]): string {
  const record = body && typeof body === "object" ? body as Record<string, any> : {};
  const id =
    record.id ??
    record.page_id ??
    record.document_id ??
    record.job_id ??
    record.page?.id ??
    record.document?.id ??
    record.job?.id;
  if (typeof id === "string" && id.length > 0) return id;
  throw new Error(`模块入库响应缺少 ${ingestMode} 对应的对象 ID`);
}
```

- [ ] **Step 4: Export adapters**

Modify `packages/platform/src/index.ts`:

```ts
export {
  buildCreateSourceRequest,
  buildIngestRequest,
  createMockModuleSource,
  createModuleSource,
  ingestTextIntoMockModule,
  ingestTextIntoModule,
  platformReferenceFromIngestResult,
  platformReferenceFromRealResponse,
  resolveModuleExecutionMode,
  type ModuleExecutionMode,
  type ModuleIngestResult,
  type ModuleSourceResult,
  type PlatformModuleReference
} from "./module-adapters";
```

- [ ] **Step 5: Run tests**

```bash
bun test packages/platform/src/module-adapters.test.ts
```

Expected:

- 10 tests pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add packages/platform/src/module-adapters.ts packages/platform/src/module-adapters.test.ts packages/platform/src/index.ts
git commit -m "feat: add mock-real scenario module adapters"
```

---

### Task 5A: Delivery Demo Data Pack And Bulk Scenario Seeding

**Files:**
- Create: `packages/platform/src/demo-data.ts`
- Create: `packages/platform/src/demo-data.test.ts`
- Modify: `packages/platform/src/index.ts`
- Create: `scripts/generate-platform-demo-data.ts`
- Create: `scripts/seed-platform-demo-data.ts`
- Modify: `package.json`

- [ ] **Step 1: Write demo data contract tests**

Create `packages/platform/src/demo-data.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
  import {
    PRODUCT_FACING_FORBIDDEN_WORDS,
    buildDeliveryDemoDataPlan,
    buildDemoScenarioSeedRequests,
    buildScenarioIngestFiles,
    buildTemplateDemoWalkthroughs
  } from "./demo-data";

describe("delivery demo data", () => {
  test("covers every official scenario template with high-volume assets", () => {
    const plan = buildDeliveryDemoDataPlan();
    const templateIds = new Set(plan.scenarios.map((item) => item.templateId));
    expect(templateIds).toEqual(new Set([
      "personal-wiki",
      "team-handbook",
      "policy-evidence",
      "contract-playbook",
      "rfp-security",
      "customer-360",
      "risk-investigation",
      "domain-relationship",
      "support-agent",
      "research-guide"
    ]));
    expect(plan.scenarios.length).toBeGreaterThanOrEqual(30);
    expect(plan.assets.length).toBeGreaterThanOrEqual(120);
  });

    test("includes the file formats required by delivery demos", () => {
      const formats = new Set(buildDeliveryDemoDataPlan().assets.map((item) => item.format));
    expect(formats).toContain("md");
    expect(formats).toContain("pdf");
    expect(formats).toContain("csv");
    expect(formats).toContain("txt");
    expect(formats).toContain("json");
    });

  test("builds one walkthrough per official template", () => {
    const walkthroughs = buildTemplateDemoWalkthroughs();
    expect(walkthroughs).toHaveLength(10);
    for (const walkthrough of walkthroughs) {
      expect(walkthrough.sampleInputs.length).toBeGreaterThanOrEqual(2);
      expect(walkthrough.citations.length).toBeGreaterThanOrEqual(2);
      expect(walkthrough.sampleQuestion.length).toBeGreaterThan(8);
      expect(walkthrough.sampleAnswer.length).toBeGreaterThan(30);
    }
  });

  test("product-facing names do not expose fake-data wording", () => {
    const plan = buildDeliveryDemoDataPlan();
    const visibleText = [
      ...plan.scenarios.flatMap((item) => [item.name, item.description, item.department, item.ownerUsername]),
      ...plan.assets.flatMap((item) => [item.fileName, item.title])
    ].join("\n").toLowerCase();

    for (const word of PRODUCT_FACING_FORBIDDEN_WORDS) {
      expect(visibleText.includes(word)).toBe(false);
    }
  });

  test("seed requests connect scenario creation to uploaded file metadata", () => {
    const requests = buildDemoScenarioSeedRequests();
    expect(requests.length).toBeGreaterThanOrEqual(30);
    for (const request of requests) {
      expect(request.uploaded_files.length).toBeGreaterThanOrEqual(4);
      expect(request.business_options.demo_asset_ids.length).toBe(request.uploaded_files.length);
    }
  });

  test("worker can resolve ingest files from demo asset IDs", () => {
    const request = buildDemoScenarioSeedRequests()[0];
    const files = buildScenarioIngestFiles({
      scenarioName: request.name,
      scenarioDescription: request.description,
      businessOptions: request.business_options
    });

    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files[0].name).toBe(request.uploaded_files[0].name);
    expect(files[0].text.length).toBeGreaterThan(300);
  });
});
```

- [ ] **Step 2: Implement canonical demo data catalog**

Create `packages/platform/src/demo-data.ts`:

```ts
import type { Visibility } from "@ff/contracts";
import type { IngestFile } from "./module-adapters";
import type { TemplateDemoWalkthrough } from "./types";

export const PRODUCT_FACING_FORBIDDEN_WORDS = ["mock", "fake", "fixture", "synthetic", "伪造", "虚构"];

export type DemoAssetFormat = "md" | "pdf" | "csv" | "txt" | "json";

export type DemoAsset = {
  id: string;
  scenarioId: string;
  templateId: string;
  title: string;
  fileName: string;
  format: DemoAssetFormat;
  mimeType: string;
  text: string;
};

export type DemoScenario = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  visibility: Visibility;
  department: string;
  ownerUsername: string;
  question: string;
};

export type DeliveryDemoDataPlan = {
  generatedAt: string;
  scenarios: DemoScenario[];
  assets: DemoAsset[];
};

export type TemplateDemoWalkthroughRecord = TemplateDemoWalkthrough & {
  templateId: string;
};

type TemplateSeed = {
  templateId: string;
  department: string;
  visibility: Visibility;
  ownerUsername: string;
  scenarioNames: string[];
  question: string;
  assetFormats: DemoAssetFormat[];
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    templateId: "personal-wiki",
    department: "销售",
    visibility: "private",
    ownerUsername: "张磊",
    scenarioNames: ["张磊销售笔记 Wiki", "华东客户复盘资料库", "售前异议处理知识本"],
    question: "把这些 Markdown 做成个人知识 Wiki，并总结常见客户异议。",
    assetFormats: ["md", "md", "csv", "pdf"]
  },
  {
    templateId: "team-handbook",
    department: "销售运营",
    visibility: "team",
    ownerUsername: "林澄",
    scenarioNames: ["销售新人上手手册", "客户成功交接手册", "售前交付协作手册"],
    question: "把团队资料整理成新人可以按章节学习的手册。",
    assetFormats: ["md", "pdf", "csv", "txt"]
  },
  {
    templateId: "policy-evidence",
    department: "HR · 财务",
    visibility: "company",
    ownerUsername: "周琪",
    scenarioNames: ["差旅报销制度问答", "采购审批制度问答", "IT 权限申请制度问答"],
    question: "一线城市住宿报销标准是多少，需要什么审批？",
    assetFormats: ["pdf", "pdf", "csv", "md"]
  },
  {
    templateId: "contract-playbook",
    department: "法务",
    visibility: "team",
    ownerUsername: "陈予",
    scenarioNames: ["SaaS 订阅合同审阅", "渠道合作协议审阅", "数据处理协议审阅"],
    question: "这份合同有哪些高风险条款，应该怎么改？",
    assetFormats: ["pdf", "txt", "csv", "md"]
  },
  {
    templateId: "rfp-security",
    department: "售前",
    visibility: "team",
    ownerUsername: "许宁",
    scenarioNames: ["华东银行安全问卷响应", "制造集团 RFP 响应", "医疗客户合规问卷响应"],
    question: "把客户安全问卷生成标准答案草稿，并标出待确认项。",
    assetFormats: ["csv", "pdf", "md", "txt"]
  },
  {
    templateId: "customer-360",
    department: "销售",
    visibility: "team",
    ownerUsername: "张磊",
    scenarioNames: ["Northwind Labs 续约简报", "恒生医疗复购简报", "云启网络风险简报"],
    question: "生成会前客户简报、关系路径和下一步推进建议。",
    assetFormats: ["csv", "json", "pdf", "md"]
  },
  {
    templateId: "risk-investigation",
    department: "风控",
    visibility: "team",
    ownerUsername: "刘洋",
    scenarioNames: ["云启网络关系风险尽调", "北辰云服供应链尽调", "星桥投资关联关系核验"],
    question: "追踪多跳关系、风险事件和证据链。",
    assetFormats: ["json", "pdf", "csv", "txt"]
  },
  {
    templateId: "domain-relationship",
    department: "行业研究",
    visibility: "team",
    ownerUsername: "孟然",
    scenarioNames: ["医疗客户关系知识库", "制造供应链对象库", "金融风控关系知识库"],
    question: "建立领域对象关系，并回答对象之间的影响路径。",
    assetFormats: ["json", "pdf", "csv", "md"]
  },
  {
    templateId: "support-agent",
    department: "客服",
    visibility: "team",
    ownerUsername: "何晴",
    scenarioNames: ["售后知识客服代理", "订单与发票客服代理", "退换货流程客服代理"],
    question: "把帮助中心和售后流程做成可嵌入网页的客服知识代理。",
    assetFormats: ["csv", "txt", "pdf", "md"]
  },
  {
    templateId: "research-guide",
    department: "研究 · 知识",
    visibility: "private",
    ownerUsername: "顾问团队",
    scenarioNames: ["医疗行业复购研究指南", "企业知识库建设研究", "AI 客服落地案例综述"],
    question: "把资料包整理成研究报告和学习指南。",
    assetFormats: ["md", "pdf", "csv", "txt"]
  }
];

export function buildDeliveryDemoDataPlan(): DeliveryDemoDataPlan {
  const scenarios = TEMPLATE_SEEDS.flatMap((seed) =>
    seed.scenarioNames.map((name, index) => ({
      id: `${seed.templateId}-${index + 1}`,
      templateId: seed.templateId,
      name,
      description: descriptionFor(seed.templateId, name),
      visibility: seed.visibility,
      department: seed.department,
      ownerUsername: seed.ownerUsername,
      question: seed.question
    }))
  );
  const assets = scenarios.flatMap((scenario) => {
    const seed = TEMPLATE_SEEDS.find((item) => item.templateId === scenario.templateId)!;
    return seed.assetFormats.flatMap((format, assetIndex) =>
      Array.from({ length: format === "md" ? 2 : 1 }, (_, copyIndex) =>
        buildAsset(scenario, format, assetIndex + copyIndex + 1)
      )
    );
  });
  return { generatedAt: "2026-06-25T00:00:00.000Z", scenarios, assets };
}

export function buildTemplateDemoWalkthroughs(): TemplateDemoWalkthroughRecord[] {
  const plan = buildDeliveryDemoDataPlan();
  return TEMPLATE_SEEDS.map((seed) => {
    const scenario = plan.scenarios.find((item) => item.templateId === seed.templateId)!;
    const assets = plan.assets.filter((item) => item.scenarioId === scenario.id).slice(0, 3);
    return {
      templateId: seed.templateId,
      scenarioName: scenario.name,
      sampleInputs: assets.slice(0, 2).map((asset) => ({
        title: asset.title,
        fileName: asset.fileName,
        fileType: asset.format,
        description: `${scenario.department}资料，用于回答「${scenario.question}」。`
      })),
      processingPreview: ["读取业务资料", "整理知识结构", "生成答案、引用和成品预览"],
      sampleQuestion: scenario.question,
      sampleAnswer: `${scenario.name}已经整理完成。系统会给出业务结论、下一步建议和可核查来源，用户可以继续追问细节或创建正式场景。`,
      citations: assets.slice(0, 2).map((asset) => ({
        label: asset.title,
        source: asset.fileName,
        excerpt: asset.text.slice(0, 80)
      })),
      resultHighlights: ["样例答案", "引用来源", "成品预览"]
    };
  });
}

export function buildDemoScenarioSeedRequests() {
  const plan = buildDeliveryDemoDataPlan();
  return plan.scenarios.map((scenario) => {
    const assets = plan.assets.filter((asset) => asset.scenarioId === scenario.id);
    return {
      template_id: scenario.templateId,
      name: scenario.name,
      description: scenario.description,
      visibility: scenario.visibility,
      uploaded_files: assets.map((asset) => ({
        name: asset.fileName,
        type: asset.mimeType,
        size: Buffer.byteLength(asset.text, "utf8")
      })),
      business_options: {
        department: scenario.department,
        owner_username: scenario.ownerUsername,
        seed_question: scenario.question,
        demo_asset_ids: assets.map((asset) => asset.id)
      }
    };
  });
}

export function buildScenarioIngestFiles(input: {
  scenarioName: string;
  scenarioDescription: string;
  businessOptions?: Record<string, unknown> | null;
}): IngestFile[] {
  const ids = Array.isArray(input.businessOptions?.demo_asset_ids)
    ? input.businessOptions.demo_asset_ids.map(String)
    : [];
  if (ids.length === 0) {
    return [{
      name: `${input.scenarioName}.md`,
      text: `# ${input.scenarioName}\n\n${input.scenarioDescription}\n\n该资料由场景创建流程提交，用于建立初始知识来源。`
    }];
  }
  const assetsById = new Map(buildDeliveryDemoDataPlan().assets.map((asset) => [asset.id, asset]));
  return ids
    .map((id) => assetsById.get(id))
    .filter((asset): asset is DemoAsset => Boolean(asset))
    .map((asset) => ({ name: asset.fileName, text: asset.text }));
}

function buildAsset(scenario: DemoScenario, format: DemoAssetFormat, index: number): DemoAsset {
  const title = assetTitle(scenario, format, index);
  const fileName = `${title}.${format}`;
  return {
    id: `${scenario.id}-${format}-${index}`,
    scenarioId: scenario.id,
    templateId: scenario.templateId,
    title,
    fileName,
    format,
    mimeType: mimeType(format),
    text: assetText(scenario, title, format, index)
  };
}

function descriptionFor(templateId: string, name: string): string {
  const map: Record<string, string> = {
    "personal-wiki": "汇总个人笔记、客户复盘、会议摘录和销售方法，整理成可追问的知识 Wiki。",
    "team-handbook": "把团队 SOP、项目复盘和交接材料整理成可维护、可分享的团队手册。",
    "policy-evidence": "基于正式制度、审批流程和操作指引回答员工高频问题，并保留依据。",
    "contract-playbook": "将合同模板、审阅规则和历史风险条款整理成审阅 playbook。",
    "rfp-security": "导入客户问卷、历史答案和安全资料，生成可信问卷响应草稿。",
    "customer-360": "围绕客户、联系人、合同、互动和项目状态生成会前简报。",
    "risk-investigation": "围绕公司、供应商、合同和风险事件建立关系尽调资料。",
    "domain-relationship": "面向垂直行业资料抽取对象、关系、证据和分析线索。",
    "support-agent": "把帮助中心、售后流程、FAQ 和工单记录整理成客服知识代理。",
    "research-guide": "把资料包整理成研究报告、学习指南、摘要和引用来源。"
  };
  return `${name}：${map[templateId]}`;
}

function assetTitle(scenario: DemoScenario, format: DemoAssetFormat, index: number): string {
  const suffix: Record<DemoAssetFormat, string> = {
    md: "会议与操作笔记",
    pdf: "正式资料摘编",
    csv: "业务明细表",
    txt: "访谈与工单记录",
    json: "对象关系数据"
  };
  return `${scenario.name}-${suffix[format]}-${index}`;
}

function assetText(scenario: DemoScenario, title: string, format: DemoAssetFormat, index: number): string {
  if (format === "csv") return csvText(scenario);
  if (format === "json") return JSON.stringify(graphText(scenario), null, 2);
  return [
    `# ${title}`,
    "",
    `场景：${scenario.name}`,
    `部门：${scenario.department}`,
    `负责人：${scenario.ownerUsername}`,
    `目标问题：${scenario.question}`,
    "",
    "## 背景",
    scenario.description,
    "",
    "## 关键事实",
    `- 最近一次业务动作发生在 2026-06-${String(10 + index).padStart(2, "0")}，需要在两周内完成下一步确认。`,
    "- 当前资料包含正式文件、表格明细、访谈记录和关系线索，适合用于场景化问答和任务生成。",
    "- 业务判断必须保留来源，不能只给泛化建议。",
    "",
    "## 待回答问题",
    `1. ${scenario.question}`,
    "2. 哪些依据可以直接引用给业务负责人？",
    "3. 哪些内容需要人工复核或管理员确认？",
    "",
    "## 处理要求",
    "输出需要包含结论、依据、风险、下一步动作和可沉淀的知识条目。"
  ].join("\n");
}

function csvText(scenario: DemoScenario): string {
  const rows = [
    ["记录ID", "对象", "类型", "负责人", "金额", "状态", "最近更新", "备注"],
    ["R-001", scenario.name, "主对象", scenario.ownerUsername, "1200000", "推进中", "2026-06-12", "需要跟进关键人"],
    ["R-002", "二期扩容", "机会", scenario.ownerUsername, "450000", "评估中", "2026-06-14", "与主合同绑定"],
    ["R-003", "审批确认", "流程", "运营团队", "0", "待确认", "2026-06-15", "需要补充附件"]
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function graphText(scenario: DemoScenario) {
  return {
    nodes: [
      { id: "company", label: scenario.name, type: "company" },
      { id: "owner", label: scenario.ownerUsername, type: "person" },
      { id: "contract", label: "框架合同", type: "contract" },
      { id: "risk", label: "待确认风险", type: "risk" }
    ],
    edges: [
      { from: "owner", to: "company", label: "负责" },
      { from: "company", to: "contract", label: "关联" },
      { from: "contract", to: "risk", label: "包含" }
    ]
  };
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function mimeType(format: DemoAssetFormat): string {
  if (format === "md") return "text/markdown";
  if (format === "pdf") return "application/pdf";
  if (format === "csv") return "text/csv";
  if (format === "json") return "application/json";
  return "text/plain";
}
```

- [ ] **Step 3: Export demo data APIs**

Modify `packages/platform/src/index.ts`:

```ts
export {
  PRODUCT_FACING_FORBIDDEN_WORDS,
  buildDeliveryDemoDataPlan,
  buildDemoScenarioSeedRequests,
  buildScenarioIngestFiles,
  buildTemplateDemoWalkthroughs,
  type DeliveryDemoDataPlan,
  type DemoAsset,
  type DemoAssetFormat,
  type DemoScenario,
  type TemplateDemoWalkthroughRecord
} from "./demo-data";
```

- [ ] **Step 4: Add physical asset generator**

Create `scripts/generate-platform-demo-data.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildDeliveryDemoDataPlan, buildTemplateDemoWalkthroughs, type DemoAsset } from "@ff/platform";

const OUT_DIR = "_demo-data/companybrain";

async function main() {
  const plan = buildDeliveryDemoDataPlan();
  const walkthroughs = buildTemplateDemoWalkthroughs();
  await mkdir(OUT_DIR, { recursive: true });
  for (const asset of plan.assets) {
    const filePath = join(OUT_DIR, asset.templateId, asset.scenarioId, asset.fileName);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, asset.format === "pdf" ? simplePdf(asset) : asset.text);
  }
  await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify({ ...plan, templateWalkthroughs: walkthroughs }, null, 2));
  console.log(JSON.stringify({
    ok: true,
    out_dir: OUT_DIR,
    scenarios: plan.scenarios.length,
    assets: plan.assets.length,
    walkthroughs: walkthroughs.length
  }, null, 2));
}

function simplePdf(asset: DemoAsset): Buffer {
  const lines = asset.text.split("\n").slice(0, 34).map((line) => line.replace(/[^\x20-\x7E]/g, " ").slice(0, 88));
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -18 Td",
      `(${escapePdf(line)}) Tj`
    ]).filter(Boolean),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function escapePdf(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Add bulk API seed script**

Create `scripts/seed-platform-demo-data.ts`:

```ts
import { buildDemoScenarioSeedRequests } from "@ff/platform";

const API = process.env.API_BASE_URL ?? "http://localhost:3001";
const USERNAME = process.env.DEMO_SEED_USERNAME ?? "companybrain_admin";
const PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "password-123";

async function json(path: string, input: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...input,
    headers: {
      "content-type": "application/json",
      ...(input.headers ?? {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${input.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function token() {
  await json("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  }).catch(() => null);
  const login = await json("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });
  return login.token as string;
}

async function runWorkerOnce() {
  const proc = Bun.spawn(["bun", "--cwd", "apps/api", "worker:once"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PLATFORM_MODULE_MODE: process.env.PLATFORM_MODULE_MODE ?? "mock" }
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  if (exitCode !== 0) throw new Error(`worker:once failed ${exitCode}: ${stderr || stdout}`);
  return JSON.parse(stdout || "{}");
}

async function main() {
  const auth = { authorization: `Bearer ${await token()}` };
  const requests = buildDemoScenarioSeedRequests();
  const created: Array<{ scenario_id: string; task_id: string; name: string }> = [];

  for (const request of requests) {
    const result = await json("/platform/scenarios", {
      method: "POST",
      headers: auth,
      body: JSON.stringify(request)
    });
    created.push({ scenario_id: result.scenario.id, task_id: result.task.id, name: result.scenario.name });
  }

  for (let i = 0; i < created.length * 3; i++) {
    const result = await runWorkerOnce();
    if (result.status === "idle") break;
  }

  const tasks = await json("/platform/tasks", { headers: auth });
  const knowledge = await json("/platform/knowledge", { headers: auth });
  const ready = tasks.tasks.filter((item: any) => item.status === "ready").length;

  if (ready < created.length) {
    throw new Error(`expected ${created.length} ready tasks, got ${ready}`);
  }
  if (knowledge.objects.length < created.length) {
    throw new Error(`expected at least ${created.length} knowledge objects, got ${knowledge.objects.length}`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: process.env.PLATFORM_MODULE_MODE ?? "mock",
    created_scenarios: created.length,
    ready_tasks: ready,
    knowledge_objects: knowledge.objects.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Add root scripts**

Modify root `package.json` scripts:

```json
"demo:data:generate": "bun run scripts/generate-platform-demo-data.ts",
"demo:data:seed": "set -a; [ -f .env ] && . ./.env; set +a; PLATFORM_MODULE_MODE=${PLATFORM_MODULE_MODE:-mock} bun run scripts/seed-platform-demo-data.ts",
"demo:data:all": "bun run demo:data:generate && bun run demo:data:seed"
```

- [ ] **Step 7: Run tests and generate assets**

Run:

```bash
bun test packages/platform/src/demo-data.test.ts
bun run demo:data:generate
```

Expected:

- 5 demo data tests pass.
- `_demo-data/companybrain/manifest.json` exists.
- The generated output reports at least 30 scenarios and at least 120 assets.

- [ ] **Step 8: Commit Task 5A**

```bash
git add packages/platform/src/demo-data.ts packages/platform/src/demo-data.test.ts packages/platform/src/index.ts scripts/generate-platform-demo-data.ts scripts/seed-platform-demo-data.ts package.json _demo-data/companybrain
git commit -m "feat: add delivery demo data pack"
```

---

### Task 6: Processing Worker And Task Execution

**Files:**
- Create: `packages/platform/src/worker.ts`
- Create: `packages/platform/src/worker.test.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/worker.ts`
- Modify: `packages/platform/src/index.ts`

- [ ] **Step 1: Write worker state-machine tests**

Create `packages/platform/src/worker.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { nextWorkerStep } from "./worker";

describe("processing worker state machine", () => {
  test("waiting review does not process", () => {
    expect(nextWorkerStep({ status: "waiting_review", hasAllRequiredBindings: false })).toBe("skip_waiting_review");
  });

  test("submitted task creates module sources first", () => {
    expect(nextWorkerStep({ status: "submitted", hasAllRequiredBindings: false })).toBe("create_sources");
  });

  test("submitted task with bindings starts ingest", () => {
    expect(nextWorkerStep({ status: "submitted", hasAllRequiredBindings: true })).toBe("ingest_sources");
  });

  test("failed task is idle until retry", () => {
    expect(nextWorkerStep({ status: "failed", hasAllRequiredBindings: false })).toBe("idle");
  });
});
```

- [ ] **Step 2: Implement worker state machine**

Create `packages/platform/src/worker.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { ProcessingStatus, UserContext } from "@ff/contracts";
import { getPlatformPool } from "./db";
import { getScenarioTemplate } from "./templates";
import { createModuleSource, ingestTextIntoModule } from "./module-adapters";
import { updateProcessingTask } from "./tasks";
import { createKnowledgeObject } from "./knowledge";
import { knowledgeModeForTemplate } from "./scenarios";
import { buildScenarioIngestFiles } from "./demo-data";

export type WorkerStep = "skip_waiting_review" | "create_sources" | "ingest_sources" | "idle";

export function nextWorkerStep(input: {
  status: ProcessingStatus;
  hasAllRequiredBindings: boolean;
}): WorkerStep {
  if (input.status === "waiting_review") return "skip_waiting_review";
  if (input.status !== "submitted" && input.status !== "processing") return "idle";
  if (!input.hasAllRequiredBindings) return "create_sources";
  return "ingest_sources";
}

export async function runNextProcessingTask(user: UserContext): Promise<{ taskId: string; status: string } | null> {
  const pool = getPlatformPool();
  const taskResult = await pool.query(
    `
      SELECT pt.*, si.name AS scenario_name, si.description AS scenario_description, si.owner_username, si.business_options
      FROM processing_tasks pt
      JOIN scenario_instances si ON si.id = pt.scenario_id
      WHERE pt.status IN ('submitted', 'processing')
      ORDER BY pt.created_at ASC
      LIMIT 1
    `
  );
  const task = taskResult.rows[0];
  if (!task) return null;
  const template = getScenarioTemplate(task.template_id);
  if (!template) {
    await updateProcessingTask({ taskId: task.id, status: "failed", progress: 0, userMessage: "模板不存在，无法处理。", error: { code: "missing_template" } });
    return { taskId: task.id, status: "failed" };
  }

  const bindings = await pool.query(`SELECT * FROM scenario_source_bindings WHERE scenario_id = $1`, [task.scenario_id]);
  const requiredPlans = template.modulePlan.filter((plan) => plan.required);
  const hasAllRequiredBindings = requiredPlans.every((plan) =>
    bindings.rows.some((binding) => binding.module_id === plan.moduleId && binding.source_purpose === plan.sourcePurpose)
  );

  const step = nextWorkerStep({ status: task.status, hasAllRequiredBindings });
  if (step === "create_sources") {
    await updateProcessingTask({ taskId: task.id, status: "processing", progress: 18, userMessage: "正在创建知识来源。" });
    for (const plan of template.modulePlan) {
      const exists = bindings.rows.some((binding) => binding.module_id === plan.moduleId && binding.source_purpose === plan.sourcePurpose);
      if (exists) continue;
      const source = await createModuleSource({
        user,
        moduleId: plan.moduleId,
        sourceName: `${plan.createSourceName}/${task.scenario_id.slice(0, 8)}`,
        description: `${template.name} · ${task.scenario_name}`
      });
      await pool.query(
        `
          INSERT INTO scenario_source_bindings (
            id, scenario_id, module_id, module_source_id, source_purpose, display_name, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'processing')
        `,
        [randomUUID(), task.scenario_id, plan.moduleId, source.sourceId, plan.sourcePurpose, `${template.name} · ${plan.sourcePurpose}`]
      );
    }
    return { taskId: task.id, status: "processing" };
  }

  if (step === "ingest_sources") {
    await updateProcessingTask({ taskId: task.id, status: "processing", progress: 62, userMessage: "正在整理资料并建立可引用来源。" });
    const latestBindings = await pool.query(`SELECT * FROM scenario_source_bindings WHERE scenario_id = $1`, [task.scenario_id]);
    const ingestFiles = buildScenarioIngestFiles({
      scenarioName: task.scenario_name,
      scenarioDescription: task.scenario_description,
      businessOptions: task.business_options
    });
    const ingestResults: Array<{
      moduleId: string;
      moduleObjectId: string;
      mode: "mock" | "real";
      status: "submitted" | "ready";
    }> = [];

    for (const binding of latestBindings.rows) {
      const plan = template.modulePlan.find((item) => item.moduleId === binding.module_id && item.sourcePurpose === binding.source_purpose);
      if (!plan) continue;
      for (const file of ingestFiles) {
        const ingestResult = await ingestTextIntoModule({
          user,
          moduleId: plan.moduleId,
          ingestMode: plan.ingestMode,
          sourceId: binding.module_source_id,
          file
        });
        ingestResults.push({
          moduleId: plan.moduleId,
          moduleObjectId: ingestResult.moduleObjectId,
          mode: ingestResult.mode,
          status: ingestResult.status
        });
      }
      await pool.query(
        `UPDATE scenario_source_bindings SET status = 'ready', updated_at = now() WHERE id = $1`,
        [binding.id]
      );
    }
    const primaryResult = ingestResults[0];
    await createKnowledgeObject({
      scenarioId: task.scenario_id,
      mode: knowledgeModeForTemplate(task.template_id),
      title: task.scenario_name,
      summary: "资料已经整理完成，可以在前台使用。",
      sourceLabel: template.name,
      moduleId: primaryResult?.moduleId ?? latestBindings.rows[0]?.module_id ?? null,
      moduleObjectId: primaryResult?.moduleObjectId ?? latestBindings.rows[0]?.module_source_id ?? null
    });
    await pool.query(`UPDATE scenario_instances SET status = 'ready', updated_at = now() WHERE id = $1`, [task.scenario_id]);
    await updateProcessingTask({ taskId: task.id, status: "ready", progress: 100, userMessage: "场景已可使用。" });
    return { taskId: task.id, status: "ready" };
  }

  return { taskId: task.id, status: task.status };
}
```

- [ ] **Step 3: Export worker**

Modify `packages/platform/src/index.ts`:

```ts
export { nextWorkerStep, runNextProcessingTask, type WorkerStep } from "./worker";
```

- [ ] **Step 4: Add API worker entry**

Create `apps/api/src/worker.ts`:

```ts
import { runNextProcessingTask } from "@ff/platform";

async function main() {
  const user = {
    userId: process.env.PLATFORM_WORKER_USER_ID ?? "platform-worker",
    username: process.env.PLATFORM_WORKER_USERNAME ?? "platform-worker",
    isAdmin: true
  };
  const result = await runNextProcessingTask(user);
  console.log(JSON.stringify(result ?? { status: "idle" }));
}

if (import.meta.main) {
  await main();
}
```

Modify `apps/api/package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run src/server.ts",
    "worker:once": "bun run src/worker.ts"
  }
}
```

- [ ] **Step 5: Run worker tests**

```bash
bun test packages/platform/src/worker.test.ts packages/platform/src/module-adapters.test.ts
```

Expected:

- Tests pass.

- [ ] **Step 6: Commit Task 6**

```bash
git add packages/platform/src/worker.ts packages/platform/src/worker.test.ts packages/platform/src/index.ts apps/api/src/worker.ts apps/api/package.json
git commit -m "feat: add scenario processing worker"
```

---

### Task 7: Admin Review, Retry, And Task Actions API

**Files:**
- Modify: `packages/platform/src/tasks.ts`
- Modify: `apps/api/src/routes/platform.ts`
- Create: `packages/platform/src/tasks.test.ts`

- [ ] **Step 1: Add task transition tests**

Create `packages/platform/src/tasks.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { assertTaskTransition, buildAssetTaskEvent } from "./tasks";

describe("task transition rules", () => {
  test("admin can approve waiting review", () => {
    expect(assertTaskTransition({ from: "waiting_review", to: "submitted", isAdmin: true })).toBe(true);
  });

  test("non-admin cannot approve waiting review", () => {
    expect(() => assertTaskTransition({ from: "waiting_review", to: "submitted", isAdmin: false })).toThrow("只有管理员可以确认该任务");
  });

  test("failed can retry to submitted", () => {
    expect(assertTaskTransition({ from: "failed", to: "submitted", isAdmin: false })).toBe(true);
  });

  test("ready cannot go back to processing from user action", () => {
    expect(() => assertTaskTransition({ from: "ready", to: "processing", isAdmin: false })).toThrow("不支持的任务状态流转");
  });

  test("asset lifecycle actions create task event copy", () => {
    expect(buildAssetTaskEvent({
      taskId: "task1",
      assetId: "asset1",
      action: "reprocess",
      actor: "张磊"
    })).toMatchObject({
      taskId: "task1",
      assetId: "asset1",
      action: "reprocess",
      userMessage: "资料已重新提交整理。"
    });
  });
});
```

- [ ] **Step 2: Implement transition guard and action helpers**

Append to `packages/platform/src/tasks.ts`:

```ts
import type { ProcessingStatus } from "@ff/contracts";

export function assertTaskTransition(input: { from: ProcessingStatus; to: ProcessingStatus; isAdmin: boolean }): true {
  if (input.from === "waiting_review" && input.to === "submitted") {
    if (!input.isAdmin) throw new PlatformError("只有管理员可以确认该任务", "forbidden", 403);
    return true;
  }
  if (input.from === "failed" && input.to === "submitted") return true;
  if (input.from === "needs_input" && input.to === "submitted") return true;
  throw new PlatformError("不支持的任务状态流转", "unsupported_status", 400);
}

export async function approveProcessingTask(input: { taskId: string; isAdmin: boolean }) {
  if (!input.isAdmin) throw new PlatformError("只有管理员可以确认该任务", "forbidden", 403);
  return updateProcessingTask({
    taskId: input.taskId,
    status: "submitted",
    progress: 8,
    currentStep: "已确认",
    userMessage: "管理员已确认资料范围，等待系统整理。"
  });
}

export async function retryProcessingTask(input: { taskId: string }) {
  return updateProcessingTask({
    taskId: input.taskId,
    status: "submitted",
    progress: 8,
    currentStep: "已重新提交",
    userMessage: "任务已重新提交，等待系统整理。"
  });
}

export function buildAssetTaskEvent(input: {
  taskId: string;
  assetId: string;
  action: "archive" | "reprocess";
  actor: string;
}) {
  return {
    id: `event-${input.taskId}-${input.assetId}-${input.action}`,
    taskId: input.taskId,
    assetId: input.assetId,
    action: input.action,
    actor: input.actor,
    userMessage: input.action === "reprocess" ? "资料已重新提交整理。" : "资料已从本场景移除。",
    adminMessage: input.action === "reprocess" ? "资产解析状态已重置，任务重新进入整理队列。" : "资产已归档，后续检索不再使用该资料。",
    createdAt: new Date()
  };
}
```

- [ ] **Step 3: Add task action routes**

Modify `apps/api/src/routes/platform.ts` imports:

```ts
import {
  approveProcessingTask,
  archiveUploadAssetById,
  buildAssetTaskEvent,
  getPlatformPool,
  markUploadAssetForReprocess,
  retryProcessingTask
} from "@ff/platform";
```

Add routes:

```ts
platformRouter.post(
  "/platform/tasks/:taskId/approve",
  protectedRoute("确认任务失败", async (c, user) => {
    const task = await approveProcessingTask({ taskId: c.req.param("taskId"), isAdmin: user.isAdmin });
    return c.json({ task: toSnakeObject(task) });
  })
);

platformRouter.post(
  "/platform/tasks/:taskId/retry",
  protectedRoute("重试任务失败", async (c) => {
    const task = await retryProcessingTask({ taskId: c.req.param("taskId") });
    return c.json({ task: toSnakeObject(task) });
  })
);

platformRouter.post(
  "/platform/tasks/:taskId/assets/:assetId/reprocess",
  protectedRoute("重新处理资料失败", async (c, user) => {
    await markUploadAssetForReprocess(getPlatformPool(), {
      assetId: c.req.param("assetId"),
      userId: user.userId,
      isAdmin: user.isAdmin
    });
    const task = await retryProcessingTask({ taskId: c.req.param("taskId") });
    const event = buildAssetTaskEvent({
      taskId: c.req.param("taskId"),
      assetId: c.req.param("assetId"),
      action: "reprocess",
      actor: user.username
    });
    return c.json({ task: toSnakeObject(task), event: toSnakeObject(event) });
  })
);

platformRouter.post(
  "/platform/tasks/:taskId/assets/:assetId/archive",
  protectedRoute("归档资料失败", async (c, user) => {
    const body = await c.req.json().catch(() => ({}));
    await archiveUploadAssetById(getPlatformPool(), {
      assetId: c.req.param("assetId"),
      userId: user.userId,
      isAdmin: user.isAdmin,
      reason: body.reason ?? "用户从任务中心移除资料"
    });
    const event = buildAssetTaskEvent({
      taskId: c.req.param("taskId"),
      assetId: c.req.param("assetId"),
      action: "archive",
      actor: user.username
    });
    return c.json({ event: toSnakeObject(event) });
  })
);
```

- [ ] **Step 4: Document task-bound asset actions**

Append to `docs/API.md`:

```md
### POST `/platform/tasks/:taskId/assets/:assetId/reprocess`

Resets one upload asset for reprocessing and moves the task back to the submitted queue.

### POST `/platform/tasks/:taskId/assets/:assetId/archive`

Archives one upload asset from a task and returns a task event for the user/admin timeline.
```

- [ ] **Step 5: Run tests**

```bash
bun test packages/platform/src/tasks.test.ts packages/platform/src/worker.test.ts
```

Expected:

- Tests pass.

- [ ] **Step 6: Commit Task 7**

```bash
git add packages/platform/src/tasks.ts packages/platform/src/tasks.test.ts apps/api/src/routes/platform.ts docs/API.md
git commit -m "feat: add processing task actions"
```

---

### Task 8: Company Brain Agent Scope

**Files:**
- Modify: `apps/agent-gateway/src/core/conversations.ts`
- Modify: `apps/agent-gateway/src/migrations.ts`
- Modify: `apps/agent-gateway/src/agent/stream.ts`
- Modify: `apps/agent-gateway/src/agent/prompt.ts`
- Modify: `apps/agent-gateway/src/index.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Add company-brain scope to conversation model**

In `apps/agent-gateway/src/core/conversations.ts`, introduce:

```ts
export type AgentActiveScope = "company-brain" | "nano-brain" | "traditional-rag" | "graph-rag";
export const SUPPORTED_AGENT_SCOPES: AgentActiveScope[] = ["company-brain", "nano-brain", "traditional-rag", "graph-rag"];
```

Replace `SUPPORTED_AGENT_MODULES` validation with `SUPPORTED_AGENT_SCOPES`.

Update `AgentConversation.activeModule` and `AgentRun.activeModule` type to `AgentActiveScope`.

Keep public JSON field name `active_module` for compatibility, but document that it now accepts `company-brain`.

- [ ] **Step 2: Update agent DB checks**

Modify `apps/agent-gateway/src/migrations.ts` check constraints:

```sql
CHECK (active_module IN ('company-brain', 'nano-brain', 'traditional-rag', 'graph-rag'))
```

Because existing tables may already exist, add safe constraint migration:

```ts
await pool.query(`
  DO $$
  BEGIN
    ALTER TABLE agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_active_module_check;
    ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_active_module_check
      CHECK (active_module IN ('company-brain', 'nano-brain', 'traditional-rag', 'graph-rag'));
    ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_active_module_check;
    ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_active_module_check
      CHECK (active_module IN ('company-brain', 'nano-brain', 'traditional-rag', 'graph-rag'));
  END $$;
`);
```

- [ ] **Step 3: Route company-brain scope to all MCP tools**

Modify `apps/agent-gateway/src/agent/stream.ts` imports:

```ts
import { loadCompanyBrainMcpTools, loadGraphRagMcpTools, loadNanoBrainMcpTools, loadTraditionalRagMcpTools, type CompanyBrainMcpToolsSession } from './mcp';
```

Modify `loadModuleMcpTools`:

```ts
if (input.activeModule === "company-brain") {
  return loadCompanyBrainMcpTools({ user: input.user, bearerToken: input.bearerToken });
}
```

- [ ] **Step 4: Add company brain system prompt**

Modify `apps/agent-gateway/src/agent/prompt.ts`:

```ts
export const COMPANY_BRAIN_AGENT_SYSTEM_PROMPT = `你是 FF-CompanyBrain 的公司大脑。

你的职责：
- 基于用户有权限的知识来源回答问题。
- 可以使用个人知识、文档来源、关系线索三类工具，但不要向用户暴露底层技术名。
- 回答先给直接结论，再给依据摘要，再在适合时给下一步动作。
- 如果依据不足，明确说明当前没有足够资料，并建议用户创建场景或补充资料。
- 默认使用中文，语气克制、准确、适合企业工作场景。`;
```

Modify `buildAgentSystemPrompt`:

```ts
if (context.activeModule === "company-brain") {
  return `${COMPANY_BRAIN_AGENT_SYSTEM_PROMPT}\n\n当前用户：${context.username}\n是否管理员：${context.isAdmin ? "是" : "否"}\n当前范围：公司大脑`;
}
```

- [ ] **Step 5: Update Agent Gateway description**

Modify `apps/agent-gateway/src/index.ts` route descriptions or comments to include:

```ts
"active_module supports company-brain, nano-brain, traditional-rag, graph-rag"
```

- [ ] **Step 6: Document Agent scope**

Update `docs/API.md` Agent Gateway section:

```md
`active_module` now accepts:

- `company-brain`: load all allowed module tools and answer across available knowledge.
- `nano-brain`: compiled/wiki knowledge scope.
- `traditional-rag`: document evidence scope.
- `graph-rag`: relationship knowledge scope.
```

- [ ] **Step 7: Run Agent Gateway type checks**

```bash
bun test apps/agent-gateway/src/core/conversations.ts apps/agent-gateway/src/agent/prompt.ts apps/agent-gateway/src/agent/stream.ts
```

Expected:

- Files load without syntax errors.

- [ ] **Step 8: Commit Task 8**

```bash
git add apps/agent-gateway/src/core/conversations.ts apps/agent-gateway/src/migrations.ts apps/agent-gateway/src/agent/stream.ts apps/agent-gateway/src/agent/prompt.ts apps/agent-gateway/src/index.ts docs/API.md
git commit -m "feat: add company brain agent scope"
```

---

### Task 9: Scenario-Aware Chat API

**Files:**
- Create: `packages/platform/src/chat.ts`
- Create: `packages/platform/src/chat.test.ts`
- Modify: `packages/platform/src/index.ts`
- Modify: `apps/api/src/routes/platform.ts`

- [ ] **Step 1: Write chat scope tests**

Create `packages/platform/src/chat.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildChatConversationRequest, normalizeChatScope } from "./chat";

describe("platform chat scope", () => {
  test("defaults to company brain", () => {
    expect(normalizeChatScope({})).toEqual({ activeModule: "company-brain", metadata: { scope_type: "global" } });
  });

  test("scenario scope carries scenario id", () => {
    expect(normalizeChatScope({ scenarioId: "scene1" })).toEqual({
      activeModule: "company-brain",
      metadata: { scope_type: "scenario", scenario_id: "scene1" }
    });
  });

  test("builds agent conversation request", () => {
    expect(buildChatConversationRequest({
      title: "问 Northwind Labs",
      scenarioId: "scene1"
    })).toEqual({
      active_module: "company-brain",
      title: "问 Northwind Labs",
      metadata: { scope_type: "scenario", scenario_id: "scene1" }
    });
  });
});
```

- [ ] **Step 2: Implement chat scope helper**

Create `packages/platform/src/chat.ts`:

```ts
import type { AgentScopeId } from "@ff/contracts";

export type ChatScopeInput = {
  scenarioId?: string;
  knowledgeObjectId?: string;
};

export function normalizeChatScope(input: ChatScopeInput): {
  activeModule: AgentScopeId;
  metadata: Record<string, string>;
} {
  if (input.scenarioId) {
    return { activeModule: "company-brain", metadata: { scope_type: "scenario", scenario_id: input.scenarioId } };
  }
  if (input.knowledgeObjectId) {
    return { activeModule: "company-brain", metadata: { scope_type: "knowledge", knowledge_object_id: input.knowledgeObjectId } };
  }
  return { activeModule: "company-brain", metadata: { scope_type: "global" } };
}

export function buildChatConversationRequest(input: { title?: string; scenarioId?: string; knowledgeObjectId?: string }) {
  const scope = normalizeChatScope(input);
  return {
    active_module: scope.activeModule,
    title: input.title,
    metadata: scope.metadata
  };
}
```

- [ ] **Step 3: Export chat helpers**

Modify `packages/platform/src/index.ts`:

```ts
export { buildChatConversationRequest, normalizeChatScope } from "./chat";
```

- [ ] **Step 4: Add platform chat bootstrap endpoint**

Modify `apps/api/src/routes/platform.ts` imports:

```ts
import { buildChatConversationRequest } from "@ff/platform";
```

Add route:

```ts
platformRouter.post(
  "/platform/chat/conversation-request",
  protectedRoute("创建公司大脑会话请求失败", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({
      agent_request: buildChatConversationRequest({
        title: body.title,
        scenarioId: body.scenario_id,
        knowledgeObjectId: body.knowledge_object_id
      })
    });
  })
);
```

This endpoint does not call Agent Gateway yet. It gives the web frontend a stable platform contract:

1. Frontend asks platform for the agent conversation request.
2. Frontend posts that request to Agent Gateway `/agent/conversations`.
3. Frontend streams messages through Agent Gateway.

- [ ] **Step 5: Run tests**

```bash
bun test packages/platform/src/chat.test.ts
```

Expected:

- 3 tests pass.

- [ ] **Step 6: Commit Task 9**

```bash
git add packages/platform/src/chat.ts packages/platform/src/chat.test.ts packages/platform/src/index.ts apps/api/src/routes/platform.ts
git commit -m "feat: add scenario aware chat scope"
```

---

### Task 10: End-To-End Backend Smoke Path

**Files:**
- Create: `scripts/smoke-platform-scenario.ts`
- Modify: `package.json`

- [ ] **Step 1: Add smoke script**

Create `scripts/smoke-platform-scenario.ts`:

```ts
const API = process.env.API_BASE_URL ?? "http://localhost:3001";

async function json(path: string, input: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...input,
    headers: {
      "content-type": "application/json",
      ...(input.headers ?? {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${input.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function runWorkerOnce() {
  const proc = Bun.spawn(["bun", "--cwd", "apps/api", "worker:once"], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PLATFORM_MODULE_MODE: process.env.PLATFORM_MODULE_MODE ?? "mock"
    }
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  if (exitCode !== 0) {
    throw new Error(`worker:once failed ${exitCode}: ${stderr || stdout}`);
  }
  return JSON.parse(stdout || "{}");
}

async function main() {
  if ((process.env.PLATFORM_MODULE_MODE ?? "mock") !== "mock") {
    console.warn("smoke-platform-scenario is optimized for PLATFORM_MODULE_MODE=mock; real module smoke is optional.");
  }

  const username = `smoke_${Date.now()}`;
  const password = "password-123";
  await json("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
  const login = await json("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  const auth = { authorization: `Bearer ${login.token}` };

  const templates = await json("/platform/templates", { headers: auth });
  if (!templates.templates?.some((item: any) => item.id === "personal-wiki")) {
    throw new Error("personal-wiki template missing");
  }

  const created = await json("/platform/scenarios", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      template_id: "personal-wiki",
      name: "Smoke Wiki",
      visibility: "private",
      uploaded_files: [{ name: "notes.md", type: "text/markdown", size: 12 }],
      business_options: { "整理粒度": "标准" }
    })
  });
  if (created.task.status !== "submitted") throw new Error(`expected submitted task, got ${created.task.status}`);

  const firstWorkerRun = await runWorkerOnce();
  if (firstWorkerRun.taskId !== created.task.id || firstWorkerRun.status !== "processing") {
    throw new Error(`expected first worker run to create bindings, got ${JSON.stringify(firstWorkerRun)}`);
  }

  const secondWorkerRun = await runWorkerOnce();
  if (secondWorkerRun.taskId !== created.task.id || secondWorkerRun.status !== "ready") {
    throw new Error(`expected second worker run to finish task, got ${JSON.stringify(secondWorkerRun)}`);
  }

  const tasks = await json("/platform/tasks", { headers: auth });
  const readyTask = tasks.tasks?.find((item: any) => item.id === created.task.id);
  if (!readyTask) throw new Error("created task missing");
  if (readyTask.status !== "ready") throw new Error(`expected ready task, got ${readyTask.status}`);

  const knowledge = await json("/platform/knowledge", { headers: auth });
  const object = knowledge.objects?.find((item: any) => item.scenario_id === created.scenario.id);
  if (!object) throw new Error("knowledge object missing");
  if (!String(object.module_object_id ?? "").startsWith("mock_")) {
    throw new Error(`expected mock module object id, got ${object.module_object_id}`);
  }

  const chat = await json("/platform/chat/conversation-request", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ title: "问公司大脑", scenario_id: created.scenario.id })
  });
  if (chat.agent_request.active_module !== "company-brain") throw new Error("chat scope not company-brain");

  console.log(JSON.stringify({
    ok: true,
    mode: process.env.PLATFORM_MODULE_MODE ?? "mock",
    scenario_id: created.scenario.id,
    task_id: created.task.id,
    task_status: readyTask.status,
    knowledge_id: object.id,
    module_object_id: object.module_object_id
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Add root script**

Modify root `package.json` scripts:

```json
"smoke:platform": "set -a; [ -f .env ] && . ./.env; set +a; PLATFORM_MODULE_MODE=${PLATFORM_MODULE_MODE:-mock} bun run scripts/smoke-platform-scenario.ts"
```

- [ ] **Step 3: Run local mock-mode services**

Run:

```bash
bun run db:init
PLATFORM_MODULE_MODE=mock bun run dev:api
```

In another shell:

```bash
bun run smoke:platform
```

Expected:

- No Nano Brain, Traditional RAG, GraphRAG, model key, or `RAG_INTERNAL_TOKEN` configuration is required.
- Smoke script prints `{ "ok": true, "mode": "mock", "scenario_id": "...", "task_id": "...", "task_status": "ready", "knowledge_id": "...", "module_object_id": "mock_..." }`.

- [ ] **Step 4: Run bulk delivery data seed**

With the API still running in `PLATFORM_MODULE_MODE=mock`, run:

```bash
bun run demo:data:all
```

Expected:

- `_demo-data/companybrain/manifest.json` is generated.
- The seed script prints `{ "ok": true, "mode": "mock", "created_scenarios": 30, "ready_tasks": 30, "knowledge_objects": ... }`.
- No real RAG module API configuration is required.
- The platform database now contains enough scenario, task, and knowledge records to test every frontstage surface.

- [ ] **Step 5: Commit Task 10**

```bash
git add scripts/smoke-platform-scenario.ts package.json
git commit -m "test: add platform scenario smoke test"
```

---

### Task 11: Docs And Final Verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SERVICE_BOUNDARIES.md`
- Modify: `docs/API.md`

- [ ] **Step 1: Update architecture docs**

In `docs/ARCHITECTURE.md`, add a platform orchestration section:

```md
## Platform Orchestration Layer

`packages/platform` owns product-level metadata:

- official scenario templates
- scenario instances
- upload asset records and local/object-storage keys
- scenario to module source bindings
- processing tasks and task events
- knowledge space projections
- scenario-aware chat scope

It does not own RAG documents, chunks, graph data, embeddings, pages, facts, or module search internals.
Those remain inside Nano Brain, Traditional RAG, and GraphRAG modules.

Upload assets are product records stored by the platform before module ingestion starts. The platform stores file metadata, checksum, storage key, lifecycle state, scenario binding, and archive status. Actual RAG indexing remains owned by the target module after the worker sends content through the adapter facade.

### Mock-Real Module Execution

`packages/platform` supports `PLATFORM_MODULE_MODE=mock | real`.

- `mock` is the default for local product-chain development. It runs the real platform APIs, platform database, task worker, source bindings, knowledge projections, and chat-scope creation, but returns deterministic synthetic module references from the module adapter layer.
- `real` calls Nano Brain, Traditional RAG, and GraphRAG through `packages/gateway` and requires the module HTTP URLs plus `RAG_INTERNAL_TOKEN`.
- Switching modes must not change frontend payloads or platform database contracts.
- `packages/platform/src/module-adapters.test.ts` is the mandatory contract test for this switch. It normalizes mock and real module responses into the same platform reference shape: `moduleId`, `sourceId`, `moduleObjectId`, `objectKind`, and `status`.

### Delivery Demo Data Pack

`packages/platform/src/demo-data.ts` is the canonical delivery data catalog.

- `bun run demo:data:generate` writes `_demo-data/companybrain/` with Markdown, PDF, CSV, TXT, and JSON assets plus a manifest.
- `bun run demo:data:seed` submits the generated scenario requests through the platform API and runs the worker until the records are ready.
- The data pack covers all ten official templates, one pre-create walkthrough per official template, at least 30 scenario instances, at least 120 asset records, and every knowledge output mode.
- User-facing UI should show this as normal sample business data. It should not display fake-data labels such as `mock`, `fixture`, `synthetic`, or `伪造`.
```

- [ ] **Step 2: Update service boundaries**

In `docs/SERVICE_BOUNDARIES.md`, add:

```md
`packages/platform` may call module HTTP APIs through `packages/gateway`.
It must not import module core code and must not connect to module databases.
It stores only business orchestration state and external module object references.

In `PLATFORM_MODULE_MODE=mock`, `packages/platform` still writes real platform records but replaces module HTTP calls with deterministic adapter responses.
In `PLATFORM_MODULE_MODE=real`, the same adapter facade calls `packages/gateway`.

The delivery data pack is generated from `packages/platform/src/demo-data.ts`.
Generated files live under `_demo-data/companybrain/`; seeded upload asset, scenario, task, and knowledge records must still be created through the normal platform HTTP API and worker path.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
bun test packages/platform/src/templates.test.ts packages/platform/src/scenarios.test.ts packages/platform/src/assets.test.ts packages/platform/src/module-adapters.test.ts packages/platform/src/worker.test.ts packages/platform/src/tasks.test.ts packages/platform/src/chat.test.ts
bun --cwd apps/api test || bun test apps/api/src/app.ts
bun test apps/agent-gateway/src/core/conversations.ts apps/agent-gateway/src/agent/prompt.ts apps/agent-gateway/src/agent/stream.ts
```

Expected:

- All package tests pass.
- API and Agent Gateway files load without syntax errors.
- `packages/platform/src/assets.test.ts` confirms upload asset storage keys, archive lifecycle, and scenario binding records.
- `packages/platform/src/module-adapters.test.ts` confirms mock mode is default, real mode can be selected, invalid mode fails, mock source/object references are deterministic, and mock/real responses normalize to the same platform reference shape.

- [ ] **Step 4: Run migration and mock-mode smoke if platform DB env is configured**

Run:

```bash
set -a; [ -f .env ] && . ./.env; set +a; bun run db:init
```

Then with API running:

```bash
PLATFORM_MODULE_MODE=mock bun run dev:api
bun run smoke:platform
bun run demo:data:all
```

Expected:

- DB migration completes.
- Smoke script returns ok with `mode = "mock"`, `task_status = "ready"`, and a `module_object_id` that starts with `mock_`.
- Bulk demo seed returns ok with at least 30 created scenarios, 30 ready tasks, and 30 knowledge objects.

If local Postgres or `PLATFORM_DATABASE_URL` is not configured, report the exact missing env var and do not claim smoke passed. Do not require real module API configuration for this smoke path.

- [ ] **Step 5: Commit docs**

```bash
git add docs/ARCHITECTURE.md docs/SERVICE_BOUNDARIES.md docs/API.md
git commit -m "docs: describe platform orchestration backend"
```

---

## Backend Acceptance Checklist

- [ ] `packages/platform` exists and owns only business orchestration metadata.
- [ ] `PLATFORM_DATABASE_URL` is migrated by `scripts/init-db.ts`.
- [ ] `PLATFORM_MODULE_MODE` supports `mock` and `real`, with `mock` as the default.
- [ ] Ten official scenario templates are registered and seeded.
- [ ] Official scenario templates persist evidence sources, product forms, limitations, evidence level, template state, and demo walkthroughs.
- [ ] Backend tests reject official templates with fewer than two evidence sources or no product form/limitation metadata.
- [ ] Backend tests reject official templates with missing demo sample inputs or citations.
- [ ] Delivery demo data catalog covers all ten official templates.
- [ ] Delivery demo data catalog builds one pre-create walkthrough per official template.
- [ ] Delivery demo data generator creates at least 30 scenarios and 120 asset files across Markdown, PDF, CSV, TXT, and JSON.
- [ ] Delivery demo seed script creates platform scenarios through HTTP APIs, not direct DB writes.
- [ ] Upload asset records persist file metadata, checksum when available, storage key, visibility, lifecycle status, scenario binding, and archive state.
- [ ] `POST /platform/assets` creates durable asset records for local/demo and future object-storage flows.
- [ ] `POST /platform/scenarios` accepts `asset_ids` as well as `uploaded_files`.
- [ ] Asset archive/reprocess actions update platform records and task events instead of trusting client-supplied asset objects.
- [ ] Template IDs map to backend module plans.
- [ ] `POST /platform/scenarios` creates a scenario instance and a processing task.
- [ ] Admin-review templates enter `waiting_review`.
- [ ] No-review templates enter `submitted`.
- [ ] Task transitions support approve, retry, needs input, ready, and failed.
- [ ] Worker can create module sources through mock adapters without real RAG configuration.
- [ ] Worker can ingest initial text through mock adapters and store deterministic module references.
- [ ] In real mode, worker can create module sources through `packages/gateway`.
- [ ] In real mode, worker can ingest initial text into Nano, Traditional, or Graph module APIs.
- [ ] Mock and real adapter responses normalize to the same platform reference shape before worker and knowledge projection code consumes them.
- [ ] Knowledge objects project ready scenarios into Wiki/document/relationship/artifact modes.
- [ ] Agent Gateway supports `active_module = company-brain`.
- [ ] Company brain scope loads all allowed module tools through MCP.
- [ ] Scenario-aware chat request metadata carries `scope_type` and `scenario_id`.
- [ ] Platform APIs never expose backend technical terms as primary labels.
- [ ] Platform code does not import module core code.
- [ ] Platform code does not connect to module databases.
- [ ] Mock-mode smoke test covers auth, template list, scenario creation, worker execution, ready task state, knowledge projection, and chat scope creation.
- [ ] Bulk mock-mode seed proves every template can create at least three ready scenario instances with knowledge projections.
