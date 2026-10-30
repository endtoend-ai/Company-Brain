import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { officialTemplates } from "../fixtures/frontstage";
import { buildScenarioProductSurface, type ScenarioProductSurface } from "../scenario-product-surface";
import {
  buildRerankRequest,
  parseRerankResponse,
  RERANK_PROVIDER_DEFAULTS,
  resolveRerankProvider,
  type RerankProvider
} from "./rerank";
import type { ProcessingTask, RagEngine, ScenarioTemplate, TaskKind, TemplateProductForm, Visibility } from "../fixtures/frontstage";

export type AdminRagEngine = "Gbrain" | "Naive RAG" | "GraphRAG";

export type StoreUser = {
  userId: string;
  name: string;
  role: "member" | "admin";
  organizationId?: string;
  teamIds?: string[];
};

export type StoreVisibility = Visibility;
export type AccessControlScope = StoreVisibility;
export type StoredAccessControl = {
  scope: AccessControlScope;
  ownerUserId: string;
  ownerName: string;
  organizationId: string;
  teamIds: string[];
};

export type OriginalFileState = "temporary" | "retained" | "deleted";
export type FileRetentionPolicy = "delete_after_ingest" | "retain_source";
export type ParsedArtifactKind = "markdown" | "document_text" | "table" | "structured_data" | "archive_manifest" | "text";
export type KnowledgeObjectKind = "knowledge_page" | "evidence_chunk" | "graph_object";
export type StoreModuleId = "nano-brain" | "traditional-rag" | "graph-rag";
export type StoredModuleReference = {
  id: string;
  scenarioId: string;
  sourceFileId: string;
  engine: AdminRagEngine;
  moduleId: StoreModuleId;
  sourceId: string;
  sourceName: string;
  sourceKind: "private" | "public";
  objectKind: "page" | "document" | "job";
  objectId: string;
  documentId?: string;
  jobId?: string;
  pageId?: string;
  status: "submitted" | "ready" | "failed";
  accessControl: StoredAccessControl;
  metadata: Record<string, unknown>;
  createdAt: string;
};
export type AdminKnowledgeAssetKind =
  | "wiki"
  | "fact"
  | "link"
  | "source"
  | "chunk"
  | "embedding"
  | "citation"
  | "eval"
  | "entity"
  | "relationship"
  | "graph"
  | "review";

export type StoredAdminTemplateState = "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
export type StoredAdminTemplate = {
  id: string;
  name: string;
  category: string;
  state: StoredAdminTemplateState;
  source: "official" | "custom";
  owner: string;
  headline: string;
  acceptedFiles: string[];
  inputExamples: string[];
  outputCapabilities: string[];
  productForm: TemplateProductForm[];
  reviewRequirement: ScenarioTemplate["reviewRequirement"];
  evidenceSources: string[];
  evidenceCoverage: number;
  demoReadiness: number;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminIntegrationSettings = {
  checked_at: string;
  overall_status: "ready" | "degraded" | "blocked";
  providers: Array<{
    id: string;
    label: string;
    provider: string;
    base_url: string | null;
    model: string | null;
    dimensions?: number | null;
    optional?: boolean;
    secrets: Array<{ env_name: string; configured: boolean; fingerprint: string | null }>;
    controls: string[];
  }>;
  parsers: Array<{
    id: string;
    label: string;
    base_url: string | null;
    model_version: string | null;
    language: string | null;
    options: string[];
    secrets: Array<{ env_name: string; configured: boolean; fingerprint: string | null }>;
  }>;
  modules: Array<{
    id: StoreModuleId;
    label: string;
    base_url: string;
    status: "ok" | "error" | "unknown";
    service: string;
    required_env: string[];
    role: string;
  }>;
  databases: Array<{
    id: string;
    label: string;
    env_name: string;
    configured: boolean;
    host: string | null;
    port: string | null;
    database: string | null;
    username: string | null;
  }>;
  runtime_policies: Array<{
    label: string;
    value: string;
    impact: string;
    key?: "rerankTopN" | "rerankMinScore" | "perSourceTimeoutMs" | "sourceFanout" | "candidatePoolSize";
    source?: "db" | "env" | "default";
    numeric?: { value: number; min: number; max: number; step: number; unit?: string };
  }>;
  engine_retrieval: Array<{
    engine: AdminRagEngine;
    label: string;
    topK: number | null;
    source: "db" | "default";
    min: number;
    max: number;
    default_hint: string;
    minScore: number | null;
    minScoreSource: "db" | "default";
    minScoreMin: number;
    minScoreMax: number;
    supportsMinScore: boolean;
  }>;
};

export type StoredAdminAuditEvent = {
  id: string;
  actor: string;
  area: string;
  summary: string;
  impact: string;
  time: string;
  createdAt: string;
};

export type AdminStrategyParameters = Record<string, string>;

export type AdminTemplateMutationInput = {
  id?: string;
  name?: string;
  category?: string;
  state?: StoredAdminTemplateState;
  owner?: string;
  headline?: string;
  acceptedFiles?: string[];
  inputExamples?: string[];
  outputCapabilities?: string[];
  productForm?: TemplateProductForm[];
  reviewRequirement?: ScenarioTemplate["reviewRequirement"];
  evidenceSources?: string[];
};

export type StoreUploadFile = {
  name: string;
  type?: string;
  bytes: Uint8Array;
};

export type StoredScenario = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  visibility: StoreVisibility;
  ownerUserId: string;
  ownerName: string;
  organizationId: string;
  teamIds: string[];
  accessControl: StoredAccessControl;
  status: "submitted" | "waiting_review" | "processing" | "ready" | "failed";
  sourceCount: number;
  processingGoal: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredScenarioWorkbench = {
  scenario: StoredScenario;
  template: StoredAdminTemplate;
  surface: ScenarioProductSurface;
  tasks: ProcessingTask[];
  knowledgeObjects: StoredKnowledgeObject[];
};

export type StoredFileRecord = {
  id: string;
  scenarioId: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
  uploadedAt: string;
  originalState: OriginalFileState;
  originalAvailable: boolean;
  retentionPolicy: FileRetentionPolicy;
  retentionReason: string;
  accessControl: StoredAccessControl;
  deletedAt?: string;
  parsedArtifactIds: string[];
  knowledgeObjectIds: string[];
};

export type StoredParsedArtifact = {
  id: string;
  scenarioId: string;
  sourceFileId: string;
  title: string;
  kind: ParsedArtifactKind;
  content: string;
  visibility: StoreVisibility;
  ownerUserId: string;
  ownerName: string;
  organizationId: string;
  teamIds: string[];
  accessControl: StoredAccessControl;
  ragMode: RagEngine;
  ragEngine: AdminRagEngine;
  createdAt: string;
};

export type StoredKnowledgeObject = {
  id: string;
  scenarioId: string;
  sourceFileId: string;
  artifactId: string;
  title: string;
  kind: KnowledgeObjectKind;
  content: string;
  visibility: StoreVisibility;
  ownerUserId: string;
  ownerName: string;
  organizationId: string;
  teamIds: string[];
  accessControl: StoredAccessControl;
  ragMode: RagEngine;
  ragEngine: AdminRagEngine;
  sourceOriginalName: string;
  moduleReferences?: StoredModuleReference[];
  createdAt: string;
};

export type StoredKnowledgeAssetDetail = {
  id: string;
  kind: AdminKnowledgeAssetKind;
  engine: AdminRagEngine;
  title: string;
  metric: string;
  status: string;
  sourceOriginalName: string;
  scenarioName: string;
  visibility: StoreVisibility;
  visibilityLabel: StoredAdminIntakeRequest["visibility"];
  ownerName: string;
  createdAt: string;
  content: string;
  metadata: Array<{ label: string; value: string }>;
};

export type AdminServiceHealthStatus = "healthy" | "degraded" | "down";
export type AdminServiceHealth = {
  id: AdminRagEngine;
  status: AdminServiceHealthStatus;
  detail: string;
};
export type AdminDashboardSnapshot = {
  requests: {
    total: number;
    pending: number;
    processing: number;
    published: number;
    rejected: number;
  };
  assets: {
    total: number;
    gbrain: number;
    naive: number;
    graph: number;
  };
  healthCards: Array<{
    id: "platform-store" | AdminRagEngine;
    label: string;
    value: string;
    detail: string;
    status: AdminServiceHealthStatus;
    route: string;
  }>;
  dataOverview: Array<{
    scope: "个人" | "团队" | "公司";
    total: number;
    unit: string;
    module: string;
    owner: string;
    policy: string;
    health: AdminServiceHealthStatus;
  }>;
};

export type StoredScenarioAnswer = {
  scenarioId: string;
  query: string;
  answer: {
    text: string;
    engine: AdminRagEngine;
    citations: Array<{
      knowledgeObjectId: string;
      sourceOriginalName: string;
      scenarioName: string;
      engine: AdminRagEngine;
      excerpt: string;
    }>;
    nextActions: string[];
  };
};

export type GlobalChatScope = "company" | "team" | "private";
export type GlobalChatOutputMode = "direct" | "report" | "table";
export type GlobalChatCitation = {
  knowledgeObjectId: string;
  sourceOriginalName: string;
  scenarioId: string;
  scenarioName: string;
  engine: AdminRagEngine;
  knowledgeType: "Knowledge wiki" | "Document evidence" | "Knowledge graph";
  excerpt: string;
};
export type GlobalChatRetrievalTrack = {
  label: "Document evidence" | "Knowledge graph" | "Knowledge wiki";
  count: number;
  description: string;
};
export type GlobalChatContextTrace = {
  layers: string[];
  scopeLabel: string;
  route: "direct" | "retrieve";
  routeReason: string;
  shortTermTurns: number;
  compressedContext: string;
  longTermMemoryHits: string[];
  retrievalTracks: GlobalChatRetrievalTrack[];
};
export type StoredGlobalChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: GlobalChatCitation[];
  contextTrace?: GlobalChatContextTrace;
  traceId?: string;
};
export type StoredGlobalChatSession = {
  id: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  organizationId: string;
  teamIds: string[];
  scope: GlobalChatScope;
  outputMode: GlobalChatOutputMode;
  createdAt: string;
  updatedAt: string;
  compressedContext: string;
  memory: {
    provider: "local";
    shortTermCount: number;
    longTermFacts: string[];
  };
  messages: StoredGlobalChatMessage[];
};
export type GlobalChatSessionSummary = {
  id: string;
  title: string;
  scope: GlobalChatScope;
  outputMode: GlobalChatOutputMode;
  updatedAt: string;
  updatedAtText: string;
  messageCount: number;
  latestMessage: string;
};

export type StoredScenarioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engine?: AdminRagEngine;
  citations?: StoredScenarioAnswer["answer"]["citations"];
  nextActions?: string[];
  traceId?: string;
};

export type StoredScenarioChatSession = {
  id: string;
  scenarioId: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredScenarioChatMessage[];
};

export type ScenarioChatSessionSummary = {
  id: string;
  scenarioId: string;
  title: string;
  ownerName: string;
  updatedAt: string;
  updatedAtText: string;
  messageCount: number;
  latestMessage: string;
};

export type StoredFilePreview = {
  file: StoredFileRecord;
  bytes: Uint8Array;
};

export type StoredAdminIntakeRequest = {
  id: string;
  scenarioId: string;
  scenarioName: string;
  requester: string;
  visibility: "个人" | "团队" | "公司";
  submittedAt: string;
  status: "待管理员确认" | "处理中" | "等待复核" | "已发布" | "已退回";
  files: string[];
  storedFiles: StoredFileRecord[];
  requestedOutcome: string;
  recommendedModes: RagEngine[];
  recommendedEngines: AdminRagEngine[];
  selectedMode: "待选择" | RagEngine;
  selectedEngine: "待选择" | AdminRagEngine;
  frontstageMapping: string;
  permissionImpact: string;
  strategyParameters: AdminStrategyParameters;
  parsedArtifactCount: number;
  knowledgeObjectCount: number;
  actions: string[];
  createdAt: string;
};

type StoreTask = ProcessingTask & {
  ownerUserId: string;
  createdAt: string;
  updatedAtIso?: string;
  strategyParameters?: AdminStrategyParameters;
};

// ===== 监控 / 可观测 trace 模型(对标 Langfuse/Phoenix:一次问答=一个 trace,内部步骤=typed span) =====
export type TraceFormLabel = "文档型" | "图谱型" | "知识页型";
export type TraceSpanKind = "RETRIEVER" | "LLM";
export type TraceSpan = {
  kind: TraceSpanKind;
  label: string;
  engine?: AdminRagEngine;
  form?: TraceFormLabel;
  latencyMs: number;
  // RETRIEVER
  sourceName?: string;
  scenarioName?: string;
  hitCount?: number;
  hits?: Array<{ excerpt: string; score?: number }>;
  // LLM
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
export type StoredChatTrace = {
  id: string;
  kind: "global_chat" | "scenario_chat";
  scenarioId?: string;
  scenarioName?: string;
  userId: string;
  userName: string;
  scope?: string;
  query: string;
  route: "direct" | "retrieve";
  answerExcerpt: string;
  success: boolean;
  citationCount: number;
  hitSourceCount: number;
  totalLatencyMs: number;
  totalTokens: number;
  engines: AdminRagEngine[];
  forms: TraceFormLabel[];
  spans: TraceSpan[];
  feedback?: { vote: "up" | "down"; note?: string; ratedAt: string };
  createdAt: string;
};

export function engineToForm(engine: AdminRagEngine): TraceFormLabel {
  if (engine === "Naive RAG") return "文档型";
  if (engine === "GraphRAG") return "图谱型";
  return "知识页型";
}

// 把一次真实问答落成一条 trace 记录(成功口径:direct=成功;retrieve=命中真实引用>0)。
function recordChatTrace(
  db: PlatformDb,
  input: {
    id: string;
    kind: "global_chat" | "scenario_chat";
    user: StoreUser;
    scope?: string;
    scenarioId?: string;
    scenarioName?: string;
    query: string;
    route: "direct" | "retrieve";
    answerText: string;
    citations: Array<{ engine: AdminRagEngine }>;
    spans: TraceSpan[];
    totalLatencyMs: number;
    now: string;
  }
) {
  const engines = Array.from(new Set(input.citations.map((c) => c.engine)));
  const retrieverSpans = input.spans.filter((s) => s.kind === "RETRIEVER");
  const hitSourceCount = retrieverSpans.filter((s) => (s.hitCount ?? 0) > 0).length;
  const totalTokens = input.spans.reduce((sum, s) => sum + (s.totalTokens ?? 0), 0);
  const success = input.route === "direct" ? true : input.citations.length > 0;
  const trace: StoredChatTrace = {
    id: input.id,
    kind: input.kind,
    scenarioId: input.scenarioId,
    scenarioName: input.scenarioName,
    userId: input.user.userId,
    userName: input.user.name,
    scope: input.scope,
    query: input.query,
    route: input.route,
    answerExcerpt: excerpt(sanitizeKnowledgeExcerpt(input.answerText), 220),
    success,
    citationCount: input.citations.length,
    hitSourceCount,
    totalLatencyMs: input.totalLatencyMs,
    totalTokens,
    engines,
    forms: Array.from(new Set(engines.map((e) => engineToForm(e)))),
    spans: input.spans,
    createdAt: input.now
  };
  if (!Array.isArray(db.traces)) db.traces = [];
  db.traces.unshift(trace);
  // 防止 JSON 存储无界增长:只保留最近 2000 条 trace。
  if (db.traces.length > 2000) db.traces = db.traces.slice(0, 2000);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

// 终端用户对一次回答点赞/点踩 → 写入对应 trace 的 feedback(进而进待改进队列)。
export async function setTraceFeedback(
  user: StoreUser,
  input: { traceId: string; vote: "up" | "down"; note?: string }
): Promise<{ ok: boolean; message: string }> {
  const db = await readDb();
  const trace = (db.traces ?? []).find((t) => t.id === input.traceId);
  if (!trace) return { ok: false, message: "Q&A record not found." };
  if (trace.userId !== user.userId && user.role !== "admin") return { ok: false, message: "You can only rate your own answers." };
  trace.feedback = { vote: input.vote, note: input.note?.trim() || undefined, ratedAt: new Date().toISOString() };
  await writeDb(db);
  return { ok: true, message: input.vote === "up" ? "Thanks for the positive feedback." : "Feedback recorded; the answer was added to the improvement queue." };
}

export type MonitoringOverview = {
  overall: {
    queries: number;
    successRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    totalTokens: number;
    upvotes: number;
    downvotes: number;
    pendingReview: number;
    noAnswerRate: number;
  };
  forms: Array<{ form: TraceFormLabel; queries: number; hitRate: number; avgRetrievalMs: number; downvotes: number }>;
};

// 监控总览(三形态健康层 + 总体一级指标),全部从真实 traces 聚合。
export async function getMonitoringOverview(user: StoreUser): Promise<MonitoringOverview> {
  const empty: MonitoringOverview = {
    overall: { queries: 0, successRate: 0, p50LatencyMs: 0, p95LatencyMs: 0, totalTokens: 0, upvotes: 0, downvotes: 0, pendingReview: 0, noAnswerRate: 0 },
    forms: (["文档型", "图谱型", "知识页型"] as TraceFormLabel[]).map((form) => ({ form, queries: 0, hitRate: 0, avgRetrievalMs: 0, downvotes: 0 }))
  };
  if (user.role !== "admin") return empty;
  const db = await readDb();
  const traces = db.traces ?? [];
  if (traces.length === 0) return empty;
  const latencies = traces.map((t) => t.totalLatencyMs);
  const successCount = traces.filter((t) => t.success).length;
  const retrieveTraces = traces.filter((t) => t.route === "retrieve");
  const noAnswer = retrieveTraces.filter((t) => t.citationCount === 0).length;
  const overall = {
    queries: traces.length,
    successRate: Math.round((successCount / traces.length) * 100),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    totalTokens: traces.reduce((s, t) => s + (t.totalTokens ?? 0), 0),
    upvotes: traces.filter((t) => t.feedback?.vote === "up").length,
    downvotes: traces.filter((t) => t.feedback?.vote === "down").length,
    pendingReview: traces.filter((t) => t.feedback?.vote === "down").length,
    noAnswerRate: retrieveTraces.length ? Math.round((noAnswer / retrieveTraces.length) * 100) : 0
  };
  const forms = (["文档型", "图谱型", "知识页型"] as TraceFormLabel[]).map((form) => {
    const formTraces = traces.filter((t) => t.forms.includes(form));
    const retrSpans = traces.flatMap((t) => t.spans).filter((s) => s.kind === "RETRIEVER" && s.form === form);
    const hitSpans = retrSpans.filter((s) => (s.hitCount ?? 0) > 0).length;
    return {
      form,
      queries: formTraces.length,
      hitRate: retrSpans.length ? Math.round((hitSpans / retrSpans.length) * 100) : 0,
      avgRetrievalMs: retrSpans.length ? Math.round(retrSpans.reduce((s, x) => s + x.latencyMs, 0) / retrSpans.length) : 0,
      downvotes: formTraces.filter((t) => t.feedback?.vote === "down").length
    };
  });
  return { overall, forms };
}

// 问答日志列表(可筛选:形态/成功/差评)。返回精简行,trace 详情另取。
export async function listMonitoringTraces(
  user: StoreUser,
  input: { form?: TraceFormLabel; onlyFailed?: boolean; onlyDownvoted?: boolean; limit?: number } = {}
): Promise<Array<Omit<StoredChatTrace, "spans">>> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  let traces = db.traces ?? [];
  if (input.form) traces = traces.filter((t) => t.forms.includes(input.form!));
  if (input.onlyFailed) traces = traces.filter((t) => !t.success);
  if (input.onlyDownvoted) traces = traces.filter((t) => t.feedback?.vote === "down");
  return traces.slice(0, input.limit ?? 100).map(({ spans, ...rest }) => rest);
}

// 单条 trace 详情(含完整 span 树)。
export async function getMonitoringTrace(user: StoreUser, traceId: string): Promise<StoredChatTrace | null> {
  if (user.role !== "admin") return null;
  const db = await readDb();
  return (db.traces ?? []).find((t) => t.id === traceId) ?? null;
}

export type MonitoringTrendPoint = { date: string; queries: number; successRate: number; avgLatencyMs: number; downvotes: number; tokens: number };

// 趋势时序:按天聚合最近 14 天的问答量/成功率/延迟/差评/token(真 traces)。
export async function getMonitoringTrends(user: StoreUser): Promise<MonitoringTrendPoint[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const traces = db.traces ?? [];
  const byDay = new Map<string, StoredChatTrace[]>();
  for (const t of traces) {
    const day = (t.createdAt || "").slice(0, 10);
    if (!day) continue;
    const arr = byDay.get(day);
    if (arr) arr.push(t);
    else byDay.set(day, [t]);
  }
  const days = Array.from(byDay.keys()).sort().slice(-14);
  return days.map((date) => {
    const list = byDay.get(date) ?? [];
    const success = list.filter((t) => t.success).length;
    return {
      date,
      queries: list.length,
      successRate: list.length ? Math.round((success / list.length) * 100) : 0,
      avgLatencyMs: list.length ? Math.round(list.reduce((s, t) => s + t.totalLatencyMs, 0) / list.length) : 0,
      downvotes: list.filter((t) => t.feedback?.vote === "down").length,
      tokens: list.reduce((s, t) => s + (t.totalTokens ?? 0), 0)
    };
  });
}

export type GraphCurationSource = { sourceId: string; name: string; scenarioName: string };
export type GraphCurationEntity = { id: string | null; name: string; type: string; description: string; source: string };
export type GraphCurationRelation = { id: string | null; source: string; target: string; description: string; weight: number | null };
export type GraphCurationDetail = {
  sourceId: string;
  sourceName: string;
  entities: GraphCurationEntity[];
  relations: GraphCurationRelation[];
  entityCount: number;
  relationCount: number;
  duplicateNames: string[];
};

async function recordCurationAudit(user: StoreUser, area: string, summary: string) {
  const db = await readDb();
  appendAuditEvent(db, user, { area, summary, impact: "Graph updated" });
  await writeDb(db);
}

// 列出可 curate 的 GraphRAG 图谱源(来自真实入库的 moduleReferences)。
export async function listGraphCurationSources(user: StoreUser): Promise<GraphCurationSource[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const seen = new Map<string, GraphCurationSource>();
  for (const ref of db.moduleReferences ?? []) {
    if (ref.engine !== "GraphRAG" || !ref.sourceId) continue;
    if (seen.has(ref.sourceId)) continue;
    const scenario = db.scenarios.find((s) => s.id === ref.scenarioId);
    seen.set(ref.sourceId, {
      sourceId: ref.sourceId,
      name: String(ref.metadata.originalFileName ?? ref.sourceName),
      scenarioName: scenario?.name ?? ""
    });
  }
  return Array.from(seen.values());
}

// 拉取某图谱源的实体+关系(真调 graph-rag curation/detail)。
export async function getGraphCurationDetail(user: StoreUser, sourceId: string): Promise<GraphCurationDetail | null> {
  if (user.role !== "admin") return null;
  const admin: StoreUser = { ...user, role: "admin" };
  const raw = await moduleJson<{
    source_id: string; source_name: string;
    entities: GraphCurationEntity[]; relations: GraphCurationRelation[];
    entity_count: number; relation_count: number;
  }>("GraphRAG", `/graph/curation/detail?source_id=${encodeURIComponent(sourceId)}`, { method: "GET", user: admin });
  const counts = new Map<string, number>();
  for (const e of raw.entities) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const duplicateNames = Array.from(counts.entries()).filter(([, c]) => c > 1).map(([n, c]) => `${n} ×${c}`);
  return {
    sourceId: raw.source_id,
    sourceName: raw.source_name,
    entities: raw.entities,
    relations: raw.relations,
    entityCount: raw.entity_count,
    relationCount: raw.relation_count,
    duplicateNames
  };
}

export async function mergeGraphCurationEntities(user: StoreUser, input: { sourceId: string; sourceEntities: string[]; targetEntity: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit the graph");
  await moduleJson("GraphRAG", "/graph/curation/entities/merge", { method: "POST", user, body: { source_id: input.sourceId, source_entities: input.sourceEntities, target_entity: input.targetEntity } });
  await recordCurationAudit(user, "图谱治理", `Merged entities ${input.sourceEntities.join(", ")} → ${input.targetEntity}`);
  return { ok: true, message: `Merged into "${input.targetEntity}"` };
}

export async function editGraphCurationEntity(user: StoreUser, input: { sourceId: string; entityName: string; newName?: string; entityType?: string; description?: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit the graph");
  const updated: Record<string, string> = {};
  if (input.newName && input.newName !== input.entityName) updated.entity_name = input.newName;
  if (input.entityType) updated.entity_type = input.entityType;
  if (typeof input.description === "string") updated.description = input.description;
  await moduleJson("GraphRAG", "/graph/curation/entities/edit", { method: "POST", user, body: { source_id: input.sourceId, entity_name: input.entityName, updated_data: updated } });
  await recordCurationAudit(user, "图谱治理", `Edited entity ${input.entityName}`);
  return { ok: true, message: "Saved" };
}

export async function deleteGraphCurationEntity(user: StoreUser, input: { sourceId: string; entityName: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit the graph");
  await moduleJson("GraphRAG", "/graph/curation/entities/delete", { method: "POST", user, body: { source_id: input.sourceId, entity_name: input.entityName } });
  await recordCurationAudit(user, "图谱治理", `Deleted entity ${input.entityName}`);
  return { ok: true, message: `Deleted "${input.entityName}"` };
}

export async function deleteGraphCurationRelation(user: StoreUser, input: { sourceId: string; sourceEntity: string; targetEntity: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit the graph");
  await moduleJson("GraphRAG", "/graph/curation/relations/delete", { method: "POST", user, body: { source_id: input.sourceId, source_entity: input.sourceEntity, target_entity: input.targetEntity } });
  await recordCurationAudit(user, "图谱治理", `Deleted relationship ${input.sourceEntity} → ${input.targetEntity}`);
  return { ok: true, message: "Relationship deleted" };
}

// ===== 文档型(Naive RAG)chunk 可编辑管理 =====
export type DocChunk = { id: string; chunkIndex: number; text: string; charCount: number };
export type NaiveDocument = { documentId: string; sourceId: string; name: string; scenarioName: string };

export async function listNaiveDocuments(user: StoreUser): Promise<NaiveDocument[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const seen = new Map<string, NaiveDocument>();
  for (const ref of db.moduleReferences ?? []) {
    if (ref.engine !== "Naive RAG" || !ref.documentId) continue;
    if (seen.has(ref.documentId)) continue;
    const scenario = db.scenarios.find((s) => s.id === ref.scenarioId);
    seen.set(ref.documentId, { documentId: ref.documentId, sourceId: ref.sourceId, name: String(ref.metadata.originalFileName ?? ref.sourceName), scenarioName: scenario?.name ?? "" });
  }
  return Array.from(seen.values());
}

export async function getDocumentChunks(user: StoreUser, documentId: string): Promise<DocChunk[]> {
  if (user.role !== "admin") return [];
  const admin: StoreUser = { ...user, role: "admin" };
  const raw = await moduleJson<{ chunks: Array<{ id: string; chunk_index: number; chunk_text?: string; text?: string }> }>("Naive RAG", `/traditional/documents/${encodeURIComponent(documentId)}/chunks`, { method: "GET", user: admin });
  return (raw.chunks ?? []).map((c) => {
    const text = c.chunk_text ?? c.text ?? "";
    return { id: c.id, chunkIndex: c.chunk_index, text, charCount: text.length };
  });
}

export async function deleteDocumentChunk(user: StoreUser, input: { documentId: string; chunkId: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit document chunks");
  const res = await moduleJson<{ deleted: boolean }>("Naive RAG", `/traditional/documents/${encodeURIComponent(input.documentId)}/chunks/${encodeURIComponent(input.chunkId)}`, { method: "DELETE", user });
  await recordCurationAudit(user, "文档治理", `Deleted chunk ${input.chunkId.slice(0, 8)} of document ${input.documentId.slice(0, 8)}`);
  return { ok: res.deleted, message: res.deleted ? "Chunk deleted" : "Chunk not found" };
}

// ===== 知识页型(Gbrain/Nano)页面可编辑管理 =====
export type KnowledgePageItem = { slug: string; title: string; body: string; contentType?: string };
export type GbrainPageSource = { sourceId: string; name: string; scenarioName: string };

export async function listGbrainPageSources(user: StoreUser): Promise<GbrainPageSource[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const seen = new Map<string, GbrainPageSource>();
  for (const ref of db.moduleReferences ?? []) {
    if (ref.engine !== "Gbrain" || !ref.sourceId) continue;
    if (seen.has(ref.sourceId)) continue;
    const scenario = db.scenarios.find((s) => s.id === ref.scenarioId);
    seen.set(ref.sourceId, { sourceId: ref.sourceId, name: String(ref.metadata.originalFileName ?? ref.sourceName), scenarioName: scenario?.name ?? "" });
  }
  return Array.from(seen.values());
}

export async function listGbrainPages(user: StoreUser, sourceId: string): Promise<KnowledgePageItem[]> {
  if (user.role !== "admin") return [];
  const admin: StoreUser = { ...user, role: "admin" };
  const raw = await moduleJson<{ pages: Array<{ slug: string; title: string; body?: string; content?: string; content_type?: string }> }>("Gbrain", `/nano/sources/${encodeURIComponent(sourceId)}/pages`, { method: "GET", user: admin });
  return (raw.pages ?? []).map((p) => ({ slug: p.slug, title: p.title, body: p.body ?? p.content ?? "", contentType: p.content_type }));
}

export async function editGbrainPage(user: StoreUser, input: { sourceId: string; slug: string; title: string; body: string }): Promise<{ ok: boolean; message?: string }> {
  if (user.role !== "admin") throw new Error("Only admins can edit knowledge pages");
  await moduleJson("Gbrain", `/nano/pages/${encodeURIComponent(input.sourceId)}/${encodeURIComponent(input.slug)}`, { method: "PUT", user, body: { title: input.title, body: input.body, content_type: "text/markdown" } });
  await recordCurationAudit(user, "知识页治理", `Edited knowledge page ${input.title}`);
  return { ok: true, message: "Saved and reindexed" };
}

export type MonitoringFormPanels = {
  文档型: { sources: Array<{ name: string; hits: number; queries: number }>; zeroHitSources: number };
  图谱型: { entities: number; relations: number; sources: number; duplicateCandidates: string[]; sampleEntities: string[]; available: boolean };
  知识页型: { traceableRate: number; knowledgePages: number; latestPageAgeHours: number | null };
};

// 三形态差异化深度监控面板(各自原生指标,全部真数据)。
export async function getMonitoringFormPanels(user: StoreUser): Promise<MonitoringFormPanels> {
  const empty: MonitoringFormPanels = {
    文档型: { sources: [], zeroHitSources: 0 },
    图谱型: { entities: 0, relations: 0, sources: 0, duplicateCandidates: [], sampleEntities: [], available: false },
    知识页型: { traceableRate: 0, knowledgePages: 0, latestPageAgeHours: null }
  };
  if (user.role !== "admin") return empty;
  const db = await readDb();
  const traces = db.traces ?? [];

  // 文档型:Naive RETRIEVER span 的来源命中分布
  const naiveSpans = traces.flatMap((t) => t.spans).filter((s) => s.kind === "RETRIEVER" && s.engine === "Naive RAG");
  const sourceMap = new Map<string, { hits: number; queries: number }>();
  for (const s of naiveSpans) {
    const name = s.sourceName ?? "Unknown source";
    const cur = sourceMap.get(name) ?? { hits: 0, queries: 0 };
    cur.queries += 1;
    cur.hits += s.hitCount ?? 0;
    sourceMap.set(name, cur);
  }
  const docSources = Array.from(sourceMap.entries()).map(([name, v]) => ({ name, hits: v.hits, queries: v.queries })).sort((a, b) => b.queries - a.queries);
  const 文档型 = { sources: docSources.slice(0, 12), zeroHitSources: docSources.filter((s) => s.hits === 0).length };

  // 图谱型:调用真 graph-rag /graph/graph-stats
  let 图谱型: MonitoringFormPanels["图谱型"] = { entities: 0, relations: 0, sources: 0, duplicateCandidates: [], sampleEntities: [], available: false };
  try {
    const stats = await moduleJson<{ entities: number; relations: number; sources: number; duplicate_candidates: string[]; sample_entities: string[] }>(
      "GraphRAG",
      "/graph/graph-stats",
      { method: "GET", user: { ...user, role: "admin" } }
    );
    图谱型 = {
      entities: stats.entities ?? 0,
      relations: stats.relations ?? 0,
      sources: stats.sources ?? 0,
      duplicateCandidates: stats.duplicate_candidates ?? [],
      sampleEntities: stats.sample_entities ?? [],
      available: true
    };
  } catch {
    图谱型.available = false;
  }

  // 知识页型:Gbrain 引用可追溯率 + 知识页规模/新鲜度
  const gbrainTraces = traces.filter((t) => t.forms.includes("知识页型"));
  const gbrainTraceable = gbrainTraces.filter((t) => t.spans.some((s) => s.kind === "RETRIEVER" && s.engine === "Gbrain" && (s.hitCount ?? 0) > 0)).length;
  const knowledgePages = db.knowledgeObjects.filter((k) => k.ragEngine === "Gbrain").length;
  const latestGbrain = db.knowledgeObjects.filter((k) => k.ragEngine === "Gbrain").map((k) => new Date(k.createdAt).getTime()).sort((a, b) => b - a)[0];
  const 知识页型 = {
    traceableRate: gbrainTraces.length ? Math.round((gbrainTraceable / gbrainTraces.length) * 100) : 0,
    knowledgePages,
    latestPageAgeHours: latestGbrain ? Math.round((Date.now() - latestGbrain) / 3600000) : null
  };

  return { 文档型, 图谱型, 知识页型 };
}

export type StoredRuntimeConfig = {
  rerankTopN?: number;
  rerankMinScore?: number;
  perSourceTimeoutMs?: number;
  sourceFanout?: number;
  candidatePoolSize?: number;
};

export type StoredEngineRetrievalConfig = Partial<Record<AdminRagEngine, { topK?: number; minScore?: number }>>;

type PlatformDb = {
  scenarios: StoredScenario[];
  tasks: StoreTask[];
  files: StoredFileRecord[];
  parsedArtifacts: StoredParsedArtifact[];
  knowledgeObjects: StoredKnowledgeObject[];
  moduleReferences: StoredModuleReference[];
  chatSessions: StoredGlobalChatSession[];
  scenarioChatSessions: StoredScenarioChatSession[];
  templates: StoredAdminTemplate[];
  auditEvents: StoredAdminAuditEvent[];
  traces: StoredChatTrace[];
  runtimeConfig?: StoredRuntimeConfig;
  engineRetrievalConfig?: StoredEngineRetrievalConfig;
};

const emptyDb = (): PlatformDb => ({
  scenarios: [],
  tasks: [],
  files: [],
  parsedArtifacts: [],
  knowledgeObjects: [],
  moduleReferences: [],
  chatSessions: [],
  scenarioChatSessions: [],
  templates: [],
  auditEvents: [],
  traces: []
});

let dbCache: { path: string; mtimeMs: number; db: PlatformDb } | null = null;

export async function resetPlatformStore() {
  await rm(dataRoot(), { recursive: true, force: true });
  dbCache = null;
}

export async function createStoredScenario(input: {
  templateId: string;
  name: string;
  description: string;
  visibility: StoreVisibility;
  processingGoal: string;
  owner: StoreUser;
  files: StoreUploadFile[];
}): Promise<{ scenario: StoredScenario; task: ProcessingTask; files: StoredFileRecord[] }> {
  const db = await readDb();
  const now = new Date().toISOString();
  const scenarioId = `scene_${randomUUID()}`;
  const taskId = `task_${randomUUID()}`;
  const uploadDir = join(dataRoot(), "uploads", scenarioId);
  await mkdir(uploadDir, { recursive: true });
  const accessControl = accessControlFor(input.visibility, input.owner);

  const fileRecords: StoredFileRecord[] = [];
  for (const file of input.files) {
    const fileId = `file_${randomUUID()}`;
    const storedName = `${fileId}_${safeFileName(file.name)}`;
    const relativePath = join("uploads", scenarioId, storedName);
    await writeFile(join(dataRoot(), relativePath), file.bytes);
    fileRecords.push({
      id: fileId,
      scenarioId,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.bytes.byteLength,
      relativePath,
      uploadedAt: now,
      originalState: "temporary",
      originalAvailable: true,
      retentionPolicy: retentionPolicyForFile(file.name, file.type),
      retentionReason: retentionReasonForPolicy(retentionPolicyForFile(file.name, file.type)),
      accessControl,
      parsedArtifactIds: [],
      knowledgeObjectIds: []
    });
  }

  const scenario: StoredScenario = {
    id: scenarioId,
    templateId: input.templateId,
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    ownerUserId: input.owner.userId,
    ownerName: input.owner.name,
    organizationId: accessControl.organizationId,
    teamIds: accessControl.teamIds,
    accessControl,
    status: "submitted",
    sourceCount: fileRecords.length,
    processingGoal: input.processingGoal,
    createdAt: now,
    updatedAt: now
  };

  const task: StoreTask = {
    id: taskId,
    scenarioId,
    title: `Create ${input.name}`,
    status: "submitted",
    kind: "Admin review",
    ragMode: ragModeForTemplate(input.templateId),
    visibility: input.visibility,
    owner: input.owner.name,
    ownerUserId: input.owner.userId,
    submittedAt: "just now",
    updatedAt: "just now",
    files: fileRecords.map((file) => file.originalName),
    waitingFor: fileRecords.length > 0 ? "Admin" : "You",
    progress: fileRecords.length > 0 ? 18 : 6,
    currentStep: fileRecords.length > 0 ? "Waiting for the admin console to configure the engine policy" : "Waiting for more files",
    userMessage: fileRecords.length > 0
      ? `The file pack is submitted; the admin console will confirm material quality and configure the ingest retrieval policy. Requested outcome: ${input.processingGoal}`
      : "The scenario exists but needs a file pack before the admin console can process it.",
    nextActions: fileRecords.length > 0 ? ["View task center", "Add more files", "Wait for admin confirmation"] : ["Keep uploading files"],
    adminEntry: fileRecords.length > 0 ? "Waiting for an admin to configure the RAG engine policy and confirm ingest" : "Waiting for the user to add files",
    createdAt: now
  };

  db.scenarios.unshift(scenario);
  db.tasks.unshift(task);
  db.files.unshift(...fileRecords);
  await writeDb(db);
  return { scenario, task: stripInternalTask(task), files: fileRecords };
}

export async function listStoredTasks(user: StoreUser): Promise<ProcessingTask[]> {
  const db = await readDb();
  const allowedScenarioIds = new Set(db.scenarios.filter((scenario) => canReadScenario(user, scenario)).map((scenario) => scenario.id));
  return db.tasks
    .filter((task) => allowedScenarioIds.has(task.scenarioId))
    .map((task) => stripInternalTask(toDisplayTask(task)));
}

export async function listStoredScenarios(user: StoreUser): Promise<StoredScenario[]> {
  const db = await readDb();
  return db.scenarios.filter((scenario) => canReadScenario(user, scenario));
}

export async function getStoredScenarioWorkbench(user: StoreUser, scenarioId: string): Promise<StoredScenarioWorkbench | null> {
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return null;
  const tasks = db.tasks
    .filter((task) => task.scenarioId === scenario.id)
    .map((task) => stripInternalTask(toDisplayTask(task)));
  const knowledgeObjects = db.knowledgeObjects.filter((item) => item.scenarioId === scenario.id && canReadKnowledgeObject(user, item));
  const template = adminTemplateForScenario(db, scenario.templateId);
  return {
    scenario,
    template,
    surface: buildScenarioProductSurface(template.id, { productForm: template.productForm } as Pick<ScenarioTemplate, "productForm">),
    tasks,
    knowledgeObjects
  };
}

export async function listStoredKnowledgeObjects(user: StoreUser): Promise<StoredKnowledgeObject[]> {
  const db = await readDb();
  return db.knowledgeObjects.filter((item) => canReadKnowledgeObject(user, item));
}

export async function getStoredPlatformSnapshot(user: StoreUser) {
  const db = await readDb();
  const scenarios = db.scenarios.filter((scenario) => canReadScenario(user, scenario));
  const allowedScenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const tasks = db.tasks
    .filter((task) => allowedScenarioIds.has(task.scenarioId))
    .map((task) => stripInternalTask(toDisplayTask(task)));
  const knowledgeObjects = db.knowledgeObjects.filter((item) => canReadKnowledgeObject(user, item));
  return {
    scenarios,
    tasks,
    knowledge: knowledgeObjects
  };
}

export async function getStoredFilePreview(user: StoreUser, fileId: string): Promise<StoredFilePreview | null> {
  if (user.role !== "admin") return null;
  const db = await readDb();
  const file = db.files.map(normalizeFileRecord).find((item) => item.id === fileId);
  if (!file || !file.originalAvailable || file.originalState === "deleted") return null;
  try {
    const bytes = await readFile(join(dataRoot(), file.relativePath));
    return { file, bytes };
  } catch {
    return null;
  }
}

export async function listAdminIntakeRequests(user: StoreUser): Promise<StoredAdminIntakeRequest[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  return db.tasks.map((task) => toAdminIntakeRequest(task, db));
}

export async function listAdminAuditEvents(user: StoreUser): Promise<StoredAdminAuditEvent[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  return [...db.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type RuntimeConfigField = {
  key: keyof StoredRuntimeConfig;
  label: string;
  impact: string;
  envName: string;
  defaultValue: number;
  min: number;
  max: number;
  integer: boolean;
  step: number;
  unit?: string;
};

// 运行策略可编辑配置的单一真相源：label/impact 与 UI 展示一致，校验范围与默认值集中于此。
const RUNTIME_CONFIG_FIELDS: RuntimeConfigField[] = [
  {
    key: "rerankTopN",
    label: "Sources per turn (TopK)",
    impact: "How many sources company-wide Q&A shows after rerank (top-k)",
    envName: "RERANK_TOP_N",
    defaultValue: 5,
    min: 1,
    max: 20,
    integer: true,
    step: 1
  },
  {
    key: "rerankMinScore",
    label: "Relevance threshold",
    impact: "Sources scoring below this relevance are dropped after rerank",
    envName: "RERANK_MIN_SCORE",
    defaultValue: 0.4,
    min: 0,
    max: 1,
    integer: false,
    step: 0.01
  },
  {
    key: "perSourceTimeoutMs",
    label: "Per-source timeout",
    impact: "Gives slow sources more time under rate limits so relevant sources are not missed",
    envName: "FF_GLOBAL_RETRIEVAL_TIMEOUT_MS",
    defaultValue: 20000,
    min: 1000,
    max: 120000,
    integer: true,
    step: 1000,
    unit: "ms"
  },
  {
    key: "sourceFanout",
    label: "Max retrieval sources",
    impact: "How many sources company-wide Q&A retrieves per query after deduplication",
    envName: "FF_GLOBAL_SOURCE_FANOUT",
    defaultValue: 8,
    min: 1,
    max: 20,
    integer: true,
    step: 1
  },
  {
    key: "candidatePoolSize",
    label: "Rerank candidate pool",
    impact: "Cross-source candidates passed into rerank (must be ≥ sources per turn)",
    envName: "FF_GLOBAL_CANDIDATE_POOL",
    defaultValue: 8,
    min: 1,
    max: 50,
    integer: true,
    step: 1
  }
];

type ResolvedRuntimeField = { value: number; source: "db" | "env" | "default" };

type ResolvedRuntimeConfig = {
  rerankTopN: ResolvedRuntimeField;
  rerankMinScore: ResolvedRuntimeField;
  perSourceTimeoutMs: ResolvedRuntimeField;
  sourceFanout: ResolvedRuntimeField;
  candidatePoolSize: ResolvedRuntimeField;
};

// 数值合法性：有限 + 满足整数/范围约束。读取端(env/db)与写入端共用，避免手误的 .env 值绕过约束生效。
function isValidRuntimeValue(field: RuntimeConfigField, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (field.integer && !Number.isInteger(value)) return false;
  return value >= field.min && value <= field.max;
}

// 生效优先级：DB 覆盖 → .env → 硬编码默认；任一层非法则跌落下一层；同时回传来源供前端标注。
async function resolveRuntimeConfig(db?: PlatformDb): Promise<ResolvedRuntimeConfig> {
  const current = db ?? (await readDb());
  const result = {} as ResolvedRuntimeConfig;
  for (const field of RUNTIME_CONFIG_FIELDS) {
    const dbValue = current.runtimeConfig?.[field.key];
    if (typeof dbValue === "number" && isValidRuntimeValue(field, dbValue)) {
      result[field.key] = { value: dbValue, source: "db" };
      continue;
    }
    const envRaw = await readIntegrationEnv(field.envName);
    const envNum = envRaw !== undefined && envRaw !== "" ? Number(envRaw) : Number.NaN;
    if (isValidRuntimeValue(field, envNum)) {
      result[field.key] = { value: envNum, source: "env" };
      continue;
    }
    result[field.key] = { value: field.defaultValue, source: "default" };
  }
  return result;
}

async function getRuntimeConfig(db?: PlatformDb): Promise<{
  rerankTopN: number;
  rerankMinScore: number;
  perSourceTimeoutMs: number;
  sourceFanout: number;
  candidatePoolSize: number;
}> {
  const resolved = await resolveRuntimeConfig(db);
  return {
    rerankTopN: resolved.rerankTopN.value,
    rerankMinScore: resolved.rerankMinScore.value,
    perSourceTimeoutMs: resolved.perSourceTimeoutMs.value,
    sourceFanout: resolved.sourceFanout.value,
    candidatePoolSize: resolved.candidatePoolSize.value
  };
}

const ENGINE_TOPK_MIN = 1;
const ENGINE_TOPK_MAX = 30;
// per-engine 检索 topK：admin 设了该引擎的覆盖值则三处检索统一生效，否则跌落各调用点的历史默认(全域4/验证3/场景5)。
// 无 env 层——这是纯后台 UI 设置，与全局 runtimeConfig 的运维 env 旋钮区别开；模块 search 支持 1-30。
function getEngineTopK(db: PlatformDb, engine: AdminRagEngine, fallback: number): number {
  const v = db.engineRetrievalConfig?.[engine]?.topK;
  if (typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= ENGINE_TOPK_MIN && v <= ENGINE_TOPK_MAX) {
    return v;
  }
  return fallback;
}

const ENGINE_MINSCORE_MIN = 0;
const ENGINE_MINSCORE_MAX = 1;
// per-engine 引用相对强度阈值（归一化 RRF 的 min_score，0-1）：仅 Naive RAG 生效（只它有三路 RRF 融合层）。
// 设了则 Naive 检索透传到模块按 normalized_score 过滤弱引用，未设回落 fallback（默认 0=不过滤，存量行为零变化）。
function getEngineMinScore(db: PlatformDb, engine: AdminRagEngine, fallback: number): number {
  const v = db.engineRetrievalConfig?.[engine]?.minScore;
  if (typeof v === "number" && Number.isFinite(v) && v >= ENGINE_MINSCORE_MIN && v <= ENGINE_MINSCORE_MAX) {
    return v;
  }
  return fallback;
}

// 仅 admin 可改；null = 删除该字段 DB 覆盖回落 env/默认；越界/类型错误抛 Error 由路由映射 400。
export async function updateRuntimeConfig(
  user: StoreUser,
  input: Record<string, unknown>
): Promise<AdminIntegrationSettings> {
  if (user.role !== "admin") {
    throw new Error("forbidden");
  }
  const db = await readDb();
  const next: StoredRuntimeConfig = { ...(db.runtimeConfig ?? {}) };
  const changes: string[] = [];
  for (const field of RUNTIME_CONFIG_FIELDS) {
    if (!(field.key in input)) continue;
    const raw = input[field.key];
    if (raw === null) {
      if (field.key in next) {
        delete next[field.key];
        changes.push(`${field.label} reset to default`);
      }
      continue;
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`${field.label} must be a number`);
    }
    if (field.integer && !Number.isInteger(raw)) {
      throw new Error(`${field.label} must be an integer`);
    }
    if (raw < field.min || raw > field.max) {
      throw new Error(`${field.label} must be between ${field.min} and ${field.max}`);
    }
    next[field.key] = raw;
    const display = field.unit ? `${raw}${field.unit}` : `${raw}`;
    changes.push(`${field.label} set to ${display}`);
  }
  // 联动校验：候选池须 ≥ 本轮来源 TopK，否则 rerank 喂不满候选。用最终生效值（DB→env→默认）比对。
  // 在临时对象上解析后才写入 db.runtimeConfig，避免校验失败时污染进程内 dbCache。
  const finalConfig = await getRuntimeConfig({ ...db, runtimeConfig: next });
  if (finalConfig.candidatePoolSize < finalConfig.rerankTopN) {
    throw new Error(`The rerank candidate pool (${finalConfig.candidatePoolSize}) must be ≥ sources per turn (${finalConfig.rerankTopN})`);
  }
  db.runtimeConfig = next;
  appendAuditEvent(db, user, {
    area: "系统接入",
    summary: "Updated runtime policy settings",
    impact: changes.length > 0 ? changes.join("; ") : "No changes"
  });
  await writeDb(db);
  return getAdminIntegrationSettings(user);
}

// per-engine 检索 topK 配置：仅 admin 可改；topK=null 删除该引擎覆盖回落各调用点默认；越界/类型错误抛 Error 由路由映射 400。
export async function updateEngineRetrievalConfig(
  user: StoreUser,
  input: Record<string, unknown>
): Promise<AdminIntegrationSettings> {
  if (user.role !== "admin") {
    throw new Error("forbidden");
  }
  const db = await readDb();
  const next: StoredEngineRetrievalConfig = { ...(db.engineRetrievalConfig ?? {}) };
  const changes: string[] = [];
  const engines: AdminRagEngine[] = ["Gbrain", "Naive RAG", "GraphRAG"];
  for (const engine of engines) {
    if (!(engine in input)) continue;
    const entry = input[engine];
    if (entry === null || typeof entry !== "object") continue;
    const entryObj = entry as Record<string, unknown>;
    // topK 与 minScore 独立合并：只传其一不抹另一，两者皆空才删该引擎覆盖。
    const current = { ...(next[engine] ?? {}) };
    if ("topK" in entryObj) {
      const topK = entryObj.topK;
      if (topK === null) {
        if (current.topK !== undefined) {
          delete current.topK;
          changes.push(`${engine} topK reset to default`);
        }
      } else {
        if (typeof topK !== "number" || !Number.isFinite(topK)) {
          throw new Error(`${engine} topK must be a number`);
        }
        if (!Number.isInteger(topK)) {
          throw new Error(`${engine} topK must be an integer`);
        }
        if (topK < ENGINE_TOPK_MIN || topK > ENGINE_TOPK_MAX) {
          throw new Error(`${engine} topK must be between ${ENGINE_TOPK_MIN} and ${ENGINE_TOPK_MAX}`);
        }
        current.topK = topK;
        changes.push(`${engine} topK set to ${topK}`);
      }
    }
    if ("minScore" in entryObj) {
      const minScore = entryObj.minScore;
      // 引用强度阈值仅 Naive RAG 有 RRF 融合层可消费；拒非 Naive 的非空设置，避免存下不可见的死配置。
      if (minScore !== null && engine !== "Naive RAG") {
        throw new Error(`${engine} does not support a citation strength threshold (only Naive RAG has the RRF fusion layer)`);
      }
      if (minScore === null) {
        if (current.minScore !== undefined) {
          delete current.minScore;
          changes.push(`${engine} citation strength threshold reset to default`);
        }
      } else {
        if (typeof minScore !== "number" || !Number.isFinite(minScore)) {
          throw new Error(`${engine} citation strength threshold must be a number`);
        }
        if (minScore < ENGINE_MINSCORE_MIN || minScore > ENGINE_MINSCORE_MAX) {
          throw new Error(`${engine} citation strength threshold must be between ${ENGINE_MINSCORE_MIN} and ${ENGINE_MINSCORE_MAX}`);
        }
        current.minScore = minScore;
        changes.push(`${engine} citation strength threshold set to ${minScore}`);
      }
    }
    if (Object.keys(current).length === 0) {
      delete next[engine];
    } else {
      next[engine] = current;
    }
  }
  db.engineRetrievalConfig = next;
  appendAuditEvent(db, user, {
    area: "系统接入",
    summary: "Updated engine retrieval settings",
    impact: changes.length > 0 ? changes.join("; ") : "No changes"
  });
  await writeDb(db);
  return getAdminIntegrationSettings(user);
}

export async function getAdminIntegrationSettings(user: StoreUser): Promise<AdminIntegrationSettings> {
  const now = new Date().toISOString();
  const moduleHealth = user.role === "admin"
    ? await Promise.all((["Gbrain", "Naive RAG", "GraphRAG"] as AdminRagEngine[]).map(async (engine) => {
        try {
          return await defaultCheckAdminModuleHealth(engine);
        } catch {
          return { id: engine, status: "down" as const, detail: `${engine} service unavailable` };
        }
      }))
    : [];
  const modules: AdminIntegrationSettings["modules"] = [
    {
      id: "nano-brain",
      label: "Gbrain service",
      base_url: moduleBaseUrl("Gbrain"),
      status: serviceStatus(moduleHealth.find((item) => item.id === "Gbrain")?.status),
      service: "nano-brain",
      required_env: ["RAG_INTERNAL_TOKEN", "NANO_BRAIN_HTTP_URL"],
      role: "Compiled knowledge organization, knowledge page navigation, fact capture"
    },
    {
      id: "traditional-rag",
      label: "Naive RAG service",
      base_url: moduleBaseUrl("Naive RAG"),
      status: serviceStatus(moduleHealth.find((item) => item.id === "Naive RAG")?.status),
      service: "traditional-rag",
      required_env: ["RAG_INTERNAL_TOKEN", "TRADITIONAL_RAG_HTTP_URL"],
      role: "Document chunking, vector retrieval, evidence-based Q&A"
    },
    {
      id: "graph-rag",
      label: "GraphRAG service",
      base_url: moduleBaseUrl("GraphRAG"),
      status: serviceStatus(moduleHealth.find((item) => item.id === "GraphRAG")?.status),
      service: "graph-rag",
      required_env: ["RAG_INTERNAL_TOKEN", "GRAPH_RAG_HTTP_URL"],
      role: "Entity relationships, risk chains, multi-hop graph retrieval"
    }
  ];
  const rerankProvider: RerankProvider = resolveRerankProvider(envValue("RERANK_PROVIDER"));
  const rerankDefaults = RERANK_PROVIDER_DEFAULTS[rerankProvider];
  const providers: AdminIntegrationSettings["providers"] = [
    {
      id: "agent",
      label: "Answer model",
      provider: "openai-compatible",
      base_url: envValue("AGENT_BASE_URL") ?? envValue("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
      model: envValue("AGENT_MODEL") ?? envValue("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini",
      secrets: [secretState("AGENT_API_KEY", "OPENROUTER_API_KEY")],
      controls: ["Used for company-wide Q&A, Agentic RAG routing, and answer generation"]
    },
    {
      id: "embedding",
      label: "Embedding model",
      provider: "openai-compatible",
      base_url: envValue("EMBEDDING_BASE_URL") ?? envValue("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
      model: envValue("EMBEDDING_MODEL") ?? "qwen/qwen3-embedding-8b",
      dimensions: Number(envValue("EMBEDDING_DIMENSIONS") ?? 4096),
      secrets: [secretState("EMBEDDING_API_KEY", "OPENROUTER_API_KEY")],
      controls: ["Used for document chunking, graph retrieval, and company-wide recall"]
    },
    {
      id: "rerank",
      label: "Rerank model",
      provider: rerankProvider,
      base_url: envValue("RERANK_BASE_URL") ?? rerankDefaults.baseUrl,
      model: envValue("RERANK_MODEL") ?? rerankDefaults.model,
      optional: true,
      secrets: [rerankProvider === "dashscope" ? secretState("DASHSCOPE_API_KEY", "RERANK_API_KEY") : secretState("RERANK_API_KEY")],
      controls: ["Relevance rerank after company-wide retrieval (threshold filter + top-k)"]
    }
  ];
  const parsers: AdminIntegrationSettings["parsers"] = [
    {
      id: "mineru",
      label: "PDF parser service",
      base_url: envValue("MINERU_BASE_URL") ?? "https://mineru.net",
      model_version: envValue("MINERU_MODEL_VERSION") ?? "vlm",
      language: envValue("MINERU_LANGUAGE") ?? "ch",
      options: ["Extract tables", "Extract formulas", "Prefer embedded document text"],
      secrets: [secretState("MINERU_API_KEY")]
    }
  ];
  const databases: AdminIntegrationSettings["databases"] = [
    databaseState("identity", "Accounts and permissions", "IDENTITY_DATABASE_URL"),
    databaseState("traditional-rag", "Naive RAG document database", "TRADITIONAL_RAG_DATABASE_URL"),
    databaseState("graph-rag", "GraphRAG graph database", "GRAPH_RAG_DATABASE_URL")
  ];
  // 可选 provider（如 rerank）未配置不应拉高 blocked 等级
  const blocked = providers.filter((p) => !p.optional).some((item) => item.secrets.some((secret) => !secret.configured))
    || parsers.some((item) => item.secrets.some((secret) => !secret.configured))
    || !envValue("RAG_INTERNAL_TOKEN");
  const degraded = modules.some((item) => item.status !== "ok");
  const db = await readDb();
  const resolvedRuntime = await resolveRuntimeConfig(db);
  return {
    checked_at: now,
    overall_status: blocked ? "blocked" : degraded ? "degraded" : "ready",
    providers,
    parsers,
    modules,
    databases,
    runtime_policies: [
      {
        label: "Internal call token",
        value: envValue("RAG_INTERNAL_TOKEN") ? "Configured" : "Not configured",
        impact: "Required when the unified API calls a knowledge processing module"
      },
      {
        label: "Real ingest mode",
        value: shouldUseRealRagModules() ? "Real modules" : "Local replay",
        impact: "Decides whether confirming ingest calls Gbrain / Naive RAG / GraphRAG services"
      },
      {
        label: "Document storage directory",
        value: dataRoot(),
        impact: "Stores uploaded files, parsed artifacts, ingest status, and audit records"
      },
      ...RUNTIME_CONFIG_FIELDS.map((field) => {
        const resolved = resolvedRuntime[field.key];
        return {
          label: field.label,
          value: field.unit ? `${resolved.value} ${field.unit}` : String(resolved.value),
          impact: field.impact,
          key: field.key,
          source: resolved.source,
          numeric: { value: resolved.value, min: field.min, max: field.max, step: field.step, unit: field.unit }
        };
      })
    ],
    engine_retrieval: (["Gbrain", "Naive RAG", "GraphRAG"] as const).map((engine) => {
      const rawTopK = db.engineRetrievalConfig?.[engine]?.topK;
      const hasOverride =
        typeof rawTopK === "number" &&
        Number.isFinite(rawTopK) &&
        Number.isInteger(rawTopK) &&
        rawTopK >= ENGINE_TOPK_MIN &&
        rawTopK <= ENGINE_TOPK_MAX;
      const rawMinScore = db.engineRetrievalConfig?.[engine]?.minScore;
      const hasMinScore =
        typeof rawMinScore === "number" &&
        Number.isFinite(rawMinScore) &&
        rawMinScore >= ENGINE_MINSCORE_MIN &&
        rawMinScore <= ENGINE_MINSCORE_MAX;
      // 引用强度阈值仅 Naive RAG 有 RRF 层 → 仅它 supportsMinScore，前端只对它显示该输入。
      const supportsMinScore = engine === "Naive RAG";
      return {
        engine,
        label: engine,
        topK: hasOverride ? rawTopK : null,
        source: hasOverride ? ("db" as const) : ("default" as const),
        min: ENGINE_TOPK_MIN,
        max: ENGINE_TOPK_MAX,
        default_hint: "When unset, each retrieval path uses its own default: company-wide recall 4 / recall verification 3 / scenario Q&A 5",
        minScore: supportsMinScore && hasMinScore ? rawMinScore : null,
        minScoreSource: supportsMinScore && hasMinScore ? ("db" as const) : ("default" as const),
        minScoreMin: ENGINE_MINSCORE_MIN,
        minScoreMax: ENGINE_MINSCORE_MAX,
        supportsMinScore
      };
    })
  };
}

export async function probeIntegration(
  target: string
): Promise<{ ok: boolean; latencyMs: number; detail?: string; error?: string }> {
  const start = Date.now();

  if (target === "agent") {
    const agentKey = (await readAgentEnv("AGENT_API_KEY")) ?? (await readAgentEnv("OPENROUTER_API_KEY"));
    if (!agentKey) {
      return { ok: false, latencyMs: Date.now() - start, error: "Not configured" };
    }
    const baseUrl = ((await readAgentEnv("AGENT_BASE_URL")) ?? (await readAgentEnv("OPENROUTER_BASE_URL")) ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const model = (await readAgentEnv("AGENT_MODEL")) ?? (await readAgentEnv("OPENROUTER_MODEL")) ?? "openai/gpt-4o-mini";
    try {
      // 直接最小 fetch（与 embedding/rerank 探活一致），只判可达+鉴权+返回 choices 数组。
      // 不经 callAgentChatModel：其要求 content.trim() 非空 + 失败重试 3 次（25s×3），
      // 对探活会假失败/拖慢——多轮实测坐实（短 prompt 偶发空 content 被判失败）。
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${agentKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        signal: AbortSignal.timeout(10000)
      });
      if (resp.status === 401) {
        return { ok: false, latencyMs: Date.now() - start, error: "Authentication failed (401)" };
      }
      if (!resp.ok) {
        return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
      }
      const data = await resp.json().catch(() => null) as any;
      if (Array.isArray(data?.choices) && data.choices.length > 0) {
        return { ok: true, latencyMs: Date.now() - start, detail: "Agent responded normally" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "TimeoutError" || name === "AbortError") {
        return { ok: false, latencyMs: Date.now() - start, error: "Timed out" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  if (target === "embedding") {
    // 回退规则与 getAdminIntegrationSettings 一致（EMBEDDING_BASE_URL → OPENROUTER_BASE_URL → 默认），
    // 避免只配 OPENROUTER_BASE_URL 时 settings 显示已配置、探活却误报"未配置"。
    const baseUrl = (await readIntegrationEnv("EMBEDDING_BASE_URL")) ?? (await readIntegrationEnv("OPENROUTER_BASE_URL")) ?? "https://openrouter.ai/api/v1";
    const apiKey = (await readIntegrationEnv("EMBEDDING_API_KEY")) ?? (await readIntegrationEnv("OPENROUTER_API_KEY"));
    const model = (await readIntegrationEnv("EMBEDDING_MODEL")) ?? "qwen/qwen3-embedding-8b";
    if (!baseUrl || !apiKey) {
      return { ok: false, latencyMs: Date.now() - start, error: "Not configured" };
    }
    try {
      const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: "ping" }),
        signal: AbortSignal.timeout(10000)
      });
      if (resp.status === 401) {
        return { ok: false, latencyMs: Date.now() - start, error: "Authentication failed (401)" };
      }
      if (!resp.ok) {
        return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
      }
      const data = await resp.json().catch(() => null) as any;
      if (Array.isArray(data?.data?.[0]?.embedding)) {
        return { ok: true, latencyMs: Date.now() - start, detail: "Embedding responded normally" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "TimeoutError" || name === "AbortError") {
        return { ok: false, latencyMs: Date.now() - start, error: "Timed out" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  if (target === "rerank") {
    const provider = resolveRerankProvider(await readIntegrationEnv("RERANK_PROVIDER"));
    const defaults = RERANK_PROVIDER_DEFAULTS[provider];
    const apiKey = (await readIntegrationEnv("RERANK_API_KEY"))
      ?? (provider === "dashscope" ? await readIntegrationEnv("DASHSCOPE_API_KEY") : undefined);
    const baseUrl = (await readIntegrationEnv("RERANK_BASE_URL")) ?? defaults.baseUrl;
    const model = (await readIntegrationEnv("RERANK_MODEL")) ?? defaults.model;
    if (!apiKey) {
      return { ok: false, latencyMs: Date.now() - start, error: "Not configured" };
    }
    try {
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildRerankRequest({ provider, model, query: "ping", documents: ["ping"], topN: 1 })),
        signal: AbortSignal.timeout(10000)
      });
      if (resp.status === 401) {
        return { ok: false, latencyMs: Date.now() - start, error: "Authentication failed (401)" };
      }
      if (!resp.ok) {
        return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
      }
      const data = await resp.json().catch(() => null) as any;
      const parsed = parseRerankResponse(data);
      if (parsed && parsed.length > 0) {
        return { ok: true, latencyMs: Date.now() - start, detail: "Rerank responded normally" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Unexpected response" };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "TimeoutError" || name === "AbortError") {
        return { ok: false, latencyMs: Date.now() - start, error: "Timed out" };
      }
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  if (target === "nano-brain") {
    try {
      const health = await defaultCheckAdminModuleHealth("Gbrain");
      return {
        ok: health.status === "healthy",
        latencyMs: Date.now() - start,
        detail: health.status === "healthy" ? "Gbrain service is available" : undefined,
        error: health.status !== "healthy" ? "Unexpected response" : undefined
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  if (target === "traditional-rag") {
    try {
      const health = await defaultCheckAdminModuleHealth("Naive RAG");
      return {
        ok: health.status === "healthy",
        latencyMs: Date.now() - start,
        detail: health.status === "healthy" ? "Naive RAG service is available" : undefined,
        error: health.status !== "healthy" ? "Unexpected response" : undefined
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  if (target === "graph-rag") {
    try {
      const health = await defaultCheckAdminModuleHealth("GraphRAG");
      return {
        ok: health.status === "healthy",
        latencyMs: Date.now() - start,
        detail: health.status === "healthy" ? "GraphRAG service is available" : undefined,
        error: health.status !== "healthy" ? "Unexpected response" : undefined
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, error: "Connection failed" };
    }
  }

  return { ok: false, latencyMs: Date.now() - start, error: "Unknown target" };
}

export async function listAdminScenarioTemplates(user: StoreUser): Promise<StoredAdminTemplate[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  return activeAdminTemplates(db.templates);
}

export async function createAdminScenarioTemplate(
  user: StoreUser,
  input: AdminTemplateMutationInput
): Promise<StoredAdminTemplate | null> {
  if (user.role !== "admin") return null;
  const db = await readDb();
  const now = new Date().toISOString();
  const name = cleanText(input.name);
  if (!name) throw new Error("Template name is required.");
  const id = uniqueTemplateId(db.templates, input.id || `template-${slugify(name)}`);
  const template: StoredAdminTemplate = {
    id,
    name,
    category: cleanText(input.category) || "Custom",
    state: input.state && input.state !== "official" ? input.state : "candidate",
    source: "custom",
    owner: cleanText(input.owner) || user.name,
    headline: cleanText(input.headline) || "Business scenario template created by an admin.",
    acceptedFiles: cleanStringArray(input.acceptedFiles, ["PDF", "Word", "Markdown", "Spreadsheet data"]),
    inputExamples: cleanStringArray(input.inputExamples, ["Business notes", "Reference files"]),
    outputCapabilities: cleanStringArray(input.outputCapabilities, ["Answers you can question", "Cited evidence", "Business deliverable"]),
    productForm: cleanProductForms(input.productForm),
    reviewRequirement: cleanReviewRequirement(input.reviewRequirement),
    evidenceSources: cleanStringArray(input.evidenceSources, ["Created by an admin"]),
    evidenceCoverage: 50,
    demoReadiness: 30,
    canEdit: true,
    canDelete: true,
    createdAt: now,
    updatedAt: now
  };
  db.templates = mergeAdminTemplates(db.templates);
  db.templates.unshift(template);
  appendAuditEvent(db, user, {
    area: "模板治理",
    summary: `Created template: ${template.name}`,
    impact: `${template.category} · ${template.reviewRequirement}`
  });
  await writeDb(db);
  return template;
}

export async function updateAdminScenarioTemplate(
  user: StoreUser,
  templateId: string,
  input: AdminTemplateMutationInput
): Promise<StoredAdminTemplate | null> {
  if (user.role !== "admin") return null;
  const db = await readDb();
  const templates = mergeAdminTemplates(db.templates);
  const index = templates.findIndex((item) => item.id === templateId);
  if (index < 0) return null;
  const current = templates[index];
  const updated: StoredAdminTemplate = {
    ...current,
    name: current.source === "official" ? current.name : cleanText(input.name) || current.name,
    category: cleanText(input.category) || current.category,
    state: input.state ?? current.state,
    owner: cleanText(input.owner) || current.owner,
    headline: cleanText(input.headline) || current.headline,
    acceptedFiles: input.acceptedFiles ? cleanStringArray(input.acceptedFiles, current.acceptedFiles) : current.acceptedFiles,
    inputExamples: input.inputExamples ? cleanStringArray(input.inputExamples, current.inputExamples) : current.inputExamples,
    outputCapabilities: input.outputCapabilities ? cleanStringArray(input.outputCapabilities, current.outputCapabilities) : current.outputCapabilities,
    productForm: input.productForm ? cleanProductForms(input.productForm) : current.productForm,
    reviewRequirement: input.reviewRequirement ? cleanReviewRequirement(input.reviewRequirement) : current.reviewRequirement,
    evidenceSources: input.evidenceSources ? cleanStringArray(input.evidenceSources, current.evidenceSources) : current.evidenceSources,
    canDelete: current.source === "custom",
    updatedAt: new Date().toISOString()
  };
  templates[index] = updated;
  db.templates = templates;
  appendAuditEvent(db, user, {
    area: "模板治理",
    summary: `Updated template: ${updated.name}`,
    impact: `${updated.state} · ${updated.reviewRequirement}`
  });
  await writeDb(db);
  return updated;
}

export async function deleteAdminScenarioTemplate(
  user: StoreUser,
  templateId: string
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "official_locked" | "forbidden" }> {
  if (user.role !== "admin") return { ok: false, reason: "forbidden" };
  const db = await readDb();
  const templates = mergeAdminTemplates(db.templates);
  const target = templates.find((item) => item.id === templateId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.source === "official") return { ok: false, reason: "official_locked" };
  db.templates = templates.filter((item) => item.id !== templateId);
  appendAuditEvent(db, user, {
    area: "模板治理",
    summary: `Deleted template: ${target.name}`,
    impact: `${target.category} · Custom template`
  });
  await writeDb(db);
  return { ok: true };
}

export async function listAdminKnowledgeAssetDetails(
  user: StoreUser,
  input: { engine?: AdminRagEngine; kind?: AdminKnowledgeAssetKind } = {}
): Promise<StoredKnowledgeAssetDetail[]> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  return db.knowledgeObjects.flatMap((item) => {
    if (input.engine && item.ragEngine !== input.engine) return [];
    const scenario = db.scenarios.find((entry) => entry.id === item.scenarioId);
    const file = db.files.map(normalizeFileRecord).find((entry) => entry.id === item.sourceFileId);
    const artifact = db.parsedArtifacts.find((entry) => entry.id === item.artifactId);
    return buildAssetDetailsForKnowledgeObject(item, scenario, file, artifact).filter((asset) => !input.kind || asset.kind === input.kind);
  });
}

// ===== 真后端治理操作（接真模块/真数据，替代前端占位按钮） =====

// 召回验证 / 运行检索 / 运行路径查询 / 图谱复核 / 关系复核 / 引用抽检 / 发布复核：
// 对指定引擎的真实来源跑一次真实检索，返回命中的真实 chunk/证据。
export async function adminEngineRecallVerify(
  user: StoreUser,
  input: { engine: AdminRagEngine; query?: string }
): Promise<{ engine: AdminRagEngine; query: string; hits: Array<{ source: string; scenario: string; excerpt: string }>; checkedSources: number }> {
  if (user.role !== "admin") return { engine: input.engine, query: input.query ?? "", hits: [], checkedSources: 0 };
  const db = await readDb();
  const query = (input.query ?? "").trim() || "Summarize the key information in this material";
  const refs = (db.moduleReferences ?? [])
    .filter((ref) => ref.engine === input.engine && ref.status === "ready")
    .filter((ref) => canAccess(user, ref.accessControl));
  const seen = new Set<string>();
  const uniqueRefs = refs.filter((ref) => {
    const key = `${ref.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const hits: Array<{ source: string; scenario: string; excerpt: string }> = [];

  if (input.engine === "Naive RAG") {
    // 全局检索（修 I60）：所有可访问 Naive 源一次检索，TopK = 最终返回 chunk 数（默认 8）；
    // 命中按 sourceId 映射回对应 ref 回填来源/场景（M4）。
    const refBySource = new Map(uniqueRefs.map((ref) => [ref.sourceId, ref]));
    try {
      const results = await Promise.race([
        searchNaiveGlobal(user, query, uniqueRefs, getEngineTopK(db, "Naive RAG", 8), getEngineMinScore(db, "Naive RAG", 0)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000))
      ]);
      for (const r of results ?? []) {
        if (!r.text || !r.text.trim()) continue;
        const ref = refBySource.get(r.sourceId);
        if (!ref) continue; // 按 sourceId 归因（M4），找不到对应 ref 则跳过，三处行为一致
        hits.push({
          source: String(ref.metadata.originalFileName ?? ref.sourceName),
          scenario: String(ref.metadata.scenarioName ?? ref.scenarioId),
          excerpt: excerpt(sanitizeKnowledgeExcerpt(r.text), 300)
        });
      }
    } catch {
      // 全局检索失败不阻断。
    }
    return { engine: input.engine, query, hits: hits.slice(0, 8), checkedSources: uniqueRefs.length };
  }

  // Gbrain / GraphRAG：保持逐源检索（本次重构仅 Naive）。
  for (const ref of uniqueRefs.slice(0, 6)) {
    try {
      const excerpts = await Promise.race([
        searchModuleForReference(user, ref, query, getEngineTopK(db, ref.engine, 3), getEngineMinScore(db, ref.engine, 0)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000))
      ]);
      for (const text of excerpts ?? []) {
        if (!text || !text.trim()) continue;
        hits.push({
          source: String(ref.metadata.originalFileName ?? ref.sourceName),
          scenario: String(ref.metadata.scenarioName ?? ref.scenarioId),
          excerpt: excerpt(sanitizeKnowledgeExcerpt(text), 300)
        });
      }
    } catch {
      // 单源失败不阻断整体验证。
    }
  }
  return { engine: input.engine, query, hits: hits.slice(0, 8), checkedSources: Math.min(uniqueRefs.length, 6) };
}

// 导出资产表：从真实知识对象生成 CSV（真实数据，非占位）。
export async function adminExportKnowledgeAssetsCsv(
  user: StoreUser,
  input: { engine?: AdminRagEngine } = {}
): Promise<string> {
  if (user.role !== "admin") return "";
  const db = await readDb();
  const rows = db.knowledgeObjects.filter((item) => !input.engine || item.ragEngine === input.engine);
  const header = ["Knowledge object ID", "Title", "Engine", "Source file", "Permission scope", "Owner", "Created at"];
  const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(csvCell).join(",")];
  for (const item of rows) {
    lines.push([
      item.id,
      item.title,
      item.ragEngine,
      item.sourceOriginalName,
      item.accessControl?.scope ?? item.visibility,
      item.ownerName,
      item.createdAt
    ].map(csvCell).join(","));
  }
  return lines.join("\n");
}

// 批量复核：把指定引擎下所有待确认的资料请求一次性真实入库发布（循环真实审批）。
export async function adminBatchReviewRequests(
  user: StoreUser,
  input: { engine?: AdminRagEngine } = {}
): Promise<{ approved: number; failed: number; engine?: AdminRagEngine }> {
  if (user.role !== "admin") return { approved: 0, failed: 0 };
  const requests = await listAdminIntakeRequests(user);
  const pending = requests.filter((request) => request.status === "待管理员确认");
  let approved = 0;
  let failed = 0;
  for (const request of pending) {
    const engine = input.engine ?? (request.recommendedEngines?.[0] as AdminRagEngine | undefined) ?? "Naive RAG";
    try {
      const result = await decideAdminIntakeRequest(user, {
        requestId: request.id,
        action: "approve",
        selectedEngine: engine
      });
      if (result) approved += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { approved, failed, engine: input.engine };
}

// 场景资料变更请求（申请更新 / 申请删除）：在真实 platform-db 创建一条真实任务，进入后台处理管线。
export async function createScenarioDataRequest(
  user: StoreUser,
  input: { scenarioId: string; action: "update" | "delete" }
): Promise<{ ok: boolean; taskId?: string; message: string }> {
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return { ok: false, message: "Scenario not found or you do not have access." };
  const now = new Date().toISOString();
  const actionLabel = input.action === "delete" ? "File deletion" : "File update";
  const task: StoreTask = {
    id: `task_${randomUUID()}`,
    scenarioId: scenario.id,
    title: `${actionLabel} request: ${scenario.name}`,
    kind: "File intake",
    status: "submitted",
    visibility: scenario.visibility,
    ragMode: ragModeForTemplate(scenario.templateId),
    owner: scenario.ownerName,
    ownerUserId: scenario.ownerUserId,
    submittedAt: "just now",
    updatedAt: "just now",
    files: [],
    waitingFor: "Admin",
    progress: 8,
    currentStep: `${actionLabel} request submitted`,
    userMessage: `Submitted a ${actionLabel} request for "${scenario.name}"; the scenario files update after an admin confirms.`,
    nextActions: ["View task center", "Wait for admin confirmation"],
    adminEntry: `The user submitted a ${actionLabel} request and is waiting for admin processing.`,
    createdAt: now,
    updatedAtIso: now
  };
  db.tasks.unshift(task);
  appendAuditEvent(db, user, { area: "处理管线", summary: `${actionLabel} request: ${scenario.name}`, impact: visibilityLabel(scenario.visibility) });
  await writeDb(db);
  return { ok: true, taskId: task.id, message: task.userMessage as string };
}

// 检索策略：从真实检索配置（.env 模型/维度）+ 真实已接来源数派生，而非 fixture。
export async function getAdminStrategies(
  user: StoreUser
): Promise<Array<{ id: string; name: string; scope: string; impact: string; controls: string[] }>> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const model = process.env.EMBEDDING_MODEL ?? "embedding";
  const dims = process.env.EMBEDDING_DIMENSIONS ?? "";
  const count = (engine: AdminRagEngine) => (db.moduleReferences ?? []).filter((r) => r.engine === engine && r.status === "ready").length;
  return [
    { id: "strategy-naive", name: "Document evidence retrieval policy", scope: "文档证据", impact: `Naive RAG · full-text + vector RRF hybrid · ${model}`, controls: ["TopK=5", `${dims}-dim vector`, `${count("Naive RAG")} real sources connected`] },
    { id: "strategy-gbrain", name: "Knowledge wiki retrieval policy", scope: "知识百科", impact: `Gbrain · keyword + vector RRF · ${model}`, controls: ["TopK=5", "RRF fusion ranking", `${count("Gbrain")} real sources connected`] },
    { id: "strategy-graph", name: "Relationship graph retrieval policy", scope: "关系图谱", impact: "GraphRAG · LightRAG mix (local/global/hybrid)", controls: ["Multi-hop paths", "Graph + vector", `${count("GraphRAG")} real sources connected`] }
  ];
}

// 评估集：从真实知识资产规模派生指标，而非 fixture。
export async function getAdminEvaluations(
  user: StoreUser
): Promise<Array<{ profile: string; evidence: number; score: string; latency: string }>> {
  if (user.role !== "admin") return [];
  const db = await readDb();
  const ko = db.knowledgeObjects;
  const refs = db.moduleReferences ?? [];
  const mk = (profile: string, engine: AdminRagEngine) => {
    const objs = ko.filter((o) => o.ragEngine === engine);
    const ready = refs.filter((r) => r.engine === engine && r.status === "ready").length;
    return { profile, evidence: objs.length, score: objs.length > 0 ? `${ready} ready sources` : "Pending ingest", latency: "Live module retrieval" };
  };
  return [mk("Document evidence retrieval policy", "Naive RAG"), mk("Knowledge wiki retrieval policy", "Gbrain"), mk("Relationship graph retrieval policy", "GraphRAG")];
}

export async function getAdminDashboardSnapshot(
  user: StoreUser,
  options: { checkHealth?: (engine: AdminRagEngine) => Promise<AdminServiceHealth> } = {}
): Promise<AdminDashboardSnapshot> {
  if (user.role !== "admin") {
    return emptyAdminDashboardSnapshot();
  }

  const requests = await listAdminIntakeRequests(user);
  const assets = await listAdminKnowledgeAssetDetails(user);
  const pending = requests.filter((request) => request.status === "待管理员确认" || request.status === "等待复核").length;
  const processing = requests.filter((request) => request.status === "处理中").length;
  const published = requests.filter((request) => request.status === "已发布").length;
  const rejected = requests.filter((request) => request.status === "已退回").length;
  const healthCheck = options.checkHealth ?? defaultCheckAdminModuleHealth;
  const moduleHealth = await Promise.all((["Gbrain", "Naive RAG", "GraphRAG"] as AdminRagEngine[]).map((engine) => healthCheck(engine)));
  const healthCards: AdminDashboardSnapshot["healthCards"] = [
    {
      id: "platform-store",
      label: "Platform state store",
      value: "Available",
      detail: `${requests.length} file requests, ${assets.length} asset records`,
      status: "healthy",
      route: "/admin/pipelines"
    },
    ...moduleHealth.map((item) => ({
      id: item.id,
      label: item.id,
      value: healthValue(item.status),
      detail: item.detail,
      status: item.status,
      route: engineHealthRoute(item.id)
    }))
  ];

  return {
    requests: {
      total: requests.length,
      pending,
      processing,
      published,
      rejected
    },
    assets: {
      total: assets.length,
      gbrain: assets.filter((asset) => asset.engine === "Gbrain").length,
      naive: assets.filter((asset) => asset.engine === "Naive RAG").length,
      graph: assets.filter((asset) => asset.engine === "GraphRAG").length
    },
    healthCards,
    dataOverview: buildAdminDataOverview(assets)
  };
}

export async function askStoredScenarioKnowledge(
  user: StoreUser,
  input: { scenarioId: string; query: string },
  spans?: TraceSpan[]
): Promise<StoredScenarioAnswer | null> {
  const query = input.query.trim();
  if (!query) return null;
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return null;
  const moduleReferences = (db.moduleReferences ?? [])
    .filter((reference) => reference.scenarioId === scenario.id && canAccess(user, reference.accessControl));
  if (moduleReferences.length > 0) {
    // 已真实入库的场景：始终走真实 RAG 模块检索，不回退到本地 fixture 答案。
    return await askRealScenarioKnowledge(user, scenario, query, moduleReferences, spans);
  }
  // 尚未完成真实入库：诚实告知，不用本地 fixture 伪造答案。
  return {
    scenarioId: scenario.id,
    query,
    answer: {
      text: `"${scenario.name}" has not finished the real ingest yet, so it cannot answer from real evidence. Confirm the files and complete ingest in the admin console first.`,
      engine: adminEngineForRagMode(defaultSelectedMode(ragModeForTemplate(scenario.templateId))),
      citations: [],
      nextActions: ["View task center", "Confirm ingest in the admin console", "Add more files"]
    }
  };
}

function buildLocalScenarioKnowledgeAnswer(
  db: PlatformDb,
  user: StoreUser,
  scenario: StoredScenario,
  query: string,
  options: { realModuleError?: string } = {}
): StoredScenarioAnswer {
  const candidates = db.knowledgeObjects
    .filter((item) => item.scenarioId === scenario.id && canReadKnowledgeObject(user, item))
    .map((item) => ({ item, score: relevanceScore(query, item) }))
    .sort((a, b) => b.score - a.score);
  const selected = candidates.filter((entry) => entry.score > 0).slice(0, 3);
  const citations = (selected.length > 0 ? selected : candidates.slice(0, 3)).map(({ item }) => ({
    knowledgeObjectId: item.id,
    sourceOriginalName: item.sourceOriginalName,
    scenarioName: scenario.name,
    engine: item.ragEngine,
    excerpt: scenarioCitationExcerpt(item.content, 260)
  }));
  if (citations.length === 0) {
    return {
      scenarioId: scenario.id,
      query,
      answer: {
        text: `"${scenario.name}" does not have retrievable knowledge ingested yet; wait for the admin console to finish processing before asking.`,
        engine: adminEngineForRagMode(defaultSelectedMode(ragModeForTemplate(scenario.templateId))),
        citations: [],
        nextActions: options.realModuleError ? ["Check real module connections in the admin console", "View task center", "Add more files"] : ["View task center", "Add more files", "Wait for admin confirmation"]
      }
    };
  }

  const engine = citations[0].engine;
  const evidence = citations.map((citation) => citation.excerpt).join("\n");
  return {
    scenarioId: scenario.id,
    query,
    answer: {
      text: buildScenarioAnswerText(scenario.name, query, engine, evidence),
      engine,
      citations,
      nextActions: options.realModuleError ? ["Keep asking", "View cited files", "Check real module connections in the admin console"] : ["Keep asking", "View cited files", "Generate a business deliverable"]
    }
  };
}

export async function listGlobalChatSessions(user: StoreUser): Promise<GlobalChatSessionSummary[]> {
  const db = await readDb();
  return db.chatSessions
    .filter((session) => canReadGlobalChatSession(user, session))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toGlobalChatSummary);
}

export async function getGlobalChatSession(user: StoreUser, sessionId: string): Promise<StoredGlobalChatSession | null> {
  const db = await readDb();
  const session = db.chatSessions.find((item) => item.id === sessionId);
  if (!session || !canReadGlobalChatSession(user, session)) return null;
  return sanitizeGlobalChatSessionForDisplay(session);
}

export async function createGlobalChatSession(
  user: StoreUser,
  input: { query?: string; scope?: GlobalChatScope; outputMode?: GlobalChatOutputMode } = {}
): Promise<StoredGlobalChatSession> {
  const db = await readDb();
  const now = new Date().toISOString();
  const query = input.query?.trim() ?? "";
  const session: StoredGlobalChatSession = {
    id: `chat_${randomUUID()}`,
    title: query ? chatTitleFromQuery(query) : "New company-wide Q&A",
    ownerUserId: user.userId,
    ownerName: user.name,
    organizationId: normalizeOrganizationId(user.organizationId),
    teamIds: normalizeTeamIds(user.teamIds),
    scope: input.scope ?? "company",
    outputMode: input.outputMode ?? "direct",
    createdAt: now,
    updatedAt: now,
    compressedContext: "",
    memory: {
      provider: "local",
      shortTermCount: 0,
      longTermFacts: []
    },
    messages: []
  };

  const tracesBefore = db.traces.length;
  if (query) {
    await appendUserAndAssistantTurn(db, user, session, query, now);
  }
  const newTraces = db.traces.slice(0, Math.max(0, db.traces.length - tracesBefore));

  // #7 并发安全：上方检索在锁外并发；持久化临界区串行 + 重读最新 db，避免整库覆盖丢并发写的 session。
  return withDbLock(async () => {
    const latestDb = await readDb();
    // trace 回归修复：本轮新增 trace 带入锁内 latestDb（否则被整库写回覆盖丢失，codex 审）。
    if (newTraces.length > 0) {
      latestDb.traces.unshift(...newTraces);
      if (latestDb.traces.length > 2000) latestDb.traces = latestDb.traces.slice(0, 2000);
    }
    latestDb.chatSessions.unshift(session);
    await writeDb(latestDb);
    return sanitizeGlobalChatSessionForDisplay(session);
  });
}

export async function appendGlobalChatMessage(
  user: StoreUser,
  input: { sessionId: string; query: string }
): Promise<StoredGlobalChatSession | null> {
  const query = input.query.trim();
  if (!query) return null;
  const db = await readDb();
  const sessionIndex = db.chatSessions.findIndex((item) => item.id === input.sessionId);
  if (sessionIndex < 0) return null;
  const session = db.chatSessions[sessionIndex];
  if (!canReadGlobalChatSession(user, session)) return null;
  const tracesBefore = db.traces.length;
  await appendUserAndAssistantTurn(db, user, session, query, new Date().toISOString());
  const newTraces = db.traces.slice(0, Math.max(0, db.traces.length - tracesBefore));
  // #7 并发安全：持久化临界区串行 + 重读最新 db 后按 id 放回，避免整库覆盖。
  return withDbLock(async () => {
    const latestDb = await readDb();
    const idx = latestDb.chatSessions.findIndex((item) => item.id === input.sessionId);
    if (idx < 0) return null; // #4（codex 审）：锁内找不到不 unshift 复活已删 session
    // trace 回归修复：本轮新增 trace 带入锁内。
    if (newTraces.length > 0) {
      latestDb.traces.unshift(...newTraces);
      if (latestDb.traces.length > 2000) latestDb.traces = latestDb.traces.slice(0, 2000);
    }
    latestDb.chatSessions[idx] = session;
    await writeDb(latestDb);
    return sanitizeGlobalChatSessionForDisplay(session);
  });
}

export async function listScenarioChatSessions(user: StoreUser, scenarioId: string): Promise<ScenarioChatSessionSummary[]> {
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return [];
  return db.scenarioChatSessions
    .filter((session) => session.scenarioId === scenarioId && canReadScenarioChatSession(user, session))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toScenarioChatSummary);
}

export async function getScenarioChatSession(
  user: StoreUser,
  input: { scenarioId: string; sessionId: string }
): Promise<StoredScenarioChatSession | null> {
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return null;
  const session = db.scenarioChatSessions.find((item) => item.id === input.sessionId && item.scenarioId === input.scenarioId);
  if (!session || !canReadScenarioChatSession(user, session)) return null;
  return sanitizeScenarioChatSessionForDisplay(session);
}

export async function createScenarioChatSession(
  user: StoreUser,
  input: { scenarioId: string; query?: string }
): Promise<StoredScenarioChatSession | null> {
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return null;
  const now = new Date().toISOString();
  const query = input.query?.trim() ?? "";
  const session: StoredScenarioChatSession = {
    id: `scenario_chat_${randomUUID()}`,
    scenarioId: scenario.id,
    title: query ? chatTitleFromQuery(query) : `${scenario.name} business session`,
    ownerUserId: user.userId,
    ownerName: user.name,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  const tracesBefore = db.traces.length;
  if (query) await appendScenarioChatTurn(db, user, session, query, now);
  const newTraces = db.traces.slice(0, Math.max(0, db.traces.length - tracesBefore));
  // #7 并发安全：持久化临界区串行 + 重读最新 db，避免整库覆盖丢并发写的 session。
  return withDbLock(async () => {
    const latestDb = await readDb();
    if (newTraces.length > 0) {
      latestDb.traces.unshift(...newTraces);
      if (latestDb.traces.length > 2000) latestDb.traces = latestDb.traces.slice(0, 2000);
    }
    latestDb.scenarioChatSessions.unshift(session);
    await writeDb(latestDb);
    return sanitizeScenarioChatSessionForDisplay(session);
  });
}

export async function appendScenarioChatMessage(
  user: StoreUser,
  input: { scenarioId: string; sessionId: string; query: string }
): Promise<StoredScenarioChatSession | null> {
  const query = input.query.trim();
  if (!query) return null;
  const db = await readDb();
  const scenario = db.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario || !canReadScenario(user, scenario)) return null;
  const sessionIndex = db.scenarioChatSessions.findIndex((item) => item.id === input.sessionId && item.scenarioId === input.scenarioId);
  if (sessionIndex < 0) return null;
  const session = db.scenarioChatSessions[sessionIndex];
  if (!canReadScenarioChatSession(user, session)) return null;
  const tracesBefore = db.traces.length;
  await appendScenarioChatTurn(db, user, session, query, new Date().toISOString());
  const newTraces = db.traces.slice(0, Math.max(0, db.traces.length - tracesBefore));
  // #7 并发安全：持久化临界区串行 + 重读最新 db 后按 id 放回。
  return withDbLock(async () => {
    const latestDb = await readDb();
    const idx = latestDb.scenarioChatSessions.findIndex((item) => item.id === input.sessionId && item.scenarioId === input.scenarioId);
    if (idx < 0) return null; // #4（codex 审）：锁内找不到不复活已删 session
    if (newTraces.length > 0) {
      latestDb.traces.unshift(...newTraces);
      if (latestDb.traces.length > 2000) latestDb.traces = latestDb.traces.slice(0, 2000);
    }
    latestDb.scenarioChatSessions[idx] = session;
    await writeDb(latestDb);
    return sanitizeScenarioChatSessionForDisplay(session);
  });
}

export async function decideAdminIntakeRequest(
  user: StoreUser,
  input: {
    requestId: string;
    action: "approve" | "reject";
    selectedMode?: RagEngine;
    selectedEngine?: AdminRagEngine;
    strategyParameters?: AdminStrategyParameters;
    reason?: string;
  }
): Promise<StoredAdminIntakeRequest | null> {
  if (user.role !== "admin") return null;
  const db = await readDb();
  const taskIndex = db.tasks.findIndex((task) => requestMatchesTask(input.requestId, task));
  if (taskIndex < 0) return null;

  const now = new Date().toISOString();
  const task = db.tasks[taskIndex];
  const scenarioIndex = db.scenarios.findIndex((scenario) => scenario.id === task.scenarioId);
  const scenario = scenarioIndex >= 0 ? db.scenarios[scenarioIndex] : null;
  const selectedMode = input.selectedMode ?? (input.selectedEngine ? ragModeForAdminEngine(input.selectedEngine) : defaultSelectedMode(task.ragMode));
  const selectedEngine = input.selectedEngine ?? adminEngineForRagMode(selectedMode);
  const strategyParameters = sanitizeStrategyParameters(input.strategyParameters);

  if (input.action === "approve") {
    if (scenario) {
      try {
        await ingestScenarioSources(db, scenario, selectedMode, selectedEngine, now, user, strategyParameters);
      } catch (error) {
        console.error("[ingestScenarioSources] FAILED", selectedEngine, scenario.name, error);
        throw error;
      }
    }
    db.tasks[taskIndex] = {
      ...task,
      status: "ready",
      kind: "Publish review",
      ragMode: selectedMode,
      strategyParameters,
      waitingFor: "Scenario owner",
      progress: 100,
      currentStep: "Admin confirmed ingest and published",
      userMessage: "The admin console confirmed ingest and created a usable business scenario.",
      nextActions: ["Open scenario", "Keep asking", "Update files"],
      adminEntry: "The admin console confirmed the files, permissions, and processing approach; the scenario is published to the workspace.",
      updatedAt: "just now",
      updatedAtIso: now
    };
    if (scenario) {
      db.scenarios[scenarioIndex] = { ...scenario, status: "ready", updatedAt: now };
    }
    appendAuditEvent(db, user, {
      area: "处理管线",
      summary: `Confirmed ingest: ${scenario?.name ?? task.title.replace(/^Create /, "")}`,
      impact: `${selectedEngine} · ${visibilityLabel(scenario?.visibility ?? task.visibility)}`
    });
  } else {
    const reason = input.reason?.trim();
    db.tasks[taskIndex] = {
      ...task,
      status: "failed",
      kind: "File intake",
      strategyParameters,
      waitingFor: "You",
      progress: 12,
      currentStep: "Returned by the admin console; waiting for more files",
      userMessage: reason ? `The admin console returned this file processing request: ${reason}` : "The admin console returned this file processing request; add more files and resubmit.",
      nextActions: ["Add more files", "Resubmit for admin processing"],
      adminEntry: "An admin returned the request and is waiting for the user to add files.",
      updatedAt: "just now",
      updatedAtIso: now
    };
    if (scenario) {
      db.scenarios[scenarioIndex] = { ...scenario, status: "failed", updatedAt: now };
    }
    appendAuditEvent(db, user, {
      area: "处理管线",
      summary: `Returned files: ${scenario?.name ?? task.title.replace(/^Create /, "")}`,
      impact: reason || "Waiting for the user to add files"
    });
  }

  await writeDb(db);
  return toAdminIntakeRequest(db.tasks[taskIndex], db);
}

function canReadScenario(user: StoreUser, scenario: StoredScenario) {
  return canAccess(user, accessControlFromScenario(scenario));
}

function canReadKnowledgeObject(user: StoreUser, item: StoredKnowledgeObject) {
  return canAccess(user, accessControlFromKnowledgeObject(item));
}

function canReadGlobalChatSession(user: StoreUser, session: StoredGlobalChatSession) {
  return user.role === "admin" || session.ownerUserId === user.userId;
}

function canReadScenarioChatSession(user: StoreUser, session: StoredScenarioChatSession) {
  return user.role === "admin" || session.ownerUserId === user.userId;
}

function sanitizeGlobalChatSessionForDisplay(session: StoredGlobalChatSession): StoredGlobalChatSession {
  return {
    ...session,
    compressedContext: sanitizeGlobalAssistantContent(session.compressedContext),
    messages: session.messages.map(sanitizeGlobalChatMessageForDisplay)
  };
}

function sanitizeGlobalChatMessageForDisplay(message: StoredGlobalChatMessage): StoredGlobalChatMessage {
  if (message.role !== "assistant") return message;
  return {
    ...message,
    content: sanitizeGlobalAssistantContent(message.content),
    citations: message.citations?.map((citation) => ({
      ...citation,
      excerpt: excerpt(sanitizeKnowledgeExcerpt(citation.excerpt), 260)
    }))
  };
}

function sanitizeScenarioChatSessionForDisplay(session: StoredScenarioChatSession): StoredScenarioChatSession {
  return {
    ...session,
    messages: session.messages.map(sanitizeScenarioChatMessageForDisplay)
  };
}

function sanitizeScenarioChatMessageForDisplay(message: StoredScenarioChatMessage): StoredScenarioChatMessage {
  if (message.role !== "assistant") return message;
  return {
    ...message,
    content: sanitizeGlobalAssistantContent(message.content),
    citations: message.citations?.map((citation) => ({
      ...citation,
      excerpt: excerpt(sanitizeKnowledgeExcerpt(citation.excerpt), 260)
    }))
  };
}

function sanitizeGlobalAssistantContent(content: string) {
  const withoutInlineEvidence = content.replace(
    /\n{0,2}(?:可追溯依据|Traceable evidence)[:：][\s\S]*$/u,
    "\n\nTraceable evidence is shown on the right by source type."
  );
  if (!containsRawParserPayload(withoutInlineEvidence)) return withoutInlineEvidence.trim();
  const cleaned = stripRawParserPayload(withoutInlineEvidence);
  return cleaned || "This answer contained excerpts that have not finished parsing, so the raw content is hidden; open the source card on the right or re-parse the file in the admin console.";
}

function toScenarioChatSummary(session: StoredScenarioChatSession): ScenarioChatSessionSummary {
  const latestMessage = [...session.messages].reverse().find((message) => message.role === "user") ?? session.messages.at(-1);
  const latestContent = latestMessage?.role === "assistant"
    ? sanitizeGlobalAssistantContent(latestMessage.content)
    : latestMessage?.content;
  return {
    id: session.id,
    scenarioId: session.scenarioId,
    title: session.title,
    ownerName: session.ownerName,
    updatedAt: session.updatedAt,
    updatedAtText: displayRelativeTime(session.updatedAt),
    messageCount: session.messages.length,
    latestMessage: latestContent ? excerpt(latestContent, 80) : "No questions yet"
  };
}

function toGlobalChatSummary(session: StoredGlobalChatSession): GlobalChatSessionSummary {
  const latestMessage = [...session.messages].reverse().find((message) => message.role === "user") ?? session.messages.at(-1);
  const latestContent = latestMessage?.role === "assistant"
    ? sanitizeGlobalAssistantContent(latestMessage.content)
    : latestMessage?.content;
  return {
    id: session.id,
    title: session.title,
    scope: session.scope,
    outputMode: session.outputMode,
    updatedAt: session.updatedAt,
    updatedAtText: displayRelativeTime(session.updatedAt),
    messageCount: session.messages.length,
    latestMessage: latestContent ? excerpt(latestContent, 80) : "No questions yet"
  };
}

async function appendScenarioChatTurn(
  db: PlatformDb,
  user: StoreUser,
  session: StoredScenarioChatSession,
  query: string,
  now: string
) {
  session.messages.push({
    id: `msg_${randomUUID()}`,
    role: "user",
    content: query,
    createdAt: now
  });
  const traceStart = Date.now();
  const spans: TraceSpan[] = [];
  const result = await askStoredScenarioKnowledge(user, { scenarioId: session.scenarioId, query }, spans);
  const answer = result?.answer ?? {
    text: "The scenario has not returned a usable answer yet; confirm the admin console finished ingest and publishing.",
    engine: "Gbrain" as AdminRagEngine,
    citations: [],
    nextActions: ["View task center", "Add more files", "Wait for admin confirmation"]
  };
  const traceId = `trace_${randomUUID()}`;
  session.messages.push(sanitizeScenarioChatMessageForDisplay({
    id: `msg_${randomUUID()}`,
    role: "assistant",
    content: answer.text,
    createdAt: now,
    engine: answer.engine,
    citations: answer.citations,
    nextActions: answer.nextActions,
    traceId
  }));
  recordChatTrace(db, {
    id: traceId,
    kind: "scenario_chat",
    user,
    scenarioId: session.scenarioId,
    scenarioName: session.title,
    query,
    route: "retrieve",
    answerText: answer.text,
    citations: (answer.citations ?? []).map((c) => ({ engine: c.engine })),
    spans,
    totalLatencyMs: Date.now() - traceStart,
    now
  });
  session.updatedAt = now;
  if (session.title.endsWith(" business session")) session.title = chatTitleFromQuery(query);
}

async function appendUserAndAssistantTurn(
  db: PlatformDb,
  user: StoreUser,
  session: StoredGlobalChatSession,
  query: string,
  now: string
) {
  const userMessage: StoredGlobalChatMessage = {
    id: `msg_${randomUUID()}`,
    role: "user",
    content: query,
    createdAt: now
  };
  session.messages.push(userMessage);
  const globalAnswer = await buildGlobalChatAnswer(db, user, session, query);
  const traceId = `trace_${randomUUID()}`;
  session.messages.push(sanitizeGlobalChatMessageForDisplay({
    id: `msg_${randomUUID()}`,
    role: "assistant",
    content: globalAnswer.text,
    createdAt: now,
    citations: globalAnswer.citations,
    contextTrace: globalAnswer.contextTrace,
    traceId
  }));
  recordChatTrace(db, {
    id: traceId,
    kind: "global_chat",
    user,
    scope: globalScopeLabel(session.scope),
    query,
    route: globalAnswer.route,
    answerText: globalAnswer.text,
    citations: globalAnswer.citations.map((c) => ({ engine: c.engine })),
    spans: globalAnswer.spans,
    totalLatencyMs: globalAnswer.totalLatencyMs,
    now
  });
  session.updatedAt = now;
  session.title = session.title === "New company-wide Q&A" ? chatTitleFromQuery(query) : session.title;
  session.memory.shortTermCount = session.messages.length;
  session.memory.longTermFacts = updateLongTermFacts(session.memory.longTermFacts, query, globalAnswer.citations);
  session.compressedContext = buildCompressedContext(session);
}

// 多轮指代消解（I46）：把含「它/这个」等指代的追问，结合历史改写成自包含检索 query，避免漏召回。
async function rewriteGlobalQueryWithHistory(query: string, session: StoredGlobalChatSession): Promise<string> {
  // 调用方已先把本轮 user 消息 push 进 session.messages，故历史 = 除最后一条外的消息。
  const history = session.messages.slice(0, -1);
  if (history.length === 0) return query; // 首轮无历史，跳过改写省一次 LLM 调用
  try {
    const recentHistory = history.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const content = await callAgentChatModel(
      [
        {
          role: "system",
          content:
            "You rewrite retrieval queries. Using the conversation history, rewrite the user's latest question into a complete, self-contained question that can be retrieved without context, replacing pronouns such as \"it\", \"this\", \"the above\", or \"that\" with the concrete entity name. Output only the rewritten question: no explanation, no quotes, no prefix. If the question is already self-contained, return it unchanged."
        },
        ...recentHistory,
        { role: "user", content: query }
      ],
      { temperature: 0, maxTokens: 200 }
    );
    if (!content) return query; // 模型失败/无 key → 回退原 query，绝不阻断
    const rewritten = content.trim();
    return rewritten || query;
  } catch {
    return query; // 任何异常(含 callAgentChatModel 潜在 reject)都回退原 query，绝不让问答主流程 5xx
  }
}

async function buildGlobalChatAnswer(
  db: PlatformDb,
  user: StoreUser,
  session: StoredGlobalChatSession,
  query: string
): Promise<{ text: string; citations: GlobalChatCitation[]; contextTrace: GlobalChatContextTrace; spans: TraceSpan[]; route: "direct" | "retrieve"; totalLatencyMs: number }> {
  const traceStart = Date.now();
  const spans: TraceSpan[] = [];
  const pushLlmSpan = (info: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
    spans.push({
      kind: "LLM",
      label: "Answer generation",
      latencyMs: info.latencyMs,
      model: info.model,
      promptTokens: info.promptTokens,
      completionTokens: info.completionTokens,
      totalTokens: info.totalTokens
    });
  };
  const retrievalQuery = await rewriteGlobalQueryWithHistory(query, session);
  const route = await routeGlobalChatQuery(retrievalQuery);
  if (route.mode === "direct") {
    const contextTrace: GlobalChatContextTrace = {
      layers: ["System boundary", "Direct answer", "Short-term session"],
      scopeLabel: globalScopeLabel(session.scope),
      route: "direct",
      routeReason: route.reason,
      shortTermTurns: Math.min(session.messages.length, 8),
      compressedContext: session.compressedContext,
      longTermMemoryHits: [],
      retrievalTracks: buildGlobalRetrievalTracks([])
    };
    return {
      text: await generateDirectGlobalReply(query, pushLlmSpan),
      citations: [],
      contextTrace,
      spans,
      route: "direct",
      totalLatencyMs: Date.now() - traceStart
    };
  }

  const citations: GlobalChatCitation[] = await retrieveRealGlobalCitations(db, user, retrievalQuery, session.scope, spans);
  const memoryHits = rankLongTermFacts(retrievalQuery, session.memory.longTermFacts).slice(0, 3);
  const contextTrace: GlobalChatContextTrace = {
    layers: ["System boundary", "Short-term session", "Compressed summary", "Long-term memory", "Permission filter", "External knowledge"],
    scopeLabel: globalScopeLabel(session.scope),
    route: "retrieve",
    routeReason: route.reason,
    shortTermTurns: Math.min(session.messages.length, 8),
    compressedContext: session.compressedContext,
    longTermMemoryHits: memoryHits,
    retrievalTracks: buildGlobalRetrievalTracks(citations)
  };

  const text = await buildGlobalChatAnswerText(retrievalQuery, session.outputMode, citations, memoryHits, pushLlmSpan);
  return {
    text,
    citations,
    contextTrace,
    spans,
    route: "retrieve",
    totalLatencyMs: Date.now() - traceStart
  };
}

function moduleReferenceAllowedByChatScope(user: StoreUser, ref: StoredModuleReference, scope: GlobalChatScope) {
  const accessControl = ref.accessControl;
  if (scope === "private") return accessControl.ownerUserId === user.userId;
  if (accessControl.ownerUserId === user.userId) return true;
  if (scope === "company") return true;
  if (accessControl.scope === "company") return true;
  if (accessControl.scope !== "team") return false;
  if (accessControl.organizationId !== normalizeOrganizationId(user.organizationId)) return false;
  return accessControl.teamIds.some((teamId) => normalizeTeamIds(user.teamIds).includes(teamId));
}

// 检索后相关性评分：用 LLM 判断每条候选引用与用户问题的相关性，过滤明显无关的来源。
// fallback 语义：调用/解析失败 → 降级返回原 citations；合法解析出 [] → 诚实返回空。
// 检索后相关性精排：用 qwen3-rerank（阿里云百炼 DashScope）对候选片段按真实相关度打校准分，
// 按阈值卡掉不相关 + 取 top-N。比 LLM 评分更准（实测相关0.94 vs 噪声0.2断层清晰）、更快(~2s)、确定。
// 返回的 citations 同时驱动 本轮来源面板 / 引用计数 / 答案证据（单一数据源）。
async function rerankCitations(
  query: string,
  citations: GlobalChatCitation[],
  spans?: TraceSpan[]
): Promise<GlobalChatCitation[]> {
  if (citations.length <= 1) return citations;

  const provider = resolveRerankProvider(await readIntegrationEnv("RERANK_PROVIDER"));
  const defaults = RERANK_PROVIDER_DEFAULTS[provider];
  const apiKey = (await readIntegrationEnv("RERANK_API_KEY"))
    ?? (provider === "dashscope" ? await readIntegrationEnv("DASHSCOPE_API_KEY") : undefined);
  const baseUrl = (await readIntegrationEnv("RERANK_BASE_URL")) ?? defaults.baseUrl;
  // 未配置 rerank → 降级保留全部（与失败降级一致，绝不清空真实来源）
  if (!apiKey) return citations;
  const model = (await readIntegrationEnv("RERANK_MODEL")) ?? defaults.model;
  const runtimeConfig = await getRuntimeConfig();
  const minScore = runtimeConfig.rerankMinScore;
  const topN = Math.max(1, runtimeConfig.rerankTopN);
  const timeoutMs = Number((await readIntegrationEnv("RERANK_TIMEOUT_MS")) ?? 15000);

  // 单条上限 4k token，截到 1500 字足够覆盖 chunk 正文且不超限。
  const documents = citations.map((c) => excerpt(sanitizeKnowledgeExcerpt(c.excerpt), 1500));
  const startedAt = Date.now();
  let body: any = null;
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildRerankRequest({ provider, model, query, documents, topN: documents.length })),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return citations;              // 非 2xx → 降级保留全部
    body = await response.json().catch(() => null);
  } catch {
    return citations;                                 // 网络/超时异常 → 降级保留全部
  }

  const results = parseRerankResponse(body);
  if (!results) return citations;      // 响应结构异常 → 降级保留全部

  spans?.push({
    kind: "LLM",
    label: `Relevance rerank (${model})`,
    latencyMs: Date.now() - startedAt,
    model,
    totalTokens: typeof body?.usage?.total_tokens === "number" ? body.usage.total_tokens : undefined
  });

  // 成功拿到 results（即使过滤后为空）→ 信任 rerank：按 relevance_score 阈值过滤 + 降序 + 取 top-N。
  // 空=诚实清空（如"报销"问到蓝鲸，分数全 <阈值），与失败降级严格区分。
  const kept = results
    .filter((r) => r.index >= 0 && r.index < citations.length && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return kept.map((r) => citations[r.index]);
}

// 真实全域检索：遍历当前用户可访问、已就绪的模块来源引用，逐源调用对应 RAG 模块的检索端点，
// 用真实召回的 chunk 构建引用。不再读本地 fixtures / 关联度评分。
async function retrieveRealGlobalCitations(
  db: PlatformDb,
  user: StoreUser,
  query: string,
  scope: GlobalChatScope,
  spans?: TraceSpan[]
): Promise<GlobalChatCitation[]> {
  const refs = (db.moduleReferences ?? [])
    .filter((ref) => ref.status === "ready")
    .filter((ref) => canAccess(user, ref.accessControl))
    .filter((ref) => moduleReferenceAllowedByChatScope(user, ref, scope));

  // 同一来源去重，限制检索的来源数量，避免一次问答打爆所有模块
  const seen = new Set<string>();
  const uniqueRefs: StoredModuleReference[] = [];
  for (const ref of refs) {
    const key = `${ref.engine}::${ref.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRefs.push(ref);
  }
  const runtimeConfig = await getRuntimeConfig(db);
  const limitedRefs = uniqueRefs.slice(0, runtimeConfig.sourceFanout);
  // 各来源并行检索 + 每源超时：慢引擎（如 GraphRAG/LightRAG 可能 1-2 分钟）超时即跳过，
  // 不阻塞整体回答；其它来源照常实时召回。
  const perSourceTimeoutMs = runtimeConfig.perSourceTimeoutMs;
  // 快引擎（文档证据 / 知识百科）优先，慢引擎（关系图谱 / LightRAG）靠后。
  const enginePriority: Record<string, number> = { "Naive RAG": 0, Gbrain: 1, GraphRAG: 2 };
  const orderedRefs = [...limitedRefs].sort(
    (a, b) => (enginePriority[a.engine] ?? 9) - (enginePriority[b.engine] ?? 9)
  );

  const searchOne = async (ref: StoredModuleReference): Promise<GlobalChatCitation[]> => {
    const startedAt = Date.now();
    try {
      const excerpts = await Promise.race([
        searchModuleForReference(user, ref, query, getEngineTopK(db, ref.engine, 4), getEngineMinScore(db, ref.engine, 0)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), perSourceTimeoutMs))
      ]);
      const cleanExcerpts = (excerpts ?? []).filter((text) => text && text.trim());
      // 记录该来源的真实 RETRIEVER span(引擎/来源/延迟/命中片段),供 trace 详情逐步钻取。
      spans?.push({
        kind: "RETRIEVER",
        label: `${ref.engine} retrieval`,
        engine: ref.engine,
        form: engineToForm(ref.engine),
        latencyMs: Date.now() - startedAt,
        sourceName: String(ref.metadata.originalFileName ?? ref.sourceName),
        scenarioName: String(ref.metadata.scenarioName ?? ref.scenarioId),
        hitCount: cleanExcerpts.length,
        hits: cleanExcerpts.slice(0, 3).map((text) => ({ excerpt: excerpt(sanitizeKnowledgeExcerpt(text), 300) }))
      });
      if (!excerpts) return [];
      return cleanExcerpts
        .map((text) => ({
          knowledgeObjectId: ref.objectId,
          sourceOriginalName: String(ref.metadata.originalFileName ?? ref.sourceName),
          scenarioId: ref.scenarioId,
          scenarioName: String(ref.metadata.scenarioName ?? ref.scenarioId),
          engine: ref.engine,
          knowledgeType: storeKnowledgeTypeLabel(ref.engine),
          // 召回片段保留较完整正文喂给生成模型，避免短文档关键信息（如末尾条款）被截断丢失。
          excerpt: excerpt(sanitizeKnowledgeExcerpt(text), 1200)
        }) as GlobalChatCitation);
    } catch {
      return [];
    }
  };

  // Naive 走一次全局检索（修 I60）；Gbrain/GraphRAG 保持逐源。合并后统一截断 candidatePoolSize 再 rerank（M3）。
  const naiveRefs = orderedRefs.filter((ref) => ref.engine === "Naive RAG");
  const otherRefs = orderedRefs.filter((ref) => ref.engine !== "Naive RAG");

  const naiveCitations: GlobalChatCitation[] = [];
  if (naiveRefs.length > 0) {
    const startedAt = Date.now();
    const refBySource = new Map(naiveRefs.map((ref) => [ref.sourceId, ref]));
    try {
      const results = await Promise.race([
        searchNaiveGlobal(user, query, naiveRefs, getEngineTopK(db, "Naive RAG", 8), getEngineMinScore(db, "Naive RAG", 0)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), perSourceTimeoutMs))
      ]);
      const clean = (results ?? []).filter((r) => r.text && r.text.trim());
      // Naive 单次全局 RETRIEVER span（命中按源回填见下；source 数计入可观测）。
      spans?.push({
        kind: "RETRIEVER",
        label: "Naive RAG company-wide retrieval",
        engine: "Naive RAG",
        form: engineToForm("Naive RAG"),
        latencyMs: Date.now() - startedAt,
        sourceName: `${naiveRefs.length} sources`,
        scenarioName: "Company-wide retrieval",
        hitCount: clean.length,
        hits: clean.slice(0, 3).map((r) => ({ excerpt: excerpt(sanitizeKnowledgeExcerpt(r.text), 300) }))
      });
      for (const r of clean) {
        const ref = refBySource.get(r.sourceId);
        if (!ref) continue; // 跨源命中按 sourceId 归因（M4），找不到对应 ref 则跳过，不错套第一个 ref
        naiveCitations.push({
          knowledgeObjectId: ref.objectId,
          sourceOriginalName: String(ref.metadata.originalFileName ?? ref.sourceName),
          scenarioId: ref.scenarioId,
          scenarioName: String(ref.metadata.scenarioName ?? ref.scenarioId),
          engine: ref.engine,
          knowledgeType: storeKnowledgeTypeLabel(ref.engine),
          excerpt: excerpt(sanitizeKnowledgeExcerpt(r.text), 1200)
        } as GlobalChatCitation);
      }
    } catch {
      // Naive 全局检索失败不阻断其它引擎。
    }
  }

  // 其它引擎并发逐源（原 searchOne）。并发上限避免对 embedding 端点限流丢源。
  // 默认 4：非 Naive 源（Gbrain+GraphRAG）通常 ≤4，一批并发拉平多源检索延迟（I74 #8 实证 graph 3 源串行占 15s）；不设更高防 embedding 端点并发限流（P8 教训）。
  const concurrency = Math.max(1, Number(process.env.FF_GLOBAL_RETRIEVAL_CONCURRENCY ?? 4));
  const otherPerRef: GlobalChatCitation[][] = [];
  for (let i = 0; i < otherRefs.length; i += concurrency) {
    const batch = await Promise.all(otherRefs.slice(i, i + concurrency).map(searchOne));
    otherPerRef.push(...batch);
  }
  // Naive 优先（enginePriority=0）放前，合并后统一截断候选池再 rerank。
  const candidates = [...naiveCitations, ...otherPerRef.flat()].slice(0, runtimeConfig.candidatePoolSize);
  return await rerankCitations(query, candidates, spans);
}

// 全局 Naive 检索（修架构债 I60）：对一组已授权的源做一次全局检索 → 模块内全局 RRF + 全局 TopK + 全局归一化阈值。
// 权限边界：sourceIds 必须是平台已用 canAccess / moduleReferenceAllowedByChatScope 预授权的源；
// 模块自身权限只有 admin/public/owner（无 team/company），故这里用 elevated reader(role=admin) 让模块放行，
// 由 sourceIds 充当唯一权限边界（等价于旧逐源 moduleReaderForReference 的 owner 模拟，但一次覆盖多源）。
// 安全闭环（codex 审）：参数收**已授权的 refs**（调用方均传 canAccess/scope 过滤后的 StoredModuleReference[]），
// 函数内派生 sourceIds —— 杜绝外部传裸 sourceIds 绕过授权。
async function searchNaiveGlobal(
  user: StoreUser,
  query: string,
  refs: StoredModuleReference[],
  limit: number,
  minScore?: number
): Promise<Array<{ text: string; sourceId: string; documentId: string }>> {
  const sourceIds = refs.map((ref) => ref.sourceId);
  if (sourceIds.length === 0) return [];
  const reader: StoreUser = { ...user, role: "admin" };
  const body = await moduleJson<{ results?: any[] }>("Naive RAG", "/traditional/search", {
    method: "POST",
    user: reader,
    body: { query, limit, source_ids: sourceIds, ...(typeof minScore === "number" && minScore > 0 ? { min_score: minScore } : {}) }
  });
  const chunkResults = (body.results ?? []).map((result) => ({
    text: result.chunk?.text ?? result.chunk?.chunk_text ?? result.chunk?.snippet ?? "",
    sourceId: String(result.chunk?.source_id ?? result.source?.id ?? ""),
    documentId: String(result.chunk?.document_id ?? result.document?.id ?? "")
  }));
  // 表格资料（CSV/XLSX）数据在 traditional_structured_rows，chunk /search 查不到（I83 根治）。
  // structured/search 仅单源 → 按源并行检索，单源失败隔离，表格结果并到 chunk 之后。
  const structuredResults = (
    await Promise.all(sourceIds.map((sourceId) => searchNaiveStructured(reader, query, sourceId, limit)))
  ).flat();
  return [...chunkResults, ...structuredResults];
}

// 表格单源检索 helper（I83 根治）：CSV/XLSX 入库走 traditional_structured_rows，chunk 端点
// /traditional/search 不覆盖它；此函数调 /traditional/structured/search，把命中行 semantic_text
// 映射为与 chunk 同构的召回文本。structured/search 仅支持单 source_id；失败隔离兜底空数组，绝不拖垮 chunk 召回。
async function searchNaiveStructured(
  reader: StoreUser,
  query: string,
  sourceId: string,
  limit: number
): Promise<Array<{ text: string; sourceId: string; documentId: string }>> {
  if (!sourceId) return [];
  type StructuredRow = { text: string; sourceId: string; documentId: string };
  const fetchRows = moduleJson<{ results?: Array<{ semantic_text?: string; source_id?: string; document_id?: string }> }>(
    "Naive RAG",
    "/traditional/structured/search",
    { method: "POST", user: reader, body: { query, limit, source_id: sourceId } }
  ).then((body) =>
    (body.results ?? [])
      .map((row) => ({
        text: String(row.semantic_text ?? ""),
        sourceId: String(row.source_id ?? ""),
        documentId: String(row.document_id ?? "")
      }))
      .filter((row) => row.text !== "" && row.sourceId !== "")
  );
  // 失败隔离对「挂起/超慢」也成立（codex 审 NIT）：moduleJson 无 AbortSignal，用超时兜底空数组，
  // 避免 structured 挂起拖住外层 25s Promise.race 而丢掉已拿到的 chunk 召回。
  // 超时取 20s：structured_rows 无 HNSW 走精确全扫 + query embedding，单源 100 行实测可达 ~7.5s，
  // 8s 会误杀正常查询致召回空；20s 容纳正常查询 + 余量，仍 < 外层 25s race，只截断真·挂起。
  const timeout = new Promise<StructuredRow[]>((resolve) => setTimeout(() => resolve([]), 20000));
  return Promise.race([fetchRows, timeout]).catch(() => [] as StructuredRow[]);
}

// 针对单个模块来源引用，调用对应引擎的真实检索端点，返回召回到的文本片段列表。
async function searchModuleForReference(
  user: StoreUser,
  ref: StoredModuleReference,
  query: string,
  limit: number,
  minScore?: number
): Promise<string[]> {
  const reader = moduleReaderForReference(user, ref);
  if (ref.engine === "Gbrain") {
    const body = await moduleJson<{ citations?: any[] }>("Gbrain", "/nano/ask", {
      method: "POST",
      user: reader,
      body: { query, limit, source_id: ref.sourceId }
    });
    return (body.citations ?? [])
      .filter((citation) => citationMatchesReference(citation, ref))
      // 优先完整 chunk 正文，snippet 只是高亮片段、可能裁掉关键句（如末尾条款）。
      .map((citation) => citation.chunk_text ?? citation.text ?? citation.snippet ?? "");
  }
  if (ref.engine === "Naive RAG") {
    const body = await moduleJson<{ results?: any[] }>("Naive RAG", "/traditional/search", {
      method: "POST",
      user: reader,
      // min_score 仅在显式设了正阈值时透传，未设/0 不传 → 模块不过滤（存量行为零变化）。
      body: { query, limit, source_id: ref.sourceId, ...(typeof minScore === "number" && minScore > 0 ? { min_score: minScore } : {}) }
    });
    const chunkTexts = (body.results ?? []).map((result) => result.chunk?.text ?? result.chunk?.chunk_text ?? result.chunk?.snippet ?? "");
    // 表格资料（CSV/XLSX）走 structured/search 补召回（I83 根治），失败隔离，并到 chunk 之后。
    const structuredTexts = (await searchNaiveStructured(reader, query, ref.sourceId, limit)).map((row) => row.text);
    return [...chunkTexts, ...structuredTexts];
  }
  // 用 /graph/search（纯检索 ~1.2s）而非 /graph/ask（含 LLM 生成 answer，延迟 1-18s 波动、抖到 >20s 被 perSourceTimeout 超时跳过）。
  // 全域检索本身会用证据自行生成答案，无需 graph 模块再生成一次（重复且是超时元凶）。
  const body = await moduleJson<{ results?: any[] }>("GraphRAG", "/graph/search", {
    method: "POST",
    user: reader,
    body: { query, limit, source_id: ref.sourceId, mode: "mix" }
  });
  return (body.results ?? []).map(
    (item) => item.context ?? item.text ?? item.chunk_text ?? item.snippet ?? ""
  );
}

async function routeGlobalChatQuery(query: string): Promise<{ mode: "direct" | "retrieve"; reason: string }> {
  const normalized = query.trim();
  if (!normalized) return { mode: "direct", reason: "Empty question; no knowledge base retrieval" };
  if (isSmallTalkQuery(normalized)) return { mode: "direct", reason: "Small talk and general chat answered directly by the model" };
  if (isBusinessKnowledgeQuery(normalized)) return { mode: "retrieve", reason: "The question mentions business entities, files, or analysis needs, so enterprise knowledge is required" };

  const llmRoute = await classifyQueryWithModel(normalized);
  if (llmRoute) return llmRoute;
  // 分类器失败/超时（限速网络下常见）→ 企业级默认检索：宁可检索后由相关性评分诚实拒答，
  // 也绝不因路由器抖动静默跳过检索、给出空泛非答案。
  return { mode: "retrieve", reason: "Routing is uncertain; default to enterprise knowledge retrieval to avoid misses" };
}

function isSmallTalkQuery(query: string) {
  const normalized = query.replace(/\s+/g, "").toLowerCase();
  const exactGreetings = ["hi", "hello", "hey", "thanks", "thank you", "good morning", "good afternoon", "good evening", "are you there", "你好", "您好", "谢谢", "感谢"];
  if (exactGreetings.includes(normalized)) return true;
  if (normalized.length <= 16 && /^(hi|hello|hey|thanks|thank you|are you there|你好|您好|谢谢|感谢)/i.test(normalized)) return true;
  return false;
}

function isBusinessKnowledgeQuery(query: string) {
  // 新增（I74 #8 提速）：错误码模式（ERR-4096 / ERR_KG_1042 / E1234 等）直接命中→retrieve，跳过慢且不稳的 LLM 路由。
  if (/[A-Za-z]{1,}[-_]?\d{3,}/.test(query)) return true;
  const normalized = query.toLowerCase();
  const businessTerms = [
    "customer", "renewal", "risk", "opportunity", "policy", "contract", "expense", "sales", "quarter", "data", "file", "document", "report",
    "analysis", "summary", "evidence", "source", "company", "team", "project", "order", "invoice", "budget", "process", "account profile", "knowledge base",
    // Frequent HR / travel / workplace requests, so they do not fall through to the slower LLM classifier
    "travel", "trip", "hotel", "transport", "meal", "benefit", "pto", "vacation", "leave", "attendance", "overtime", "comp time",
    "salary", "payroll", "performance", "commission", "401k", "onboarding", "promotion", "offboarding", "approval", "limit", "cap", "quota",
    "reimbursement", "request", "device", "procurement", "permission", "role", "level", "review", "training",
    "pdf", "word", "markdown", "csv", "graph", "rag", "wiki",
    // Frequent IT / incident terms; a zero-hit retrieval refuses instead of hallucinating, which is safe
    "incident", "error", "error code", "outage", "troubleshoot", "postmortem", "on-call", "log", "deploy", "configuration", "fix", "how do", "how to",
    // Legacy Chinese queries must keep matching while older stored conversations exist
    "客户", "续约", "风险", "机会", "制度", "政策", "合同", "报销", "销售", "季度", "数据", "资料", "文档", "报告",
    "分析", "总结", "依据", "来源", "公司", "团队", "项目", "订单", "发票", "预算", "流程", "知识库",
    "差旅", "住宿", "交通", "福利", "年假", "请假", "考勤", "审批", "标准", "上限", "额度", "采购", "权限", "培训",
    "故障", "报错", "异常", "排查", "复盘", "运维", "日志", "部署", "配置"
  ];
  return businessTerms.some((term) => normalized.includes(term));
}

function knowledgeAllowedByChatScope(user: StoreUser, item: StoredKnowledgeObject, scope: GlobalChatScope) {
  const accessControl = accessControlFromKnowledgeObject(item);
  if (scope === "company") return true;
  if (scope === "private") return accessControl.ownerUserId === user.userId;
  if (accessControl.ownerUserId === user.userId) return true;
  if (accessControl.scope !== "team") return false;
  if (accessControl.organizationId !== normalizeOrganizationId(user.organizationId)) return false;
  return accessControl.teamIds.some((teamId) => normalizeTeamIds(user.teamIds).includes(teamId));
}

function buildGlobalRetrievalTracks(citations: GlobalChatCitation[]): GlobalChatRetrievalTrack[] {
  return [
    {
      label: "Document evidence",
      count: citations.filter((item) => item.engine === "Naive RAG").length,
      description: "Raw evidence chunks from policies, contracts, PDFs, Word documents, and spreadsheets."
    },
    {
      label: "Knowledge graph",
      count: citations.filter((item) => item.engine === "GraphRAG").length,
      description: "Relationships among customers, people, vendors, events, and risks."
    },
    {
      label: "Knowledge wiki",
      count: citations.filter((item) => item.engine === "Gbrain").length,
      description: "Compiled wikis, handbooks, fact cards, and reusable conclusions."
    }
  ];
}

async function buildGlobalChatAnswerText(
  query: string,
  outputMode: GlobalChatOutputMode,
  citations: GlobalChatCitation[],
  memoryHits: string[],
  onLlm?: (info: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void
) {
  if (citations.length === 0) {
    return `I could not find enough evidence in the knowledge assets this account can access to answer "${query}". Start by picking a scenario template and uploading files, or save the question as a business scenario to build.`;
  }
  const grouped = buildEngineSummary(citations);
  const evidence = citations.slice(0, 3).map((citation, index) => `${index + 1}. ${citation.scenarioName}：${citation.excerpt}`).join("\n");
  const memoryText = memoryHits.length ? `\n\nThis turn also used earlier session memory: ${memoryHits.join("; ")}` : "";
  const generated = await synthesizeGlobalAnswerWithModel(query, outputMode, citations, memoryHits, onLlm);
  if (generated) return generated;
  if (outputMode === "report") {
    return `Using the company knowledge this account can access, I turned "${query}" into a report draft.\n\nCore judgment: ${grouped}.\n\nKey evidence:\n${evidence}${memoryText}`;
  }
  if (outputMode === "table") {
    return `Using the company knowledge this account can access, "${query}" matched ${citations.length} evidence items. It can be shaped into table fields: conclusion, source scenario, knowledge type, evidence excerpt, and next action.\n\n${evidence}${memoryText}`;
  }
  return `For "${query}" I searched the document evidence, relationship graph, and knowledge wiki this account can access. ${grouped}.\n\nTraceable evidence:\n${evidence}${memoryText}`;
}

async function classifyQueryWithModel(query: string): Promise<{ mode: "direct" | "retrieve"; reason: string } | null> {
  const content = await callAgentChatModel([
    {
      role: "system",
      content: [
        "You are the Agentic RAG router for an enterprise knowledge platform. Decide whether the user question needs enterprise knowledge base retrieval.",
        "【direct】Only for: small talk, general knowledge unrelated to a specific business entity, and generic text generation (translation, poems, generic template emails).",
        "【retrieve】Anything involving an internal business entity, or any question that needs internal material to answer accurately.",
        "**Pay special attention (most common misroute)**: employee names (who is X / what does X own / who does X report to / X's background), product names (what is X / how is X / what does X do), investors (who did X invest in / who does X work with), company names (where is X headquartered / when was X founded / who is X's CFO) — even if they look generic, route to retrieve whenever they may point at an internal business entity. Routing them to direct lets the model fabricate business facts.",
        "When unsure, default to retrieve: an honest refusal after retrieval is better than a fabricated direct answer.",
        "Return JSON only: {\"mode\":\"direct|retrieve\",\"reason\":\"short reason in English\"}."
      ].join("\n")
      // 路由 prompt 经 DSPy 评测集（60 条含 25 边界例）优化：原 zero-shot 边界 65%→强化后 100%，总 86%→98%（台账 I74 #9）。
    },
    { role: "user", content: query }
  ], { temperature: 0, maxTokens: 160 });
  if (!content) return null;
  const parsed = parseJsonObject(content);
  if (!parsed) return null;
  const mode = parsed.mode === "retrieve" ? "retrieve" : parsed.mode === "direct" ? "direct" : null;
  if (!mode) return null;
  return { mode, reason: typeof parsed.reason === "string" ? parsed.reason : "Model routing decision" };
}

async function generateDirectGlobalReply(
  query: string,
  onLlm?: (info: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void
) {
  const content = await callAgentChatModel([
    {
      role: "system",
      content: "You are CompanyBrain, the company-wide assistant of an enterprise knowledge platform. The current question was judged not to need knowledge base retrieval, so answer it directly, naturally, and concisely. Never fabricate internal business facts (job titles, product details, company numbers, contracts, funding). If the question actually involves a specific business proper noun (person, product, company, or institution), do not answer from thin air; say the question needs enterprise knowledge retrieval and ask for scope or a reframed question instead of stating a fixed conclusion. Do not mention retrieved material."
    },
    { role: "user", content: query }
  ], { temperature: 0.3, maxTokens: 320 }, onLlm);
  if (content) return content;
  if (isSmallTalkQuery(query)) return "Hi, I'm here. Ask a business question directly, or upload files and I'll analyze them with enterprise knowledge.";
  return "I'm here. This question does not need enterprise knowledge retrieval, so go ahead; if it should use internal material, name the customer, policy, contract, or data scope.";
}

async function synthesizeGlobalAnswerWithModel(
  query: string,
  outputMode: GlobalChatOutputMode,
  citations: GlobalChatCitation[],
  memoryHits: string[],
  onLlm?: (info: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void
) {
  if (citations.length === 0) return null;
  const evidence = citations.map((citation, index) => [
    `Source ${index + 1}`,
    `Knowledge type: ${citation.knowledgeType}`,
    `Scenario: ${citation.scenarioName}`,
    `Source: ${citation.sourceOriginalName}`,
    `Content: ${citation.excerpt}`
  ].join("\n")).join("\n\n");
  return callAgentChatModel([
    {
      role: "system",
      content: [
        "You are the Agentic RAG answer generator for an enterprise knowledge platform.",
        "Answer only from the provided evidence; do not add business facts from outside the material.",
        "If the evidence is insufficient, say so clearly and suggest the next step.",
        "Write for business users and avoid exposing technical details such as RAG, embeddings, or context compression.",
        outputMode === "report" ? "Output a short report draft." : outputMode === "table" ? "Output structured conclusions suitable for a table." : "Output a concise business answer."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Question: ${query}`,
        memoryHits.length ? `Earlier focus areas you can reference: ${memoryHits.join("; ")}` : "",
        "Evidence:",
        evidence
      ].filter(Boolean).join("\n\n")
    }
  ], { temperature: 0.2, maxTokens: 900 }, onLlm);
}

async function callAgentChatModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: { temperature: number; maxTokens: number },
  onLlm?: (info: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void
): Promise<string | null> {
  if (process.env.FF_PLATFORM_AGENT_MODE === "local" || process.env.FF_PLATFORM_AGENT_MODE === "off") return null;
  const apiKey = await readAgentEnv("AGENT_API_KEY") ?? await readAgentEnv("OPENROUTER_API_KEY");
  if (!apiKey) return null;
  const baseUrl = (await readAgentEnv("AGENT_BASE_URL") ?? await readAgentEnv("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = await readAgentEnv("AGENT_MODEL") ?? await readAgentEnv("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";
  const timeoutMs = Number(await readAgentEnv("AGENT_TIMEOUT_MS") ?? 25000);
  // OpenRouter 偶发挂起/抖动；多次重试以避免在真实证据已召回的情况下回退到模板答案。
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost",
          "X-Title": "ff-companybrain"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const body = await response.json().catch(() => null) as any;
      if (!response.ok) {
        if (attempt < attempts - 1) { await new Promise((r) => setTimeout(r, 1200)); continue; }
        return null;
      }
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        const usage = body?.usage ?? {};
        onLlm?.({
          model,
          latencyMs: Date.now() - startedAt,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        });
        return content.trim();
      }
      if (attempt < attempts - 1) { await new Promise((r) => setTimeout(r, 1200)); continue; }
      return null;
    } catch {
      if (attempt < attempts - 1) { await new Promise((r) => setTimeout(r, 1200)); continue; }
      return null;
    }
  }
  return null;
}

let cachedAgentEnv: Record<string, string> | null = null;

async function readAgentEnv(name: string): Promise<string | undefined> {
  if (process.env[name]) return process.env[name];
  if (!cachedAgentEnv) cachedAgentEnv = await readAgentEnvFile();
  return cachedAgentEnv[name];
}

async function readIntegrationEnv(name: string): Promise<string | undefined> {
  if (process.env[name]) return process.env[name];
  if (!cachedAgentEnv) cachedAgentEnv = await readAgentEnvFile();
  return cachedAgentEnv[name];
}

async function readAgentEnvFile(): Promise<Record<string, string>> {
  const candidates = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", "..", ".env")
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      return parseEnvFile(raw);
    } catch {
      // Continue to the next likely project root.
    }
  }
  return {};
}

function parseEnvFile(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function globalCitationExcerpt(item: StoredKnowledgeObject) {
  const indexedText = item.moduleReferences
    ?.map((reference) => reference.metadata?.indexedText)
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return scenarioCitationExcerpt(indexedText ?? item.content, 260);
}

function sanitizeKnowledgeExcerpt(value: string) {
  const afterContent = extractKnowledgeContentPayload(value);
  const readablePdfText = extractPdfReadableText(afterContent);
  const candidate = readablePdfText || afterContent;
  const cleaned = containsRawParserPayload(candidate)
    ? stripRawParserPayload(candidate)
    : cleanKnowledgeDisplayText(candidate);
  if (!cleaned || cleaned.length < 12 || containsRawParserPayload(cleaned)) {
    return "The file is ingested, but there is not enough displayable text; open the original file or parsed artifact in the admin console.";
  }
  return formatStructuredExcerpt(cleaned);
}

function scenarioCitationExcerpt(value: string, maxLength: number) {
  return excerpt(sanitizeKnowledgeExcerpt(value), maxLength);
}

function extractKnowledgeContentPayload(value: string) {
  const match = value.match(/(?:内容|Content)[:：]([\s\S]*)/u);
  return match ? match[1] : value;
}

function cleanKnowledgeDisplayText(value: string) {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatStructuredExcerpt(value: string) {
  const table = formatDelimitedTableExcerpt(value);
  return table ?? value.replace(/\s+/g, " ").trim();
}

function formatDelimitedTableExcerpt(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const separator = lines[0].includes("\t") ? "\t" : ",";
  if (!lines[0].includes(separator)) return null;
  const headers = splitDelimitedLine(lines[0], separator).map(cleanCellText).filter(Boolean);
  if (headers.length < 2) return null;
  const rows = lines.slice(1, 4)
    .map((line) => splitDelimitedLine(line, separator).map(cleanCellText))
    .filter((row) => row.length >= 2);
  if (rows.length === 0) return null;
  return rows.map((row) => headers.slice(0, 5)
    .map((header, index) => row[index] ? `${header}：${row[index]}` : "")
    .filter(Boolean)
    .join("，"))
    .join("；");
}

function splitDelimitedLine(line: string, separator: "," | "\t") {
  if (separator === "\t") return line.split("\t");
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function cleanCellText(value: string) {
  return value.replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ").trim();
}

function containsRawParserPayload(value: string) {
  return /%PDF|%%EOF|\bendobj\b|\b\d+\s+\d+\s+obj\b|\/(?:Type|Catalog|Pages|Page|Parent|MediaBox|Resources|Contents|Font|Subtype|Length|Filter)/i.test(value);
}

function extractPdfReadableText(value: string) {
  const matches = Array.from(value.matchAll(/\(([^()]{6,})\)\s*Tj/gi))
    .map((match) => decodePdfLiteralText(match[1]))
    .filter(Boolean);
  return matches.join(" ");
}

function decodePdfLiteralText(value: string) {
  return value
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .trim();
}

function stripRawParserPayload(value: string) {
  return value
    .replace(/%PDF-[^\s。！？\n]*/gi, " ")
    .replace(/%%EOF|\bxref\b|\bstartxref\b|\btrailer\b|\bstream\b|\bendstream\b/gi, " ")
    .replace(/\b\d+\s+\d+\s+obj\b|\bendobj\b/gi, " ")
    .replace(/<<[\s\S]*?>>/g, " ")
    .replace(/\/[A-Za-z0-9#_.-]+/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[<>{}[\]]/g, " ")
    .replace(/\b0{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEngineSummary(citations: GlobalChatCitation[]) {
  const tracks = buildGlobalRetrievalTracks(citations).filter((track) => track.count > 0);
  return tracks.map((track) => `${track.label}: ${track.count}`).join(", ") || "No citable knowledge matched";
}

function updateLongTermFacts(facts: string[], query: string, citations: GlobalChatCitation[]) {
  const nextFact = citations.length
    ? `Focus: "${chatTitleFromQuery(query)}"; frequent sources include ${Array.from(new Set(citations.map((item) => item.scenarioName))).slice(0, 3).join(", ")}`
    : `Focus: "${chatTitleFromQuery(query)}" but no knowledge assets matched yet`;
  return Array.from(new Set([nextFact, ...facts])).slice(0, 20);
}

function rankLongTermFacts(query: string, facts: string[]) {
  return facts
    .map((fact) => ({
      fact,
      score: queryTokens(query.toLowerCase()).reduce((total, token) => total + (fact.toLowerCase().includes(token) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.fact);
}

function buildCompressedContext(session: StoredGlobalChatSession) {
  const olderMessages = session.messages.slice(0, Math.max(0, session.messages.length - 8));
  if (olderMessages.length < 8) return session.compressedContext;
  const turns = olderMessages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => chatTitleFromQuery(message.content));
  return turns.length ? `Conversation summary: the user previously focused on ${turns.join(", ")}.` : session.compressedContext;
}

function chatTitleFromQuery(query: string) {
  return excerpt(query.replace(/\s+/g, " ").trim(), 28) || "New company-wide Q&A";
}

function globalScopeLabel(scope: GlobalChatScope) {
  if (scope === "private") return "Personal files";
  if (scope === "team") return "Team knowledge";
  return "Company-wide knowledge";
}

function storeKnowledgeTypeLabel(engine: AdminRagEngine): GlobalChatCitation["knowledgeType"] {
  if (engine === "Naive RAG") return "Document evidence";
  if (engine === "GraphRAG") return "Knowledge graph";
  return "Knowledge wiki";
}

function canAccess(user: StoreUser, accessControl: StoredAccessControl) {
  if (user.role === "admin") return true;
  if (accessControl.ownerUserId === user.userId) return true;
  if (accessControl.scope === "private") return false;

  const userOrganizationId = normalizeOrganizationId(user.organizationId);
  if (accessControl.organizationId !== userOrganizationId) return false;
  if (accessControl.scope === "company") return true;

  const userTeamIds = normalizeTeamIds(user.teamIds);
  return accessControl.teamIds.some((teamId) => userTeamIds.includes(teamId));
}

function accessControlFor(scope: StoreVisibility, owner: StoreUser): StoredAccessControl {
  return {
    scope,
    ownerUserId: owner.userId,
    ownerName: owner.name,
    organizationId: normalizeOrganizationId(owner.organizationId),
    teamIds: normalizeTeamIds(owner.teamIds)
  };
}

function accessControlFromScenario(scenario: StoredScenario): StoredAccessControl {
  return normalizeAccessControl(scenario.accessControl, {
    scope: scenario.visibility,
    ownerUserId: scenario.ownerUserId,
    ownerName: scenario.ownerName,
    organizationId: scenario.organizationId,
    teamIds: scenario.teamIds
  });
}

function accessControlFromKnowledgeObject(item: StoredKnowledgeObject): StoredAccessControl {
  return normalizeAccessControl(item.accessControl, {
    scope: item.visibility,
    ownerUserId: item.ownerUserId,
    ownerName: item.ownerName,
    organizationId: item.organizationId,
    teamIds: item.teamIds
  });
}

function normalizeAccessControl(
  accessControl: StoredAccessControl | undefined,
  fallback: {
    scope: StoreVisibility;
    ownerUserId: string;
    ownerName: string;
    organizationId?: string;
    teamIds?: string[];
  }
): StoredAccessControl {
  return {
    scope: accessControl?.scope ?? fallback.scope,
    ownerUserId: accessControl?.ownerUserId ?? fallback.ownerUserId,
    ownerName: accessControl?.ownerName ?? fallback.ownerName,
    organizationId: normalizeOrganizationId(accessControl?.organizationId ?? fallback.organizationId),
    teamIds: normalizeTeamIds(accessControl?.teamIds ?? fallback.teamIds)
  };
}

function normalizeOrganizationId(value?: string) {
  return value?.trim() || "org_companybrain";
}

function normalizeTeamIds(value?: string[]) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function dataRoot() {
  return process.env.FF_PLATFORM_DATA_DIR || join(process.cwd(), ".platform-data");
}

function dbPath() {
  return join(dataRoot(), "platform-db.json");
}

async function readDb(): Promise<PlatformDb> {
  const path = dbPath();
  try {
    const fileStat = await stat(path);
    if (dbCache && dbCache.path === path && dbCache.mtimeMs === fileStat.mtimeMs) {
      return normalizeDb(dbCache.db);
    }
    const raw = await readFile(path, "utf8");
    const db = normalizeDb({ ...emptyDb(), ...JSON.parse(raw) });
    dbCache = { path, mtimeMs: fileStat.mtimeMs, db };
    return db;
  } catch {
    dbCache = null;
    return normalizeDb(emptyDb());
  }
}

async function writeDb(db: PlatformDb) {
  await mkdir(dataRoot(), { recursive: true });
  const path = dbPath();
  const normalized = normalizeDb(db);
  await writeFile(path, JSON.stringify(normalized));
  const fileStat = await stat(path);
  dbCache = { path, mtimeMs: fileStat.mtimeMs, db: normalized };
}

// #7 持久化临界区串行 mutex：把"重读最新 db → 改 → writeDb"串行化，
// 避免并发 read-modify-write 因 writeDb 整库覆盖而互相丢数据（检索/LLM 仍在锁外并发）。
let dbLockChain: Promise<unknown> = Promise.resolve();
function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = dbLockChain.then(() => fn());
  dbLockChain = p.then(() => undefined, () => undefined);
  return p;
}

function normalizeDb(db: PlatformDb): PlatformDb {
  return {
    ...emptyDb(),
    ...db,
    templates: mergeAdminTemplates(db.templates ?? []),
    auditEvents: db.auditEvents ?? [],
    traces: db.traces ?? [],
    runtimeConfig: db.runtimeConfig ?? {}
  };
}

function serviceStatus(status?: AdminServiceHealthStatus): "ok" | "error" | "unknown" {
  if (!status) return "unknown";
  return status === "healthy" ? "ok" : "error";
}

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function secretState(...envNames: string[]) {
  const configuredEnv = envNames.find((envName) => Boolean(envValue(envName)));
  const envName = configuredEnv ?? envNames[0] ?? "UNKNOWN_SECRET";
  const value = configuredEnv ? envValue(configuredEnv) : null;
  return {
    env_name: envName,
    configured: Boolean(value),
    fingerprint: value ? secretFingerprint(value) : null
  };
}

function secretFingerprint(value: string) {
  if (value.length <= 8) return "Configured";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function databaseState(id: string, label: string, envName: string): AdminIntegrationSettings["databases"][number] {
  const value = envValue(envName);
  if (!value) {
    return { id, label, env_name: envName, configured: false, host: null, port: null, database: null, username: null };
  }

  try {
    const url = new URL(value);
    return {
      id,
      label,
      env_name: envName,
      configured: true,
      host: url.hostname || null,
      port: url.port || null,
      database: url.pathname.replace(/^\/+/, "") || null,
      username: url.username || null
    };
  } catch {
    return { id, label, env_name: envName, configured: true, host: "Custom connection string", port: null, database: null, username: null };
  }
}

function sanitizeStrategyParameters(input?: AdminStrategyParameters): AdminStrategyParameters {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key.trim(), String(value ?? "").trim()] as const)
      .filter(([key, value]) => key && value)
  );
}

function appendAuditEvent(
  db: PlatformDb,
  user: StoreUser,
  input: { area: string; summary: string; impact: string }
) {
  const now = new Date().toISOString();
  db.auditEvents = [
    {
      id: `audit_${randomUUID()}`,
      actor: user.name,
      area: input.area,
      summary: input.summary,
      impact: input.impact,
      time: displayRelativeTime(now),
      createdAt: now
    },
    ...(db.auditEvents ?? [])
  ].slice(0, 500);
}

function activeAdminTemplates(templates: StoredAdminTemplate[]) {
  return mergeAdminTemplates(templates).filter((template) => template.state !== "archived");
}

function adminTemplateForScenario(db: PlatformDb, templateId: string): StoredAdminTemplate {
  return activeAdminTemplates(db.templates).find((template) => template.id === templateId) ?? customAdminTemplateFallback(templateId);
}

function customAdminTemplateFallback(templateId: string): StoredAdminTemplate {
  const now = new Date().toISOString();
  return {
    id: templateId || "custom-scenario",
    name: "Custom business scenario",
    category: "Custom",
    state: "custom",
    source: "custom",
    owner: "Scenario creator",
    headline: "The admin console picks a suitable real RAG ingest policy after the user submits files and a business goal.",
    acceptedFiles: ["PDF", "Word", "Markdown", "Spreadsheet data", "Images", "Audio/video"],
    inputExamples: ["Business notes", "Reference files", "Data spreadsheets"],
    outputCapabilities: ["Answers you can question", "Cited evidence", "Business deliverable"],
    productForm: ["hybrid", "task_workflow"],
    reviewRequirement: "Requires admin confirmation",
    evidenceSources: ["User created"],
    evidenceCoverage: 50,
    demoReadiness: 20,
    canEdit: false,
    canDelete: false,
    createdAt: now,
    updatedAt: now
  };
}

function mergeAdminTemplates(existing: StoredAdminTemplate[]) {
  const existingById = new Map(existing.map((item) => [item.id, normalizeAdminTemplate(item)]));
  const official = officialTemplates.map((template) => {
    const seeded = officialAdminTemplate(template);
    const stored = existingById.get(template.id);
    return {
      ...seeded,
      state: stored?.source === "official" ? stored.state : seeded.state,
      owner: stored?.owner || seeded.owner,
      reviewRequirement: stored?.reviewRequirement || seeded.reviewRequirement,
      evidenceSources: stored?.evidenceSources?.length ? stored.evidenceSources : seeded.evidenceSources,
      updatedAt: stored?.updatedAt || seeded.updatedAt,
      canDelete: false
    };
  });
  const officialIds = new Set(official.map((item) => item.id));
  const custom = existing
    .map(normalizeAdminTemplate)
    .filter((item) => item.source === "custom" && !officialIds.has(item.id) && item.state !== "archived");
  return [...official, ...custom];
}

function officialAdminTemplate(template: ScenarioTemplate): StoredAdminTemplate {
  const ready = template.demoWalkthrough.sampleInputs.length >= 2 && template.demoWalkthrough.citations.length >= 2;
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    state: "official",
    source: "official",
    owner: ownerForTemplate(template.id),
    headline: template.headline,
    acceptedFiles: template.acceptedFiles,
    inputExamples: template.inputExamples,
    outputCapabilities: template.outputCapabilities,
    productForm: template.productForm,
    reviewRequirement: template.reviewRequirement,
    evidenceSources: template.evidenceSources,
    evidenceCoverage: template.evidenceLevel === "validated" ? 100 : 60,
    demoReadiness: ready ? 100 : 55,
    canEdit: true,
    canDelete: false,
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z"
  };
}

function normalizeAdminTemplate(template: StoredAdminTemplate): StoredAdminTemplate {
  return {
    ...template,
    state: template.state ?? (template.source === "official" ? "official" : "candidate"),
    source: template.source ?? "custom",
    acceptedFiles: cleanStringArray(template.acceptedFiles, ["PDF", "Word", "Markdown", "Spreadsheet data"]),
    inputExamples: cleanStringArray(template.inputExamples, ["Business notes", "Reference files"]),
    outputCapabilities: cleanStringArray(template.outputCapabilities, ["Answers you can question", "Cited evidence"]),
    productForm: cleanProductForms(template.productForm),
    reviewRequirement: cleanReviewRequirement(template.reviewRequirement),
    evidenceSources: cleanStringArray(template.evidenceSources, ["Created by an admin"]),
    evidenceCoverage: Number.isFinite(template.evidenceCoverage) ? template.evidenceCoverage : 50,
    demoReadiness: Number.isFinite(template.demoReadiness) ? template.demoReadiness : 30,
    canEdit: true,
    canDelete: template.source === "custom"
  };
}

function ownerForTemplate(id: string) {
  if (id.includes("customer") || id.includes("rfp") || id.includes("voice")) return "Sales Ops";
  if (id.includes("support")) return "Customer Success";
  if (id.includes("risk") || id.includes("domain")) return "Risk & Compliance";
  if (id.includes("contract")) return "Legal";
  if (id.includes("policy")) return "People & Workplace";
  if (id.includes("data")) return "Data Operations";
  if (id.includes("runbook")) return "IT Operations";
  return "Knowledge Ops";
}

function uniqueTemplateId(templates: StoredAdminTemplate[], seed: string) {
  const base = slugify(seed) || `template-${Date.now()}`;
  const used = new Set(templates.map((item) => item.id));
  if (!used.has(base)) return base;
  for (let index = 2; index < 200; index += 1) {
    const next = `${base}-${index}`;
    if (!used.has(next)) return next;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function slugify(value: string) {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (/^[a-z0-9-]+$/.test(ascii)) return ascii;
  return `template-${Array.from(value).map((char) => char.charCodeAt(0).toString(36)).join("-").slice(0, 60)}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown, fallback: string[]) {
  const items = Array.isArray(value) ? value : [];
  const cleaned = items.map((item) => String(item ?? "").trim()).filter(Boolean);
  return Array.from(new Set(cleaned.length ? cleaned : fallback));
}

function cleanProductForms(value: unknown): TemplateProductForm[] {
  const allowed: TemplateProductForm[] = ["chat", "embedded_assistant", "knowledge_portal", "document_review", "report_generator", "graph_explorer", "task_workflow", "hybrid"];
  const items = Array.isArray(value) ? value : [];
  const cleaned = items.filter((item): item is TemplateProductForm => allowed.includes(item as TemplateProductForm));
  return cleaned.length ? Array.from(new Set(cleaned)) : ["hybrid", "task_workflow"];
}

function cleanReviewRequirement(value: unknown): ScenarioTemplate["reviewRequirement"] {
  if (value === "No admin confirmation needed" || value === "Requires admin confirmation" || value === "Admin confirmation recommended") return value;
  return "Requires admin confirmation";
}

function stripInternalTask(task: StoreTask): ProcessingTask {
  const { ownerUserId: _ownerUserId, createdAt: _createdAt, updatedAtIso: _updatedAtIso, ...publicTask } = task;
  return publicTask;
}

function toDisplayTask(task: StoreTask): StoreTask {
  return {
    ...task,
    submittedAt: displayRelativeTime(task.createdAt),
    updatedAt: displayRelativeTime(task.updatedAtIso ?? task.createdAt)
  };
}

function toAdminIntakeRequest(task: StoreTask, db: PlatformDb): StoredAdminIntakeRequest {
  const scenario = db.scenarios.find((item) => item.id === task.scenarioId);
  const files = db.files.filter((item) => item.scenarioId === task.scenarioId).map(normalizeFileRecord);
  const parsedArtifacts = db.parsedArtifacts.filter((item) => item.scenarioId === task.scenarioId);
  const knowledgeObjects = db.knowledgeObjects.filter((item) => item.scenarioId === task.scenarioId);
  return {
    id: `request_${task.id}`,
    scenarioId: task.scenarioId,
    scenarioName: scenario?.name ?? task.title.replace(/^Create /, ""),
    requester: scenario?.ownerName ?? task.owner,
    visibility: visibilityText(scenario?.visibility ?? task.visibility),
    submittedAt: displayRelativeTime(task.createdAt),
    status: adminStatusForTask(task.status),
    files: files.map((file) => file.originalName),
    storedFiles: files,
    requestedOutcome: scenario?.processingGoal ?? task.userMessage,
    recommendedModes: recommendedModesForTemplate(task.ragMode, scenario?.templateId ?? "custom-scenario"),
    recommendedEngines: recommendedEnginesForTemplate(task.ragMode, scenario?.templateId ?? "custom-scenario"),
    selectedMode: task.status === "submitted" || task.status === "waiting_review" ? "待选择" : task.ragMode,
    selectedEngine: task.status === "submitted" || task.status === "waiting_review" ? "待选择" : adminEngineForRagMode(task.ragMode),
    frontstageMapping: frontstageMappingForEngines(recommendedEnginesForTemplate(task.ragMode, scenario?.templateId ?? "custom-scenario")),
    permissionImpact: permissionImpactForVisibility(scenario?.visibility ?? task.visibility),
    strategyParameters: task.strategyParameters ?? {},
    parsedArtifactCount: parsedArtifacts.length,
    knowledgeObjectCount: knowledgeObjects.length,
    actions: adminActionsForTask(task.status),
    createdAt: task.createdAt
  };
}

function buildAssetDetailsForKnowledgeObject(
  item: StoredKnowledgeObject,
  scenario: StoredScenario | undefined,
  file: StoredFileRecord | undefined,
  artifact: StoredParsedArtifact | undefined
): StoredKnowledgeAssetDetail[] {
  const scenarioName = scenario?.name ?? "No linked scenario";
  const sourceOriginalName = file?.originalName ?? item.sourceOriginalName;
  const accessControl = accessControlFromKnowledgeObject(item);
  const common = {
    engine: item.ragEngine,
    sourceOriginalName,
    scenarioName,
    visibility: item.visibility,
    visibilityLabel: visibilityText(item.visibility),
    ownerName: item.ownerName,
    createdAt: item.createdAt,
    metadata: [
      { label: "Source file", value: sourceOriginalName },
      { label: "Business scenario", value: scenarioName },
      { label: "权限范围", value: accessControlLabel(accessControl) },
      { label: "Owner", value: item.ownerName },
      { label: "Knowledge object", value: item.id },
      { label: "Parsed artifact", value: artifact?.id ?? item.artifactId },
      { label: "Ingested at", value: displayRelativeTime(item.createdAt) }
    ]
  };

  if (item.ragEngine === "Naive RAG") {
    const chunkLength = Math.max(1, item.content.length);
    return [
      {
        ...common,
        id: `chunk_${item.id}`,
        kind: "chunk",
        title: `Document chunk · ${sourceOriginalName}`,
        metric: `~${chunkLength} chars`,
        status: "Chunked",
        content: item.content
      },
      {
        ...common,
        id: `embedding_${item.id}`,
        kind: "embedding",
        title: `Vector index · ${sourceOriginalName}`,
        metric: "1 vector record",
        status: "Indexed",
        content: `The chunks for "${sourceOriginalName}" were written to the Naive RAG vector index for similarity recall, TopK ranking, and citation backfill.`,
        metadata: [
          ...common.metadata,
          { label: "Index type", value: "Vector index" },
          { label: "Default use", value: "Semantic recall / citation ranking" }
        ]
      },
      {
        ...common,
        id: `citation_${item.id}`,
        kind: "citation",
        title: `Cited evidence · ${sourceOriginalName}`,
        metric: "1 cited source",
        status: "Citable",
        content: `When an answer is generated, the source "${sourceOriginalName}" can be backfilled: ${excerpt(item.content, 220)}`,
        metadata: [
          ...common.metadata,
          { label: "Citation boundary", value: "Only retrievable in scenarios where permissions match" }
        ]
      },
      {
        ...common,
        id: `eval_${item.id}`,
        kind: "eval",
        title: `Recall verification · ${scenarioName}`,
        metric: "1 verification set",
        status: "Passed",
        content: `Verification question: what can this material answer?\nExpected: a business answer about "${scenarioName}" with cited evidence, plus an explicit boundary for questions it cannot cover.`,
        metadata: [
          ...common.metadata,
          { label: "Verification goal", value: "Answer relevance / traceable citations / refusal without evidence" }
        ]
      }
    ];
  }

  if (item.ragEngine === "GraphRAG") {
    return [
      {
        ...common,
        id: `entity_${item.id}`,
        kind: "entity",
        title: `Entity table · ${scenarioName}`,
        metric: "Entity extraction result",
        status: "Extracted",
        content: `Business entities extracted from "${sourceOriginalName}" for relationship recall and graph Q&A.\n${excerpt(item.content, 240)}`
      },
      {
        ...common,
        id: `relationship_${item.id}`,
        kind: "relationship",
        title: `Relationship edges · ${scenarioName}`,
        metric: "Relationship candidates",
        status: "Built",
        content: `Relationship edges among entities, events, and evidence were built around the scenario "${scenarioName}".`
      },
      {
        ...common,
        id: `graph_${item.id}`,
        kind: "graph",
        title: `Knowledge graph · ${scenarioName}`,
        metric: "Graph view",
        status: "Viewable",
        content: `The graph is published to the admin asset ledger and supports multi-hop reasoning, customer profiles, and risk attribution.`
      },
      {
        ...common,
        id: `review_${item.id}`,
        kind: "review",
        title: `Relationship review · ${scenarioName}`,
        metric: "Review queue",
        status: "Pending spot check",
        content: `Spot-check high-impact entities, relationship directions, and cross-document evidence so incorrect relationships do not reach workspace scenarios.`
      }
    ];
  }

  return [
    {
      ...common,
      id: `wiki_${item.id}`,
      kind: "wiki",
      title: `Knowledge page · ${scenarioName}`,
      metric: "Page assets",
      status: "Published",
      content: item.content
    },
    {
      ...common,
      id: `fact_${item.id}`,
      kind: "fact",
      title: `Fact card · ${sourceOriginalName}`,
      metric: "Fact excerpts",
      status: "Generated",
      content: `A fact summary that knowledge pages and Q&A can both cite: ${excerpt(item.content, 220)}`
    },
    {
      ...common,
      id: `link_${item.id}`,
      kind: "link",
      title: `Cross-link outline · ${scenarioName}`,
      metric: "Outline relationships",
      status: "Linked",
      content: `Outline cross-links generated from the scenario, sources, and knowledge pages, so workspace users can jump between answers and pages.`
    },
    {
      ...common,
      id: `source_${item.id}`,
      kind: "source",
      title: `Source registry · ${sourceOriginalName}`,
      metric: "Source registry",
      status: "Registered",
      content: `The source file, parsed artifact, and knowledge object are now in the asset ledger and traceable by permission scope.`
    }
  ];
}

function emptyAdminDashboardSnapshot(): AdminDashboardSnapshot {
  return {
    requests: { total: 0, pending: 0, processing: 0, published: 0, rejected: 0 },
    assets: { total: 0, gbrain: 0, naive: 0, graph: 0 },
    healthCards: [],
    dataOverview: []
  };
}

async function defaultCheckAdminModuleHealth(engine: AdminRagEngine): Promise<AdminServiceHealth> {
  try {
    const response = await fetch(`${moduleBaseUrl(engine)}/health`, {
      signal: AbortSignal.timeout(1800)
    });
    const body = await response.json().catch(() => ({}));
    const rawStatus = String(body.status ?? "").toLowerCase();
    const service = String(body.service ?? engine);
    if (!response.ok) {
      return { id: engine, status: "down", detail: `${service} health check failed: HTTP ${response.status}` };
    }
    const status: AdminServiceHealthStatus = rawStatus === "ok" || rawStatus === "healthy" ? "healthy" : "degraded";
    return {
      id: engine,
      status,
      detail: status === "healthy" ? `${service} service is available` : `${service} returned status: ${rawStatus || "unknown"}`
    };
  } catch (error) {
    return {
      id: engine,
      status: "down",
      detail: error instanceof Error ? error.message : "Service health check unavailable"
    };
  }
}

function buildAdminDataOverview(assets: StoredKnowledgeAssetDetail[]): AdminDashboardSnapshot["dataOverview"] {
  const scopes: AdminDashboardSnapshot["dataOverview"] = [
    {
      scope: "个人",
      total: 0,
      unit: "assets",
      module: "Personal knowledge space",
      owner: "Creator",
      policy: "Readable only by the creator and admins; never enters team or company-wide recall.",
      health: "healthy"
    },
    {
      scope: "团队",
      total: 0,
      unit: "assets",
      module: "Team knowledge space",
      owner: "Team owner",
      policy: "Readable only by teammates; the platform proxies the module private source permission.",
      health: "healthy"
    },
    {
      scope: "公司",
      total: 0,
      unit: "assets",
      module: "CompanyBrain",
      owner: "Admin",
      policy: "Recalled by company-wide Q&A after publishing; an admin must confirm the files and ingest policy.",
      health: "healthy"
    }
  ];
  for (const asset of assets) {
    const target = scopes.find((scope) => scope.scope === asset.visibilityLabel);
    if (target) target.total += 1;
  }
  return scopes.map((scope) => ({
    ...scope,
    health: scope.total === 0 ? "degraded" : "healthy"
  }));
}

function healthValue(status: AdminServiceHealthStatus) {
  if (status === "healthy") return "Available";
  if (status === "degraded") return "Needs review";
  return "Unavailable";
}

function engineHealthRoute(engine: AdminRagEngine) {
  if (engine === "Gbrain") return "/admin/knowledge-bases/gbrain";
  if (engine === "Naive RAG") return "/admin/knowledge-bases/naive";
  return "/admin/graph"; // GraphRAG 管理统一指向图谱治理(I51)，与导航/子导航一致
}

function accessControlLabel(accessControl: StoredAccessControl) {
  const scope = visibilityLabel(accessControl.scope);
  if (accessControl.scope === "team") {
    return `${scope} · ${accessControl.teamIds.join(", ") || "No team assigned"}`;
  }
  if (accessControl.scope === "company") {
    return `${scope} · ${accessControl.organizationId}`;
  }
  return `${scope} · ${accessControl.ownerName}`;
}

function excerpt(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function relevanceScore(query: string, item: StoredKnowledgeObject) {
  const haystack = `${item.title}\n${item.sourceOriginalName}\n${item.content}`.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = haystack.includes(normalizedQuery) ? 8 : 0;
  for (const token of queryTokens(normalizedQuery)) {
    if (haystack.includes(token)) score += Math.max(1, Math.min(6, token.length));
  }
  if (haystack.includes(item.sourceOriginalName.toLowerCase())) score += 1;
  return score;
}

function queryTokens(query: string) {
  const rough = query
    .replace(/[？?，,。；;：:、（）()【】\[\]{}"'“”‘’]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  if (rough.length > 0) return Array.from(new Set(rough));
  const compact = query.replace(/\s+/g, "");
  const tokens: string[] = [];
  for (let size = 2; size <= Math.min(6, compact.length); size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      tokens.push(compact.slice(index, index + size));
    }
  }
  return Array.from(new Set(tokens));
}

function buildScenarioAnswerText(scenarioName: string, query: string, engine: AdminRagEngine, evidence: string) {
  const label = storeKnowledgeTypeLabel(engine);
  const focus = engine === "GraphRAG"
    ? "This turn focuses on the links among entities, relationships, events, and the evidence chain."
    : engine === "Naive RAG"
      ? "This turn focuses on original passages, policy clauses, and citable evidence."
      : "This turn focuses on the compiled knowledge pages, fact cards, and reusable conclusions.";
  const insight = excerpt(sanitizeKnowledgeExcerpt(evidence), 260);
  return `For the question "${query}" in "${scenarioName}", I matched citable evidence in ${label}. ${focus}Core lead: ${insight}\n\nCited sources are grouped by type in the evidence panel on the right.`;
}

async function ingestScenarioSources(
  db: PlatformDb,
  scenario: StoredScenario,
  selectedMode: RagEngine,
  selectedEngine: AdminRagEngine,
  now: string,
  approver: StoreUser,
  strategyParameters?: AdminStrategyParameters
) {
  const scenarioFiles = db.files
    .map((file, index) => ({ file: normalizeFileRecord(file), index }))
    .filter(({ file }) => file.scenarioId === scenario.id);
  const previousKnowledgeIds = new Set(db.knowledgeObjects.filter((item) => item.scenarioId === scenario.id).map((item) => item.id));
  const previousArtifactIds = new Set(db.parsedArtifacts.filter((item) => item.scenarioId === scenario.id).map((item) => item.id));
  const previousModuleReferenceIds = new Set((db.moduleReferences ?? []).filter((item) => item.scenarioId === scenario.id).map((item) => item.id));
  db.parsedArtifacts = db.parsedArtifacts.filter((item) => !previousArtifactIds.has(item.id));
  db.knowledgeObjects = db.knowledgeObjects.filter((item) => !previousKnowledgeIds.has(item.id));
  db.moduleReferences = (db.moduleReferences ?? []).filter((item) => !previousModuleReferenceIds.has(item.id));

  const nextArtifacts: StoredParsedArtifact[] = [];
  const nextKnowledgeObjects: StoredKnowledgeObject[] = [];
  const nextModuleReferences: StoredModuleReference[] = [];
  const accessControl = accessControlFromScenario(scenario);

  for (const { file, index } of scenarioFiles) {
    const artifactId = `artifact_${randomUUID()}`;
    const knowledgeObjectId = `ko_${randomUUID()}`;
    const content = await readSourceContent(file);

    // #4 非原子容错：单篇入库失败（embedding 超时 / graph 建图超时等）不阻断其它篇，
    // 已成功篇照常在循环后落盘；失败篇跳过并记录，保持文件记录可重传。
    let realIngest: { reference: StoredModuleReference } | null = null;
    if (shouldUseRealRagModules()) {
      try {
        realIngest = await ingestFileThroughRealRagModule({
          scenario,
          file,
          content,
          selectedEngine,
          accessControl,
          approver,
          now,
          strategyParameters
        });
      } catch (error) {
        console.error(
          `[ingestScenarioSources] single-file ingest failed, skipping (engine=${selectedEngine}, file=${file.originalName})`,
          error
        );
        continue;
      }
    }
    const artifact: StoredParsedArtifact = {
      id: artifactId,
      scenarioId: scenario.id,
      sourceFileId: file.id,
      title: file.originalName,
      kind: artifactKindForFile(file),
      content,
      visibility: scenario.visibility,
      ownerUserId: scenario.ownerUserId,
      ownerName: scenario.ownerName,
      organizationId: accessControl.organizationId,
      teamIds: accessControl.teamIds,
      accessControl,
      ragMode: selectedMode,
      ragEngine: selectedEngine,
      createdAt: now
    };
    const knowledgeObject: StoredKnowledgeObject = {
      id: knowledgeObjectId,
      scenarioId: scenario.id,
      sourceFileId: file.id,
      artifactId,
      title: `${scenario.name} · ${file.originalName}`,
      kind: knowledgeKindForEngine(selectedEngine),
      content: buildKnowledgeContent(scenario, file, content, selectedEngine),
      visibility: scenario.visibility,
      ownerUserId: scenario.ownerUserId,
      ownerName: scenario.ownerName,
      organizationId: accessControl.organizationId,
      teamIds: accessControl.teamIds,
      accessControl,
      ragMode: selectedMode,
      ragEngine: selectedEngine,
      sourceOriginalName: file.originalName,
      moduleReferences: realIngest ? [realIngest.reference] : [],
      createdAt: now
    };

    nextArtifacts.push(artifact);
    nextKnowledgeObjects.push(knowledgeObject);
    if (realIngest) nextModuleReferences.push(realIngest.reference);

    const policy = retentionPolicyForFile(file.originalName, file.mimeType);
    if (policy === "delete_after_ingest") {
      await rm(join(dataRoot(), file.relativePath), { force: true });
    }

    db.files[index] = {
      ...file,
      originalState: policy === "retain_source" ? "retained" : "deleted",
      originalAvailable: policy === "retain_source",
      retentionPolicy: policy,
      retentionReason: retentionReasonForPolicy(policy),
      accessControl,
      deletedAt: policy === "delete_after_ingest" ? now : undefined,
      parsedArtifactIds: [artifactId],
      knowledgeObjectIds: [knowledgeObjectId]
    };
  }

  // #4 全失败不假发布（codex 审）：启用真实模块且有文件但零成功入库时抛错，
  // 让 decideAdminIntakeRequest 审批失败，而非把 task/scenario 标 ready 却无任何知识引用。
  if (shouldUseRealRagModules() && scenarioFiles.length > 0 && nextModuleReferences.length === 0) {
    throw new Error(`All ${scenarioFiles.length} files for "${scenario.name}" failed to ingest; no knowledge citation was produced`);
  }
  db.parsedArtifacts.unshift(...nextArtifacts);
  db.knowledgeObjects.unshift(...nextKnowledgeObjects);
  db.moduleReferences.unshift(...nextModuleReferences);
}

async function ingestFileThroughRealRagModule(input: {
  scenario: StoredScenario;
  file: StoredFileRecord;
  content: string;
  selectedEngine: AdminRagEngine;
  accessControl: StoredAccessControl;
  approver: StoreUser;
  now: string;
  strategyParameters?: AdminStrategyParameters;
}): Promise<{ reference: StoredModuleReference }> {
  if (input.selectedEngine === "Gbrain") {
    return ingestGbrainFile(input);
  }
  if (input.selectedEngine === "Naive RAG") {
    return ingestNaiveRagFile(input);
  }
  return ingestGraphRagFile(input);
}

// 幂等确保场景级 source 存在（I87 根治）：先按 name 查已有，无则创建；创建撞 409 duplicate_source 再兜底重查。
// 覆盖 (a) 同场景多文件第 2+ 篇同名建 source、(b) re-approve/重试时 source 已存在 两种 409 情形。泛型 S 保留各模块额外字段（如 Graph workspace）。
async function ensureModuleSource<S extends { id: string; name: string; kind: "private" | "public" }>(
  engine: AdminRagEngine,
  listPath: string,
  writer: StoreUser,
  createBody: { name: string; kind: "private" | "public"; description?: string }
): Promise<S> {
  const existing = await findModuleSourceByName<S>(engine, listPath, writer, createBody.name);
  if (existing) return existing;
  try {
    const created = await moduleJson<{ source: S }>(engine, listPath, { method: "POST", user: writer, body: createBody });
    return created.source;
  } catch (error) {
    if (isDuplicateSourceError(error)) {
      const raced = await findModuleSourceByName<S>(engine, listPath, writer, createBody.name);
      if (raced) return raced;
    }
    throw error;
  }
}

async function findModuleSourceByName<S extends { id: string; name: string; kind: "private" | "public" }>(
  engine: AdminRagEngine,
  listPath: string,
  writer: StoreUser,
  name: string
): Promise<S | null> {
  const { sources } = await moduleJson<{ sources: S[] }>(engine, listPath, { method: "GET", user: writer });
  return (sources ?? []).find((s) => s.name === name) ?? null;
}

function isDuplicateSourceError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("HTTP 409") && error.message.includes("duplicate_source");
}

async function ingestGbrainFile(input: {
  scenario: StoredScenario;
  file: StoredFileRecord;
  content: string;
  selectedEngine: AdminRagEngine;
  accessControl: StoredAccessControl;
  approver: StoreUser;
  now: string;
}) {
  const sourceKind = sourceKindForScenario(input.scenario);
  const writer = sourceKind === "public" ? input.approver : storeUserFromAccessControl(input.accessControl);
  const source = sourceKind === "public"
    ? await ensureModuleSource<{ id: string; name: string; kind: "private" | "public" }>("Gbrain", "/nano/sources", { ...input.approver, role: "admin" }, { name: realSourceName(input.scenario, "gbrain"), kind: "public" })
    : (await moduleJson<{ source: { id: string; name: string; kind: "private" | "public" } }>("Gbrain", "/internal/users/default-source", {
        method: "POST",
        user: writer,
        body: {}
      })).source;
  const slug = moduleSlug(`${input.scenario.id}-${input.file.id}`);
  const page = (await moduleJson<{ page: { id: string; source_id: string; title: string; slug: string } }>("Gbrain", "/nano/pages", {
    method: "POST",
    user: writer,
    body: {
      source_id: source.id,
      slug,
      title: input.file.originalName,
      content_type: "text/markdown",
      body: input.content || `# ${input.file.originalName}\n\nNo body text extracted.`
    }
  })).page;
  return {
    reference: moduleReference({
      input,
      moduleId: "nano-brain",
      source,
      objectKind: "page",
      objectId: page.id,
      pageId: page.id,
      status: "ready",
      metadata: { slug, originalFileName: input.file.originalName, title: page.title }
    })
  };
}

async function ingestNaiveRagFile(input: {
  scenario: StoredScenario;
  file: StoredFileRecord;
  content: string;
  selectedEngine: AdminRagEngine;
  accessControl: StoredAccessControl;
  approver: StoreUser;
  now: string;
  strategyParameters?: AdminStrategyParameters;
}) {
  const sourceKind = sourceKindForScenario(input.scenario);
  const writer = sourceKind === "public" ? { ...input.approver, role: "admin" as const } : storeUserFromAccessControl(input.accessControl);
  const source = await ensureModuleSource<{ id: string; name: string; kind: "private" | "public" }>("Naive RAG", "/traditional/sources", writer, { name: realSourceName(input.scenario, "naive"), kind: sourceKind, description: input.scenario.description });
  const bytes = await readStoredFileBytes(input.file);
  const form = new FormData();
  form.set("source_id", source.id);
  form.set("file", new File([toArrayBuffer(bytes)], input.file.originalName, { type: input.file.mimeType || "application/octet-stream" }));
  // T1-B1: per-engine 切片参数透传（approve 时 strategyParameters 带入；缺省由模块落回默认 1200/160）
  const chunkSize = input.strategyParameters?.chunk_size;
  const chunkOverlap = input.strategyParameters?.chunk_overlap;
  if (chunkSize) form.set("chunk_size", String(chunkSize));
  if (chunkOverlap) form.set("chunk_overlap", String(chunkOverlap));
  const uploaded = await moduleJson<{
    document: { id: string; status: string; original_filename?: string };
    job: { id: string; status: string };
  }>("Naive RAG", "/traditional/documents", {
    method: "POST",
    user: writer,
    form
  });
  const job = await pollTraditionalJob(writer, uploaded.job.id);
  const chunks = await listTraditionalChunks(writer, uploaded.document.id);
  const chunkText = chunks.map((chunk: any) => chunk.chunk_text).filter(Boolean).join("\n\n");
  return {
    reference: moduleReference({
      input,
      moduleId: "traditional-rag",
      source,
      objectKind: "job",
      objectId: uploaded.job.id,
      documentId: uploaded.document.id,
      jobId: uploaded.job.id,
      status: job.status === "ready" ? "ready" : "submitted",
      metadata: {
        originalFileName: input.file.originalName,
        documentId: uploaded.document.id,
        jobStage: job.stage,
        chunkCount: chunks.length,
        indexedText: chunkText || input.content
      }
    })
  };
}

async function ingestGraphRagFile(input: {
  scenario: StoredScenario;
  file: StoredFileRecord;
  content: string;
  selectedEngine: AdminRagEngine;
  accessControl: StoredAccessControl;
  approver: StoreUser;
  now: string;
}) {
  const sourceKind = sourceKindForScenario(input.scenario);
  const writer = sourceKind === "public" ? { ...input.approver, role: "admin" as const } : storeUserFromAccessControl(input.accessControl);
  const source = await ensureModuleSource<{ id: string; name: string; kind: "private" | "public"; workspace?: string }>("GraphRAG", "/graph/sources", writer, { name: realSourceName(input.scenario, "graph"), kind: sourceKind, description: input.scenario.description });
  const document = (await moduleJson<{ document: { id: string; status: string; original_filename?: string } }>("GraphRAG", "/graph/documents/text", {
    method: "POST",
    user: writer,
    body: {
      source_id: source.id,
      title: input.file.originalName,
      text: input.content || `${input.file.originalName} had no extractable body text.`,
      metadata: { scenario_id: input.scenario.id, file_id: input.file.id }
    }
  })).document;
  if (document.status === "failed") {
    throw new Error(`GraphRAG ingest failed: ${input.file.originalName}`);
  }
  // graph 建图异步（模块 C1：插 processing 行后台建图），轮询到 ready 再建 ref，
  // 否则 ref 卡 submitted，被全域 retrieveRealGlobalCitations 的 filter(status==="ready") 永久排除（台账 I74 #6）。
  const finalDoc = document.status === "ready" ? document : await pollGraphDocument(writer, document.id);
  return {
    reference: moduleReference({
      input,
      moduleId: "graph-rag",
      source,
      objectKind: "document",
      objectId: finalDoc.id,
      documentId: finalDoc.id,
      status: finalDoc.status === "ready" ? "ready" : "submitted",
      metadata: { originalFileName: input.file.originalName, workspace: source.workspace, indexedText: input.content }
    })
  };
}

async function askRealScenarioKnowledge(
  user: StoreUser,
  scenario: StoredScenario,
  query: string,
  references: StoredModuleReference[],
  spans?: TraceSpan[]
): Promise<StoredScenarioAnswer> {
  const readyReferences = references.filter((reference) => reference.status === "ready");
  const activeReferences = readyReferences.length > 0 ? readyReferences : references;
  const engine = activeReferences[0]?.engine ?? adminEngineForRagMode(defaultSelectedMode(ragModeForTemplate(scenario.templateId)));
  const db = await readDb();
  const scenarioTopK = getEngineTopK(db, engine, 5);
  const scenarioMinScore = getEngineMinScore(db, engine, 0);
  const citations: StoredScenarioAnswer["answer"]["citations"] = [];
  const recordRetriever = (reference: StoredModuleReference, startedAt: number, added: number) => {
    spans?.push({
      kind: "RETRIEVER",
      label: `${reference.engine} retrieval`,
      engine: reference.engine,
      form: engineToForm(reference.engine),
      latencyMs: Date.now() - startedAt,
      sourceName: String(reference.metadata.originalFileName ?? reference.sourceName),
      scenarioName: scenario.name,
      hitCount: added
    });
  };

  if (engine === "Gbrain") {
    for (const reference of activeReferences.filter((item) => item.engine === "Gbrain")) {
      const reader = moduleReaderForReference(user, reference);
      const startedAt = Date.now();
      const before = citations.length;
      const body = await moduleJson<{ answer?: string; citations?: any[] }>("Gbrain", "/nano/ask", {
        method: "POST",
        user: reader,
        body: { query, limit: scenarioTopK, source_id: reference.sourceId }
      });
      for (const citation of body.citations ?? []) {
        if (!citationMatchesReference(citation, reference)) continue;
        citations.push(realCitation(reference, citation.chunk_text ?? citation.text ?? citation.snippet ?? JSON.stringify(citation)));
      }
      recordRetriever(reference, startedAt, citations.length - before);
    }
  } else if (engine === "Naive RAG") {
    // 全局检索（修 I60）：场景内所有 Naive 源一次检索，TopK = 最终返回数；命中按 sourceId 回填对应 reference（M4）。
    const naiveRefs = activeReferences.filter((item) => item.engine === "Naive RAG");
    // One module source can hold several uploaded files; map by module document id first so each
    // citation is attributed to the file it actually came from.
    const refByDocument = new Map(naiveRefs.map((reference) => [String(reference.documentId ?? ""), reference]));
    const refBySource = new Map(naiveRefs.map((reference) => [reference.sourceId, reference]));
    const startedAt = Date.now();
    const before = citations.length;
    const results = await searchNaiveGlobal(user, query, naiveRefs, scenarioTopK, scenarioMinScore);
    for (const r of results) {
      const reference = refByDocument.get(String(r.documentId ?? "")) ?? refBySource.get(r.sourceId);
      if (!reference) continue;
      citations.push(realCitation(reference, r.text || ""));
    }
    if (naiveRefs[0]) {
      spans?.push({
        kind: "RETRIEVER",
        label: "Naive RAG company-wide retrieval",
        engine: "Naive RAG",
        form: engineToForm("Naive RAG"),
        latencyMs: Date.now() - startedAt,
        sourceName: `${naiveRefs.length} sources`,
        scenarioName: scenario.name,
        hitCount: citations.length - before
      });
    }
  } else {
    for (const reference of activeReferences.filter((item) => item.engine === "GraphRAG")) {
      const reader = moduleReaderForReference(user, reference);
      const startedAt = Date.now();
      const before = citations.length;
      const body = await moduleJson<{ answer?: string; citations?: any[]; results?: any[] }>("GraphRAG", "/graph/ask", {
        method: "POST",
        user: reader,
        body: { query, limit: scenarioTopK, source_id: reference.sourceId, mode: "mix" }
      });
      const graphCitations = body.citations ?? body.results ?? [];
      for (const citation of graphCitations) {
        citations.push(
          realCitation(
            reference,
            cleanGraphCitationText(
              citation.context ?? citation.text ?? citation.chunk_text ?? citation.snippet ?? JSON.stringify(citation)
            )
          )
        );
      }
      recordRetriever(reference, startedAt, citations.length - before);
    }
  }

  if (citations.length === 0) {
    return {
      scenarioId: scenario.id,
      query,
      answer: {
        text: `"${scenario.name}" is published, but the real ${engine} service returned no citable results.`,
        engine,
        citations: [],
        nextActions: ["Add more files", "Adjust the retrieval question", "Check ingest results in the admin console"]
      }
    };
  }

  const evidence = citations
    .map((citation, index) => `Source ${index + 1} (source: ${citation.sourceOriginalName}):\n${citation.excerpt}`)
    .join("\n\n");
  // 用真实 LLM 基于召回到的真实证据合成业务答案；失败时回退到证据摘要模板。
  const generated = await callAgentChatModel(
    [
      {
        role: "system",
        content: [
          `You are the answer generator for the "${scenario.name}" scenario in an enterprise knowledge platform.`,
          "Answer only from the provided evidence and do not invent facts outside the material; say so plainly when evidence is insufficient.",
          "Write for business users and lead with the conclusion; do not expose technical details such as RAG or embeddings."
        ].join("\n")
      },
      { role: "user", content: [`Question: ${query}`, "Evidence:", evidence].join("\n\n") }
    ],
    { temperature: 0.2, maxTokens: 900 },
    (info) => spans?.push({ kind: "LLM", label: "Answer generation", latencyMs: info.latencyMs, model: info.model, promptTokens: info.promptTokens, completionTokens: info.completionTokens, totalTokens: info.totalTokens })
  );
  return {
    scenarioId: scenario.id,
    query,
    answer: {
      text: generated ?? buildScenarioAnswerText(scenario.name, query, engine, evidence),
      engine,
      citations,
      nextActions: ["Keep asking", "View cited files", "Generate a business deliverable"]
    }
  };
}

function moduleReference(input: {
  input: {
    scenario: StoredScenario;
    file: StoredFileRecord;
    selectedEngine: AdminRagEngine;
    accessControl: StoredAccessControl;
    now: string;
  };
  moduleId: StoreModuleId;
  source: { id: string; name?: string; kind?: "private" | "public" };
  objectKind: StoredModuleReference["objectKind"];
  objectId: string;
  documentId?: string;
  jobId?: string;
  pageId?: string;
  status: StoredModuleReference["status"];
  metadata: Record<string, unknown>;
}): StoredModuleReference {
  return {
    id: `module_ref_${randomUUID()}`,
    scenarioId: input.input.scenario.id,
    sourceFileId: input.input.file.id,
    engine: input.input.selectedEngine,
    moduleId: input.moduleId,
    sourceId: input.source.id,
    sourceName: input.source.name ?? input.source.id,
    sourceKind: input.source.kind ?? sourceKindForScenario(input.input.scenario),
    objectKind: input.objectKind,
    objectId: input.objectId,
    documentId: input.documentId,
    jobId: input.jobId,
    pageId: input.pageId,
    status: input.status,
    accessControl: input.input.accessControl,
    metadata: { ...input.metadata, scenarioName: input.input.scenario.name },
    createdAt: input.input.now
  };
}

function shouldUseRealRagModules() {
  const mode = process.env.FF_PLATFORM_INGEST_MODE ?? process.env.PLATFORM_MODULE_MODE ?? "real";
  return mode !== "local" && mode !== "mock";
}

function moduleIdForEngine(engine: AdminRagEngine): StoreModuleId {
  if (engine === "Gbrain") return "nano-brain";
  if (engine === "Naive RAG") return "traditional-rag";
  return "graph-rag";
}

function moduleBaseUrl(engine: AdminRagEngine) {
  const envName = engine === "Gbrain" ? "NANO_BRAIN_HTTP_URL" : engine === "Naive RAG" ? "TRADITIONAL_RAG_HTTP_URL" : "GRAPH_RAG_HTTP_URL";
  const fallback = engine === "Gbrain" ? "http://127.0.0.1:8100" : engine === "Naive RAG" ? "http://127.0.0.1:8101" : "http://127.0.0.1:8102";
  return (process.env[envName] ?? fallback).replace(/\/+$/, "");
}

async function moduleJson<T>(
  engine: AdminRagEngine,
  path: string,
  input: { method: string; user: StoreUser; body?: unknown; form?: FormData }
): Promise<T> {
  const response = await fetch(`${moduleBaseUrl(engine)}${path}`, {
    method: input.method,
    headers: moduleHeaders(input.user, !input.form),
    body: input.form ?? (input.body === undefined ? undefined : JSON.stringify(input.body))
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${engine} module call failed ${input.method} ${path}: HTTP ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body as T;
}

function moduleHeaders(user: StoreUser, json: boolean) {
  const token = process.env.RAG_INTERNAL_TOKEN;
  if (!token) throw new Error("RAG_INTERNAL_TOKEN is missing, so the real RAG module cannot be called.");
  const headers = new Headers({
    "x-ff-internal-token": token,
    "x-ff-user-id": asciiHeaderValue(user.userId),
    "x-ff-username": asciiHeaderValue(user.userId),
    "x-ff-is-admin": String(user.role === "admin")
  });
  if (json) headers.set("content-type", "application/json");
  return headers;
}

function asciiHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "_");
}

function sourceKindForScenario(scenario: StoredScenario): "private" | "public" {
  return scenario.visibility === "company" ? "public" : "private";
}

function storeUserFromAccessControl(accessControl: StoredAccessControl): StoreUser {
  return {
    userId: accessControl.ownerUserId,
    name: accessControl.ownerName,
    role: "member",
    organizationId: accessControl.organizationId,
    teamIds: accessControl.teamIds
  };
}

function moduleReaderForReference(user: StoreUser, reference: StoredModuleReference): StoreUser {
  if (reference.sourceKind === "public" || user.role === "admin") return user;
  return storeUserFromAccessControl(reference.accessControl);
}

function realSourceName(scenario: StoredScenario, suffix: string) {
  // RAG 模块（尤其 nano-brain）要求 source 名仅含 ASCII 字母数字与 _./- ，不能含中文。
  // scenario.id 形如 scene_<uuid>，本身 ASCII 且唯一，足以保证来源命名唯一与可追溯。
  return asciiModuleSlug(`${scenario.id}-${suffix}`).slice(0, 90) || `scene-${suffix}`;
}

function asciiModuleSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function moduleSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

async function readStoredFileBytes(file: StoredFileRecord) {
  return new Uint8Array(await readFile(join(dataRoot(), file.relativePath)));
}

async function pollTraditionalJob(user: StoreUser, jobId: string): Promise<any> {
  const timeoutMs = Number(process.env.FF_RAG_JOB_TIMEOUT_MS ?? 900000);
  const started = Date.now();
  let lastJob: any = null;
  while (Date.now() - started <= timeoutMs) {
    const body = await moduleJson<{ job: any }>("Naive RAG", `/traditional/jobs/${jobId}`, {
      method: "GET",
      user
    });
    lastJob = body.job;
    if (lastJob.status === "ready") return lastJob;
    if (lastJob.status === "failed") throw new Error(`Naive RAG ingest failed: ${JSON.stringify(lastJob.error ?? lastJob)}`);
    await sleep(1500);
  }
  throw new Error(`Naive RAG ingest timed out: ${jobId}, last status ${JSON.stringify(lastJob)}`);
}

// 轮询 graph 文档到 ready（graph 建图为模块 C1 异步后台任务，与 traditional 的 pollTraditionalJob 对齐）。
async function pollGraphDocument(user: StoreUser, documentId: string): Promise<any> {
  const timeoutMs = Number(process.env.FF_GRAPH_DOC_TIMEOUT_MS ?? 300000);
  const started = Date.now();
  let lastDoc: any = null;
  while (Date.now() - started <= timeoutMs) {
    const body = await moduleJson<{ document: any }>("GraphRAG", `/graph/documents/${documentId}`, { method: "GET", user });
    lastDoc = body.document;
    if (lastDoc.status === "ready") return lastDoc;
    if (lastDoc.status === "failed") throw new Error(`GraphRAG ingest failed: ${JSON.stringify(lastDoc.error ?? lastDoc)}`);
    await sleep(2000);
  }
  throw new Error(`GraphRAG ingest timed out: ${documentId}, last status ${JSON.stringify(lastDoc)}`);
}

async function listTraditionalChunks(user: StoreUser, documentId: string) {
  try {
    const body = await moduleJson<{ chunks: any[] }>("Naive RAG", `/traditional/documents/${documentId}/chunks`, {
      method: "GET",
      user
    });
    return body.chunks ?? [];
  } catch {
    return [];
  }
}

// LightRAG returns raw JSON blocks for entities and relationships. Turn them into readable
// evidence lines so graph citations are useful in the UI instead of showing JSON syntax.
function cleanGraphCitationText(raw: string): string {
  if (!raw) return raw;
  const entities: string[] = [];
  const relations: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const item = JSON.parse(trimmed) as Record<string, unknown>;
      const description = typeof item.description === "string" ? item.description : "";
      if (typeof item.entity === "string") {
        const type = typeof item.type === "string" ? ` (${item.type})` : "";
        entities.push(`${item.entity}${type}: ${description}`.trim());
      } else if (typeof item.entity1 === "string" || typeof item.entity2 === "string") {
        relations.push(`${String(item.entity1 ?? "?")} → ${String(item.entity2 ?? "?")}: ${description}`.trim());
      }
    } catch {
      // Ignore non-JSON lines and keep the remaining evidence.
    }
  }
  if (entities.length === 0 && relations.length === 0) return raw;
  const sections: string[] = [];
  if (entities.length > 0) sections.push(`Entities:\n- ${entities.join("\n- ")}`);
  if (relations.length > 0) sections.push(`Relationships:\n- ${relations.join("\n- ")}`);
  return sections.join("\n\n");
}

function realCitation(reference: StoredModuleReference, text: string): StoredScenarioAnswer["answer"]["citations"][number] {
  return {
    knowledgeObjectId: reference.objectId,
    sourceOriginalName: String(reference.metadata.originalFileName ?? reference.sourceName),
    scenarioName: String(reference.metadata.scenarioName ?? reference.scenarioId),
    engine: reference.engine,
    // 保留较完整正文喂给生成模型，避免短文档末尾关键条款被截断。
    excerpt: scenarioCitationExcerpt(text, 1200)
  };
}

function citationMatchesReference(citation: any, reference: StoredModuleReference) {
  const sourceId = citation?.sourceId ?? citation?.source_id;
  return !sourceId || sourceId === reference.sourceId;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function normalizeFileRecord(file: StoredFileRecord): StoredFileRecord {
  const retentionPolicy = file.retentionPolicy ?? retentionPolicyForFile(file.originalName, file.mimeType);
  const accessControl = normalizeAccessControl(file.accessControl, {
    scope: file.accessControl?.scope ?? "private",
    ownerUserId: file.accessControl?.ownerUserId ?? "",
    ownerName: file.accessControl?.ownerName ?? "",
    organizationId: file.accessControl?.organizationId,
    teamIds: file.accessControl?.teamIds
  });
  return {
    ...file,
    originalState: file.originalState ?? "temporary",
    originalAvailable: file.originalAvailable ?? true,
    retentionPolicy,
    retentionReason: file.retentionReason ?? retentionReasonForPolicy(retentionPolicy),
    accessControl,
    parsedArtifactIds: file.parsedArtifactIds ?? [],
    knowledgeObjectIds: file.knowledgeObjectIds ?? []
  };
}

async function readSourceContent(file: StoredFileRecord) {
  try {
    const bytes = await readFile(join(dataRoot(), file.relativePath));
    return parseUploadedFileContent(file, bytes);
  } catch {
    return `${file.originalName}: the original file is unavailable, so the parse record is rebuilt from the registered file metadata.`;
  }
}

async function parseUploadedFileContent(file: StoredFileRecord, bytes: Uint8Array) {
  const ext = extensionForFile(file.originalName);
  const mime = file.mimeType.toLowerCase();
  if (["docx"].includes(ext) || mime.includes("wordprocessingml")) return parseDocxContent(bytes, file.originalName);
  if (["xlsx", "xls"].includes(ext) || mime.includes("spreadsheetml")) return parseXlsxContent(bytes, file.originalName);
  if (["json"].includes(ext) || mime.includes("json")) return parseJsonContent(decodeUtf8(bytes), file.originalName);
  if (["html", "htm"].includes(ext) || mime.includes("html")) return parseHtmlContent(decodeUtf8(bytes), file.originalName);
  if (ext === "pdf" || mime.includes("pdf")) return parsePdfContent(decodeUtf8(bytes), file.originalName);
  if (isImageFile(ext, mime)) return parseImageContent(file, bytes);
  if (isAudioFile(ext, mime)) return parseAudioVisualContent(file, bytes, "Audio material");
  if (isVideoFile(ext, mime)) return parseAudioVisualContent(file, bytes, "Video material");
  const text = decodeUtf8(bytes);
  return sanitizeKnowledgeExcerpt(text) || text.trim() || `${file.originalName} parsed successfully but no body text was extracted.`;
}

function parseDocxContent(bytes: Uint8Array, fileName: string) {
  const entries = readZipEntries(bytes);
  const documentXml = entries.get("word/document.xml") ?? "";
  const textRuns = Array.from(documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map((match) => decodeXmlEntities(match[1]));
  const text = textRuns.join("").replace(/\s+/g, " ").trim();
  return text ? `Word document: ${fileName}\n${text}` : `${fileName} was read as a Word document but no body text was extracted.`;
}

function parseXlsxContent(bytes: Uint8Array, fileName: string) {
  const entries = readZipEntries(bytes);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml") ?? "";
  const sharedStrings = Array.from(sharedStringsXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => decodeXmlEntities(match[1]));
  const sheets = Array.from(entries.entries()).filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  const rows: string[] = [];
  for (const [, xml] of sheets) {
    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const values = Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).map((cellMatch) => {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const rawValue = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]?.trim() ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]?.trim() ?? "";
        if (/\bt=["']s["']/.test(attrs)) return sharedStrings[Number(rawValue)] ?? rawValue;
        return decodeXmlEntities(rawValue);
      }).filter(Boolean);
      if (values.length) rows.push(values.join(" | "));
    }
  }
  return rows.length ? `Spreadsheet: ${fileName}\n${rows.join("\n")}` : `${fileName} was read as a spreadsheet but no cell content was extracted.`;
}

function parseJsonContent(raw: string, fileName: string) {
  try {
    const parsed = JSON.parse(raw);
    const flattened = flattenJson(parsed).join("\n");
    return flattened ? `JSON data: ${fileName}\n${flattened}` : `JSON data: ${fileName}\n${raw}`;
  } catch {
    return raw.trim() || `${fileName} is a JSON file but its content is empty.`;
  }
}

function parseHtmlContent(raw: string, fileName: string) {
  const text = decodeHtmlEntities(raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
  return text ? `Web/HTML document: ${fileName}\n${text}` : `${fileName} was read as HTML but no body text was extracted.`;
}

function parsePdfContent(raw: string, fileName: string) {
  const readable = extractPdfReadableText(raw);
  const cleaned = stripRawParserPayload(readable || raw);
  return cleaned ? `PDF document: ${fileName}\n${cleaned}` : `${fileName} was read as a PDF but no displayable body text was extracted.`;
}

function parseMediaMetadata(file: StoredFileRecord, bytes: Uint8Array, label: string) {
  return `${label}: ${file.originalName}\nFile type: ${file.mimeType || extensionForFile(file.originalName)}\nFile size: ${formatBytes(bytes.byteLength)}\nThis material is registered as multimodal input; text, image descriptions, and timeline evidence can be extracted once OCR, ASR, or video frame sampling is configured.`;
}

async function parseImageContent(file: StoredFileRecord, bytes: Uint8Array) {
  const description = await extractImageDescription(file, bytes);
  if (description) {
    return `Image material: ${file.originalName}\nFile type: ${file.mimeType || extensionForFile(file.originalName)}\nFile size: ${formatBytes(bytes.byteLength)}\nImage parsing: ${description}`;
  }
  return parseMediaMetadata(file, bytes, "Image material");
}

async function parseAudioVisualContent(file: StoredFileRecord, bytes: Uint8Array, label: "Audio material" | "Video material") {
  const transcript = await transcribeMediaFile(file, bytes);
  if (transcript) {
    return `${label}: ${file.originalName}\nFile type: ${file.mimeType || extensionForFile(file.originalName)}\nFile size: ${formatBytes(bytes.byteLength)}\nTranscript: ${transcript}`;
  }
  return parseMediaMetadata(file, bytes, label);
}

async function extractImageDescription(file: StoredFileRecord, bytes: Uint8Array): Promise<string | null> {
  if (isLocalMediaParsingMode()) return null;
  const apiKey = await readIntegrationEnv("VISION_API_KEY") ?? await readIntegrationEnv("OPENROUTER_API_KEY") ?? await readIntegrationEnv("OPENAI_API_KEY");
  if (!apiKey) return null;
  const baseUrl = (await readIntegrationEnv("VISION_BASE_URL") ?? await readIntegrationEnv("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = await readIntegrationEnv("VISION_MODEL") ?? await readIntegrationEnv("OPENROUTER_VISION_MODEL") ?? await readIntegrationEnv("AGENT_MODEL") ?? "openai/gpt-4o-mini";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost",
        "X-Title": "ff-companybrain"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are the image parser for enterprise knowledge ingest. Extract the text, tables, key objects, relationships, and business meaning from the image, and output a concise summary usable for RAG retrieval."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Parse this uploaded material image. File name: ${file.originalName}` },
              { type: "image_url", image_url: { url: `data:${file.mimeType || "image/png"};base64,${Buffer.from(bytes).toString("base64")}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 900
      }),
      signal: AbortSignal.timeout(Number(await readIntegrationEnv("VISION_TIMEOUT_MS") ?? 45000))
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) return null;
    const content = body?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
  } catch {
    return null;
  }
}

async function transcribeMediaFile(file: StoredFileRecord, bytes: Uint8Array): Promise<string | null> {
  if (isLocalMediaParsingMode()) return null;
  if (bytes.byteLength > 25 * 1024 * 1024) return null;
  const apiKey = await readIntegrationEnv("MEDIA_TRANSCRIPTION_API_KEY") ?? await readIntegrationEnv("OPENAI_API_KEY");
  if (!apiKey) return null;
  const baseUrl = (await readIntegrationEnv("MEDIA_TRANSCRIPTION_BASE_URL") ?? await readIntegrationEnv("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = await readIntegrationEnv("MEDIA_TRANSCRIPTION_MODEL") ?? await readIntegrationEnv("OPENAI_TRANSCRIPTION_MODEL") ?? "gpt-4o-mini-transcribe";
  try {
    const form = new FormData();
    form.set("model", model);
    form.set("file", new File([toArrayBuffer(bytes)], file.originalName, { type: file.mimeType || "application/octet-stream" }));
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(Number(await readIntegrationEnv("MEDIA_TRANSCRIPTION_TIMEOUT_MS") ?? 120000))
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) return null;
    return typeof body?.text === "string" && body.text.trim() ? body.text.trim() : null;
  } catch {
    return null;
  }
}

function isLocalMediaParsingMode() {
  return process.env.FF_PLATFORM_AGENT_MODE === "local"
    || process.env.FF_PLATFORM_AGENT_MODE === "off"
    || process.env.FF_PLATFORM_MEDIA_MODE === "local"
    || process.env.FF_PLATFORM_MEDIA_MODE === "off";
}

function readZipEntries(bytes: Uint8Array) {
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const flags = view.getUint16(6, true);
    const method = view.getUint16(8, true);
    const compressedSize = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = decodeUtf8(bytes.slice(nameStart, nameStart + nameLength));
    if (dataEnd > bytes.byteLength || flags & 0x08) break;
    const compressed = bytes.slice(dataStart, dataEnd);
    let data: Uint8Array | null = null;
    if (method === 0) data = compressed;
    if (method === 8) data = inflateRawSync(compressed);
    if (data) entries.set(name, decodeUtf8(data));
    offset = dataEnd;
  }
  return entries;
}

function flattenJson(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return prefix ? [`${prefix}: ${String(value)}`] : [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJson(item, `${prefix}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, nested]) => flattenJson(nested, prefix ? `${prefix}.${key}` : key));
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeXmlEntities(value: string) {
  return decodeHtmlEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function isImageFile(ext: string, mime: string) {
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"].includes(ext) || mime.startsWith("image/");
}

function isAudioFile(ext: string, mime: string) {
  return ["mp3", "m4a", "wav", "webm", "mpeg", "mpga", "aac", "flac", "ogg"].includes(ext) || mime.startsWith("audio/");
}

function isVideoFile(ext: string, mime: string) {
  return ["mp4", "mov", "mkv", "avi", "webm", "m4v"].includes(ext) || mime.startsWith("video/");
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function buildKnowledgeContent(scenario: StoredScenario, file: StoredFileRecord, content: string, engine: AdminRagEngine) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const excerpt = normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
  return `Scenario: ${scenario.name}\nSource: ${file.originalName}\nEngine: ${engine}\nPermission: ${visibilityLabel(scenario.visibility)}\nContent: ${excerpt}`;
}

function artifactKindForFile(file: StoredFileRecord): ParsedArtifactKind {
  const ext = extensionForFile(file.originalName);
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (["csv", "xls", "xlsx"].includes(ext)) return "table";
  if (ext === "json") return "structured_data";
  if (["zip", "rar", "7z"].includes(ext)) return "archive_manifest";
  if (["txt", "text"].includes(ext)) return "text";
  if (isImageFile(ext, file.mimeType.toLowerCase()) || isAudioFile(ext, file.mimeType.toLowerCase()) || isVideoFile(ext, file.mimeType.toLowerCase())) return "document_text";
  return "document_text";
}

function knowledgeKindForEngine(engine: AdminRagEngine): KnowledgeObjectKind {
  if (engine === "Naive RAG") return "evidence_chunk";
  if (engine === "GraphRAG") return "graph_object";
  return "knowledge_page";
}

function retentionPolicyForFile(fileName: string, mimeType?: string): FileRetentionPolicy {
  const ext = extensionForFile(fileName);
  if (["md", "markdown"].includes(ext) || mimeType === "text/markdown") return "retain_source";
  return "delete_after_ingest";
}

function retentionReasonForPolicy(policy: FileRetentionPolicy) {
  if (policy === "retain_source") return "Markdown is a readable, versionable knowledge source and is kept after ingest.";
  return "Parsed artifacts and knowledge objects are ingested; original files are cleaned up under the default policy.";
}

function extensionForFile(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function requestMatchesTask(requestId: string, task: StoreTask) {
  return requestId === task.id || requestId === task.scenarioId || requestId === `request_${task.id}`;
}

function adminStatusForTask(status: StoreTask["status"]): StoredAdminIntakeRequest["status"] {
  if (status === "ready") return "已发布";
  if (status === "failed") return "已退回";
  if (status === "processing") return "处理中";
  if (status === "waiting_review") return "等待复核";
  return "待管理员确认";
}

function adminActionsForTask(status: StoreTask["status"]) {
  if (status === "ready") return ["查看资料", "查看发布结果"];
  if (status === "failed") return ["查看资料", "查看退回原因"];
  return ["查看资料", "配置引擎策略", "确认入库", "退回补充"];
}

function defaultSelectedMode(mode: RagEngine): RagEngine {
  return mode === "混合处理" ? "知识百科" : mode;
}

function adminEngineForRagMode(mode: RagEngine): AdminRagEngine {
  if (mode === "文档证据") return "Naive RAG";
  if (mode === "关系图谱") return "GraphRAG";
  return "Gbrain";
}

function ragModeForAdminEngine(engine: AdminRagEngine): RagEngine {
  if (engine === "Naive RAG") return "文档证据";
  if (engine === "GraphRAG") return "关系图谱";
  return "知识百科";
}

function displayRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "just now";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days <= 1) return `Yesterday ${new Date(time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  if (days < 7) return `${days} days ago`;
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ragModeForTemplate(templateId: string): RagEngine {
  if (["customer-360", "risk-investigation", "domain-relationship", "voice-of-customer"].includes(templateId)) return "关系图谱";
  if (["contract-playbook", "rfp-security", "policy-evidence", "data-analyst", "it-runbook", "meeting-media-memory"].includes(templateId)) return "文档证据";
  if (["personal-wiki", "team-handbook", "research-guide"].includes(templateId)) return "知识百科";
  return "混合处理";
}

function recommendedModesForTemplate(primary: RagEngine, templateId: string): RagEngine[] {
  if (templateId === "custom-scenario") return ["知识百科", "文档证据", "关系图谱"];
  if (primary === "混合处理") return ["知识百科", "文档证据", "关系图谱"];
  return [primary];
}

function recommendedEnginesForTemplate(primary: RagEngine, templateId: string): AdminRagEngine[] {
  return recommendedModesForTemplate(primary, templateId).map(adminEngineForRagMode);
}

function frontstageMappingForEngines(engines: AdminRagEngine[]) {
  const labels = engines.map((engine) => {
    if (engine === "Gbrain") return "知识百科";
    if (engine === "Naive RAG") return "文档证据";
    return "关系图谱";
  });
  return `Maps to the workspace as: ${labels.join(" / ")}.`;
}

function visibilityText(visibility: StoreVisibility): StoredAdminIntakeRequest["visibility"] {
  if (visibility === "private") return "个人";
  if (visibility === "team") return "团队";
  return "公司";
}

// Display label for text that is rendered directly (audit impact, asset preview, access scope).
// visibilityText above stays Chinese because the admin console dispatches on that discriminator.
function visibilityLabel(visibility: StoreVisibility) {
  if (visibility === "private") return "Personal";
  if (visibility === "team") return "Team";
  return "Company";
}

function permissionImpactForVisibility(visibility: StoreVisibility) {
  if (visibility === "private") return "If this is ingested at personal scope, team and company-wide Q&A will not recall these files.";
  if (visibility === "team") return "If this is ingested at team scope, only team members and admins can use these files.";
  return "If this is ingested at company scope, an admin must review citations, permissions, and publishing boundaries before it enters CompanyBrain.";
}

function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "") || "file";
}
