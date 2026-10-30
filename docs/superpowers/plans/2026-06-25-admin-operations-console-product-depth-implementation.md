# Admin Operations Console And Product Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-side SaaS operations console and product-depth controls so the system exposes meaningful configuration, observability, graph exploration, and quality testing across Nano Brain, Traditional RAG, GraphRAG, and Company Brain without turning the frontend into a technical console.

**Architecture:** Keep frontstage and admin product surfaces separate. Frontstage exposes business-safe controls such as source selection, evidence strictness, output type, sharing, and review requirements. Admin exposes module strategy profiles, ingestion pipeline visibility, retry controls, relationship graph exploration, template governance, and quality test benches through `packages/platform` APIs under `/platform/admin/*`. Mock mode uses the delivery data pack and deterministic graph projections; real mode routes strategy execution to the existing module APIs through `packages/gateway`.

**Tech Stack:** Next.js App Router admin routes, React client components, TypeScript fixture/API adapters, CSS in `apps/web/app/app/app.css`, Hono platform routes, `packages/platform` services, PostgreSQL via `pg`, Bun tests, Playwright layout audit.

---

## Product Depth Contract

1. **No naked entry points.** Any major feature that creates, ingests, retrieves, answers, visualizes, publishes, or embeds knowledge must expose the next layer of meaningful controls, status, or diagnostics. A button that only triggers a canned result is not acceptable.
2. **Default first, advanced second.** Every workflow must have a safe default path and an advanced panel. Defaults keep ordinary users moving; advanced controls prevent the product from feeling like a demo.
3. **Frontstage controls are business-facing.** Frontstage users can choose sources, visibility, output format, audience, evidence strictness, refresh cadence, sharing, and review requirement. They should not configure raw embeddings, database details, or module internals.
4. **Admin controls are operational.** Admins can configure retrieval strategies, indexing profiles, extraction policies, pipeline retry behavior, graph filters, template defaults, quality checks, and publishing gates.
5. **Internal-only settings stay hidden.** Model provider keys, database URLs, embedding dimensions, internal auth tokens, raw workspace IDs, and module implementation names are never product controls.
6. **Every advanced option must show impact.** Controls must explain what changes for answer quality, latency, citations, graph density, admin review, or user permissions.
7. **Mock-real parity applies.** Mock mode must support the same controls and status surfaces with deterministic results. Real mode swaps execution adapters, not product contracts.

## Control Surface Matrix

| Journey Stage | Frontstage User Controls | Admin Controls | Internal Only |
| --- | --- | --- | --- |
| Template discovery | Business goal, department, input type, output type | Enable/disable templates, default module plan, default strategy profile, review policy | Module class names, raw adapter names |
| Scenario creation | Name, description, files, existing sources, visibility, output audience, evidence strictness, refresh cadence | Required fields, accepted file types, quotas, review gates, default task SLA | Database table names, raw source IDs |
| Ingestion pipeline | Progress, current step, required user action, visible source count | Stage timeline, parser profile, extraction profile, retry stage, failure detail, source binding state | Parser temp paths, raw token traces |
| Retrieval/chat | Scope, selected scenario, answer style, citation strictness, save as task | Retrieval profile, allowed modules, recall blend, graph hop policy, confidence gate, evaluation set | API keys, embedding dimensions |
| Knowledge consumption | Wiki, document evidence, relationship graph, artifact archive, export/share | Object health, stale sources, graph density, citation coverage, publish/unpublish | Raw chunk vectors, DB indexes |
| Embed/publish | Channel, display name, allowed audience, escalation rule | Domain allowlist, answer policy, audit sampling, handoff policy | Internal auth headers |

## Retrieval Strategy Matrix

### Traditional RAG

- **Evidence First:** high citation strictness, document evidence prioritized, lower tolerance for unsupported answers.
- **Table Heavy:** table rows and CSV/XLSX-derived records prioritized for operational questions.
- **Contract Review:** clause-level evidence, risk language, missing-clause checks, stricter admin review.
- **Policy Answer:** official documents only, latest-version preference, short employee-facing answers.

Admin-visible controls: keyword weight, dense recall weight, table recall toggle, result limit, source freshness preference, citation strictness, rerank toggle, archived-source exclusion.

### GraphRAG

- **Local Neighborhood:** focused node neighborhood around selected entities.
- **Direct Path:** shortest explainable path between two entities.
- **Global Community:** broader community/cluster summary for domain exploration.
- **Risk Expansion:** expands from a target object through risk event, supplier, contract, and person relations.

Admin-visible controls: max hops, relation type filters, entity type filters, confidence threshold, community depth, stale-edge handling, source evidence requirement, path highlight mode.

### Nano Brain

- **Wiki Navigation:** page and link traversal for compiled knowledge.
- **Fact First:** reviewed facts and trusted pages before free-form notes.
- **Synthesis Page:** creates or updates a topic page from multiple sources.
- **Review Queue:** routes unverified facts to admin review before publishing.

Admin-visible controls: page depth, link traversal depth, public/private source blend, reviewed-fact preference, stale page threshold, fact submission queue policy.

### Company Brain

- **Global Company Answer:** routes across all allowed knowledge.
- **Scenario Bound Answer:** limits answer to one scenario and its bindings.
- **Strict Evidence Answer:** refuses unsupported answers and exposes missing sources.
- **Creative Synthesis:** allows broader synthesis but marks lower-confidence sections.

Admin-visible controls: allowed modules, routing priority, confidence gate, citation policy, fallback behavior, answer length, escalation action.

## Admin Information Architecture

- `/admin`: operations overview with module health, active pipelines, data volume, quality alerts, and quick actions.
- `/admin/templates`: template governance, default strategy profile, review requirement, accepted input policy.
- `/admin/knowledge-bases`: module/source inventory across Nano Brain, Traditional RAG, GraphRAG, and Company Brain bindings.
- `/admin/strategies`: retrieval strategy profile list, detail, clone, edit, test.
- `/admin/pipelines`: ingestion/processing pipeline monitor with stage timeline, event log, retry, and failure triage.
- `/admin/graph`: relationship graph explorer with node/edge filters, path highlight, evidence drawer, and scenario binding.
- `/admin/evaluations`: query test bench for comparing strategy profiles against sample questions.
- `/admin/audit`: admin review, publish/unpublish decisions, and user-impacting configuration history.

## Gap Closure Requirements

1. **Every admin nav item must ship as a route.** `/admin/templates`, `/admin/knowledge-bases`, and `/admin/audit` cannot remain navigation-only entries. Each route needs fixture data, API shape, component, route file, layout audit coverage, and acceptance criteria.
2. **Strategy profiles need lifecycle actions.** A strategy card is not enough. Admins must be able to clone, edit draft fields, activate as default, archive, restore, test, and see an audit trail for each user-impacting change.
3. **Admin access needs a page-level guard.** API authorization remains mandatory, but `/admin/*` pages must also show a clear non-admin state instead of rendering operational controls and failing later.
4. **Graph visualization needs visual QA.** The graph route must pass build checks and a screenshot or pixel-level nonblank check so the relationship graph is visibly rendered, not just structurally present.
5. **Product copy must stay real.** Admin/frontstage UI can use deterministic data in local mode, but visible labels must not say `mock`, `fixture`, `synthetic`, `fake`, `占位`, or `待实现`.
6. **Official templates need evidence governance.** `/admin/templates` must show evidence coverage, product form, known limitations, template state, source count, demo walkthrough readiness, sample scenario, and sample question. Admins can promote `candidate` to `official` only after the evidence and demo gates pass.

---

### Task 0: Scope Guard And Existing Admin Audit

**Files:**
- No source edits.

- [ ] **Step 1: Confirm current admin routes are placeholders**

Run:

```bash
sed -n '1,120p' apps/web/app/admin/page.tsx
sed -n '1,120p' apps/web/app/admin/new/page.tsx
sed -n '1,120p' apps/web/app/admin/diagnostics/page.tsx
```

Expected:

- The files render `Soon`.
- This plan replaces those placeholders instead of layering controls into frontstage pages.

- [ ] **Step 2: Confirm related plans are present**

Run:

```bash
test -f docs/superpowers/plans/2026-06-24-saas-frontstage-implementation.md
test -f docs/superpowers/plans/2026-06-24-backend-scenario-lifecycle-implementation.md
```

Expected:

- Both commands exit 0.

---

### Task 1: Platform Admin Contracts, Strategy Profiles, And Pipeline Types

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/platform/src/types.ts`
- Modify: `packages/platform/src/migrations.ts`
- Create: `packages/platform/src/admin-ops.ts`
- Create: `packages/platform/src/admin-ops.test.ts`
- Modify: `packages/platform/src/index.ts`

- [ ] **Step 1: Write admin ops contract tests**

Create `packages/platform/src/admin-ops.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  ADMIN_OPERATION_AREAS,
  DEFAULT_STRATEGY_PROFILES,
  PIPELINE_STAGE_DEFINITIONS,
  PRODUCT_CONTROL_CLASSIFICATION,
  graphExplorerDefaults,
  strategyProfileById,
  validateStrategyProfile
} from "./admin-ops";

describe("admin operations product depth", () => {
  test("covers all admin operation areas", () => {
    expect(ADMIN_OPERATION_AREAS).toEqual([
      "overview",
      "templates",
      "knowledge_bases",
      "strategies",
      "pipelines",
      "graph",
      "evaluations",
      "audit"
    ]);
  });

  test("ships strategy profiles for all runtime scopes", () => {
    expect(DEFAULT_STRATEGY_PROFILES.map((item) => item.id)).toEqual([
      "traditional-evidence-first",
      "traditional-table-heavy",
      "traditional-contract-review",
      "traditional-policy-answer",
      "graph-local-neighborhood",
      "graph-direct-path",
      "graph-global-community",
      "graph-risk-expansion",
      "nano-wiki-navigation",
      "nano-fact-first",
      "nano-synthesis-page",
      "company-global-answer",
      "company-scenario-bound",
      "company-strict-evidence"
    ]);
  });

  test("validates strategy profile control ranges", () => {
    expect(validateStrategyProfile(strategyProfileById("graph-local-neighborhood")!)).toBe(true);
    expect(() => validateStrategyProfile({
      ...strategyProfileById("graph-local-neighborhood")!,
      controls: { max_hops: 99 }
    })).toThrow("max_hops");
  });

  test("pipeline stages are user-meaningful and admin-actionable", () => {
    expect(PIPELINE_STAGE_DEFINITIONS.map((item) => item.id)).toEqual([
      "received",
      "parse",
      "normalize",
      "index",
      "extract",
      "link",
      "quality",
      "publish"
    ]);
    expect(PIPELINE_STAGE_DEFINITIONS.every((item) => item.userLabel && item.adminAction)).toBe(true);
  });

  test("control classification separates frontend, admin, and internal settings", () => {
    expect(PRODUCT_CONTROL_CLASSIFICATION.frontstage).toContain("evidence_strictness");
    expect(PRODUCT_CONTROL_CLASSIFICATION.admin).toContain("retrieval_strategy_profile");
    expect(PRODUCT_CONTROL_CLASSIFICATION.internal).toContain("provider_api_key");
  });

  test("graph explorer defaults are bounded", () => {
    expect(graphExplorerDefaults.maxHops).toBe(2);
    expect(graphExplorerDefaults.minConfidence).toBe(0.62);
    expect(graphExplorerDefaults.layout).toBe("force");
  });
});
```

- [ ] **Step 2: Add shared contract types**

Append to `packages/contracts/src/index.ts`:

```ts
export type AdminOperationArea =
  | "overview"
  | "templates"
  | "knowledge_bases"
  | "strategies"
  | "pipelines"
  | "graph"
  | "evaluations"
  | "audit";

export type StrategyScope = "traditional-rag" | "graph-rag" | "nano-brain" | "company-brain";

export type PipelineStageId =
  | "received"
  | "parse"
  | "normalize"
  | "index"
  | "extract"
  | "link"
  | "quality"
  | "publish";

export type PipelineStageStatus = "pending" | "running" | "ready" | "warning" | "failed" | "skipped";
```

- [ ] **Step 3: Add platform admin domain types**

Append to `packages/platform/src/types.ts`:

```ts
import type { AdminOperationArea, PipelineStageId, PipelineStageStatus, StrategyScope } from "@ff/contracts";

export type RetrievalStrategyProfile = {
  id: string;
  name: string;
  scope: StrategyScope;
  description: string;
  businessImpact: string;
  controls: Record<string, string | number | boolean | string[]>;
  frontstageSummary: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineStageDefinition = {
  id: PipelineStageId;
  userLabel: string;
  adminLabel: string;
  adminAction: string;
  visibleToUser: boolean;
};

export type PipelineStageRun = {
  id: string;
  taskId: string;
  scenarioId: string;
  stageId: PipelineStageId;
  status: PipelineStageStatus;
  progress: number;
  userMessage: string;
  adminMessage: string;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type GraphExplorerState = {
  scenarioId: string;
  maxHops: number;
  minConfidence: number;
  entityTypes: string[];
  relationTypes: string[];
  layout: "force" | "radial" | "hierarchy";
};

export type AdminOperationSummary = {
  area: AdminOperationArea;
  label: string;
  status: "healthy" | "attention" | "blocked";
  count: number;
};
```

- [ ] **Step 4: Add admin ops constants and validators**

Create `packages/platform/src/admin-ops.ts`:

```ts
import type { AdminOperationArea } from "@ff/contracts";
import type { PipelineStageDefinition, RetrievalStrategyProfile } from "./types";

export const ADMIN_OPERATION_AREAS: AdminOperationArea[] = [
  "overview",
  "templates",
  "knowledge_bases",
  "strategies",
  "pipelines",
  "graph",
  "evaluations",
  "audit"
];

export const PRODUCT_CONTROL_CLASSIFICATION = {
  frontstage: [
    "source_selection",
    "visibility",
    "output_audience",
    "evidence_strictness",
    "refresh_cadence",
    "review_requirement",
    "publish_channel"
  ],
  admin: [
    "retrieval_strategy_profile",
    "indexing_profile",
    "extraction_policy",
    "pipeline_retry_policy",
    "graph_filter_policy",
    "quality_gate",
    "template_governance"
  ],
  internal: [
    "provider_api_key",
    "database_url",
    "embedding_dimensions",
    "internal_token",
    "raw_workspace_id"
  ]
} as const;

export const PIPELINE_STAGE_DEFINITIONS: PipelineStageDefinition[] = [
  stage("received", "已收到资料", "接收资料", "检查上传文件和场景信息"),
  stage("parse", "正在读取资料", "解析资料", "查看解析器输出和失败文件"),
  stage("normalize", "正在整理结构", "标准化", "检查字段、表格和文本规范化结果"),
  stage("index", "正在建立检索来源", "建立索引", "检查文档、表格和页面索引状态"),
  stage("extract", "正在识别关键对象", "抽取对象", "检查实体、事实和关键对象候选"),
  stage("link", "正在建立关系线索", "建立关系", "检查关系边、来源证据和置信度"),
  stage("quality", "正在检查质量", "质量检查", "查看缺失资料、低置信度和引用覆盖"),
  stage("publish", "正在发布结果", "发布结果", "确认知识对象和场景可用状态")
];

export const DEFAULT_STRATEGY_PROFILES: RetrievalStrategyProfile[] = [
  profile("traditional-evidence-first", "证据优先", "traditional-rag", "正式文档优先，回答必须带来源。", { keyword_weight: 0.35, dense_weight: 0.65, result_limit: 8, citation_strictness: "high", table_recall: false }),
  profile("traditional-table-heavy", "表格优先", "traditional-rag", "适合 CSV/XLSX 明细和运营查询。", { keyword_weight: 0.25, dense_weight: 0.45, result_limit: 12, citation_strictness: "medium", table_recall: true }),
  profile("traditional-contract-review", "合同审阅", "traditional-rag", "条款级证据、风险语言和缺失条款检查。", { keyword_weight: 0.45, dense_weight: 0.55, result_limit: 10, citation_strictness: "high", archived_source_exclusion: true }),
  profile("traditional-policy-answer", "制度答复", "traditional-rag", "最新制度优先，给员工短答复。", { keyword_weight: 0.5, dense_weight: 0.5, result_limit: 6, citation_strictness: "high", latest_version_preference: true }),
  profile("graph-local-neighborhood", "局部邻域", "graph-rag", "围绕目标对象展示直接关系。", { max_hops: 2, min_confidence: 0.62, relation_types: ["负责", "关联", "影响"], layout: "force" }),
  profile("graph-direct-path", "直接路径", "graph-rag", "解释两个对象之间的最短关系路径。", { max_hops: 4, min_confidence: 0.68, path_mode: "shortest", layout: "hierarchy" }),
  profile("graph-global-community", "全局社群", "graph-rag", "查看资料集中的主题社群和关键对象。", { max_hops: 3, min_confidence: 0.55, community_depth: 2, layout: "radial" }),
  profile("graph-risk-expansion", "风险扩展", "graph-rag", "沿风险、供应商、合同、人物关系扩展。", { max_hops: 3, min_confidence: 0.7, relation_types: ["供应", "合同", "风险", "任职"], layout: "force" }),
  profile("nano-wiki-navigation", "知识页导航", "nano-brain", "优先页面、链接和主题结构。", { page_depth: 2, link_depth: 2, reviewed_fact_preference: false }),
  profile("nano-fact-first", "事实优先", "nano-brain", "优先已审核事实和可信页面。", { page_depth: 1, link_depth: 1, reviewed_fact_preference: true }),
  profile("nano-synthesis-page", "综述生成", "nano-brain", "从多来源生成主题页。", { page_depth: 3, link_depth: 2, synthesis_mode: true }),
  profile("company-global-answer", "全局公司答复", "company-brain", "跨可用知识范围回答。", { allowed_modules: ["traditional-rag", "graph-rag", "nano-brain"], confidence_gate: 0.55, citation_policy: "balanced" }),
  profile("company-scenario-bound", "场景限定答复", "company-brain", "只使用当前场景绑定来源。", { allowed_modules: ["traditional-rag", "graph-rag", "nano-brain"], confidence_gate: 0.62, citation_policy: "scenario_only" }),
  profile("company-strict-evidence", "严格证据答复", "company-brain", "无依据则拒答或提示缺资料。", { allowed_modules: ["traditional-rag", "graph-rag", "nano-brain"], confidence_gate: 0.78, citation_policy: "strict" })
];

export const graphExplorerDefaults = {
  maxHops: 2,
  minConfidence: 0.62,
  entityTypes: ["客户", "人员", "项目", "合同", "风险"],
  relationTypes: ["负责", "关联", "影响", "供应", "合同"],
  layout: "force" as const
};

export function strategyProfileById(id: string): RetrievalStrategyProfile | undefined {
  return DEFAULT_STRATEGY_PROFILES.find((item) => item.id === id);
}

export function validateStrategyProfile(profile: RetrievalStrategyProfile): true {
  const maxHops = profile.controls.max_hops;
  if (typeof maxHops === "number" && (maxHops < 1 || maxHops > 6)) {
    throw new Error("max_hops must be between 1 and 6");
  }
  const resultLimit = profile.controls.result_limit;
  if (typeof resultLimit === "number" && (resultLimit < 1 || resultLimit > 30)) {
    throw new Error("result_limit must be between 1 and 30");
  }
  const confidence = profile.controls.min_confidence ?? profile.controls.confidence_gate;
  if (typeof confidence === "number" && (confidence < 0 || confidence > 1)) {
    throw new Error("confidence controls must be between 0 and 1");
  }
  return true;
}

function stage(id: PipelineStageDefinition["id"], userLabel: string, adminLabel: string, adminAction: string): PipelineStageDefinition {
  return { id, userLabel, adminLabel, adminAction, visibleToUser: true };
}

function profile(
  id: string,
  name: string,
  scope: RetrievalStrategyProfile["scope"],
  description: string,
  controls: RetrievalStrategyProfile["controls"]
): RetrievalStrategyProfile {
  return {
    id,
    name,
    scope,
    description,
    businessImpact: description,
    controls,
    frontstageSummary: description,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    updatedAt: new Date("2026-06-25T00:00:00.000Z")
  };
}
```

- [ ] **Step 5: Add admin persistence tables**

Append to `migratePlatformDatabase()` in `packages/platform/src/migrations.ts`:

```ts
await pool.query(`
  CREATE TABLE IF NOT EXISTS retrieval_strategy_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('traditional-rag', 'graph-rag', 'nano-brain', 'company-brain')),
    description TEXT NOT NULL,
    business_impact TEXT NOT NULL,
    controls JSONB NOT NULL DEFAULT '{}'::jsonb,
    frontstage_summary TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(controls) = 'object')
  );
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS pipeline_stage_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES processing_tasks(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL CHECK (stage_id IN ('received', 'parse', 'normalize', 'index', 'extract', 'link', 'quality', 'publish')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'ready', 'warning', 'failed', 'skipped')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    user_message TEXT NOT NULL,
    admin_message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(metadata) = 'object')
  );
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS graph_explorer_snapshots (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(nodes) = 'array'),
    CHECK (jsonb_typeof(edges) = 'array'),
    CHECK (jsonb_typeof(filters) = 'object')
  );
`);
```

- [ ] **Step 6: Export admin ops APIs**

Modify `packages/platform/src/index.ts`:

```ts
export {
  ADMIN_OPERATION_AREAS,
  DEFAULT_STRATEGY_PROFILES,
  PIPELINE_STAGE_DEFINITIONS,
  PRODUCT_CONTROL_CLASSIFICATION,
  graphExplorerDefaults,
  strategyProfileById,
  validateStrategyProfile
} from "./admin-ops";
export type {
  AdminOperationSummary,
  GraphExplorerState,
  PipelineStageDefinition,
  PipelineStageRun,
  RetrievalStrategyProfile
} from "./types";
```

- [ ] **Step 7: Run tests**

```bash
bun test packages/platform/src/admin-ops.test.ts
```

Expected:

- 6 tests pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/contracts/src/index.ts packages/platform/src/types.ts packages/platform/src/migrations.ts packages/platform/src/admin-ops.ts packages/platform/src/admin-ops.test.ts packages/platform/src/index.ts
git commit -m "feat: add admin operations contracts"
```

---

### Task 2: Admin Platform APIs For Strategies, Pipelines, Graph, And Evaluation

**Files:**
- Create: `packages/platform/src/admin-services.ts`
- Create: `packages/platform/src/admin-services.test.ts`
- Modify: `packages/platform/src/index.ts`
- Modify: `apps/api/src/routes/platform.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Write admin service tests**

Create `packages/platform/src/admin-services.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildGraphExplorerSnapshot,
  buildPipelineTimeline,
  compareStrategyProfiles,
  summarizeAdminOperations
} from "./admin-services";

describe("admin services pure builders", () => {
  test("builds pipeline timeline with admin and user messages", () => {
    const timeline = buildPipelineTimeline("task1", "scene1");
    expect(timeline).toHaveLength(8);
    expect(timeline[0]).toMatchObject({
      taskId: "task1",
      scenarioId: "scene1",
      stageId: "received",
      status: "ready"
    });
    expect(timeline.every((item) => item.userMessage && item.adminMessage)).toBe(true);
  });

  test("builds graph explorer snapshot with nodes, edges, filters, and evidence", () => {
    const snapshot = buildGraphExplorerSnapshot({
      scenarioId: "scene-renewal",
      title: "Northwind Labs 客户关系线索"
    });
    expect(snapshot.nodes.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.edges.length).toBeGreaterThanOrEqual(9);
    expect(snapshot.nodes.some((node) => node.core)).toBe(true);
  });

  test("compares two strategy profiles for test bench output", () => {
    const result = compareStrategyProfiles({
      question: "Northwind Labs 值不值得续约？",
      profileAId: "company-global-answer",
      profileBId: "company-strict-evidence"
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].score).toBeGreaterThan(0);
    expect(result.recommendation).toContain("证据");
  });

  test("summarizes admin operation areas", () => {
    const summary = summarizeAdminOperations();
    expect(summary.map((item) => item.area)).toContain("pipelines");
    expect(summary.map((item) => item.area)).toContain("graph");
  });
});
```

- [ ] **Step 2: Implement admin services**

Create `packages/platform/src/admin-services.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { AdminOperationSummary, PipelineStageRun } from "./types";
import { ADMIN_OPERATION_AREAS, DEFAULT_STRATEGY_PROFILES, PIPELINE_STAGE_DEFINITIONS, graphExplorerDefaults, strategyProfileById } from "./admin-ops";

export type GraphNode = {
  id: string;
  label: string;
  type: "customer" | "person" | "project" | "contract" | "risk" | "supplier";
  score: number;
  core?: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: number;
  evidence: string;
};

export type StrategyComparison = {
  question: string;
  rows: Array<{ profileId: string; profileName: string; scope: string; score: number; latencyMs: number; evidenceCount: number; answerStyle: string }>;
  recommendation: string;
};

export function buildPipelineTimeline(taskId: string, scenarioId: string): PipelineStageRun[] {
  return PIPELINE_STAGE_DEFINITIONS.map((stage, index) => ({
    id: `stage-${taskId}-${stage.id}`,
    taskId,
    scenarioId,
    stageId: stage.id,
    status: index < 6 ? "ready" : index === 6 ? "warning" : "running",
    progress: index < 6 ? 100 : index === 6 ? 78 : 42,
    userMessage: stage.userLabel,
    adminMessage: `${stage.adminLabel}：${stage.adminAction}`,
    startedAt: new Date("2026-06-25T09:00:00.000Z"),
    finishedAt: index < 6 ? new Date("2026-06-25T09:10:00.000Z") : null,
    createdAt: new Date("2026-06-25T09:00:00.000Z"),
    updatedAt: new Date("2026-06-25T09:10:00.000Z")
  }));
}

export function buildGraphExplorerSnapshot(input: { scenarioId: string; title: string }) {
  const nodes: GraphNode[] = [
    { id: "ff", label: "Northwind Labs", type: "customer", score: 0.94, core: true },
    { id: "zl", label: "张磊", type: "person", score: 0.86 },
    { id: "wh", label: "王皓 CTO", type: "person", score: 0.91 },
    { id: "project-a", label: "A 项目", type: "project", score: 0.83 },
    { id: "contract-main", label: "框架合同 120 万", type: "contract", score: 0.88 },
    { id: "expansion", label: "二期扩容 45 万", type: "project", score: 0.81 },
    { id: "risk-gap", label: "14 天无互动", type: "risk", score: 0.76 },
    { id: "supplier", label: "北辰云服", type: "supplier", score: 0.68 }
  ];
  const edges: GraphEdge[] = [
    edge("ff", "zl", "负责人", 0.86, "客户关系表"),
    edge("ff", "wh", "关键决策人", 0.91, "会议纪要"),
    edge("ff", "project-a", "已上线", 0.83, "项目复盘"),
    edge("ff", "contract-main", "续签中", 0.88, "合同记录"),
    edge("contract-main", "expansion", "绑定增购", 0.81, "销售机会表"),
    edge("ff", "risk-gap", "存在风险", 0.76, "互动时间线"),
    edge("supplier", "project-a", "提供服务", 0.68, "供应商记录"),
    edge("wh", "expansion", "推动", 0.72, "公开信号"),
    edge("zl", "contract-main", "跟进", 0.84, "CRM 记录")
  ];
  return {
    id: randomUUID(),
    scenarioId: input.scenarioId,
    title: input.title,
    nodes,
    edges,
    filters: graphExplorerDefaults
  };
}

export function compareStrategyProfiles(input: { question: string; profileAId: string; profileBId: string }): StrategyComparison {
  const profiles = [strategyProfileById(input.profileAId), strategyProfileById(input.profileBId)].filter(Boolean);
  const rows = profiles.map((profile, index) => ({
    profileId: profile!.id,
    profileName: profile!.name,
    scope: profile!.scope,
    score: index === 0 ? 0.82 : 0.88,
    latencyMs: index === 0 ? 1420 : 1760,
    evidenceCount: index === 0 ? 6 : 9,
    answerStyle: profile!.frontstageSummary
  }));
  return {
    question: input.question,
    rows,
    recommendation: "严格证据策略更适合需要对外发送的答案；全局答复策略更适合内部探索。"
  };
}

export function summarizeAdminOperations(): AdminOperationSummary[] {
  return ADMIN_OPERATION_AREAS.map((area, index) => ({
    area,
    label: labelForArea(area),
    status: index === 4 ? "attention" : "healthy",
    count: area === "strategies" ? DEFAULT_STRATEGY_PROFILES.length : 3 + index
  }));
}

function edge(source: string, target: string, label: string, confidence: number, evidence: string): GraphEdge {
  return { id: `${source}-${target}-${label}`, source, target, label, confidence, evidence };
}

function labelForArea(area: AdminOperationSummary["area"]): string {
  const labels: Record<AdminOperationSummary["area"], string> = {
    overview: "运营概览",
    templates: "模板治理",
    knowledge_bases: "知识库资产",
    strategies: "检索策略",
    pipelines: "处理流程",
    graph: "关系图谱",
    evaluations: "质量测试",
    audit: "审核与审计"
  };
  return labels[area];
}
```

- [ ] **Step 3: Export admin services**

Modify `packages/platform/src/index.ts`:

```ts
export {
  buildGraphExplorerSnapshot,
  buildPipelineTimeline,
  compareStrategyProfiles,
  summarizeAdminOperations,
  type GraphEdge,
  type GraphNode,
  type StrategyComparison
} from "./admin-services";
```

- [ ] **Step 4: Add admin API routes**

Modify `apps/api/src/routes/platform.ts` imports:

```ts
import {
  DEFAULT_STRATEGY_PROFILES,
  buildGraphExplorerSnapshot,
  buildPipelineTimeline,
  compareStrategyProfiles,
  summarizeAdminOperations
} from "@ff/platform";
```

Add routes:

```ts
platformRouter.get(
  "/platform/admin/overview",
  protectedRoute("读取后台运营概览失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ summary: summarizeAdminOperations() });
  })
);

platformRouter.get(
  "/platform/admin/strategies",
  protectedRoute("读取检索策略失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ strategies: DEFAULT_STRATEGY_PROFILES.map(toSnakeObject) });
  })
);

platformRouter.get(
  "/platform/admin/pipelines/:taskId",
  protectedRoute("读取处理流程失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ stages: buildPipelineTimeline(c.req.param("taskId"), c.req.query("scenario_id") ?? "scene-demo").map(toSnakeObject) });
  })
);

platformRouter.get(
  "/platform/admin/graph/:scenarioId",
  protectedRoute("读取关系图谱失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ graph: toSnakeObject(buildGraphExplorerSnapshot({ scenarioId: c.req.param("scenarioId"), title: "关系图谱" })) });
  })
);

platformRouter.post(
  "/platform/admin/evaluations/compare",
  protectedRoute("比较检索策略失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json();
    return c.json({ result: compareStrategyProfiles({
      question: body.question,
      profileAId: body.profile_a_id,
      profileBId: body.profile_b_id
    }) });
  })
);
```

- [ ] **Step 5: Document admin APIs**

Append to `docs/API.md`:

```md
## Platform Admin Operations API

All `/platform/admin/*` endpoints require `is_admin = true`.

- `GET /platform/admin/overview`: operations overview.
- `GET /platform/admin/strategies`: retrieval strategy profiles.
- `GET /platform/admin/pipelines/:taskId?scenario_id=...`: pipeline stage timeline.
- `GET /platform/admin/graph/:scenarioId`: relationship graph snapshot.
- `POST /platform/admin/evaluations/compare`: compare two strategy profiles for a sample question.

Admin APIs expose product-level controls and diagnostics. They do not expose provider keys, database URLs, raw embeddings, or internal module database records.
```

- [ ] **Step 6: Run tests**

```bash
bun test packages/platform/src/admin-services.test.ts packages/platform/src/admin-ops.test.ts
bun --cwd apps/api test || bun test apps/api/src/app.ts
```

Expected:

- Admin service tests pass.
- API loads without syntax errors.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/platform/src/admin-services.ts packages/platform/src/admin-services.test.ts packages/platform/src/index.ts apps/api/src/routes/platform.ts docs/API.md
git commit -m "feat: expose admin operations api"
```

---

### Task 2A: Admin Governance APIs And Strategy Lifecycle Closure

**Files:**
- Create: `packages/platform/src/admin-governance.ts`
- Create: `packages/platform/src/admin-governance.test.ts`
- Modify: `packages/platform/src/index.ts`
- Modify: `apps/api/src/routes/platform.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Write governance service tests**

Create `packages/platform/src/admin-governance.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  applyStrategyLifecycleAction,
  buildAdminTemplateGovernance,
  buildAuditEvents,
  buildKnowledgeBaseInventory
} from "./admin-governance";

describe("admin governance services", () => {
  test("builds data for every governance admin route", () => {
    expect(buildAdminTemplateGovernance()).toHaveLength(5);
    expect(buildKnowledgeBaseInventory().map((item) => item.moduleId)).toEqual([
      "company-brain",
      "traditional-rag",
      "graph-rag",
      "nano-brain"
    ]);
    expect(buildAuditEvents().length).toBeGreaterThanOrEqual(6);
  });

  test("strategy lifecycle action produces a profile and audit event", () => {
    const result = applyStrategyLifecycleAction({
      profileId: "company-strict-evidence",
      action: "activate_default",
      actor: "admin@muyu.ai",
      note: "设为对外答复默认策略"
    });
    expect(result.profile.id).toBe("company-strict-evidence");
    expect(result.profile.isDefault).toBe(true);
    expect(result.event.summary).toContain("设为默认");
  });

  test("clone action creates a draft profile id", () => {
    const result = applyStrategyLifecycleAction({
      profileId: "graph-local-neighborhood",
      action: "clone",
      actor: "admin@muyu.ai",
      note: "为风险分析创建副本"
    });
    expect(result.profile.id).toContain("graph-local-neighborhood-draft");
    expect(result.profile.status).toBe("draft");
  });
});
```

- [ ] **Step 2: Implement governance services**

Create `packages/platform/src/admin-governance.ts`:

```ts
import { randomUUID } from "node:crypto";
import { DEFAULT_STRATEGY_PROFILES, strategyProfileById } from "./admin-ops";

export type AdminTemplateGovernance = {
  id: string;
  name: string;
  owner: string;
  templateState: "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
  evidenceCoverage: number;
  evidenceSources: string[];
  productForms: string[];
  limitations: string[];
  demoReadiness: number;
  demoScenarioName: string;
  sampleQuestion: string;
  defaultStrategyProfileId: string;
  reviewPolicy: "none" | "sample" | "required";
  acceptedInputs: string[];
  publishState: "published" | "reviewing" | "paused";
  impact: string;
};

export type KnowledgeBaseInventoryItem = {
  moduleId: "company-brain" | "traditional-rag" | "graph-rag" | "nano-brain";
  displayName: string;
  sourceCount: number;
  objectCount: number;
  health: "healthy" | "attention" | "blocked";
  staleCount: number;
  lastUpdated: string;
  adminAction: string;
};

export type AdminAuditEvent = {
  id: string;
  actor: string;
  area: "templates" | "knowledge_bases" | "strategies" | "pipelines" | "graph" | "evaluations";
  summary: string;
  impact: string;
  createdAt: string;
};

export type StrategyLifecycleAction = "clone" | "edit_draft" | "activate_default" | "archive" | "restore";

export type StrategyLifecycleResult = {
  profile: {
    id: string;
    name: string;
    scope: string;
    status: "draft" | "active" | "archived";
    isDefault: boolean;
  };
  event: AdminAuditEvent;
};

export function buildAdminTemplateGovernance(): AdminTemplateGovernance[] {
  return [
    template("customer-360", "客户 360 分析", "销售运营", "company-strict-evidence", "required", ["CSV", "CRM 导出", "会议纪要"], "published", "影响销售团队对客户续约和扩容的判断"),
    template("support-agent", "智能客服知识库", "客户成功", "traditional-evidence-first", "sample", ["FAQ", "帮助中心", "工单导出"], "published", "影响嵌入式客服答复质量"),
    template("personal-wiki", "个人知识维基", "个人效率", "nano-wiki-navigation", "none", ["Markdown", "PDF", "网页摘录"], "published", "影响个人和小团队知识沉淀"),
    template("risk-investigation", "风险关系排查", "风控", "graph-risk-expansion", "required", ["合同", "供应商清单", "事件记录"], "reviewing", "影响高风险关系识别"),
    template("policy-assistant", "制度问答助手", "人力行政", "traditional-policy-answer", "sample", ["制度 PDF", "公告", "员工手册"], "paused", "影响员工政策答复")
  ];
}

export function buildKnowledgeBaseInventory(): KnowledgeBaseInventoryItem[] {
  return [
    kb("company-brain", "公司大脑聚合范围", 86, 1240, "healthy", 4, "2026-06-25 10:20", "检查跨场景引用覆盖"),
    kb("traditional-rag", "文档证据库", 52, 846, "healthy", 8, "2026-06-25 10:12", "复核低引用覆盖文档"),
    kb("graph-rag", "关系图谱库", 18, 392, "attention", 17, "2026-06-25 09:48", "确认低置信关系边"),
    kb("nano-brain", "知识页与事实库", 16, 214, "healthy", 3, "2026-06-25 09:30", "处理待发布事实")
  ];
}

export function buildAuditEvents(): AdminAuditEvent[] {
  return [
    audit("admin@muyu.ai", "templates", "发布客户 360 分析模板", "前台可创建客户分析场景"),
    audit("ops@muyu.ai", "strategies", "严格证据答复设为默认", "对外答复会要求更高引用覆盖"),
    audit("ops@muyu.ai", "pipelines", "重试风险关系排查的关系建立阶段", "任务继续处理低置信关系"),
    audit("review@muyu.ai", "graph", "隐藏一条低置信供应商关系", "图谱探索不再展示该关系"),
    audit("qa@muyu.ai", "evaluations", "完成客服策略对比测试", "客服模板继续使用证据优先策略"),
    audit("admin@muyu.ai", "knowledge_bases", "归档 3 个过期制度来源", "制度问答不再引用旧版本")
  ];
}

export function applyStrategyLifecycleAction(input: {
  profileId: string;
  action: StrategyLifecycleAction;
  actor: string;
  note: string;
}): StrategyLifecycleResult {
  const base = strategyProfileById(input.profileId) ?? DEFAULT_STRATEGY_PROFILES[0];
  const cloned = input.action === "clone";
  const archived = input.action === "archive";
  const restored = input.action === "restore";
  const activated = input.action === "activate_default";
  const profile = {
    id: cloned ? `${base.id}-draft-${new Date("2026-06-25T00:00:00.000Z").getTime()}` : base.id,
    name: cloned ? `${base.name} 副本` : base.name,
    scope: base.scope,
    status: archived ? "archived" as const : cloned || input.action === "edit_draft" ? "draft" as const : "active" as const,
    isDefault: activated || restored
  };
  const actionLabel: Record<StrategyLifecycleAction, string> = {
    clone: "复制为草稿",
    edit_draft: "更新草稿",
    activate_default: "设为默认",
    archive: "归档策略",
    restore: "恢复策略"
  };
  return {
    profile,
    event: audit(input.actor, "strategies", `${base.name}${actionLabel[input.action]}`, input.note)
  };
}

function template(
  id: string,
  name: string,
  owner: string,
  defaultStrategyProfileId: string,
  reviewPolicy: AdminTemplateGovernance["reviewPolicy"],
  acceptedInputs: string[],
  publishState: AdminTemplateGovernance["publishState"],
  impact: string
): AdminTemplateGovernance {
  return {
    id,
    name,
    owner,
    templateState: publishState === "published" ? "official" : publishState === "reviewing" ? "candidate" : "paused",
    evidenceCoverage: publishState === "published" ? 100 : publishState === "reviewing" ? 72 : 48,
    evidenceSources: [
      "_research/official-template-best-practice-research.md",
      "https://docs.dify.ai/en/use-dify/knowledge/knowledge-pipeline/create-knowledge-pipeline"
    ],
    productForms: id.includes("support") ? ["embedded_assistant", "chat"] : id.includes("risk") ? ["graph_explorer", "report_generator"] : ["knowledge_portal", "task_workflow"],
    limitations: ["需要按业务资料质量和管理员复核结果决定是否发布。"],
    demoReadiness: publishState === "published" ? 100 : publishState === "reviewing" ? 76 : 45,
    demoScenarioName: id.includes("customer") ? "Northwind Labs 续约简报" : id.includes("support") ? "订单与发票客服代理" : `${name}样例场景`,
    sampleQuestion: id.includes("customer") ? "这个客户当前续约风险和机会是什么？" : "这个模板创建后能回答什么问题？",
    defaultStrategyProfileId,
    reviewPolicy,
    acceptedInputs,
    publishState,
    impact
  };
}

function kb(
  moduleId: KnowledgeBaseInventoryItem["moduleId"],
  displayName: string,
  sourceCount: number,
  objectCount: number,
  health: KnowledgeBaseInventoryItem["health"],
  staleCount: number,
  lastUpdated: string,
  adminAction: string
): KnowledgeBaseInventoryItem {
  return { moduleId, displayName, sourceCount, objectCount, health, staleCount, lastUpdated, adminAction };
}

function audit(actor: string, area: AdminAuditEvent["area"], summary: string, impact: string): AdminAuditEvent {
  return {
    id: randomUUID(),
    actor,
    area,
    summary,
    impact,
    createdAt: "2026-06-25T10:30:00.000Z"
  };
}
```

- [ ] **Step 3: Export governance services**

Modify `packages/platform/src/index.ts`:

```ts
export {
  applyStrategyLifecycleAction,
  buildAdminTemplateGovernance,
  buildAuditEvents,
  buildKnowledgeBaseInventory,
  type AdminAuditEvent,
  type AdminTemplateGovernance,
  type KnowledgeBaseInventoryItem,
  type StrategyLifecycleAction,
  type StrategyLifecycleResult
} from "./admin-governance";
```

- [ ] **Step 4: Add governance API routes**

Modify `apps/api/src/routes/platform.ts` imports:

```ts
import {
  applyStrategyLifecycleAction,
  buildAdminTemplateGovernance,
  buildAuditEvents,
  buildKnowledgeBaseInventory
} from "@ff/platform";
```

Add routes:

```ts
platformRouter.get(
  "/platform/admin/templates",
  protectedRoute("读取模板治理失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ templates: buildAdminTemplateGovernance().map(toSnakeObject) });
  })
);

platformRouter.get(
  "/platform/admin/knowledge-bases",
  protectedRoute("读取知识库资产失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ knowledge_bases: buildKnowledgeBaseInventory().map(toSnakeObject) });
  })
);

platformRouter.get(
  "/platform/admin/audit",
  protectedRoute("读取审计记录失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    return c.json({ events: buildAuditEvents().map(toSnakeObject) });
  })
);

platformRouter.post(
  "/platform/admin/strategies/:profileId/actions",
  protectedRoute("更新检索策略失败", async (c, user) => {
    if (!user.isAdmin) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json();
    const result = applyStrategyLifecycleAction({
      profileId: c.req.param("profileId"),
      action: body.action,
      actor: user.username,
      note: body.note ?? "管理员更新检索策略"
    });
    return c.json(toSnakeObject(result));
  })
);
```

- [ ] **Step 5: Document governance APIs**

Append to the `Platform Admin Operations API` section in `docs/API.md`:

```md
- `GET /platform/admin/templates`: template governance records with owner, publish state, accepted inputs, default strategy, and review policy.
- `GET /platform/admin/knowledge-bases`: knowledge inventory grouped by Company Brain, Traditional RAG, GraphRAG, and Nano Brain.
- `GET /platform/admin/audit`: user-impacting admin configuration and review history.
- `POST /platform/admin/strategies/:profileId/actions`: clone, edit draft, activate default, archive, or restore a strategy profile.
```

- [ ] **Step 6: Run governance tests**

```bash
bun test packages/platform/src/admin-governance.test.ts packages/platform/src/admin-services.test.ts
bun --cwd apps/api test || bun test apps/api/src/app.ts
```

Expected:

- Governance service tests pass.
- Admin API route module loads without syntax errors.

- [ ] **Step 7: Commit Task 2A**

```bash
git add packages/platform/src/admin-governance.ts packages/platform/src/admin-governance.test.ts packages/platform/src/index.ts apps/api/src/routes/platform.ts docs/API.md
git commit -m "feat: add admin governance APIs"
```

---

### Task 3: Admin Frontend Domain Fixtures And API Adapter

**Files:**
- Create: `apps/web/lib/fixtures/admin-ops.ts`
- Create: `apps/web/lib/fixtures/admin-ops.test.ts`
- Create: `apps/web/lib/admin-api.ts`

- [ ] **Step 1: Write admin frontend fixture tests**

Create `apps/web/lib/fixtures/admin-ops.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  adminNav,
  adminOperationSummary,
  graphSnapshot,
  pipelineTimeline,
  strategyProfiles,
  visibleAdminText
} from "./admin-ops";

describe("admin operations frontend data", () => {
  test("has complete admin navigation", () => {
    expect(adminNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/templates",
      "/admin/knowledge-bases",
      "/admin/strategies",
      "/admin/pipelines",
      "/admin/graph",
      "/admin/evaluations",
      "/admin/audit"
    ]);
  });

  test("contains strategy profiles for every knowledge mode", () => {
    expect(strategyProfiles.some((item) => item.scope === "traditional-rag")).toBe(true);
    expect(strategyProfiles.some((item) => item.scope === "graph-rag")).toBe(true);
    expect(strategyProfiles.some((item) => item.scope === "nano-brain")).toBe(true);
    expect(strategyProfiles.some((item) => item.scope === "company-brain")).toBe(true);
  });

  test("pipeline timeline exposes operational details", () => {
    expect(pipelineTimeline.map((item) => item.stageId)).toContain("extract");
    expect(pipelineTimeline.map((item) => item.stageId)).toContain("link");
    expect(pipelineTimeline.every((item) => item.userMessage && item.adminMessage)).toBe(true);
  });

  test("graph snapshot is rich enough for a visual explorer", () => {
    expect(graphSnapshot.nodes.length).toBeGreaterThanOrEqual(8);
    expect(graphSnapshot.edges.length).toBeGreaterThanOrEqual(9);
    expect(graphSnapshot.edges.every((edge) => edge.evidence)).toBe(true);
  });

  test("visible admin text avoids placeholder copy", () => {
    expect(visibleAdminText()).not.toMatch(/Soon|coming soon|占位|待实现/i);
  });

  test("operation summary includes attention state", () => {
    expect(adminOperationSummary.map((item) => item.status)).toContain("attention");
  });
});
```

- [ ] **Step 2: Implement admin fixtures**

Create `apps/web/lib/fixtures/admin-ops.ts`:

```ts
export type AdminNavItem = { label: string; href: string };
export type AdminStatus = "healthy" | "attention" | "blocked";

export const adminNav: AdminNavItem[] = [
  { label: "运营概览", href: "/admin" },
  { label: "模板治理", href: "/admin/templates" },
  { label: "知识库资产", href: "/admin/knowledge-bases" },
  { label: "检索策略", href: "/admin/strategies" },
  { label: "处理流程", href: "/admin/pipelines" },
  { label: "关系图谱", href: "/admin/graph" },
  { label: "质量测试", href: "/admin/evaluations" },
  { label: "审核与审计", href: "/admin/audit" }
];

export const strategyProfiles = [
  { id: "traditional-evidence-first", name: "证据优先", scope: "traditional-rag", impact: "回答更稳，引用更多，速度中等", controls: ["引用严格", "正式文档优先", "结果 8 条"] },
  { id: "traditional-table-heavy", name: "表格优先", scope: "traditional-rag", impact: "适合运营表格和问卷明细", controls: ["表格召回", "结果 12 条", "中等引用"] },
  { id: "graph-local-neighborhood", name: "局部邻域", scope: "graph-rag", impact: "适合客户、项目、合同关系探索", controls: ["2 跳关系", "置信度 0.62", "关系过滤"] },
  { id: "graph-direct-path", name: "直接路径", scope: "graph-rag", impact: "适合解释两个对象之间的关系", controls: ["最短路径", "4 跳以内", "路径高亮"] },
  { id: "nano-wiki-navigation", name: "知识页导航", scope: "nano-brain", impact: "适合页面阅读和主题沉淀", controls: ["页面深度 2", "链接深度 2", "主题结构"] },
  { id: "nano-fact-first", name: "事实优先", scope: "nano-brain", impact: "适合需要审核事实的团队知识", controls: ["已审核事实优先", "公共来源限制", "低噪音"] },
  { id: "company-global-answer", name: "全局公司答复", scope: "company-brain", impact: "适合开放式探索", controls: ["跨来源", "均衡引用", "中等门槛"] },
  { id: "company-strict-evidence", name: "严格证据答复", scope: "company-brain", impact: "适合对外发送和高风险问题", controls: ["高置信门槛", "无依据拒答", "引用优先"] }
];

export const pipelineTimeline = [
  { stageId: "received", label: "接收资料", status: "ready", progress: 100, userMessage: "已收到资料", adminMessage: "文件数量、格式和场景字段完整" },
  { stageId: "parse", label: "解析资料", status: "ready", progress: 100, userMessage: "已读取资料", adminMessage: "PDF、CSV、Markdown 已完成文本抽取" },
  { stageId: "normalize", label: "标准化", status: "ready", progress: 100, userMessage: "已整理结构", adminMessage: "表格字段和文档段落已规范化" },
  { stageId: "index", label: "建立索引", status: "ready", progress: 100, userMessage: "已建立检索来源", adminMessage: "文档和表格来源已绑定到场景" },
  { stageId: "extract", label: "抽取对象", status: "warning", progress: 78, userMessage: "部分对象需要确认", adminMessage: "2 个客户对象缺少行业字段" },
  { stageId: "link", label: "建立关系", status: "running", progress: 62, userMessage: "正在建立关系线索", adminMessage: "正在生成客户、联系人、合同和项目关系" },
  { stageId: "quality", label: "质量检查", status: "pending", progress: 0, userMessage: "等待质量检查", adminMessage: "将检查引用覆盖和低置信对象" },
  { stageId: "publish", label: "发布结果", status: "pending", progress: 0, userMessage: "等待发布", adminMessage: "将发布知识对象到前台知识空间" }
];

export const graphSnapshot = {
  nodes: [
    { id: "ff", label: "Northwind Labs", type: "客户", score: 0.94, core: true, x: 320, y: 220 },
    { id: "zl", label: "张磊", type: "人员", score: 0.86, x: 160, y: 120 },
    { id: "wh", label: "王皓 CTO", type: "人员", score: 0.91, x: 480, y: 130 },
    { id: "project-a", label: "A 项目", type: "项目", score: 0.83, x: 170, y: 320 },
    { id: "contract-main", label: "框架合同 120 万", type: "合同", score: 0.88, x: 480, y: 330 },
    { id: "expansion", label: "二期扩容 45 万", type: "项目", score: 0.81, x: 330, y: 420 },
    { id: "risk-gap", label: "14 天无互动", type: "风险", score: 0.76, x: 610, y: 260 },
    { id: "supplier", label: "北辰云服", type: "供应商", score: 0.68, x: 70, y: 240 }
  ],
  edges: [
    { source: "ff", target: "zl", label: "负责人", confidence: 0.86, evidence: "客户关系表" },
    { source: "ff", target: "wh", label: "关键决策人", confidence: 0.91, evidence: "会议纪要" },
    { source: "ff", target: "project-a", label: "已上线", confidence: 0.83, evidence: "项目复盘" },
    { source: "ff", target: "contract-main", label: "续签中", confidence: 0.88, evidence: "合同记录" },
    { source: "contract-main", target: "expansion", label: "绑定增购", confidence: 0.81, evidence: "销售机会表" },
    { source: "ff", target: "risk-gap", label: "存在风险", confidence: 0.76, evidence: "互动时间线" },
    { source: "supplier", target: "project-a", label: "提供服务", confidence: 0.68, evidence: "供应商记录" },
    { source: "wh", target: "expansion", label: "推动", confidence: 0.72, evidence: "公开信号" },
    { source: "zl", target: "contract-main", label: "跟进", confidence: 0.84, evidence: "CRM 记录" }
  ]
};

export const adminOperationSummary = [
  { area: "templates", label: "模板治理", status: "healthy" as AdminStatus, count: 10 },
  { area: "strategies", label: "检索策略", status: "healthy" as AdminStatus, count: strategyProfiles.length },
  { area: "pipelines", label: "处理流程", status: "attention" as AdminStatus, count: 6 },
  { area: "graph", label: "关系图谱", status: "healthy" as AdminStatus, count: graphSnapshot.nodes.length },
  { area: "evaluations", label: "质量测试", status: "attention" as AdminStatus, count: 4 }
];

export function visibleAdminText(): string {
  return JSON.stringify({ adminNav, strategyProfiles, pipelineTimeline, graphSnapshot, adminOperationSummary });
}
```

- [ ] **Step 3: Add admin API adapter**

Create `apps/web/lib/admin-api.ts`:

```ts
const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Admin API failed ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}

export const adminApi = {
  overview: () => request<{ summary: unknown[] }>("/platform/admin/overview"),
  strategies: () => request<{ strategies: unknown[] }>("/platform/admin/strategies"),
  pipeline: (taskId: string, scenarioId: string) =>
    request<{ stages: unknown[] }>(`/platform/admin/pipelines/${taskId}?scenario_id=${encodeURIComponent(scenarioId)}`),
  graph: (scenarioId: string) => request<{ graph: unknown }>(`/platform/admin/graph/${scenarioId}`),
  compareStrategies: (input: { question: string; profileAId: string; profileBId: string }) =>
    request<{ result: unknown }>("/platform/admin/evaluations/compare", {
      method: "POST",
      body: JSON.stringify({
        question: input.question,
        profile_a_id: input.profileAId,
        profile_b_id: input.profileBId
      })
    })
};
```

- [ ] **Step 4: Run tests**

```bash
bun test apps/web/lib/fixtures/admin-ops.test.ts
```

Expected:

- 6 tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/web/lib/fixtures/admin-ops.ts apps/web/lib/fixtures/admin-ops.test.ts apps/web/lib/admin-api.ts
git commit -m "feat: define admin operations fixtures"
```

---

### Task 3A: Admin Governance Frontend Fixtures And API Adapter

**Files:**
- Create: `apps/web/lib/fixtures/admin-governance.ts`
- Create: `apps/web/lib/fixtures/admin-governance.test.ts`
- Modify: `apps/web/lib/admin-api.ts`

- [ ] **Step 1: Write frontend governance fixture tests**

Create `apps/web/lib/fixtures/admin-governance.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  adminAuditEvents,
  adminTemplates,
  adminVisibleGovernanceText,
  knowledgeBaseInventory,
  strategyLifecycleActions
} from "./admin-governance";

describe("admin governance frontend fixtures", () => {
  test("supports every governance admin page", () => {
    expect(adminTemplates.length).toBeGreaterThanOrEqual(5);
    expect(knowledgeBaseInventory.map((item) => item.moduleId)).toEqual([
      "company-brain",
      "traditional-rag",
      "graph-rag",
      "nano-brain"
    ]);
    expect(adminAuditEvents.length).toBeGreaterThanOrEqual(6);
  });

    test("strategy actions cover lifecycle management", () => {
    expect(strategyLifecycleActions.map((item) => item.action)).toEqual([
      "clone",
      "edit_draft",
      "activate_default",
      "archive",
      "restore"
    ]);
    });

    test("template governance exposes evidence gate fields", () => {
      expect(adminTemplates.every((item) => item.evidenceCoverage >= 50)).toBe(true);
      expect(adminTemplates.every((item) => item.productForms.length > 0)).toBe(true);
      expect(adminTemplates.every((item) => item.limitations.length > 0)).toBe(true);
      expect(adminTemplates.every((item) => item.demoReadiness >= 50)).toBe(true);
      expect(adminTemplates.every((item) => item.demoScenarioName.length > 0)).toBe(true);
      expect(adminTemplates.every((item) => item.sampleQuestion.length > 0)).toBe(true);
    });

    test("visible governance copy avoids local-data language", () => {
    expect(adminVisibleGovernanceText()).not.toMatch(/mock|fixture|synthetic|fake|占位|待实现/i);
  });
});
```

- [ ] **Step 2: Implement governance fixtures**

Create `apps/web/lib/fixtures/admin-governance.ts`:

```ts
export const adminTemplates = [
  { id: "customer-360", name: "客户 360 分析", owner: "销售运营", defaultStrategy: "严格证据答复", reviewPolicy: "必须复核", inputs: ["CSV", "CRM 导出", "会议纪要"], state: "已发布", evidenceCoverage: 100, demoReadiness: 100, demoScenarioName: "Northwind Labs 续约简报", sampleQuestion: "这个客户当前续约风险和机会是什么？", productForms: ["报告生成", "关系图谱"], limitations: ["依赖 CRM 和会议记录新鲜度"], impact: "用于续约、扩容和客户风险判断" },
  { id: "support-agent", name: "智能客服知识库", owner: "客户成功", defaultStrategy: "证据优先", reviewPolicy: "抽样复核", inputs: ["FAQ", "帮助中心", "工单导出"], state: "已发布", evidenceCoverage: 100, demoReadiness: 100, demoScenarioName: "订单与发票客服代理", sampleQuestion: "客户说订单延迟三天，应该怎么回复？", productForms: ["嵌入式助手", "客服问答"], limitations: ["上线前必须测试拒答和转人工"], impact: "用于嵌入式客服答复" },
  { id: "personal-wiki", name: "个人知识维基", owner: "个人效率", defaultStrategy: "知识页导航", reviewPolicy: "无需复核", inputs: ["Markdown", "PDF", "网页摘录"], state: "已发布", evidenceCoverage: 86, demoReadiness: 88, demoScenarioName: "张磊销售笔记知识 Wiki", sampleQuestion: "这批笔记里最常见的客户异议是什么？", productForms: ["知识门户", "问答"], limitations: ["不适合直接生成正式对外文件"], impact: "用于个人和小团队知识沉淀" },
  { id: "risk-investigation", name: "风险关系排查", owner: "风控", defaultStrategy: "风险扩展", reviewPolicy: "必须复核", inputs: ["合同", "供应商清单", "事件记录"], state: "审核中", evidenceCoverage: 72, demoReadiness: 76, demoScenarioName: "云启网络关系风险尽调", sampleQuestion: "这家供应商有哪些关联风险？", productForms: ["关系图谱", "尽调报告"], limitations: ["低置信关系不能直接作为结论"], impact: "用于高风险关系识别" },
  { id: "policy-assistant", name: "制度问答助手", owner: "人力行政", defaultStrategy: "制度答复", reviewPolicy: "抽样复核", inputs: ["制度 PDF", "公告", "员工手册"], state: "暂停", evidenceCoverage: 58, demoReadiness: 60, demoScenarioName: "差旅报销制度问答", sampleQuestion: "一线城市住宿报销标准是多少？", productForms: ["知识门户", "员工问答"], limitations: ["需要明确制度版本和解释口径"], impact: "用于员工制度问答" }
];

export const knowledgeBaseInventory = [
  { moduleId: "company-brain", name: "公司大脑聚合范围", sources: 86, objects: 1240, health: "正常", stale: 4, lastUpdated: "2026-06-25 10:20", action: "检查跨场景引用覆盖" },
  { moduleId: "traditional-rag", name: "文档证据库", sources: 52, objects: 846, health: "正常", stale: 8, lastUpdated: "2026-06-25 10:12", action: "复核低引用覆盖文档" },
  { moduleId: "graph-rag", name: "关系图谱库", sources: 18, objects: 392, health: "需关注", stale: 17, lastUpdated: "2026-06-25 09:48", action: "确认低置信关系边" },
  { moduleId: "nano-brain", name: "知识页与事实库", sources: 16, objects: 214, health: "正常", stale: 3, lastUpdated: "2026-06-25 09:30", action: "处理待发布事实" }
];

export const adminAuditEvents = [
  { id: "audit-1", actor: "admin@muyu.ai", area: "模板治理", summary: "发布客户 360 分析模板", impact: "前台可创建客户分析场景", time: "2026-06-25 10:30" },
  { id: "audit-2", actor: "ops@muyu.ai", area: "检索策略", summary: "严格证据答复设为默认", impact: "对外答复会要求更高引用覆盖", time: "2026-06-25 10:18" },
  { id: "audit-3", actor: "ops@muyu.ai", area: "处理流程", summary: "重试风险关系排查的关系建立阶段", impact: "任务继续处理低置信关系", time: "2026-06-25 09:55" },
  { id: "audit-4", actor: "review@muyu.ai", area: "关系图谱", summary: "隐藏一条低置信供应商关系", impact: "图谱探索不再展示该关系", time: "2026-06-25 09:42" },
  { id: "audit-5", actor: "qa@muyu.ai", area: "质量测试", summary: "完成客服策略对比测试", impact: "客服模板继续使用证据优先策略", time: "2026-06-25 09:20" },
  { id: "audit-6", actor: "admin@muyu.ai", area: "知识资产", summary: "归档 3 个过期制度来源", impact: "制度问答不再引用旧版本", time: "2026-06-25 08:58" }
];

export const strategyLifecycleActions = [
  { action: "clone", label: "复制为新策略", impact: "保留原策略，生成可编辑草稿" },
  { action: "edit_draft", label: "编辑草稿", impact: "修改参数但不影响当前线上模板" },
  { action: "activate_default", label: "设为默认", impact: "新建场景将默认使用该策略" },
  { action: "archive", label: "归档策略", impact: "不再允许新模板选择该策略" },
  { action: "restore", label: "恢复策略", impact: "重新进入可配置策略列表" }
];

export function adminVisibleGovernanceText() {
  return JSON.stringify({ adminTemplates, knowledgeBaseInventory, adminAuditEvents, strategyLifecycleActions });
}
```

- [ ] **Step 3: Extend admin API adapter**

Modify `apps/web/lib/admin-api.ts`:

```ts
export const adminApi = {
  overview: () => request<{ summary: unknown[] }>("/platform/admin/overview"),
  templates: () => request<{ templates: unknown[] }>("/platform/admin/templates"),
  knowledgeBases: () => request<{ knowledge_bases: unknown[] }>("/platform/admin/knowledge-bases"),
  strategies: () => request<{ strategies: unknown[] }>("/platform/admin/strategies"),
  strategyAction: (profileId: string, input: { action: string; note: string }) =>
    request<{ profile: unknown; event: unknown }>(`/platform/admin/strategies/${profileId}/actions`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  pipeline: (taskId: string, scenarioId: string) =>
    request<{ stages: unknown[] }>(`/platform/admin/pipelines/${taskId}?scenario_id=${encodeURIComponent(scenarioId)}`),
  graph: (scenarioId: string) => request<{ graph: unknown }>(`/platform/admin/graph/${scenarioId}`),
  audit: () => request<{ events: unknown[] }>("/platform/admin/audit"),
  compareStrategies: (input: { question: string; profileAId: string; profileBId: string }) =>
    request<{ result: unknown }>("/platform/admin/evaluations/compare", {
      method: "POST",
      body: JSON.stringify({
        question: input.question,
        profile_a_id: input.profileAId,
        profile_b_id: input.profileBId
      })
    })
};
```

- [ ] **Step 4: Run tests**

```bash
bun test apps/web/lib/fixtures/admin-governance.test.ts apps/web/lib/fixtures/admin-ops.test.ts
```

Expected:

- Governance fixture tests pass.
- Existing admin operations fixture tests continue to pass.

- [ ] **Step 5: Commit Task 3A**

```bash
git add apps/web/lib/fixtures/admin-governance.ts apps/web/lib/fixtures/admin-governance.test.ts apps/web/lib/admin-api.ts
git commit -m "feat: define admin governance fixtures"
```

---

### Task 4: Admin Console Shell, Overview, Strategies, And Pipelines

**Files:**
- Create: `apps/web/components/admin/admin-shell.tsx`
- Create: `apps/web/components/admin/admin-overview.tsx`
- Create: `apps/web/components/admin/admin-strategies.tsx`
- Create: `apps/web/components/admin/admin-pipelines.tsx`
- Modify: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/strategies/page.tsx`
- Create: `apps/web/app/admin/pipelines/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create admin shell**

Create `apps/web/components/admin/admin-shell.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { adminNav } from "../../lib/fixtures/admin-ops";

export function AdminShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  return (
    <main className="admin-console">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">CompanyBrain Admin</Link>
        <nav>
          {adminNav.map((item) => (
            <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>后台运营控制台</span>
            <h1>{title}</h1>
          </div>
          <Link href="/app">返回前台</Link>
        </header>
        {children}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create overview page component**

Create `apps/web/components/admin/admin-overview.tsx`:

```tsx
import Link from "next/link";
import { adminOperationSummary, pipelineTimeline, strategyProfiles } from "../../lib/fixtures/admin-ops";
import { AdminShell } from "./admin-shell";

export function AdminOverviewPage() {
  return (
    <AdminShell active="/admin" title="运营概览">
      <section className="admin-summary-grid">
        {adminOperationSummary.map((item) => (
          <Link key={item.area} href={`/admin/${item.area === "templates" ? "templates" : item.area}`} className={`admin-summary ${item.status}`}>
            <span>{item.label}</span>
            <b>{item.count}</b>
            <em>{item.status === "attention" ? "需要关注" : "运行正常"}</em>
          </Link>
        ))}
      </section>
      <section className="admin-two-col">
        <article className="admin-panel">
          <h2>活跃处理流程</h2>
          {pipelineTimeline.slice(0, 5).map((stage) => (
            <div key={stage.stageId} className={`admin-stage-row ${stage.status}`}>
              <span>{stage.label}</span>
              <b>{stage.progress}%</b>
              <p>{stage.adminMessage}</p>
            </div>
          ))}
        </article>
        <article className="admin-panel">
          <h2>默认策略</h2>
          {strategyProfiles.slice(0, 6).map((profile) => (
            <div key={profile.id} className="admin-strategy-mini">
              <b>{profile.name}</b>
              <span>{profile.impact}</span>
            </div>
          ))}
        </article>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Create strategies page component**

Create `apps/web/components/admin/admin-strategies.tsx`:

```tsx
"use client";

import { useState } from "react";
import { strategyProfiles } from "../../lib/fixtures/admin-ops";
import { AdminShell } from "./admin-shell";

export function AdminStrategiesPage() {
  const [scope, setScope] = useState("全部");
  const visible = strategyProfiles.filter((item) => scope === "全部" || item.scope === scope);
  return (
    <AdminShell active="/admin/strategies" title="检索策略">
      <section className="admin-toolbar">
        <select value={scope} onChange={(event) => setScope(event.target.value)}>
          <option>全部</option>
          <option value="traditional-rag">文档证据</option>
          <option value="graph-rag">关系图谱</option>
          <option value="nano-brain">知识沉淀</option>
          <option value="company-brain">公司大脑</option>
        </select>
        <button type="button">复制为新策略</button>
      </section>
      <section className="admin-strategy-grid">
        {visible.map((profile) => (
          <article key={profile.id} className="admin-strategy-card">
            <span>{scopeLabel(profile.scope)}</span>
            <h2>{profile.name}</h2>
            <p>{profile.impact}</p>
            <div>
              {profile.controls.map((control) => <em key={control}>{control}</em>)}
            </div>
            <footer>
              <button type="button">测试策略</button>
              <button type="button">设为模板默认</button>
            </footer>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

function scopeLabel(scope: string) {
  const labels: Record<string, string> = {
    "traditional-rag": "文档证据",
    "graph-rag": "关系图谱",
    "nano-brain": "知识沉淀",
    "company-brain": "公司大脑"
  };
  return labels[scope] ?? scope;
}
```

- [ ] **Step 4: Create pipelines page component**

Create `apps/web/components/admin/admin-pipelines.tsx`:

```tsx
import { pipelineTimeline } from "../../lib/fixtures/admin-ops";
import { AdminShell } from "./admin-shell";

export function AdminPipelinesPage() {
  return (
    <AdminShell active="/admin/pipelines" title="处理流程">
      <section className="admin-pipeline-board">
        {pipelineTimeline.map((stage, index) => (
          <article key={stage.stageId} className={`admin-pipeline-stage ${stage.status}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{stage.label}</h2>
            <p>{stage.adminMessage}</p>
            <div><i style={{ width: `${stage.progress}%` }} /></div>
            <footer>
              <b>{stage.progress}%</b>
              <button type="button">{stage.status === "warning" ? "查看问题" : "查看日志"}</button>
            </footer>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 5: Wire admin routes**

Modify `apps/web/app/admin/page.tsx`:

```tsx
import { AdminOverviewPage } from "../../components/admin/admin-overview";

export default function AdminHome() {
  return <AdminOverviewPage />;
}
```

Create `apps/web/app/admin/strategies/page.tsx`:

```tsx
import { AdminStrategiesPage } from "../../../components/admin/admin-strategies";

export default function Page() {
  return <AdminStrategiesPage />;
}
```

Create `apps/web/app/admin/pipelines/page.tsx`:

```tsx
import { AdminPipelinesPage } from "../../../components/admin/admin-pipelines";

export default function Page() {
  return <AdminPipelinesPage />;
}
```

- [ ] **Step 6: Add admin console CSS**

Append to `apps/web/app/app/app.css`:

```css
.admin-console {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  background: #f7f5ef;
  color: #23201b;
}
.admin-sidebar {
  border-right: 1px solid rgba(35, 32, 27, .1);
  padding: 22px;
  background: #fffdf8;
}
.admin-brand {
  display: block;
  font-weight: 760;
  color: inherit;
  text-decoration: none;
  margin-bottom: 24px;
}
.admin-sidebar nav {
  display: grid;
  gap: 6px;
}
.admin-sidebar nav a {
  text-decoration: none;
  color: #5d574d;
  padding: 10px 12px;
  border-radius: 8px;
}
.admin-sidebar nav a.active,
.admin-sidebar nav a:hover {
  background: #efe8db;
  color: #1f1c18;
}
.admin-main {
  padding: 28px;
}
.admin-topbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  margin-bottom: 24px;
}
.admin-topbar span {
  font-size: 12px;
  color: #7a7164;
}
.admin-topbar h1 {
  margin: 4px 0 0;
  font-size: 28px;
}
.admin-summary-grid,
.admin-strategy-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.admin-summary,
.admin-panel,
.admin-strategy-card,
.admin-pipeline-stage {
  background: #fffdfa;
  border: 1px solid rgba(35, 32, 27, .1);
  border-radius: 8px;
  padding: 16px;
  text-decoration: none;
  color: inherit;
}
.admin-summary b {
  display: block;
  font-size: 30px;
  margin: 8px 0;
}
.admin-summary.attention {
  border-color: rgba(172, 102, 32, .35);
  background: #fff8ec;
}
.admin-two-col {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr);
  gap: 14px;
  margin-top: 14px;
}
.admin-stage-row,
.admin-strategy-mini {
  padding: 10px 0;
  border-top: 1px solid rgba(35, 32, 27, .08);
}
.admin-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.admin-toolbar select,
.admin-toolbar button,
.admin-strategy-card button,
.admin-pipeline-stage button {
  border: 1px solid rgba(35, 32, 27, .14);
  background: #fffdfa;
  border-radius: 7px;
  padding: 8px 10px;
}
.admin-strategy-card h2,
.admin-pipeline-stage h2 {
  margin: 8px 0;
  font-size: 17px;
}
.admin-strategy-card div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
.admin-strategy-card em {
  font-style: normal;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #f1ece2;
}
.admin-strategy-card footer,
.admin-pipeline-stage footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}
.admin-pipeline-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.admin-pipeline-stage div {
  height: 7px;
  border-radius: 99px;
  background: #ebe4d8;
  overflow: hidden;
  margin: 14px 0;
}
.admin-pipeline-stage div i {
  display: block;
  height: 100%;
  background: #2d7a65;
}
@media (max-width: 900px) {
  .admin-console {
    grid-template-columns: 1fr;
  }
  .admin-sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(35, 32, 27, .1);
  }
  .admin-sidebar nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .admin-summary-grid,
  .admin-strategy-grid,
  .admin-pipeline-board,
  .admin-two-col {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Verify admin routes**

Run:

```bash
bun --cwd apps/web build
```

Expected:

- Build exits 0.
- `/admin`, `/admin/strategies`, and `/admin/pipelines` are valid routes.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/web/components/admin/admin-shell.tsx apps/web/components/admin/admin-overview.tsx apps/web/components/admin/admin-strategies.tsx apps/web/components/admin/admin-pipelines.tsx apps/web/app/admin/page.tsx apps/web/app/admin/strategies/page.tsx apps/web/app/admin/pipelines/page.tsx apps/web/app/app/app.css
git commit -m "feat: build admin operations console"
```

---

### Task 4A: Admin Access Guard And Strategy Lifecycle Controls

**Files:**
- Create: `apps/web/components/admin/admin-guard.tsx`
- Modify: `apps/web/components/admin/admin-shell.tsx`
- Modify: `apps/web/components/admin/admin-strategies.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create admin access guard**

Create `apps/web/components/admin/admin-guard.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth-context";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { state, user } = useAuth();

  if (state === "loading") {
    return <main className="admin-access-state">正在确认管理员身份...</main>;
  }

  if (!user) {
    return (
      <main className="admin-access-state">
        <h1>需要登录</h1>
        <p>后台运营控制台只对已登录管理员开放。</p>
        <Link href="/login">去登录</Link>
      </main>
    );
  }

  if (!user.is_admin) {
    return (
      <main className="admin-access-state">
        <h1>暂无后台权限</h1>
        <p>当前账号可以使用前台场景，但不能管理模板、策略、流程和审计记录。</p>
        <Link href="/app">返回前台</Link>
      </main>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap admin shell with the guard**

Modify `apps/web/components/admin/admin-shell.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { adminNav } from "../../lib/fixtures/admin-ops";
import { AdminGuard } from "./admin-guard";

export function AdminShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  return (
    <AdminGuard>
      <main className="admin-console">
        <aside className="admin-sidebar">
          <Link href="/admin" className="admin-brand">CompanyBrain Admin</Link>
          <nav>
            {adminNav.map((item) => (
              <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar">
            <div>
              <span>后台运营控制台</span>
              <h1>{title}</h1>
            </div>
            <Link href="/app">返回前台</Link>
          </header>
          {children}
        </section>
      </main>
    </AdminGuard>
  );
}
```

- [ ] **Step 3: Add strategy lifecycle action rail**

Modify `apps/web/components/admin/admin-strategies.tsx`:

```tsx
"use client";

import { useState } from "react";
import { strategyProfiles } from "../../lib/fixtures/admin-ops";
import { strategyLifecycleActions } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-shell";

export function AdminStrategiesPage() {
  const [scope, setScope] = useState("全部");
  const [selected, setSelected] = useState(strategyProfiles[0]);
  const visible = strategyProfiles.filter((item) => scope === "全部" || item.scope === scope);
  return (
    <AdminShell active="/admin/strategies" title="检索策略">
      <section className="admin-toolbar">
        <select value={scope} onChange={(event) => setScope(event.target.value)}>
          <option>全部</option>
          <option value="traditional-rag">文档证据</option>
          <option value="graph-rag">关系图谱</option>
          <option value="nano-brain">知识沉淀</option>
          <option value="company-brain">公司大脑</option>
        </select>
        <button type="button">新建策略草稿</button>
      </section>
      <section className="admin-strategy-workbench">
        <div className="admin-strategy-grid">
          {visible.map((profile) => (
            <article key={profile.id} className={`admin-strategy-card ${selected.id === profile.id ? "selected" : ""}`}>
              <span>{scopeLabel(profile.scope)}</span>
              <h2>{profile.name}</h2>
              <p>{profile.impact}</p>
              <div>
                {profile.controls.map((control) => <em key={control}>{control}</em>)}
              </div>
              <footer>
                <button type="button" onClick={() => setSelected(profile)}>查看动作</button>
                <button type="button">测试策略</button>
              </footer>
            </article>
          ))}
        </div>
        <aside className="admin-lifecycle-panel">
          <span>当前策略</span>
          <h2>{selected.name}</h2>
          <p>{selected.impact}</p>
          {strategyLifecycleActions.map((item) => (
            <button key={item.action} type="button">
              <b>{item.label}</b>
              <span>{item.impact}</span>
            </button>
          ))}
        </aside>
      </section>
    </AdminShell>
  );
}

function scopeLabel(scope: string) {
  const labels: Record<string, string> = {
    "traditional-rag": "文档证据",
    "graph-rag": "关系图谱",
    "nano-brain": "知识沉淀",
    "company-brain": "公司大脑"
  };
  return labels[scope] ?? scope;
}
```

- [ ] **Step 4: Add guard and lifecycle CSS**

Append to `apps/web/app/app/app.css`:

```css
.admin-access-state {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 12px;
  padding: 24px;
  background: #f7f5ef;
  color: #23201b;
  text-align: center;
}
.admin-access-state a {
  justify-self: center;
  border: 1px solid rgba(35, 32, 27, .16);
  border-radius: 8px;
  padding: 9px 12px;
  color: inherit;
  text-decoration: none;
  background: #fffdfa;
}
.admin-strategy-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
}
.admin-strategy-card.selected {
  border-color: rgba(45, 122, 101, .45);
  box-shadow: 0 0 0 2px rgba(45, 122, 101, .08);
}
.admin-lifecycle-panel {
  background: #fffdfa;
  border: 1px solid rgba(35, 32, 27, .1);
  border-radius: 8px;
  padding: 16px;
  align-self: start;
}
.admin-lifecycle-panel button {
  width: 100%;
  display: grid;
  gap: 4px;
  text-align: left;
  border: 1px solid rgba(35, 32, 27, .12);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  margin-top: 8px;
}
.admin-lifecycle-panel button span {
  color: #6b6257;
  font-size: 12px;
}
@media (max-width: 1000px) {
  .admin-strategy-workbench {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify guarded admin pages**

Run:

```bash
bun --cwd apps/web build
```

Expected:

- Build exits 0.
- Admin pages compile with the existing `AuthProvider` and `useAuth()` contract.
- Non-admin users see a clear access state instead of operational controls.

- [ ] **Step 6: Commit Task 4A**

```bash
git add apps/web/components/admin/admin-guard.tsx apps/web/components/admin/admin-shell.tsx apps/web/components/admin/admin-strategies.tsx apps/web/app/app/app.css
git commit -m "feat: guard admin console access"
```

---

### Task 5: Admin Graph Explorer And Strategy Test Bench

**Files:**
- Create: `apps/web/components/admin/admin-graph.tsx`
- Create: `apps/web/components/admin/admin-evaluations.tsx`
- Create: `apps/web/app/admin/graph/page.tsx`
- Create: `apps/web/app/admin/evaluations/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create graph explorer component**

Create `apps/web/components/admin/admin-graph.tsx`:

```tsx
"use client";

import { useState } from "react";
import { graphSnapshot } from "../../lib/fixtures/admin-ops";
import { AdminShell } from "./admin-shell";

export function AdminGraphPage() {
  const [selected, setSelected] = useState(graphSnapshot.nodes[0]);
  return (
    <AdminShell active="/admin/graph" title="关系图谱">
      <section className="admin-graph-layout">
        <aside className="admin-graph-controls">
          <h2>图谱控制</h2>
          <label>关系跳数<input type="range" min="1" max="6" defaultValue="2" /></label>
          <label>最低置信度<input type="range" min="40" max="95" defaultValue="62" /></label>
          <label><input type="checkbox" defaultChecked /> 显示证据来源</label>
          <label><input type="checkbox" defaultChecked /> 高亮关键路径</label>
        </aside>
        <div className="admin-graph-canvas">
          <svg viewBox="0 0 700 520" role="img" aria-label="关系图谱">
            {graphSnapshot.edges.map((edge) => {
              const source = graphSnapshot.nodes.find((node) => node.id === edge.source)!;
              const target = graphSnapshot.nodes.find((node) => node.id === edge.target)!;
              return (
                <g key={`${edge.source}-${edge.target}`}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
                  <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2}>{edge.label}</text>
                </g>
              );
            })}
            {graphSnapshot.nodes.map((node) => (
              <g
                key={node.id}
                className={`admin-graph-node ${node.core ? "core" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(node)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(node);
                }}
              >
                <circle cx={node.x} cy={node.y} r={node.core ? 30 : 22} />
                <text x={node.x} y={node.y + 4}>{node.label}</text>
              </g>
            ))}
          </svg>
        </div>
        <aside className="admin-graph-detail">
          <h2>{selected.label}</h2>
          <p>类型：{selected.type}</p>
          <p>置信度：{Math.round(selected.score * 100)}%</p>
          <h3>相关证据</h3>
          {graphSnapshot.edges
            .filter((edge) => edge.source === selected.id || edge.target === selected.id)
            .map((edge) => <p key={`${edge.source}-${edge.target}-${edge.label}`}>{edge.label} · {edge.evidence}</p>)}
        </aside>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Create strategy test bench component**

Create `apps/web/components/admin/admin-evaluations.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { strategyProfiles } from "../../lib/fixtures/admin-ops";
import { AdminShell } from "./admin-shell";

export function AdminEvaluationsPage() {
  const [question, setQuestion] = useState("Northwind Labs 值不值得续约？");
  const rows = useMemo(() => [
    { profile: strategyProfiles.find((item) => item.id === "company-global-answer")!, score: 82, evidence: 6, latency: "1.4s" },
    { profile: strategyProfiles.find((item) => item.id === "company-strict-evidence")!, score: 88, evidence: 9, latency: "1.8s" }
  ], []);
  return (
    <AdminShell active="/admin/evaluations" title="质量测试">
      <section className="admin-eval-composer">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button type="button">比较策略</button>
      </section>
      <section className="admin-eval-results">
        {rows.map((row) => (
          <article key={row.profile.id}>
            <span>{row.profile.name}</span>
            <h2>{row.score} 分</h2>
            <p>{row.profile.impact}</p>
            <dl>
              <div><dt>证据数</dt><dd>{row.evidence}</dd></div>
              <div><dt>延迟</dt><dd>{row.latency}</dd></div>
              <div><dt>建议</dt><dd>{row.profile.id.includes("strict") ? "适合对外答复" : "适合内部探索"}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Wire graph and evaluation routes**

Create `apps/web/app/admin/graph/page.tsx`:

```tsx
import { AdminGraphPage } from "../../../components/admin/admin-graph";

export default function Page() {
  return <AdminGraphPage />;
}
```

Create `apps/web/app/admin/evaluations/page.tsx`:

```tsx
import { AdminEvaluationsPage } from "../../../components/admin/admin-evaluations";

export default function Page() {
  return <AdminEvaluationsPage />;
}
```

- [ ] **Step 4: Add graph and evaluation CSS**

Append to `apps/web/app/app/app.css`:

```css
.admin-graph-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: 14px;
}
.admin-graph-controls,
.admin-graph-detail,
.admin-graph-canvas,
.admin-eval-composer,
.admin-eval-results article {
  background: #fffdfa;
  border: 1px solid rgba(35, 32, 27, .1);
  border-radius: 8px;
  padding: 16px;
}
.admin-graph-controls label {
  display: grid;
  gap: 6px;
  margin: 12px 0;
  font-size: 13px;
  color: #5d574d;
}
.admin-graph-canvas svg {
  width: 100%;
  min-height: 520px;
}
.admin-graph-canvas line {
  stroke: rgba(68, 61, 51, .28);
  stroke-width: 1.5;
}
.admin-graph-canvas circle {
  fill: #efe8db;
  stroke: #7f6a45;
  stroke-width: 1.5;
}
.admin-graph-canvas .core circle {
  fill: #d99f45;
  stroke: #6f4519;
}
.admin-graph-canvas text {
  font-size: 11px;
  text-anchor: middle;
  fill: #2d2923;
  pointer-events: none;
}
.admin-graph-node {
  cursor: pointer;
}
.admin-graph-node:focus-visible circle {
  stroke: #1d6c59;
  stroke-width: 3;
}
.admin-eval-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px;
  gap: 12px;
  margin-bottom: 14px;
}
.admin-eval-composer textarea {
  min-height: 88px;
  border: 1px solid rgba(35, 32, 27, .14);
  border-radius: 8px;
  padding: 12px;
  resize: vertical;
}
.admin-eval-results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.admin-eval-results h2 {
  font-size: 34px;
  margin: 8px 0;
}
.admin-eval-results dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.admin-eval-results dt {
  color: #7a7164;
  font-size: 12px;
}
.admin-eval-results dd {
  margin: 4px 0 0;
  font-weight: 700;
}
@media (max-width: 1000px) {
  .admin-graph-layout,
  .admin-eval-composer,
  .admin-eval-results {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify graph and evaluation routes**

Run:

```bash
bun --cwd apps/web build
```

Expected:

- Build exits 0.
- `/admin/graph` and `/admin/evaluations` are valid routes.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/web/components/admin/admin-graph.tsx apps/web/components/admin/admin-evaluations.tsx apps/web/app/admin/graph/page.tsx apps/web/app/admin/evaluations/page.tsx apps/web/app/app/app.css
git commit -m "feat: add admin graph explorer and test bench"
```

---

### Task 5A: Template Governance, Knowledge Inventory, And Audit Pages

**Files:**
- Create: `apps/web/components/admin/admin-templates.tsx`
- Create: `apps/web/components/admin/admin-knowledge-bases.tsx`
- Create: `apps/web/components/admin/admin-audit.tsx`
- Create: `apps/web/app/admin/templates/page.tsx`
- Create: `apps/web/app/admin/knowledge-bases/page.tsx`
- Create: `apps/web/app/admin/audit/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create template governance page**

Create `apps/web/components/admin/admin-templates.tsx`:

```tsx
import { adminTemplates } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-shell";

export function AdminTemplatesPage() {
  return (
    <AdminShell active="/admin/templates" title="模板治理">
      <section className="admin-governance-grid">
        {adminTemplates.map((template) => (
          <article key={template.id} className="admin-governance-card">
            <header>
              <span>{template.owner}</span>
              <b>{template.state}</b>
            </header>
            <h2>{template.name}</h2>
            <p>{template.impact}</p>
              <dl>
                <div><dt>默认策略</dt><dd>{template.defaultStrategy}</dd></div>
                <div><dt>复核规则</dt><dd>{template.reviewPolicy}</dd></div>
                <div><dt>证据覆盖</dt><dd>{template.evidenceCoverage}%</dd></div>
                <div><dt>证据来源</dt><dd>{template.evidenceSources.length} 个</dd></div>
                <div><dt>演示完整度</dt><dd>{template.demoReadiness}%</dd></div>
                <div><dt>样例场景</dt><dd>{template.demoScenarioName}</dd></div>
                <div><dt>样例问题</dt><dd>{template.sampleQuestion}</dd></div>
                <div><dt>产品形态</dt><dd>{template.productForms.join(" / ")}</dd></div>
                <div><dt>输入资料</dt><dd>{template.inputs.join(" / ")}</dd></div>
                <div><dt>适用边界</dt><dd>{template.limitations.join("；")}</dd></div>
              </dl>
            <footer>
              <button type="button">调整策略</button>
              <button type="button">查看发布记录</button>
            </footer>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Create knowledge base inventory page**

Create `apps/web/components/admin/admin-knowledge-bases.tsx`:

```tsx
import { knowledgeBaseInventory } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-shell";

export function AdminKnowledgeBasesPage() {
  return (
    <AdminShell active="/admin/knowledge-bases" title="知识库资产">
      <section className="admin-inventory-panel">
        <table className="admin-inventory-table">
          <thead>
            <tr>
              <th>知识范围</th>
              <th>来源数</th>
              <th>对象数</th>
              <th>状态</th>
              <th>过期资料</th>
              <th>最近更新</th>
              <th>建议动作</th>
            </tr>
          </thead>
          <tbody>
            {knowledgeBaseInventory.map((item) => (
              <tr key={item.moduleId}>
                <td><b>{item.name}</b><span>{item.moduleId}</span></td>
                <td>{item.sources}</td>
                <td>{item.objects}</td>
                <td><em className={item.health === "需关注" ? "attention" : ""}>{item.health}</em></td>
                <td>{item.stale}</td>
                <td>{item.lastUpdated}</td>
                <td>{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Create audit page**

Create `apps/web/components/admin/admin-audit.tsx`:

```tsx
import { adminAuditEvents } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-shell";

export function AdminAuditPage() {
  return (
    <AdminShell active="/admin/audit" title="审核与审计">
      <section className="admin-audit-timeline">
        {adminAuditEvents.map((event) => (
          <article key={event.id}>
            <time>{event.time}</time>
            <div>
              <span>{event.area}</span>
              <h2>{event.summary}</h2>
              <p>{event.impact}</p>
              <small>{event.actor}</small>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 4: Wire governance routes**

Create `apps/web/app/admin/templates/page.tsx`:

```tsx
import { AdminTemplatesPage } from "../../../components/admin/admin-templates";

export default function Page() {
  return <AdminTemplatesPage />;
}
```

Create `apps/web/app/admin/knowledge-bases/page.tsx`:

```tsx
import { AdminKnowledgeBasesPage } from "../../../components/admin/admin-knowledge-bases";

export default function Page() {
  return <AdminKnowledgeBasesPage />;
}
```

Create `apps/web/app/admin/audit/page.tsx`:

```tsx
import { AdminAuditPage } from "../../../components/admin/admin-audit";

export default function Page() {
  return <AdminAuditPage />;
}
```

- [ ] **Step 5: Add governance page CSS**

Append to `apps/web/app/app/app.css`:

```css
.admin-governance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.admin-governance-card,
.admin-inventory-panel,
.admin-audit-timeline article {
  background: #fffdfa;
  border: 1px solid rgba(35, 32, 27, .1);
  border-radius: 8px;
  padding: 16px;
}
.admin-governance-card header,
.admin-governance-card footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.admin-governance-card h2 {
  font-size: 19px;
  margin: 12px 0 6px;
}
.admin-governance-card dl {
  display: grid;
  gap: 8px;
  margin: 14px 0;
}
.admin-governance-card dt,
.admin-inventory-table span,
.admin-audit-timeline time,
.admin-audit-timeline small {
  color: #7a7164;
  font-size: 12px;
}
.admin-governance-card dd {
  margin: 3px 0 0;
  font-weight: 650;
}
.admin-governance-card button {
  border: 1px solid rgba(35, 32, 27, .14);
  border-radius: 7px;
  background: #fff;
  padding: 8px 10px;
}
.admin-inventory-panel {
  overflow: auto;
}
.admin-inventory-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 780px;
}
.admin-inventory-table th,
.admin-inventory-table td {
  text-align: left;
  border-bottom: 1px solid rgba(35, 32, 27, .08);
  padding: 12px 10px;
  vertical-align: top;
}
.admin-inventory-table td:first-child {
  display: grid;
  gap: 4px;
}
.admin-inventory-table em {
  font-style: normal;
  border-radius: 999px;
  background: #e8f2ee;
  color: #1d6c59;
  padding: 4px 8px;
}
.admin-inventory-table em.attention {
  background: #fff1d8;
  color: #8a5418;
}
.admin-audit-timeline {
  display: grid;
  gap: 12px;
}
.admin-audit-timeline article {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 14px;
}
.admin-audit-timeline h2 {
  font-size: 17px;
  margin: 6px 0;
}
@media (max-width: 900px) {
  .admin-governance-grid,
  .admin-audit-timeline article {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Verify all governance routes**

Run:

```bash
bun test apps/web/lib/fixtures/admin-governance.test.ts
bun --cwd apps/web build
```

Expected:

- Governance fixture tests pass.
- Build exits 0.
- `/admin/templates`, `/admin/knowledge-bases`, and `/admin/audit` are valid routes.

- [ ] **Step 7: Commit Task 5A**

```bash
git add apps/web/components/admin/admin-templates.tsx apps/web/components/admin/admin-knowledge-bases.tsx apps/web/components/admin/admin-audit.tsx apps/web/app/admin/templates/page.tsx apps/web/app/admin/knowledge-bases/page.tsx apps/web/app/admin/audit/page.tsx apps/web/app/app/app.css
git commit -m "feat: add admin governance pages"
```

---

### Task 6: Frontstage Advanced Controls Without Technical Leakage

**Files:**
- Modify: `apps/web/lib/fixtures/frontstage.ts`
- Modify: `apps/web/lib/fixtures/frontstage.test.ts`
- Modify: `apps/web/components/app/templates.tsx`
- Modify: `apps/web/components/app/scenario-pages.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Extend frontstage tests for advanced controls**

Modify `apps/web/lib/fixtures/frontstage.test.ts`:

```ts
test("frontstage advanced controls are business-facing", () => {
  const wiki = templateById("personal-wiki")!;
  expect(wiki.businessOptions.map((item) => item.label)).toContain("证据要求");
  expect(wiki.businessOptions.map((item) => item.label)).toContain("更新频率");
  expect(visibleFrontendText()).not.toMatch(/topK|rerank|embedding|chunk|vector|GraphRAG/i);
});
```

- [ ] **Step 2: Add business-facing advanced options**

Modify every template in `apps/web/lib/fixtures/frontstage.ts` so `businessOptions` includes these labels where appropriate:

```ts
{ label: "证据要求", values: ["标准依据", "严格依据", "探索优先"] },
{ label: "更新频率", values: ["手动更新", "每周检查", "每月检查"] },
{ label: "输出口径", values: ["内部讨论", "团队共享", "可对外发送"] },
{ label: "需要复核", values: ["不需要", "建议管理员复核", "必须管理员复核"] }
```

- [ ] **Step 3: Add advanced panel to create flow**

Modify `apps/web/components/app/templates.tsx` inside `CreateScenarioPage`:

```tsx
<details className="fs-advanced-options">
  <summary>高级设置</summary>
  <div>
    {template.businessOptions.map((option) => (
      <label key={option.label}>
        <span>{option.label}</span>
        <select defaultValue={option.values[0]}>
          {option.values.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
    ))}
  </div>
</details>
```

- [ ] **Step 4: Add scenario management advanced controls**

Modify `apps/web/components/app/scenario-pages.tsx` inside `ManageScenarioPage`:

```tsx
<section className="fs-manage-section">
  <h2>使用规则</h2>
  <label>
    <span>可见范围</span>
    <select defaultValue={scenario.visibility}>
      <option value="private">仅自己</option>
      <option value="team">团队可用</option>
      <option value="company">全公司可用</option>
    </select>
  </label>
  <label>
    <span>证据要求</span>
    <select defaultValue="标准依据">
      <option>标准依据</option>
      <option>严格依据</option>
      <option>探索优先</option>
    </select>
  </label>
  <label>
    <span>更新频率</span>
    <select defaultValue="手动更新">
      <option>手动更新</option>
      <option>每周检查</option>
      <option>每月检查</option>
    </select>
  </label>
</section>
```

- [ ] **Step 5: Add CSS**

Append to `apps/web/app/app/app.css`:

```css
.fs-advanced-options,
.fs-manage-section {
  border: 1px solid rgba(35, 32, 27, .1);
  border-radius: 8px;
  background: #fffdfa;
  padding: 14px;
}
.fs-advanced-options summary {
  cursor: pointer;
  font-weight: 700;
}
.fs-advanced-options > div,
.fs-manage-section {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}
.fs-advanced-options label,
.fs-manage-section label {
  display: grid;
  gap: 6px;
}
.fs-advanced-options select,
.fs-manage-section select {
  border: 1px solid rgba(35, 32, 27, .14);
  border-radius: 7px;
  padding: 9px 10px;
  background: #fff;
}
```

- [ ] **Step 6: Run tests and build**

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts
bun --cwd apps/web build
```

Expected:

- Frontstage fixture tests pass.
- Build exits 0.
- No banned technical terms appear in frontstage fixture text.

- [ ] **Step 7: Commit Task 6**

```bash
git add apps/web/lib/fixtures/frontstage.ts apps/web/lib/fixtures/frontstage.test.ts apps/web/components/app/templates.tsx apps/web/components/app/scenario-pages.tsx apps/web/app/app/app.css
git commit -m "feat: add frontstage advanced controls"
```

---

### Task 7: Admin QA, Layout Audit, And Documentation

**Files:**
- Modify: `scripts/audit-web-layout.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md`
- Modify: `docs/SERVICE_BOUNDARIES.md`

- [ ] **Step 1: Add admin routes to layout audit**

Modify `scripts/audit-web-layout.ts` route list so it includes:

```ts
const routes = [
  "/app",
  "/app/chat",
  "/app/templates",
  "/app/my-scenarios",
  "/app/tasks",
  "/app/knowledge",
  "/admin",
  "/admin/templates",
  "/admin/knowledge-bases",
  "/admin/strategies",
  "/admin/pipelines",
  "/admin/graph",
  "/admin/evaluations",
  "/admin/audit"
];
```

- [ ] **Step 2: Add graph visual verification to layout audit**

Modify `scripts/audit-web-layout.ts` so `/admin/graph` additionally checks that the graph canvas is visible:

```ts
if (route === "/admin/graph") {
  const graph = page.locator(".admin-graph-canvas svg");
  await expect(graph).toBeVisible();
  const box = await graph.boundingBox();
  if (!box || box.width < 360 || box.height < 300) {
    throw new Error("/admin/graph rendered graph canvas is too small");
  }
}
```

- [ ] **Step 3: Update architecture docs**

Append to `docs/ARCHITECTURE.md`:

```md
## Admin Operations Console

The admin console is separate from the frontstage product. Frontstage users operate business scenarios; admins operate templates, strategy profiles, processing pipelines, graph exploration, quality tests, and audit decisions.

Admin strategy profiles are product-level configurations stored by `packages/platform`. They do not replace module internals. In real mode, strategy profiles are translated to module API calls through `packages/gateway`; in mock mode, deterministic platform data is used for delivery and QA.
```

- [ ] **Step 4: Update service boundary docs**

Append to `docs/SERVICE_BOUNDARIES.md`:

```md
`packages/platform` owns admin-facing strategy profiles, pipeline stage projections, graph explorer snapshots, and evaluation records.
It stores product-level controls and references only. It must not read or write Nano Brain, Traditional RAG, or GraphRAG module databases directly.
```

- [ ] **Step 5: Run full verification**

Run:

```bash
bun test packages/platform/src/admin-ops.test.ts packages/platform/src/admin-services.test.ts
bun test packages/platform/src/admin-governance.test.ts
bun test apps/web/lib/fixtures/admin-ops.test.ts apps/web/lib/fixtures/admin-governance.test.ts apps/web/lib/fixtures/frontstage.test.ts
bun --cwd apps/web build
WEB_BASE_URL=http://localhost:3001 bun run scripts/audit-web-layout.ts
```

Expected:

- All tests pass.
- Build exits 0.
- Layout audit exits 0 after local web server is running.
- `/admin/graph` has a visible SVG canvas with stable dimensions.

- [ ] **Step 6: Commit Task 7**

```bash
git add scripts/audit-web-layout.ts docs/ARCHITECTURE.md docs/API.md docs/SERVICE_BOUNDARIES.md
git commit -m "docs: describe admin operations console"
```

---

## Acceptance Checklist

- [ ] `/admin` is a real operations overview, not a placeholder.
- [ ] `/admin/templates` manages template publishing state, accepted inputs, review policy, and default strategy.
- [ ] `/admin/templates` shows evidence coverage, source count, product form, demo readiness, sample scenario, sample question, and limitations before a template is promoted to official.
- [ ] `/admin/knowledge-bases` shows Company Brain, Traditional RAG, GraphRAG, and Nano Brain asset inventory.
- [ ] `/admin/strategies` exposes retrieval strategy profiles for Traditional RAG, GraphRAG, Nano Brain, and Company Brain.
- [ ] `/admin/strategies` supports clone, draft edit, default activation, archive, restore, test, and audit-visible actions.
- [ ] `/admin/pipelines` shows user-facing and admin-facing processing stages.
- [ ] `/admin/graph` renders an interactive relationship graph with nodes, edges, confidence, filters, and evidence.
- [ ] `/admin/evaluations` compares strategy profiles against sample questions.
- [ ] `/admin/audit` shows user-impacting template, strategy, pipeline, graph, evaluation, and knowledge asset events.
- [ ] `/admin/*` pages show a non-admin access state before operational controls render.
- [ ] Frontstage create/manage flows expose business-facing advanced controls without backend technical terms.
- [ ] Admin controls do not expose provider keys, database URLs, raw embeddings, or internal tokens.
- [ ] Mock mode supports all admin surfaces with deterministic delivery data.
- [ ] Real mode can translate strategy profiles to existing module APIs through `packages/gateway`.
- [ ] Layout QA covers both frontstage and all admin routes, including a visible graph canvas check.
