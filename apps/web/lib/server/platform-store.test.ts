import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  askStoredScenarioKnowledge,
  appendGlobalChatMessage,
  createGlobalChatSession,
  createScenarioChatSession,
  createStoredScenario,
  decideAdminIntakeRequest,
  getAdminDashboardSnapshot,
  getGlobalChatSession,
  getAdminIntegrationSettings,
  listAdminAuditEvents,
  listAdminIntakeRequests,
  listAdminKnowledgeAssetDetails,
  listGlobalChatSessions,
  listStoredKnowledgeObjects,
  listStoredTasks,
  resetPlatformStore
} from "./platform-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ff-platform-store-"));
  process.env.FF_PLATFORM_DATA_DIR = root;
  process.env.FF_PLATFORM_INGEST_MODE = "local";
  process.env.FF_PLATFORM_AGENT_MODE = "local";
  await resetPlatformStore();
});

afterEach(async () => {
  delete process.env.FF_PLATFORM_DATA_DIR;
  delete process.env.FF_PLATFORM_INGEST_MODE;
  delete process.env.FF_PLATFORM_AGENT_MODE;
  delete process.env.NANO_BRAIN_HTTP_URL;
  delete process.env.TRADITIONAL_RAG_HTTP_URL;
  delete process.env.GRAPH_RAG_HTTP_URL;
  delete process.env.RAG_INTERNAL_TOKEN;
  await rm(root, { recursive: true, force: true });
});

describe("platform store", () => {
  test("persists a frontstage scenario submission as a user task and admin intake request", async () => {
    const created = await createStoredScenario({
      templateId: "custom-scenario",
      name: "我的真实自建场景",
      description: "把上传资料做成可追问的知识应用。",
      visibility: "private",
      processingGoal: "先整理资料，再判断适合的知识处理方式。",
      owner: { userId: "user-maya", name: "Maya Chen", role: "member" },
      files: [
        {
          name: "业务说明.md",
          type: "text/markdown",
          bytes: new TextEncoder().encode("真实上传内容")
        }
      ]
    });

    const tasks = await listStoredTasks({ userId: "user-maya", name: "Maya Chen", role: "member" });
    const requests = await listAdminIntakeRequests({ userId: "admin", name: "Admin", role: "admin" });

    expect(created.task.scenarioId).toBe(created.scenario.id);
    expect(tasks.some((task) => task.id === created.task.id)).toBe(true);
    expect(tasks[0].files).toEqual(["业务说明.md"]);
    expect(tasks[0].waitingFor).toBe("Admin");
    expect(requests[0].scenarioName).toBe("我的真实自建场景");
    expect(requests[0].files).toEqual(["业务说明.md"]);
    expect(requests[0].recommendedEngines).toEqual(["Gbrain", "Naive RAG", "GraphRAG"]);
    expect(requests[0].selectedEngine).toBe("待选择");
    expect(requests[0].frontstageMapping).toContain("workspace");
    expect(requests[0].permissionImpact).toContain("team and company-wide Q&A");
    expect(requests[0].storedFiles[0].relativePath).toContain(created.scenario.id);
  });

  test("keeps private tasks invisible to other frontstage users while admin can see them", async () => {
    await createStoredScenario({
      templateId: "custom-scenario",
      name: "仅自己可用资料",
      description: "个人资料",
      visibility: "private",
      processingGoal: "整理个人资料",
      owner: { userId: "owner", name: "Maya Chen", role: "member" },
      files: [{ name: "个人笔记.md", type: "text/markdown", bytes: new TextEncoder().encode("个人内容") }]
    });

    const ownerTasks = await listStoredTasks({ userId: "owner", name: "Maya Chen", role: "member" });
    const otherTasks = await listStoredTasks({ userId: "other", name: "Jordan Lee", role: "member" });
    const adminRequests = await listAdminIntakeRequests({ userId: "admin", name: "Admin", role: "admin" });

    expect(ownerTasks).toHaveLength(1);
    expect(otherTasks).toHaveLength(0);
    expect(adminRequests).toHaveLength(1);
  });

  test("lets an admin confirm intake and updates the frontstage task state", async () => {
    const created = await createStoredScenario({
      templateId: "custom-scenario",
      name: "销售续约资料",
      description: "客户资料包",
      visibility: "team",
      processingGoal: "生成销售续约问答场景。",
      owner: { userId: "owner", name: "Maya Chen", role: "member" },
      files: [{ name: "客户资料.md", type: "text/markdown", bytes: new TextEncoder().encode("客户内容") }]
    });

    const request = await decideAdminIntakeRequest(
      { userId: "admin", name: "Admin", role: "admin" },
      { requestId: `request_${created.task.id}`, action: "approve", selectedMode: "关系图谱" }
    );
    const tasks = await listStoredTasks({ userId: "owner", name: "Maya Chen", role: "member" });

    expect(request?.status).toBe("已发布");
    expect(request?.selectedMode).toBe("关系图谱");
    expect(request?.selectedEngine).toBe("GraphRAG");
    expect(request?.frontstageMapping).toContain("关系图谱");
    expect(tasks[0].status).toBe("ready");
    expect(tasks[0].progress).toBe(100);
    expect(tasks[0].waitingFor).toBe("Scenario owner");
    expect(tasks[0].userMessage).toContain("confirmed ingest");
  });

  test("ingests approved files into permissioned knowledge objects and applies retention policy", async () => {
    const created = await createStoredScenario({
      templateId: "custom-scenario",
      name: "合同资料入库",
      description: "合同和说明资料",
      visibility: "private",
      processingGoal: "生成带引用的合同问答。",
      owner: { userId: "owner", name: "Maya Chen", role: "member" },
      files: [
        { name: "订阅合同.pdf", type: "application/pdf", bytes: new TextEncoder().encode("PDF 合同内容") },
        { name: "业务说明.md", type: "text/markdown", bytes: new TextEncoder().encode("# 业务说明\n需要保留为源文件") }
      ]
    });
    const beforeRequests = await listAdminIntakeRequests({ userId: "admin", name: "Admin", role: "admin" });
    const pdfBefore = beforeRequests[0].storedFiles.find((file) => file.originalName === "订阅合同.pdf");
    const markdownBefore = beforeRequests[0].storedFiles.find((file) => file.originalName === "业务说明.md");

    expect(pdfBefore?.originalState).toBe("temporary");
    expect(markdownBefore?.originalState).toBe("temporary");
    expect(await pathExists(join(root, pdfBefore!.relativePath))).toBe(true);
    expect(await pathExists(join(root, markdownBefore!.relativePath))).toBe(true);

    const approved = await decideAdminIntakeRequest(
      { userId: "admin", name: "Admin", role: "admin" },
      { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "Naive RAG" }
    );
    const ownerKnowledge = await listStoredKnowledgeObjects({ userId: "owner", name: "Maya Chen", role: "member" });
    const otherKnowledge = await listStoredKnowledgeObjects({ userId: "other", name: "Jordan Lee", role: "member" });
    const adminKnowledge = await listStoredKnowledgeObjects({ userId: "admin", name: "Admin", role: "admin" });
    const pdfAfter = approved?.storedFiles.find((file) => file.originalName === "订阅合同.pdf");
    const markdownAfter = approved?.storedFiles.find((file) => file.originalName === "业务说明.md");

    expect(approved?.knowledgeObjectCount).toBeGreaterThanOrEqual(2);
    expect(ownerKnowledge.every((item) => item.visibility === "private" && item.ownerUserId === "owner")).toBe(true);
    expect(ownerKnowledge.map((item) => item.ragEngine)).toContain("Naive RAG");
    expect(otherKnowledge).toHaveLength(0);
    expect(adminKnowledge.length).toBe(ownerKnowledge.length);
    expect(pdfAfter?.retentionPolicy).toBe("delete_after_ingest");
    expect(pdfAfter?.originalState).toBe("deleted");
    expect(pdfAfter?.originalAvailable).toBe(false);
    expect(markdownAfter?.retentionPolicy).toBe("retain_source");
    expect(markdownAfter?.originalState).toBe("retained");
    expect(markdownAfter?.originalAvailable).toBe(true);
    expect(await pathExists(join(root, pdfAfter!.relativePath))).toBe(false);
    expect(await pathExists(join(root, markdownAfter!.relativePath))).toBe(true);
  });

  test("lets admins inspect Naive RAG asset details after ingestion", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const };
    const created = await createStoredScenario({
      templateId: "custom-scenario",
      name: "Naive 切片资料",
      description: "测试切片查看",
      visibility: "private",
      processingGoal: "生成带引用的问答资产。",
      owner,
      files: [{ name: "客户资料.md", type: "text/markdown", bytes: new TextEncoder().encode("客户内容包括续约风险、预算周期和上线阻塞。") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "Naive RAG" });

    const chunks = await listAdminKnowledgeAssetDetails(admin, { engine: "Naive RAG", kind: "chunk" });
    const embeddings = await listAdminKnowledgeAssetDetails(admin, { engine: "Naive RAG", kind: "embedding" });
    const memberChunks = await listAdminKnowledgeAssetDetails(owner, { engine: "Naive RAG", kind: "chunk" });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      kind: "chunk",
      engine: "Naive RAG",
      sourceOriginalName: "客户资料.md",
      scenarioName: "Naive 切片资料"
    });
    expect(chunks[0].content).toContain("续约风险");
    expect(chunks[0].metadata.map((item) => item.label)).toEqual(expect.arrayContaining(["Source file", "权限范围", "Knowledge object"]));
    expect(embeddings[0].status).toBe("Indexed");
    expect(memberChunks).toHaveLength(0);
  });

  test("normalizes legacy knowledge objects when admins inspect asset details", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const };
    const created = await createStoredScenario({
      templateId: "custom-scenario",
      name: "旧版资料兼容",
      description: "旧版数据缺少 accessControl",
      visibility: "private",
      processingGoal: "验证旧数据仍然可查看。",
      owner,
      files: [{ name: "旧版资料.md", type: "text/markdown", bytes: new TextEncoder().encode("旧版知识内容") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "Naive RAG" });
    const dbPath = join(root, "platform-db.json");
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    delete db.knowledgeObjects[0].accessControl;
    await writeFile(dbPath, JSON.stringify(db, null, 2));

    const chunks = await listAdminKnowledgeAssetDetails(admin, { engine: "Naive RAG", kind: "chunk" });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.find((item) => item.label === "权限范围")?.value).toContain("Personal");
  });

  test("isolates team and company knowledge objects by team and organization", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["ops"] };
    const salesOwner = { userId: "sales-owner", name: "Sales owner", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const salesPeer = { userId: "sales-peer", name: "Sales teammate", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const legalPeer = { userId: "legal-peer", name: "Legal teammate", role: "member" as const, organizationId: "org-main", teamIds: ["legal"] };
    const outsideOrg = { userId: "outside", name: "External org", role: "member" as const, organizationId: "org-other", teamIds: ["sales"] };

    const teamScenario = await createStoredScenario({
      templateId: "customer-360",
      name: "销售团队客户画像",
      description: "团队客户资料",
      visibility: "team",
      processingGoal: "生成销售团队可用客户画像。",
      owner: salesOwner,
      files: [{ name: "客户资料.md", type: "text/markdown", bytes: new TextEncoder().encode("销售团队资料") }]
    });
    const companyScenario = await createStoredScenario({
      templateId: "policy-evidence",
      name: "公司制度问答",
      description: "公司级制度资料",
      visibility: "company",
      processingGoal: "生成全公司制度问答。",
      owner: salesOwner,
      files: [{ name: "制度.md", type: "text/markdown", bytes: new TextEncoder().encode("公司制度") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${teamScenario.task.id}`, action: "approve", selectedEngine: "GraphRAG" });
    await decideAdminIntakeRequest(admin, { requestId: `request_${companyScenario.task.id}`, action: "approve", selectedEngine: "Naive RAG" });

    const salesKnowledge = await listStoredKnowledgeObjects(salesPeer);
    const legalKnowledge = await listStoredKnowledgeObjects(legalPeer);
    const outsideKnowledge = await listStoredKnowledgeObjects(outsideOrg);

    expect(salesKnowledge.map((item) => item.scenarioId)).toEqual(expect.arrayContaining([teamScenario.scenario.id, companyScenario.scenario.id]));
    expect(legalKnowledge.map((item) => item.scenarioId)).not.toContain(teamScenario.scenario.id);
    expect(legalKnowledge.map((item) => item.scenarioId)).toContain(companyScenario.scenario.id);
    expect(outsideKnowledge).toHaveLength(0);
    expect(salesKnowledge.find((item) => item.scenarioId === teamScenario.scenario.id)?.accessControl).toMatchObject({
      scope: "team",
      organizationId: "org-main",
      teamIds: ["sales"]
    });
  });

  test("does not treat users without team assignments as one shared team", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Scenario owner", role: "member" as const, organizationId: "org-main" };
    const peerWithoutTeam = { userId: "peer", name: "Same-org member", role: "member" as const, organizationId: "org-main" };

    const created = await createStoredScenario({
      templateId: "team-handbook",
      name: "未分配团队手册",
      description: "缺少团队归属",
      visibility: "team",
      processingGoal: "生成团队手册。",
      owner,
      files: [{ name: "手册.md", type: "text/markdown", bytes: new TextEncoder().encode("团队资料") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "Gbrain" });

    expect(await listStoredKnowledgeObjects(owner)).toHaveLength(1);
    expect(await listStoredKnowledgeObjects(peerWithoutTeam)).toHaveLength(0);
  });

  test("builds an admin dashboard snapshot from real requests assets and module health", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const ready = await createStoredScenario({
      templateId: "policy-evidence",
      name: "公司制度问答",
      description: "公司级制度资料",
      visibility: "company",
      processingGoal: "生成制度问答。",
      owner,
      files: [{ name: "制度.md", type: "text/markdown", bytes: new TextEncoder().encode("公司制度内容") }]
    });
    await createStoredScenario({
      templateId: "customer-360",
      name: "待处理客户资料",
      description: "等待后台处理",
      visibility: "team",
      processingGoal: "生成客户画像。",
      owner,
      files: [{ name: "客户.md", type: "text/markdown", bytes: new TextEncoder().encode("客户资料") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${ready.task.id}`, action: "approve", selectedEngine: "Naive RAG" });

    const snapshot = await getAdminDashboardSnapshot(admin, {
      checkHealth: async (engine) => ({
        id: engine,
        status: engine === "GraphRAG" ? "degraded" : "healthy",
        detail: engine === "GraphRAG" ? "LightRAG 服务需要复核" : "服务可用"
      })
    });

    expect(snapshot.requests.total).toBe(2);
    expect(snapshot.requests.pending).toBe(1);
    expect(snapshot.assets.total).toBeGreaterThanOrEqual(4);
    expect(snapshot.dataOverview.find((item) => item.scope === "公司")?.total).toBeGreaterThanOrEqual(1);
    expect(snapshot.healthCards.map((item) => item.id)).toEqual(["platform-store", "Gbrain", "Naive RAG", "GraphRAG"]);
    expect(snapshot.healthCards.find((item) => item.id === "GraphRAG")?.status).toBe("degraded");
  });

  test("builds real admin integration settings from environment and module health checks", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const calls: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        calls.push(new URL(request.url).pathname);
        return Response.json({ status: "ok", service: "test-rag" });
      }
    });

    process.env.AGENT_API_KEY = "agent-secret-key";
    process.env.AGENT_MODEL = "deepseek/test-chat";
    process.env.EMBEDDING_API_KEY = "embedding-secret-key";
    process.env.EMBEDDING_MODEL = "qwen/test-embedding";
    process.env.MINERU_API_KEY = "mineru-secret-key";
    process.env.RAG_INTERNAL_TOKEN = "internal-token";
    process.env.NANO_BRAIN_HTTP_URL = `http://127.0.0.1:${server.port}`;
    process.env.TRADITIONAL_RAG_HTTP_URL = `http://127.0.0.1:${server.port}`;
    process.env.GRAPH_RAG_HTTP_URL = `http://127.0.0.1:${server.port}`;

    try {
      const settings = await getAdminIntegrationSettings(admin);

      expect(settings.overall_status).toBe("ready");
      expect(settings.providers.find((item) => item.id === "agent")?.model).toBe("deepseek/test-chat");
      expect(settings.providers.find((item) => item.id === "agent")?.secrets[0]).toMatchObject({
        env_name: "AGENT_API_KEY",
        configured: true
      });
      expect(settings.modules.every((item) => item.status === "ok")).toBe(true);
      expect(settings.runtime_policies.find((item) => item.label === "Internal call token")?.value).toBe("Configured");
      expect(calls).toEqual(["/health", "/health", "/health"]);
    } finally {
      server.stop(true);
      delete process.env.AGENT_API_KEY;
      delete process.env.AGENT_MODEL;
      delete process.env.EMBEDDING_API_KEY;
      delete process.env.EMBEDDING_MODEL;
      delete process.env.MINERU_API_KEY;
    }
  });

  test("persists admin strategy parameters and writes audit event when approving intake", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const created = await createStoredScenario({
      templateId: "policy-evidence",
      name: "制度策略参数测试",
      description: "验证管理员策略参数留痕。",
      visibility: "company",
      processingGoal: "生成制度问答。",
      owner,
      files: [{ name: "制度.md", type: "text/markdown", bytes: new TextEncoder().encode("制度内容") }]
    });

    const approved = await decideAdminIntakeRequest(admin, {
      requestId: `request_${created.task.id}`,
      action: "approve",
      selectedEngine: "Naive RAG",
      strategyParameters: { chunk_size: "960", top_k: "10", no_answer_policy: "严格拒答" }
    });
    const requests = await listAdminIntakeRequests(admin);
    const auditEvents = await listAdminAuditEvents(admin);

    expect(approved?.strategyParameters).toEqual({ chunk_size: "960", top_k: "10", no_answer_policy: "严格拒答" });
    expect(requests[0].strategyParameters).toEqual({ chunk_size: "960", top_k: "10", no_answer_policy: "严格拒答" });
    expect(auditEvents[0]).toMatchObject({
      actor: "Admin",
      area: "处理管线",
      summary: "Confirmed ingest: 制度策略参数测试",
      impact: "Naive RAG · Company"
    });
  });

  test("real module mode stores module references and asks through selected RAG services", async () => {
    const calls: Array<{ path: string; method: string; body?: any }> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        let body: any = undefined;
        if (method !== "GET" && request.headers.get("content-type")?.includes("application/json")) {
          body = await request.json();
        }
        calls.push({ path, method, body });

        if (path === "/internal/users/default-source") {
          return Response.json({ source: { id: "nano_source", name: "user/owner", kind: "private" } });
        }
        if (path === "/nano/pages") {
          return Response.json({ page: { id: "nano_page", source_id: body.source_id, title: body.title, slug: body.slug } }, { status: 201 });
        }
        if (path === "/nano/ask") {
          return Response.json({
            answer: "第一阶段问答仅返回检索引用，暂不调用生成模型。请参考 citations。",
            citations: [{ sourceId: "nano_source", source_id: "nano_source", title: "梧桐计划", snippet: "梧桐计划交付窗口是七月第一周。" }]
          });
        }
        if (path === "/traditional/sources") {
          return Response.json({ source: { id: "traditional_source", name: "real-naive", kind: body.kind ?? "private" } }, { status: 201 });
        }
        if (path === "/traditional/documents") {
          return Response.json({
            document: { id: "traditional_document", source_id: "traditional_source", original_filename: "星河制度.md", status: "uploaded" },
            job: { id: "traditional_job", status: "uploaded" }
          }, { status: 201 });
        }
        if (path === "/traditional/jobs/traditional_job") {
          return Response.json({ job: { id: "traditional_job", status: "ready", stage: "embedded" } });
        }
        if (path === "/traditional/search") {
          return Response.json({
            results: [{
              chunk: { id: "traditional_chunk", text: "星河制度规定差旅报销上限是 680 元。", snippet: "差旅报销上限是 680 元。" },
              document: { id: "traditional_document", filename: "星河制度.md" },
              source: { id: "traditional_source" }
            }]
          });
        }
        if (path === "/graph/sources") {
          return Response.json({ source: { id: "graph_source", name: "real-graph", kind: body.kind ?? "private", workspace: "graph_workspace" } }, { status: 201 });
        }
        if (path === "/graph/documents/text") {
          return Response.json({ document: { id: "graph_document", source_id: "graph_source", status: "ready", original_filename: body.title } }, { status: 201 });
        }
        if (path === "/graph/ask") {
          return Response.json({
            answer: "",
            note: "GraphRAG MCP/HTTP 返回检索依据；最终回答由 Agent 基于依据生成。",
            citations: [{ source_id: "graph_source", context: "曜石客户的主要风险是集成风险，关系对象包含北辰云服。" }]
          });
        }
        return Response.json({ error: "not_found", path }, { status: 404 });
      }
    });

    process.env.FF_PLATFORM_INGEST_MODE = "real";
    process.env.RAG_INTERNAL_TOKEN = "test-internal-token";
    process.env.NANO_BRAIN_HTTP_URL = `http://127.0.0.1:${server.port}`;
    process.env.TRADITIONAL_RAG_HTTP_URL = `http://127.0.0.1:${server.port}`;
    process.env.GRAPH_RAG_HTTP_URL = `http://127.0.0.1:${server.port}`;

    try {
      const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
      const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
      const cases = [
        { templateId: "personal-wiki", engine: "Gbrain" as const, name: "梧桐知识库", file: "梧桐计划.md", text: "梧桐计划交付窗口是七月第一周。", query: "梧桐计划交付窗口是什么？", expected: "七月第一周" },
        { templateId: "policy-evidence", engine: "Naive RAG" as const, name: "星河制度问答", file: "星河制度.md", text: "星河制度规定差旅报销上限是 680 元。", query: "差旅报销上限是多少？", expected: "680 元" },
        { templateId: "customer-360", engine: "GraphRAG" as const, name: "曜石关系图谱", file: "曜石关系.md", text: "曜石客户的主要风险是集成风险。", query: "曜石客户主要风险是什么？", expected: "集成风险" }
      ];

      for (const item of cases) {
        const created = await createStoredScenario({
          templateId: item.templateId,
          name: item.name,
          description: "真实模块编排测试",
          visibility: "private",
          processingGoal: "进入真实 RAG 模块入库和检索。",
          owner,
          files: [{ name: item.file, type: "text/markdown", bytes: new TextEncoder().encode(item.text) }]
        });
        const approved = await decideAdminIntakeRequest(admin, {
          requestId: `request_${created.task.id}`,
          action: "approve",
          selectedEngine: item.engine
        });
        const answer = await askStoredScenarioKnowledge(owner, { scenarioId: created.scenario.id, query: item.query });
        const objects = await listStoredKnowledgeObjects(owner);
        const object = objects.find((entry) => entry.scenarioId === created.scenario.id);

        expect(approved?.status).toBe("已发布");
        expect(object?.moduleReferences?.[0].engine).toBe(item.engine);
        expect(answer?.answer.engine).toBe(item.engine);
        expect(answer?.answer.text).toContain(item.expected);
        expect(answer?.answer.citations[0].excerpt).toContain(item.expected);
      }

      expect(calls.map((call) => call.path)).toEqual(expect.arrayContaining([
        "/internal/users/default-source",
        "/nano/pages",
        "/nano/ask",
        "/traditional/documents",
        "/traditional/search",
        "/graph/documents/text",
        "/graph/ask"
      ]));
    } finally {
      server.stop(true);
    }
  });

  test("keeps scenario chat answers separate from raw GraphRAG source payloads", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const csv = [
      '"需求","影响客户数","行业","续约影响","证据来源","建议优先级"',
      '"角色模板","18","金融/制造","高","工单与访谈","P0"',
      '"审批日志","12","金融","高","安全问卷","P0"'
    ].join("\n");
    const created = await createStoredScenario({
      templateId: "customer-360",
      name: "重点客户反馈分析",
      description: "汇总工单、访谈和反馈，识别高频需求、影响客户和证据链。",
      visibility: "team",
      processingGoal: "识别高频需求、影响客户和证据链。",
      owner,
      files: [{ name: "重点客户反馈分析-结构化记录.csv", type: "text/csv", bytes: new TextEncoder().encode(csv) }]
    });

    await decideAdminIntakeRequest(admin, {
      requestId: `request_${created.task.id}`,
      action: "approve",
      selectedEngine: "GraphRAG"
    });

    const session = await createScenarioChatSession(owner, {
      scenarioId: created.scenario.id,
      query: "哪些客户需求影响企业续约？"
    });
    const assistant = session?.messages.at(-1);
    const visibleText = `${assistant?.content}\n${assistant?.citations?.map((item) => item.excerpt).join("\n")}`;

    expect(assistant?.role).toBe("assistant");
    expect(assistant?.engine).toBe("GraphRAG");
    expect(assistant?.citations?.[0]).toMatchObject({
      sourceOriginalName: "重点客户反馈分析-结构化记录.csv",
      engine: "GraphRAG"
    });
    expect(assistant?.content).toContain("重点客户反馈分析");
    expect(assistant?.content).toContain("关系图谱");
    expect(visibleText).toContain("角色模板");
    expect(assistant?.content).not.toContain("场景：");
    expect(assistant?.content).not.toContain("来源：重点客户反馈分析-结构化记录.csv");
    expect(assistant?.content).not.toContain("引擎：");
    expect(assistant?.content).not.toContain("权限：");
    expect(assistant?.content).not.toContain('"需求","影响客户数"');
    expect(visibleText).not.toContain("场景：重点客户反馈分析");
    expect(visibleText).not.toContain("引擎：GraphRAG");
    expect(visibleText).not.toContain("权限：团队");
  });

  test("creates global chat sessions from accessible knowledge and keeps history sorted by update time", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const salesOwner = { userId: "sales-owner", name: "Sales owner", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const salesPeer = { userId: "sales-peer", name: "Sales teammate", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const legalPeer = { userId: "legal-peer", name: "Legal teammate", role: "member" as const, organizationId: "org-main", teamIds: ["legal"] };

    const teamScenario = await createStoredScenario({
      templateId: "customer-360",
      name: "销售客户续约风险",
      description: "团队客户资料",
      visibility: "team",
      processingGoal: "生成客户风险问答。",
      owner: salesOwner,
      files: [{ name: "客户风险.md", type: "text/markdown", bytes: new TextEncoder().encode("Northwind Labs存在续约风险，主要原因是预算周期延后和接口集成阻塞。") }]
    });
    const companyScenario = await createStoredScenario({
      templateId: "policy-evidence",
      name: "公司制度问答",
      description: "公司级制度资料",
      visibility: "company",
      processingGoal: "生成全公司制度问答。",
      owner: salesOwner,
      files: [{ name: "续约制度.md", type: "text/markdown", bytes: new TextEncoder().encode("公司续约制度要求高风险客户必须输出风险来源、缓解动作和责任人。") }]
    });

    await decideAdminIntakeRequest(admin, { requestId: `request_${teamScenario.task.id}`, action: "approve", selectedEngine: "GraphRAG" });
    await decideAdminIntakeRequest(admin, { requestId: `request_${companyScenario.task.id}`, action: "approve", selectedEngine: "Naive RAG" });

    const session = await createGlobalChatSession(salesPeer, {
      query: "Northwind Labs续约风险是什么？",
      scope: "company",
      outputMode: "direct"
    });

    expect(session.messages).toHaveLength(2);
    expect(session.messages[1].role).toBe("assistant");
    expect(session.messages[1].citations?.map((item) => item.scenarioName)).toEqual(expect.arrayContaining(["销售客户续约风险", "公司制度问答"]));
    expect(session.messages[1].contextTrace?.layers).toEqual(expect.arrayContaining(["Short-term session", "Long-term memory", "Permission filter", "External knowledge"]));
    expect(session.messages[1].contextTrace?.retrievalTracks.find((item) => item.label === "Knowledge graph")?.count).toBeGreaterThanOrEqual(1);

    const legalSession = await createGlobalChatSession(legalPeer, {
      query: "Northwind Labs续约风险是什么？",
      scope: "company",
      outputMode: "direct"
    });
    expect(legalSession.messages[1].citations?.map((item) => item.scenarioName)).not.toContain("销售客户续约风险");
    expect(legalSession.messages[1].citations?.map((item) => item.scenarioName)).toContain("公司制度问答");

    await appendGlobalChatMessage(salesPeer, { sessionId: session.id, query: "继续给出缓解动作" });
    const history = await listGlobalChatSessions(salesPeer);
    const detail = await getGlobalChatSession(salesPeer, session.id);

    expect(history[0].id).toBe(session.id);
    expect(history[0].messageCount).toBe(4);
    expect(detail?.memory.shortTermCount).toBe(4);
    expect(detail?.messages.at(-1)?.contextTrace?.shortTermTurns).toBeGreaterThanOrEqual(2);
  });

  test("routes greetings to direct model answers without retrieving knowledge assets", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const created = await createStoredScenario({
      templateId: "customer-360",
      name: "销售客户续约风险",
      description: "团队客户资料",
      visibility: "company",
      processingGoal: "生成客户风险问答。",
      owner,
      files: [{ name: "客户风险.md", type: "text/markdown", bytes: new TextEncoder().encode("Northwind Labs存在续约风险，主要原因是预算周期延后和接口集成阻塞。") }]
    });
    await decideAdminIntakeRequest(admin, { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "GraphRAG" });

    const session = await createGlobalChatSession(owner, {
      query: "你好",
      scope: "company",
      outputMode: "direct"
    });
    const assistant = session.messages.at(-1);

    expect(assistant?.role).toBe("assistant");
    expect(assistant?.citations).toHaveLength(0);
    expect(assistant?.content).not.toContain("销售客户续约风险");
    expect(assistant?.content).not.toContain("Document evidence");
    expect(assistant?.contextTrace?.layers).toContain("Direct answer");
    expect(assistant?.contextTrace?.retrievalTracks.every((track) => track.count === 0)).toBe(true);
  });

  test("does not expose raw parser payloads in global retrieval answers or citations", async () => {
    const admin = { userId: "admin", name: "Admin", role: "admin" as const, organizationId: "org-main", teamIds: ["platform-admin"] };
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const rawPdfLikeContent = [
      "%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj 2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "制度问答：高风险客户必须输出风险来源、缓解动作和责任人。"
    ].join(" ");
    const created = await createStoredScenario({
      templateId: "policy-evidence",
      name: "制度政策据问答",
      description: "公司制度资料",
      visibility: "company",
      processingGoal: "生成制度问答。",
      owner,
      files: [{ name: "制度问答.pdf", type: "application/pdf", bytes: new TextEncoder().encode(rawPdfLikeContent) }]
    });
    await decideAdminIntakeRequest(admin, { requestId: `request_${created.task.id}`, action: "approve", selectedEngine: "Naive RAG" });

    const session = await createGlobalChatSession(owner, {
      query: "制度问答中高风险客户需要什么动作？",
      scope: "company",
      outputMode: "direct"
    });
    const assistant = session.messages.at(-1);
    const citationText = assistant?.citations?.map((item) => item.excerpt).join("\n") ?? "";

    expect(assistant?.citations?.[0]?.knowledgeType).toBe("Document evidence");
    expect(`${assistant?.content}\n${citationText}`).toContain("高风险客户");
    expect(`${assistant?.content}\n${citationText}`).not.toContain("%PDF");
    expect(`${assistant?.content}\n${citationText}`).not.toContain("/Type");
    expect(`${assistant?.content}\n${citationText}`).not.toContain("endobj");
  });

  test("sanitizes legacy persisted global chat messages before returning sessions", async () => {
    const owner = { userId: "owner", name: "Maya Chen", role: "member" as const, organizationId: "org-main", teamIds: ["sales"] };
    const session = await createGlobalChatSession(owner, {
      query: "你好",
      scope: "company",
      outputMode: "direct"
    });
    const dbPath = join(root, "platform-db.json");
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    const stored = db.chatSessions.find((item: any) => item.id === session.id);
    stored.messages[1].content = [
      "针对「Northwind Labs续约风险是什么？」，我同时检索了当前账号可访问的文档证据。",
      "可追溯依据：1. 真实链路 Naive RAG 制度问答：场景：真实链路 Naive RAG 制度问答 来源：xinghe-policy.pdf 引擎：Naive RAG 权限：公司 内容：%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj"
    ].join("\n\n");
    stored.messages[1].citations = [
      {
        knowledgeObjectId: "ko_legacy",
        sourceOriginalName: "xinghe-policy.pdf",
        scenarioId: "scene_legacy",
        scenarioName: "真实链路 Naive RAG 制度问答",
        engine: "Naive RAG",
        knowledgeType: "Document evidence",
        excerpt: "场景：真实链路 Naive RAG 制度问答 来源：xinghe-policy.pdf 引擎：Naive RAG 权限：公司 内容：%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj BT (Xinghe policy says approval is required.) Tj ET"
      }
    ];
    await writeFile(dbPath, JSON.stringify(db, null, 2));

    const cleaned = await getGlobalChatSession(owner, session.id);
    const assistant = cleaned?.messages.at(-1);
    const visibleText = `${assistant?.content}\n${assistant?.citations?.map((item) => item.excerpt).join("\n")}`;

    expect(assistant?.content).toContain("Traceable evidence is shown on the right by source type");
    expect(assistant?.citations?.[0]?.excerpt).toContain("Xinghe policy");
    expect(visibleText).not.toContain("%PDF");
    expect(visibleText).not.toContain("/Type");
    expect(visibleText).not.toContain("endobj");
  });
});

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
