import { proxyToUpstream } from "../../_proxy";
import {
  authenticateUser,
  clearSessionCookie,
  getRequestSessionToken,
  getRequestUser,
  registerUser,
  revokeSession,
  sessionCookie,
  userToStoreUser
} from "../../../../lib/server/auth-store";
import {
  appendGlobalChatMessage,
  appendScenarioChatMessage,
  askStoredScenarioKnowledge,
  createAdminScenarioTemplate,
  createGlobalChatSession,
  createScenarioChatSession,
  createStoredScenario,
  createScenarioDataRequest,
  setTraceFeedback,
  listGraphCurationSources,
  getGraphCurationDetail,
  mergeGraphCurationEntities,
  editGraphCurationEntity,
  deleteGraphCurationEntity,
  deleteGraphCurationRelation,
  getDocumentChunks,
  deleteDocumentChunk,
  listGbrainPages,
  editGbrainPage,
  deleteAdminScenarioTemplate,
  decideAdminIntakeRequest,
  getAdminDashboardSnapshot,
  getAdminIntegrationSettings,
  probeIntegration,
  updateRuntimeConfig,
  updateEngineRetrievalConfig,
  getGlobalChatSession,
  getScenarioChatSession,
  getStoredFilePreview,
  getStoredScenarioWorkbench,
  listAdminAuditEvents,
  listAdminIntakeRequests,
  listAdminKnowledgeAssetDetails,
  adminEngineRecallVerify,
  adminExportKnowledgeAssetsCsv,
  adminBatchReviewRequests,
  listAdminScenarioTemplates,
  listGlobalChatSessions,
  listScenarioChatSessions,
  listStoredKnowledgeObjects,
  listStoredScenarios,
  listStoredTasks,
  updateAdminScenarioTemplate,
  type AdminKnowledgeAssetKind,
  type AdminRagEngine,
  type AdminStrategyParameters,
  type AdminTemplateMutationInput,
  type GlobalChatOutputMode,
  type GlobalChatScope,
  type StoreUploadFile,
  type StoreUser,
  type StoreVisibility
} from "../../../../lib/server/platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const rawPlatformBaseUrl =
  process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function resolvePlatformBaseUrl(baseUrl = rawPlatformBaseUrl): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  try {
    const url = new URL(normalizedBase);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.at(-1) === "platform") return normalizedBase;
  } catch {
    if (normalizedBase.endsWith("/platform")) return normalizedBase;
  }

  return `${normalizedBase}/platform`;
}

const platformBaseUrl = resolvePlatformBaseUrl();

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxy(request: Request, context: RouteContext) {
  const local = await handleLocalPlatformRoute(request, context);
  if (local) return local;
  return proxyToUpstream(request, context, platformBaseUrl);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

async function handleLocalPlatformRoute(request: Request, context: RouteContext): Promise<Response | null> {
  const { path = [] } = await context.params;
  const method = request.method.toUpperCase();

  if (path[0] === "auth") {
    return handleAuthRoute(request, method, path);
  }

  if (method === "POST" && path.join("/") === "scenarios") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const input = await parseScenarioSubmission(request);
    const created = await createStoredScenario({ ...input, owner: userToStoreUser(user) });
    return Response.json(created, { status: 201 });
  }

  if (method === "GET" && path.join("/") === "tasks") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const tasks = await listStoredTasks(userToStoreUser(user));
    return Response.json({ tasks });
  }

  if (method === "GET" && path.join("/") === "scenarios") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const scenarios = await listStoredScenarios(userToStoreUser(user));
    return Response.json({ scenarios });
  }

  if (method === "GET" && path[0] === "scenarios" && path[1] && path[2] === "workbench") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const workbench = await getStoredScenarioWorkbench(userToStoreUser(user), path[1]);
    if (!workbench) {
      return Response.json({ error: "not_found", message: "Scenario not found, or this account has no access to it." }, { status: 404 });
    }
    return Response.json({
      scenario: workbench.scenario,
      template: workbench.template,
      surface: workbench.surface,
      tasks: workbench.tasks,
      knowledge_objects: workbench.knowledgeObjects
    });
  }

  if (method === "GET" && path[0] === "scenarios" && path[1] && path[2] === "sessions" && !path[3]) {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const sessions = await listScenarioChatSessions(userToStoreUser(user), path[1]);
    return Response.json({ sessions });
  }

  if (method === "POST" && path[0] === "scenarios" && path[1] && path[2] === "sessions" && !path[3]) {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const session = await createScenarioChatSession(userToStoreUser(user), {
      scenarioId: path[1],
      query: typeof body.query === "string" ? body.query : undefined
    });
    if (!session) {
      return Response.json({ error: "not_found", message: "Scenario not found, or this account has no access to it." }, { status: 404 });
    }
    return Response.json({ session }, { status: 201 });
  }

  if (method === "GET" && path[0] === "scenarios" && path[1] && path[2] === "sessions" && path[3]) {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const session = await getScenarioChatSession(userToStoreUser(user), { scenarioId: path[1], sessionId: path[3] });
    if (!session) {
      return Response.json({ error: "not_found", message: "Scenario chat session not found." }, { status: 404 });
    }
    return Response.json({ session });
  }

  if (method === "POST" && path[0] === "scenarios" && path[1] && path[2] === "sessions" && path[3] && path[4] === "messages") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const session = await appendScenarioChatMessage(userToStoreUser(user), {
      scenarioId: path[1],
      sessionId: path[3],
      query: String(body.query ?? "")
    });
    if (!session) {
      return Response.json({ error: "not_found", message: "Scenario chat session not found, or the question is empty." }, { status: 404 });
    }
    return Response.json({ session });
  }

  if (method === "POST" && path[0] === "scenarios" && path[1] && path[2] === "ask") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const query = String(body.query ?? "");
    const answer = await askStoredScenarioKnowledge(userToStoreUser(user), { scenarioId: path[1], query });
    if (!answer) {
      return Response.json({ error: "not_found", message: "No scenario available to ask, or the question is empty." }, { status: 404 });
    }
    return Response.json(answer);
  }

  // 场景资料变更申请（申请更新 / 申请删除）→ 创建真实任务进入处理管线
  if (method === "POST" && path[0] === "scenarios" && path[1] && path[2] === "data-request") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await createScenarioDataRequest(userToStoreUser(user), {
      scenarioId: path[1],
      action: body.action === "delete" ? "delete" : "update"
    });
    return Response.json(result, { status: result.ok ? 201 : 404 });
  }

  // 终端用户对一次问答点赞/点踩 → 写入对应 trace(差评进后台待改进队列)
  if (method === "POST" && path[0] === "traces" && path[1] && path[2] === "feedback") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await setTraceFeedback(userToStoreUser(user), {
      traceId: path[1],
      vote: body.vote === "up" ? "up" : "down",
      note: typeof body.note === "string" ? body.note : undefined
    });
    return Response.json(result, { status: result.ok ? 200 : 404 });
  }

  // 图谱型可编辑工作台:列源 / 详情 / 合并 / 编辑 / 删除实体 / 删除关系(全部真改 LightRAG)
  if (method === "GET" && path.join("/") === "admin/graph-curation/sources") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const sources = await listGraphCurationSources(userToStoreUser(user));
    return Response.json({ sources });
  }
  if (method === "GET" && path.join("/") === "admin/graph-curation/detail") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const sourceId = new URL(request.url).searchParams.get("sourceId") ?? "";
    const detail = await getGraphCurationDetail(userToStoreUser(user), sourceId);
    return detail ? Response.json(detail) : Response.json({ error: "graph_source_not_found", message: "Graph source not found." }, { status: 404 });
  }
  if (method === "POST" && path.join("/") === "admin/graph-curation/merge") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await mergeGraphCurationEntities(userToStoreUser(user), { sourceId: body.sourceId, sourceEntities: body.sourceEntities ?? [], targetEntity: body.targetEntity });
    return Response.json(result);
  }
  if (method === "POST" && path.join("/") === "admin/graph-curation/entity/edit") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await editGraphCurationEntity(userToStoreUser(user), body);
    return Response.json(result);
  }
  if (method === "POST" && path.join("/") === "admin/graph-curation/entity/delete") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await deleteGraphCurationEntity(userToStoreUser(user), body);
    return Response.json(result);
  }
  if (method === "POST" && path.join("/") === "admin/graph-curation/relation/delete") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await deleteGraphCurationRelation(userToStoreUser(user), body);
    return Response.json(result);
  }

  // 文档型:列 chunk / 删 chunk(真改 traditional_chunks)
  if (method === "GET" && path.join("/") === "admin/doc-curation/chunks") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const documentId = new URL(request.url).searchParams.get("documentId") ?? "";
    const chunks = await getDocumentChunks(userToStoreUser(user), documentId);
    return Response.json({ chunks });
  }
  if (method === "POST" && path.join("/") === "admin/doc-curation/chunk/delete") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await deleteDocumentChunk(userToStoreUser(user), body);
    return Response.json(result);
  }
  // 知识页型:列页面 / 编辑页面(真改 nano pages + 重索引)
  if (method === "GET" && path.join("/") === "admin/page-curation/pages") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const sourceId = new URL(request.url).searchParams.get("sourceId") ?? "";
    const pages = await listGbrainPages(userToStoreUser(user), sourceId);
    return Response.json({ pages });
  }
  if (method === "POST" && path.join("/") === "admin/page-curation/page/edit") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const result = await editGbrainPage(userToStoreUser(user), body);
    return Response.json(result);
  }

  if (method === "GET" && path.join("/") === "chat-sessions") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const sessions = await listGlobalChatSessions(userToStoreUser(user));
    return Response.json({ sessions });
  }

  if (method === "POST" && path.join("/") === "chat-sessions") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const session = await createGlobalChatSession(userToStoreUser(user), {
      query: typeof body.query === "string" ? body.query : undefined,
      scope: globalScopeField(body.scope),
      outputMode: globalOutputModeField(body.output_mode ?? body.outputMode)
    });
    return Response.json({ session }, { status: 201 });
  }

  if (method === "GET" && path[0] === "chat-sessions" && path[1]) {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const session = await getGlobalChatSession(userToStoreUser(user), path[1]);
    if (!session) {
      return Response.json({ error: "not_found", message: "Chat session not found." }, { status: 404 });
    }
    return Response.json({ session });
  }

  if (method === "POST" && path[0] === "chat-sessions" && path[1] && path[2] === "messages") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({}));
    const session = await appendGlobalChatMessage(userToStoreUser(user), {
      sessionId: path[1],
      query: String(body.query ?? "")
    });
    if (!session) {
      return Response.json({ error: "not_found", message: "Chat session not found, or the question is empty." }, { status: 404 });
    }
    return Response.json({ session });
  }

  if (method === "GET" && path.join("/") === "knowledge-objects") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const knowledgeObjects = await listStoredKnowledgeObjects(userToStoreUser(user));
    return Response.json({ knowledge_objects: knowledgeObjects });
  }

  if (method === "GET" && path[0] === "admin" && path[1] === "files" && path[2] && path[3] === "preview") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const preview = await getStoredFilePreview(storeUser, path[2]);
    if (!preview) {
      return Response.json({ error: "not_found", message: "The original file is unavailable; it may have been cleaned up under the ingest policy." }, { status: 404 });
    }
    return new Response(toArrayBuffer(preview.bytes), {
      headers: {
        "Content-Type": previewContentType(preview.file.mimeType, preview.file.originalName),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(preview.file.originalName)}`,
        "Cache-Control": "no-store",
        "X-Original-File-State": preview.file.originalState,
        "X-Retention-Policy": preview.file.retentionPolicy
      }
    });
  }

  if (method === "GET" && path.join("/") === "admin/requests") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const requests = await listAdminIntakeRequests(storeUser);
    return Response.json({ requests });
  }

  if (path[0] === "admin" && path[1] === "templates") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }

    if (method === "GET" && path.length === 2) {
      const templates = await listAdminScenarioTemplates(storeUser);
      return Response.json({ templates });
    }
    if (method === "POST" && path.length === 2) {
      const body = await request.json().catch(() => ({}));
      try {
        const template = await createAdminScenarioTemplate(storeUser, adminTemplateMutationInput(body));
        return Response.json({ template }, { status: 201 });
      } catch (error) {
        return Response.json({ error: "invalid_template", message: error instanceof Error ? error.message : "Template information is incomplete." }, { status: 400 });
      }
    }
    if (method === "PATCH" && path[2]) {
      const body = await request.json().catch(() => ({}));
      const template = await updateAdminScenarioTemplate(storeUser, path[2], adminTemplateMutationInput(body));
      if (!template) return Response.json({ error: "not_found", message: "Template not found." }, { status: 404 });
      return Response.json({ template });
    }
    if (method === "DELETE" && path[2]) {
      const result = await deleteAdminScenarioTemplate(storeUser, path[2]);
      if (result.ok) return Response.json({ ok: true });
      if (result.reason === "official_locked") {
        return Response.json({ error: "official_locked", message: "Official templates cannot be hard deleted; pause or archive them instead." }, { status: 409 });
      }
      return Response.json({ error: result.reason, message: "Template not found." }, { status: result.reason === "forbidden" ? 403 : 404 });
    }
  }

  if (method === "GET" && path.join("/") === "admin/dashboard") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const dashboard = await getAdminDashboardSnapshot(storeUser);
    return Response.json({ dashboard });
  }

  if (method === "GET" && path.join("/") === "admin/settings") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const settings = await getAdminIntegrationSettings(storeUser);
    return Response.json({ settings });
  }

  if (method === "POST" && path.join("/") === "admin/integrations/test") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const target = String(body.target ?? "");
    const allowed = ["agent", "embedding", "rerank", "nano-brain", "traditional-rag", "graph-rag"];
    if (!allowed.includes(target)) {
      return Response.json({ error: "bad_request", message: "Unknown health check target." }, { status: 400 });
    }
    const result = await probeIntegration(target);
    return Response.json({ result });
  }

  if (method === "POST" && path.join("/") === "admin/runtime-config") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    try {
      const settings = await updateRuntimeConfig(storeUser, body);
      return Response.json({ settings });
    } catch (error) {
      return Response.json(
        { error: "invalid_runtime_config", message: error instanceof Error ? error.message : "Runtime policy configuration is invalid." },
        { status: 400 }
      );
    }
  }

  if (method === "POST" && path.join("/") === "admin/engine-retrieval-config") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    try {
      const settings = await updateEngineRetrievalConfig(storeUser, body);
      return Response.json({ settings });
    } catch (error) {
      return Response.json(
        { error: "invalid_engine_retrieval_config", message: error instanceof Error ? error.message : "Engine retrieval configuration is invalid." },
        { status: 400 }
      );
    }
  }

  if (method === "GET" && path.join("/") === "admin/audit") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const events = await listAdminAuditEvents(storeUser);
    return Response.json({ events });
  }

  if (method === "GET" && path.join("/") === "admin/knowledge-assets") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const url = new URL(request.url);
    const assets = await listAdminKnowledgeAssetDetails(storeUser, {
      engine: adminEngineField(url.searchParams.get("engine")),
      kind: assetKindField(url.searchParams.get("kind"))
    });
    return Response.json({ assets });
  }

  // 召回验证 / 运行检索 / 运行路径查询 / 图谱·关系复核 / 引用抽检 / 发布复核：对真实引擎跑一次真实检索
  if (method === "POST" && path.join("/") === "admin/recall-verify") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const engine = adminEngineField(body.engine) ?? "Naive RAG";
    const result = await adminEngineRecallVerify(storeUser, {
      engine,
      query: typeof body.query === "string" ? body.query : undefined
    });
    return Response.json(result);
  }

  // 导出资产表：真实知识对象 → CSV
  if (method === "GET" && path.join("/") === "admin/knowledge-assets/export") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const url = new URL(request.url);
    const csv = await adminExportKnowledgeAssetsCsv(storeUser, { engine: adminEngineField(url.searchParams.get("engine")) });
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename*=UTF-8''knowledge-assets.csv",
        "Cache-Control": "no-store"
      }
    });
  }

  // 批量复核：把待确认请求一次性真实入库发布
  if (method === "POST" && path.join("/") === "admin/batch-review") {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const result = await adminBatchReviewRequests(storeUser, { engine: adminEngineField(body.engine) });
    return Response.json(result);
  }

  if (method === "PATCH" && path[0] === "admin" && path[1] === "requests" && path[2]) {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const storeUser = userToStoreUser(user);
    if (storeUser.role !== "admin") {
      return Response.json({ error: "forbidden", message: "Admin permission required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const updated = await decideAdminIntakeRequest(storeUser, {
      requestId: path[2],
      action: body.action === "reject" ? "reject" : "approve",
      selectedMode: ragModeField(body.selected_mode ?? body.selectedMode),
      selectedEngine: adminEngineField(body.selected_engine ?? body.selectedEngine),
      strategyParameters: strategyParametersField(body.strategy_parameters ?? body.strategyParameters),
      reason: typeof body.reason === "string" ? body.reason : undefined
    });
    if (!updated) {
      return Response.json({ error: "not_found", message: "File processing request not found." }, { status: 404 });
    }
    return Response.json({ request: updated });
  }

  return null;
}

async function handleAuthRoute(request: Request, method: string, path: string[]) {
  if (method === "POST" && path[1] === "register") {
    const body = await request.json().catch(() => ({}));
    try {
      const user = await registerUser({
        username: String(body.username ?? ""),
        password: String(body.password ?? ""),
        displayName: typeof body.display_name === "string" ? body.display_name : undefined,
        role: "member",
        organizationId: typeof body.organization_id === "string" ? body.organization_id : undefined,
        teamIds: Array.isArray(body.team_ids) ? body.team_ids.filter((item: unknown): item is string => typeof item === "string") : undefined
      });
      return Response.json({ user }, { status: 201 });
    } catch (error) {
      return Response.json({ error: "invalid_register", message: error instanceof Error ? error.message : "Registration failed" }, { status: 400 });
    }
  }

  if (method === "POST" && path[1] === "login") {
    const body = await request.json().catch(() => ({}));
    const session = await authenticateUser({ username: String(body.username ?? ""), password: String(body.password ?? "") });
    if (!session) {
      return Response.json({ error: "invalid_credentials", message: "Incorrect username or password." }, { status: 401 });
    }
    return Response.json(
      { token: session.token, token_type: "Bearer", user: session.user },
      { headers: { "Set-Cookie": sessionCookie(session.token) } }
    );
  }

  if (method === "GET" && path[1] === "me") {
    const user = await getRequestUser(request);
    if (!user) return Response.json({ error: "unauthorized", message: "Sign in first." }, { status: 401 });
    return Response.json({ user });
  }

  if (method === "POST" && path[1] === "logout") {
    await revokeSession(getRequestSessionToken(request));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  }

  return Response.json({ error: "not_found", message: "Auth endpoint not found." }, { status: 404 });
}

async function requireUser(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "unauthorized", message: "Sign in first." }, { status: 401 });
  return user;
}

async function parseScenarioSubmission(request: Request): Promise<{
  templateId: string;
  name: string;
  description: string;
  visibility: StoreVisibility;
  processingGoal: string;
  files: StoreUploadFile[];
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      templateId: textField(form, "template_id", "custom-scenario"),
      name: textField(form, "name", "Untitled scenario"),
      description: textField(form, "description", ""),
      visibility: visibilityField(textField(form, "visibility", "private")),
      processingGoal: textField(form, "processing_goal", ""),
      files: await Promise.all(form.getAll("files").filter((item): item is File => item instanceof File).map(fileToUpload))
    };
  }

  const body = await request.json().catch(() => ({}));
  const uploadedFiles = Array.isArray(body.uploaded_files) ? body.uploaded_files : [];
  return {
    templateId: String(body.template_id ?? body.templateId ?? "custom-scenario"),
    name: String(body.name ?? "Untitled scenario"),
    description: String(body.description ?? ""),
    visibility: visibilityField(String(body.visibility ?? "private")),
    processingGoal: String(body.processing_goal ?? body.processingGoal ?? ""),
    files: uploadedFiles.map((file: any) => ({
      name: String(file.name ?? "file.txt"),
      type: typeof file.type === "string" ? file.type : "text/plain",
      bytes: new TextEncoder().encode(String(file.text ?? ""))
    }))
  };
}

function textField(form: FormData, key: string, fallback: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function visibilityField(value: string): StoreVisibility {
  return value === "team" || value === "company" ? value : "private";
}

function ragModeField(value: unknown) {
  return value === "知识百科" || value === "文档证据" || value === "关系图谱" || value === "混合处理" ? value : undefined;
}

function adminEngineField(value: unknown): AdminRagEngine | undefined {
  return value === "Gbrain" || value === "Naive RAG" || value === "GraphRAG" ? value : undefined;
}

function assetKindField(value: unknown): AdminKnowledgeAssetKind | undefined {
  const allowedKinds: AdminKnowledgeAssetKind[] = [
    "wiki",
    "fact",
    "link",
    "source",
    "chunk",
    "embedding",
    "citation",
    "eval",
    "entity",
    "relationship",
    "graph",
    "review"
  ];
  return typeof value === "string" && allowedKinds.includes(value as AdminKnowledgeAssetKind) ? value as AdminKnowledgeAssetKind : undefined;
}

function strategyParametersField(value: unknown): AdminStrategyParameters | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key.trim(), String(entry ?? "").trim()] as const)
      .filter(([key, entry]) => key && entry)
  );
}

function adminTemplateMutationInput(body: any): AdminTemplateMutationInput {
  return {
    id: typeof body.id === "string" ? body.id : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    state: typeof body.state === "string" ? body.state as AdminTemplateMutationInput["state"] : undefined,
    owner: typeof body.owner === "string" ? body.owner : undefined,
    headline: typeof body.headline === "string" ? body.headline : undefined,
    acceptedFiles: arrayOfStrings(body.accepted_files ?? body.acceptedFiles),
    inputExamples: arrayOfStrings(body.input_examples ?? body.inputExamples),
    outputCapabilities: arrayOfStrings(body.output_capabilities ?? body.outputCapabilities),
    productForm: arrayOfStrings(body.product_form ?? body.productForm) as AdminTemplateMutationInput["productForm"],
    reviewRequirement: typeof (body.review_requirement ?? body.reviewRequirement) === "string"
      ? body.review_requirement ?? body.reviewRequirement
      : undefined,
    evidenceSources: arrayOfStrings(body.evidence_sources ?? body.evidenceSources)
  };
}

function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function globalScopeField(value: unknown): GlobalChatScope | undefined {
  return value === "private" || value === "team" || value === "company" ? value : undefined;
}

function globalOutputModeField(value: unknown): GlobalChatOutputMode | undefined {
  return value === "report" || value === "table" || value === "direct" ? value : undefined;
}

async function fileToUpload(file: File): Promise<StoreUploadFile> {
  return {
    name: file.name,
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer())
  };
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function previewContentType(mimeType: string, fileName: string) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "csv") return "text/csv; charset=utf-8";
  if (extension === "md" || extension === "markdown") return "text/markdown; charset=utf-8";
  if (extension === "json") return "application/json; charset=utf-8";
  if (extension === "txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
