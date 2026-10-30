import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DELETE, GET, PATCH, POST, resolvePlatformBaseUrl } from "./route";
import { authenticateUser, registerUser, resetAuthStore } from "../../../../lib/server/auth-store";
import { resetPlatformStore } from "../../../../lib/server/platform-store";

describe("platform API proxy route", () => {
  beforeEach(() => {
    process.env.FF_PLATFORM_INGEST_MODE = "local";
    process.env.FF_PLATFORM_AGENT_MODE = "local";
  });

  afterEach(() => {
    delete process.env.FF_PLATFORM_INGEST_MODE;
    delete process.env.FF_PLATFORM_AGENT_MODE;
  });

  it("targets the backend platform mount when the API base is the service root", () => {
    expect(resolvePlatformBaseUrl("http://localhost:3101")).toBe("http://localhost:3101/platform");
  });

  it("does not duplicate the platform segment when it is already configured", () => {
    expect(resolvePlatformBaseUrl("http://localhost:3101/platform/")).toBe("http://localhost:3101/platform");
  });

  it("persists scenario submissions and exposes them to user tasks and admin requests", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "真实前台提交场景");
      form.set("description", "用户从前台上传资料创建的场景");
      form.set("visibility", "private");
      form.set("processing_goal", "让后台选择知识处理方式");
      form.append("files", new File(["真实文件内容"], "业务说明.md", { type: "text/markdown" }));

      const unauthenticated = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", body: form }), routeContext("scenarios"));
      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      const tasks = await GET(new Request("http://localhost/api/platform/tasks", { headers: authHeader(memberToken) }), routeContext("tasks"));
      const tasksBody = await tasks.json();
      const requests = await GET(new Request("http://localhost/api/platform/admin/requests", { headers: authHeader(adminToken) }), routeContext("admin", "requests"));
      const requestsBody = await requests.json();

      expect(unauthenticated.status).toBe(401);
      expect(created.status).toBe(201);
      expect(createdBody.task.files).toEqual(["业务说明.md"]);
      expect(tasksBody.tasks.some((task: any) => task.id === createdBody.task.id)).toBe(true);
      expect(requestsBody.requests[0].scenarioName).toBe("真实前台提交场景");
      expect(requestsBody.requests[0].storedFiles[0].relativePath).toContain(createdBody.scenario.id);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects admin request data for non-admin callers", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const unauthenticated = await GET(new Request("http://localhost/api/platform/admin/requests"), routeContext("admin", "requests"));
      const forged = await GET(new Request("http://localhost/api/platform/admin/requests", { headers: { "x-user-role": "admin" } }), routeContext("admin", "requests"));
      const response = await GET(new Request("http://localhost/api/platform/admin/requests", { headers: authHeader(memberToken) }), routeContext("admin", "requests"));
    const body = await response.json();

      expect(unauthenticated.status).toBe(401);
      expect(forged.status).toBe(401);
    expect(response.status).toBe(403);
    expect(body.error).toBe("forbidden");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("lets admins approve an intake request and updates user tasks", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "待确认客户资料");
      form.set("visibility", "team");
      form.set("processing_goal", "生成客户画像。");
      form.append("files", new File(["客户资料"], "客户资料.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      const forbidden = await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: authHeader(memberToken),
          body: JSON.stringify({ action: "approve", selected_mode: "关系图谱" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const approved = await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "GraphRAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const approvedBody = await approved.json();
      const tasks = await GET(new Request("http://localhost/api/platform/tasks", { headers: authHeader(memberToken) }), routeContext("tasks"));
      const tasksBody = await tasks.json();

      expect(forbidden.status).toBe(403);
      expect(approved.status).toBe(200);
      expect(approvedBody.request.status).toBe("已发布");
      expect(approvedBody.request.selectedMode).toBe("关系图谱");
      expect(approvedBody.request.selectedEngine).toBe("GraphRAG");
      expect(approvedBody.request.knowledgeObjectCount).toBeGreaterThanOrEqual(1);
      expect(approvedBody.request.storedFiles[0].originalState).toBe("retained");
      expect(tasksBody.tasks[0].status).toBe("ready");
      expect(tasksBody.tasks[0].progress).toBe(100);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes only permissioned knowledge objects after admin ingestion", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const ownerToken = await createSession("owner", false);
      const otherToken = await createSession("other", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "个人资料库");
      form.set("visibility", "private");
      form.set("processing_goal", "生成个人可追问知识。");
      form.append("files", new File(["个人知识"], "个人资料.pdf", { type: "application/pdf" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(ownerToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const ownerObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(ownerToken) }), routeContext("knowledge-objects"));
      const otherObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(otherToken) }), routeContext("knowledge-objects"));
      const adminObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(adminToken) }), routeContext("knowledge-objects"));
      const ownerBody = await ownerObjects.json();
      const otherBody = await otherObjects.json();
      const adminBody = await adminObjects.json();

      expect(ownerObjects.status).toBe(200);
      expect(ownerBody.knowledge_objects).toHaveLength(1);
      expect(ownerBody.knowledge_objects[0].visibility).toBe("private");
      expect(ownerBody.knowledge_objects[0].ragEngine).toBe("Naive RAG");
      expect(otherBody.knowledge_objects).toHaveLength(0);
      expect(adminBody.knowledge_objects).toHaveLength(1);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves admin-only knowledge asset details for Naive RAG chunks", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "Naive RAG 资料库");
      form.set("visibility", "private");
      form.set("processing_goal", "生成可溯源问答。");
      form.append("files", new File(["客户预算周期、续约风险和上线阻塞"], "客户资料.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );

      const forbidden = await GET(new Request("http://localhost/api/platform/admin/knowledge-assets?engine=Naive%20RAG&kind=chunk", { headers: authHeader(memberToken) }), routeContext("admin", "knowledge-assets"));
      const response = await GET(new Request("http://localhost/api/platform/admin/knowledge-assets?engine=Naive%20RAG&kind=chunk", { headers: authHeader(adminToken) }), routeContext("admin", "knowledge-assets"));
      const body = await response.json();

      expect(forbidden.status).toBe(403);
      expect(response.status).toBe(200);
      expect(body.assets).toHaveLength(1);
      expect(body.assets[0]).toMatchObject({
        kind: "chunk",
        engine: "Naive RAG",
        sourceOriginalName: "客户资料.md",
        scenarioName: "Naive RAG 资料库"
      });
      expect(body.assets[0].content).toContain("续约风险");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("protects admin template governance and supports custom template lifecycle", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);

      const unauthenticated = await GET(new Request("http://localhost/api/platform/admin/templates"), routeContext("admin", "templates"));
      const forbiddenList = await GET(new Request("http://localhost/api/platform/admin/templates", { headers: authHeader(memberToken) }), routeContext("admin", "templates"));
      const listed = await GET(new Request("http://localhost/api/platform/admin/templates", { headers: authHeader(adminToken) }), routeContext("admin", "templates"));
      const listedBody = await listed.json();

      const forbiddenCreate = await POST(
        new Request("http://localhost/api/platform/admin/templates", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ name: "售后质检分析", category: "客服" })
        }),
        routeContext("admin", "templates")
      );
      const created = await POST(
        new Request("http://localhost/api/platform/admin/templates", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({
            name: "售后质检分析",
            category: "客服",
            headline: "分析客服录音、工单和质检表，输出服务风险与改进建议。",
            accepted_files: ["音频", "表格资料", "文档资料"],
            input_examples: ["客服录音", "工单导出", "质检表"],
            output_capabilities: ["质检摘要", "风险清单", "改进建议"],
            product_form: ["report_generator", "task_workflow"],
            review_requirement: "需要管理员确认"
          })
        }),
        routeContext("admin", "templates")
      );
      const createdBody = await created.json();
      const patched = await PATCH(
        new Request(`http://localhost/api/platform/admin/templates/${createdBody.template.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ state: "paused", owner: "知识运营", review_requirement: "建议管理员确认" })
        }),
        routeContext("admin", "templates", createdBody.template.id)
      );
      const patchedBody = await patched.json();
      const officialDelete = await DELETE(
        new Request("http://localhost/api/platform/admin/templates/customer-360", { method: "DELETE", headers: authHeader(adminToken) }),
        routeContext("admin", "templates", "customer-360")
      );
      const deleted = await DELETE(
        new Request(`http://localhost/api/platform/admin/templates/${createdBody.template.id}`, { method: "DELETE", headers: authHeader(adminToken) }),
        routeContext("admin", "templates", createdBody.template.id)
      );
      const relisted = await GET(new Request("http://localhost/api/platform/admin/templates", { headers: authHeader(adminToken) }), routeContext("admin", "templates"));
      const relistedBody = await relisted.json();

      expect(unauthenticated.status).toBe(401);
      expect(forbiddenList.status).toBe(403);
      expect(listed.status).toBe(200);
      expect(listedBody.templates).toHaveLength(14);
      expect(listedBody.templates.find((item: any) => item.id === "voice-of-customer")).toMatchObject({
        source: "official",
        canDelete: false
      });
      expect(forbiddenCreate.status).toBe(403);
      expect(created.status).toBe(201);
      expect(createdBody.template).toMatchObject({
        name: "售后质检分析",
        source: "custom",
        canDelete: true,
        state: "candidate"
      });
      expect(patched.status).toBe(200);
      expect(patchedBody.template.state).toBe("paused");
      expect(patchedBody.template.owner).toBe("知识运营");
      expect(officialDelete.status).toBe(409);
      expect(deleted.status).toBe(200);
      expect(relistedBody.templates.some((item: any) => item.id === createdBody.template.id)).toBe(false);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes uploaded office documents tables json html pdf and media before local ingestion", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "data-analyst");
      form.set("name", "多格式资料分析");
      form.set("visibility", "company");
      form.set("processing_goal", "把多格式资料解析成可检索证据。");
      form.append("files", new File([officeDocx("客户访谈确认审批延期，续约风险来自预算周期。")], "客户访谈.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      form.append("files", new File([officeXlsx([["客户", "风险"], ["Northwind Labs", "预算延期"], ["星河", "住宿标准 680 元"]])], "指标明细.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      form.append("files", new File([JSON.stringify({ customer: "Northwind Labs", risk: "预算延期", next: "复核合同排期" })], "关系数据.json", { type: "application/json" }));
      form.append("files", new File(["<html><body><h1>续约制度</h1><p>提前30天确认风险。</p></body></html>"], "制度说明.html", { type: "text/html" }));
      form.append("files", new File(["%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nBT\n(一线城市住宿标准为 680 元) Tj\nET\n%%EOF"], "报销制度.pdf", { type: "application/pdf" }));
      form.append("files", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], "客户关系图.png", { type: "image/png" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      const approved = await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const assets = await GET(
        new Request("http://localhost/api/platform/admin/knowledge-assets?engine=Naive%20RAG&kind=chunk", { headers: authHeader(adminToken) }),
        routeContext("admin", "knowledge-assets")
      );
      const assetsBody = await assets.json();
      const serializedAssets = JSON.stringify(assetsBody.assets);
      const answer = await POST(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/ask`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "Northwind Labs的风险和住宿标准是多少？" })
        }),
        routeContext("scenarios", createdBody.scenario.id, "ask")
      );
      const answerBody = await answer.json();

      expect(created.status).toBe(201);
      expect(approved.status).toBe(200);
      expect(assets.status).toBe(200);
      expect(serializedAssets).toContain("审批延期");
      expect(serializedAssets).toContain("Northwind Labs");
      expect(serializedAssets).toContain("提前30天");
      expect(serializedAssets).toContain("680 元");
      expect(serializedAssets).toContain("Image material: 客户关系图.png");
      expect(serializedAssets).not.toContain("<w:t");
      expect(serializedAssets).not.toContain("<sheetData");
      expect(serializedAssets).not.toContain("%PDF-1.4");
      expect(serializedAssets).not.toContain("endobj");
      expect(answer.status).toBe(200);
      expect(answerBody.answer.text).toContain("预算延期");
      expect(answerBody.answer.text).toContain("680 元");
      expect(answerBody.answer.citations.length).toBeGreaterThanOrEqual(2);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses configured multimodal parsers for image and audio uploads before retrieval", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    process.env.FF_PLATFORM_AGENT_MODE = "remote";
    process.env.FF_PLATFORM_MEDIA_MODE = "remote";
    process.env.OPENROUTER_API_KEY = "test-openrouter";
    process.env.OPENAI_API_KEY = "test-openai";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/chat/completions")) {
        return Response.json({ choices: [{ message: { content: "图片里展示Northwind Labs、采购负责人和集成风险的关系链。" } }] });
      }
      if (url.includes("/audio/transcriptions")) {
        return Response.json({ text: "会议确认预算延期是当前风险，客户成功下周同步上线成效材料。" });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "meeting-media-memory");
      form.set("name", "多模态会议资料");
      form.set("visibility", "team");
      form.set("processing_goal", "解析图片和录音，形成可追问纪要。");
      form.append("files", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], "客户关系图.png", { type: "image/png" }));
      form.append("files", new File([new Uint8Array([1, 2, 3, 4, 5, 6])], "续约会议.mp3", { type: "audio/mpeg" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const answer = await POST(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/ask`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "会议确认了什么风险？" })
        }),
        routeContext("scenarios", createdBody.scenario.id, "ask")
      );
      const answerBody = await answer.json();

      expect(answer.status).toBe(200);
      expect(answerBody.answer.text).toContain("预算延期");
      expect(answerBody.answer.text).toContain("集成风险");
      expect(answerBody.answer.citations.map((item: any) => item.sourceOriginalName)).toEqual(expect.arrayContaining(["客户关系图.png", "续约会议.mp3"]));
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.FF_PLATFORM_DATA_DIR;
      delete process.env.FF_PLATFORM_MEDIA_MODE;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENAI_API_KEY;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves an admin dashboard snapshot with requests assets and service health", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "后台总览资料包");
      form.set("visibility", "private");
      form.set("processing_goal", "生成后台总览数据。");
      form.append("files", new File(["后台总览资料"], "后台总览.md", { type: "text/markdown" }));

      await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));

      const forbidden = await GET(new Request("http://localhost/api/platform/admin/dashboard", { headers: authHeader(memberToken) }), routeContext("admin", "dashboard"));
      const response = await GET(new Request("http://localhost/api/platform/admin/dashboard", { headers: authHeader(adminToken) }), routeContext("admin", "dashboard"));
      const body = await response.json();

      expect(forbidden.status).toBe(403);
      expect(response.status).toBe(200);
      expect(body.dashboard.requests.total).toBe(1);
      expect(body.dashboard.requests.pending).toBe(1);
      expect(body.dashboard.healthCards.map((item: any) => item.id)).toEqual(["platform-store", "Gbrain", "Naive RAG", "GraphRAG"]);
      expect(body.dashboard.dataOverview.map((item: any) => item.scope)).toEqual(["个人", "团队", "公司"]);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves real admin integration settings from environment and protects them", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    const healthServer = Bun.serve({
      port: 0,
      fetch(request) {
        return new URL(request.url).pathname === "/health"
          ? Response.json({ status: "ok", service: "route-rag" })
          : new Response("missing", { status: 404 });
      }
    });
    const baseUrl = `http://127.0.0.1:${healthServer.port}`;
    process.env.FF_PLATFORM_DATA_DIR = root;
    process.env.AGENT_API_KEY = "route-agent-secret";
    process.env.AGENT_MODEL = "deepseek/route-chat";
    process.env.EMBEDDING_API_KEY = "route-embedding-secret";
    process.env.MINERU_API_KEY = "route-mineru-secret";
    process.env.RAG_INTERNAL_TOKEN = "route-internal-token";
    process.env.NANO_BRAIN_HTTP_URL = baseUrl;
    process.env.TRADITIONAL_RAG_HTTP_URL = baseUrl;
    process.env.GRAPH_RAG_HTTP_URL = baseUrl;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const forbidden = await GET(new Request("http://localhost/api/platform/admin/settings", { headers: authHeader(memberToken) }), routeContext("admin", "settings"));
      const response = await GET(new Request("http://localhost/api/platform/admin/settings", { headers: authHeader(adminToken) }), routeContext("admin", "settings"));
      const body = await response.json();

      expect(forbidden.status).toBe(403);
      expect(response.status).toBe(200);
      expect(body.settings.overall_status).toBe("ready");
      expect(body.settings.providers[0].model).toBe("deepseek/route-chat");
      expect(body.settings.modules.every((module: any) => module.status === "ok")).toBe(true);
      expect(body.settings.runtime_policies.find((policy: any) => policy.label === "Internal call token").value).toBe("Configured");
    } finally {
      healthServer.stop(true);
      delete process.env.FF_PLATFORM_DATA_DIR;
      delete process.env.AGENT_API_KEY;
      delete process.env.AGENT_MODEL;
      delete process.env.EMBEDDING_API_KEY;
      delete process.env.MINERU_API_KEY;
      delete process.env.RAG_INTERNAL_TOKEN;
      delete process.env.NANO_BRAIN_HTTP_URL;
      delete process.env.TRADITIONAL_RAG_HTTP_URL;
      delete process.env.GRAPH_RAG_HTTP_URL;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("records admin audit events when intake strategy decisions are made through the API", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "policy-evidence");
      form.set("name", "审计策略参数场景");
      form.set("visibility", "company");
      form.set("processing_goal", "记录管理员选择的入库策略。");
      form.append("files", new File(["审计测试资料"], "审计资料.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      const approved = await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({
            action: "approve",
            selected_engine: "Naive RAG",
            strategy_parameters: { chunk_size: "900", overlap: "120" }
          })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );
      const approvedBody = await approved.json();
      const audit = await GET(new Request("http://localhost/api/platform/admin/audit", { headers: authHeader(adminToken) }), routeContext("admin", "audit"));
      const auditBody = await audit.json();

      expect(approved.status).toBe(200);
      expect(approvedBody.request.strategyParameters).toEqual({ chunk_size: "900", overlap: "120" });
      expect(audit.status).toBe(200);
      expect(auditBody.events[0]).toMatchObject({
        actor: "Admin",
        area: "处理管线",
        summary: "Confirmed ingest: 审计策略参数场景",
        impact: "Naive RAG · Company"
      });
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runs all three RAG paths from uploaded files to frontstage scenario answers", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false, { organizationId: "org-main", teamIds: ["sales"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });
      const cases = [
        {
          templateId: "personal-wiki",
          engine: "Gbrain",
          name: "梧桐计划知识库",
          visibility: "private",
          file: new File(["# 梧桐计划\n梧桐计划的交付窗口是七月第一周，负责人是林乔，验收材料包括上线清单和培训纪要。"], "梧桐计划.md", { type: "text/markdown" }),
          query: "梧桐计划交付窗口是什么？",
          expected: "七月第一周",
          expectedAssetKind: "wiki"
        },
        {
          templateId: "policy-evidence",
          engine: "Naive RAG",
          name: "星河报销制度问答",
          visibility: "company",
          file: new File(["%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n星河项目一线城市住宿标准为每晚 680 元，超标必须由直属负责人和财务共同审批。\n%%EOF"], "星河报销制度.pdf", { type: "application/pdf" }),
          query: "星河项目一线城市住宿标准是多少？",
          expected: "680 元",
          expectedAssetKind: "chunk"
        },
        {
          templateId: "customer-360",
          engine: "GraphRAG",
          name: "曜石客户关系图谱",
          visibility: "team",
          file: new File(["曜石客户的关键关系：采购负责人苏航担心集成风险，技术负责人周澈支持二期扩容，客户成功负责人需要先提交集成排期。"], "曜石客户关系.md", { type: "text/markdown" }),
          query: "曜石客户当前的关键关系和风险是什么？",
          expected: "集成风险",
          expectedAssetKind: "graph"
        }
      ] as const;

      for (const item of cases) {
        const form = new FormData();
        form.set("template_id", item.templateId);
        form.set("name", item.name);
        form.set("visibility", item.visibility);
        form.set("description", `${item.name} 的真实链路测试。`);
        form.set("processing_goal", "上传资料后由管理员选择 RAG 引擎入库，并在前台场景内直接提问。");
        form.append("files", item.file);

        const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
        const createdBody = await created.json();
        const approved = await PATCH(
          new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json", ...authHeader(adminToken) },
            body: JSON.stringify({ action: "approve", selected_engine: item.engine })
          }),
          routeContext("admin", "requests", `request_${createdBody.task.id}`)
        );
        const approvedBody = await approved.json();
        const assets = await GET(
          new Request(`http://localhost/api/platform/admin/knowledge-assets?engine=${encodeURIComponent(item.engine)}&kind=${item.expectedAssetKind}`, { headers: authHeader(adminToken) }),
          routeContext("admin", "knowledge-assets")
        );
        const assetsBody = await assets.json();
        const answer = await POST(
          new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/ask`, {
            method: "POST",
            headers: { "content-type": "application/json", ...authHeader(memberToken) },
            body: JSON.stringify({ query: item.query })
          }),
          routeContext("scenarios", createdBody.scenario.id, "ask")
        );
        const answerBody = await answer.json();

        expect(created.status).toBe(201);
        expect(approved.status).toBe(200);
        expect(approvedBody.request.status).toBe("已发布");
        expect(approvedBody.request.selectedEngine).toBe(item.engine);
        expect(assets.status).toBe(200);
        expect(assetsBody.assets.length).toBeGreaterThanOrEqual(1);
        expect(assetsBody.assets[0].scenarioName).toBe(item.name);
        expect(answer.status).toBe(200);
        expect(answerBody.answer.engine).toBe(item.engine);
        expect(answerBody.answer.text).toContain(item.expected);
        expect(answerBody.answer.citations[0].sourceOriginalName).toBe(item.file.name);
        expect(answerBody.answer.citations[0].excerpt).toContain(item.expected);
      }
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns a real product-form workbench for a published scenario", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false, { organizationId: "org-main", teamIds: ["support"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });
      const form = new FormData();
      form.set("template_id", "support-agent");
      form.set("name", "订单与发票客服代理");
      form.set("visibility", "team");
      form.set("description", "把帮助中心和售后流程发布成可嵌入的客服知识代理。");
      form.set("processing_goal", "让客服页面可以按订单、发票和售后流程回答，并标记需要转人工的问题。");
      form.append("files", new File(["订单延迟超过三天需要先查询物流状态，超过承诺时效可提供运费券并建议转人工。"], "订单售后帮助中心.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );

      const workbench = await GET(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/workbench`, { headers: authHeader(memberToken) }),
        routeContext("scenarios", createdBody.scenario.id, "workbench")
      );
      const workbenchBody = await workbench.json();

      expect(workbench.status).toBe(200);
      expect(workbenchBody.scenario.id).toBe(createdBody.scenario.id);
      expect(workbenchBody.scenario.status).toBe("ready");
      expect(workbenchBody.template.id).toBe("support-agent");
      expect(workbenchBody.template.productForm).toEqual(expect.arrayContaining(["embedded_assistant"]));
      expect(workbenchBody.surface.kind).toBe("embedded_assistant");
      expect(workbenchBody.surface.primaryAction.label).toBe("Open support assistant");
      expect(workbenchBody.tasks[0].scenarioId).toBe(createdBody.scenario.id);
      expect(workbenchBody.knowledge_objects[0].scenarioId).toBe(createdBody.scenario.id);
      expect(workbenchBody.knowledge_objects[0].content).toContain("订单延迟");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists scenario-specific conversation history for reusable business workspaces", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false, { organizationId: "org-main", teamIds: ["sales"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });
      const form = new FormData();
      form.set("template_id", "customer-360");
      form.set("name", "Northwind Labs renewal brief");
      form.set("visibility", "team");
      form.set("processing_goal", "生成客户续约风险、机会和下一步行动。");
      form.append("files", new File(["Northwind Labs续约风险来自采购审批延期，机会来自二期扩容。"], "Northwind Labs account record.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "GraphRAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );

      const createdSession = await POST(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "Northwind Labs续约风险是什么？" })
        }),
        routeContext("scenarios", createdBody.scenario.id, "sessions")
      );
      const createdSessionBody = await createdSession.json();
      const appended = await POST(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/sessions/${createdSessionBody.session.id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "继续给出下一步行动" })
        }),
        routeContext("scenarios", createdBody.scenario.id, "sessions", createdSessionBody.session.id, "messages")
      );
      const sessions = await GET(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/sessions`, { headers: authHeader(memberToken) }),
        routeContext("scenarios", createdBody.scenario.id, "sessions")
      );
      const sessionsBody = await sessions.json();
      const opened = await GET(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/sessions/${createdSessionBody.session.id}`, { headers: authHeader(memberToken) }),
        routeContext("scenarios", createdBody.scenario.id, "sessions", createdSessionBody.session.id)
      );
      const openedBody = await opened.json();

      expect(createdSession.status).toBe(201);
      expect(createdSessionBody.session.scenarioId).toBe(createdBody.scenario.id);
      expect(createdSessionBody.session.messages).toHaveLength(2);
      expect(appended.status).toBe(200);
      expect((await appended.json()).session.messages).toHaveLength(4);
      expect(sessions.status).toBe(200);
      expect(sessionsBody.sessions[0]).toMatchObject({
        id: createdSessionBody.session.id,
        scenarioId: createdBody.scenario.id,
        messageCount: 4
      });
      expect(opened.status).toBe(200);
      expect(openedBody.session.messages[1].citations[0].scenarioName).toBe("Northwind Labs renewal brief");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps scenario conversations usable when real RAG module credentials are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false, { organizationId: "org-main", teamIds: ["sales"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });
      const form = new FormData();
      form.set("template_id", "customer-360");
      form.set("name", "真实模块凭证缺失兜底");
      form.set("visibility", "team");
      form.set("processing_goal", "真实模块不可用时仍然能基于已入库知识回答。");
      form.append("files", new File(["Northwind Labs续约风险来自采购审批延期，机会来自二期扩容。"], "Northwind Labs account record.md", { type: "text/markdown" }));

      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "GraphRAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );

      const dbPath = join(root, "platform-db.json");
      const db = JSON.parse(await readFile(dbPath, "utf8"));
      db.moduleReferences.unshift({
        id: "module_ref_missing_token",
        scenarioId: createdBody.scenario.id,
        sourceFileId: createdBody.files[0].id,
        engine: "GraphRAG",
        moduleId: "graph-rag",
        sourceId: "graph_source_missing_token",
        sourceName: "真实模块凭证缺失兜底",
        sourceKind: "private",
        objectKind: "document",
        objectId: "graph_doc_missing_token",
        documentId: "graph_doc_missing_token",
        status: "ready",
        accessControl: db.scenarios.find((item: any) => item.id === createdBody.scenario.id).accessControl,
        metadata: { scenarioName: createdBody.scenario.name },
        createdAt: new Date().toISOString()
      });
      await writeFile(dbPath, JSON.stringify(db, null, 2));

      process.env.FF_PLATFORM_INGEST_MODE = "real";
      delete process.env.RAG_INTERNAL_TOKEN;
      const createdSession = await POST(
        new Request(`http://localhost/api/platform/scenarios/${createdBody.scenario.id}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "Northwind Labs续约风险是什么？" })
        }),
        routeContext("scenarios", createdBody.scenario.id, "sessions")
      );
      const sessionBody = await createdSession.json();

      expect(createdSession.status).toBe(201);
      expect(sessionBody.session.messages).toHaveLength(2);
      expect(sessionBody.session.messages[1].content).toContain("采购审批延期");
      expect(sessionBody.session.messages[1].citations[0].sourceOriginalName).toBe("Northwind Labs account record.md");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      delete process.env.RAG_INTERNAL_TOKEN;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("filters team and company knowledge objects through authenticated API identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const ownerToken = await createSession("owner", false, { organizationId: "org-main", teamIds: ["sales"] });
      const salesToken = await createSession("sales-peer", false, { organizationId: "org-main", teamIds: ["sales"] });
      const legalToken = await createSession("legal-peer", false, { organizationId: "org-main", teamIds: ["legal"] });
      const outsideToken = await createSession("outside", false, { organizationId: "org-other", teamIds: ["sales"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });

      const teamForm = new FormData();
      teamForm.set("template_id", "customer-360");
      teamForm.set("name", "销售团队客户画像");
      teamForm.set("visibility", "team");
      teamForm.set("processing_goal", "生成团队客户画像。");
      teamForm.append("files", new File(["销售团队资料"], "客户资料.md", { type: "text/markdown" }));
      const companyForm = new FormData();
      companyForm.set("template_id", "policy-evidence");
      companyForm.set("name", "公司制度问答");
      companyForm.set("visibility", "company");
      companyForm.set("processing_goal", "生成公司制度问答。");
      companyForm.append("files", new File(["公司制度"], "制度.md", { type: "text/markdown" }));

      const teamCreated = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(ownerToken), body: teamForm }), routeContext("scenarios"));
      const teamBody = await teamCreated.json();
      const companyCreated = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(ownerToken), body: companyForm }), routeContext("scenarios"));
      const companyBody = await companyCreated.json();

      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${teamBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "GraphRAG" })
        }),
        routeContext("admin", "requests", `request_${teamBody.task.id}`)
      );
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${companyBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "Naive RAG" })
        }),
        routeContext("admin", "requests", `request_${companyBody.task.id}`)
      );

      const salesObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(salesToken) }), routeContext("knowledge-objects"));
      const legalObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(legalToken) }), routeContext("knowledge-objects"));
      const outsideObjects = await GET(new Request("http://localhost/api/platform/knowledge-objects", { headers: authHeader(outsideToken) }), routeContext("knowledge-objects"));
      const salesBody = await salesObjects.json();
      const legalBody = await legalObjects.json();
      const outsideBody = await outsideObjects.json();

      expect(salesBody.knowledge_objects.map((item: any) => item.scenarioId)).toEqual(expect.arrayContaining([teamBody.scenario.id, companyBody.scenario.id]));
      expect(legalBody.knowledge_objects.map((item: any) => item.scenarioId)).not.toContain(teamBody.scenario.id);
      expect(legalBody.knowledge_objects.map((item: any) => item.scenarioId)).toContain(companyBody.scenario.id);
      expect(outsideBody.knowledge_objects).toHaveLength(0);
      expect(salesBody.knowledge_objects.find((item: any) => item.scenarioId === teamBody.scenario.id).accessControl).toMatchObject({
        scope: "team",
        organizationId: "org-main",
        teamIds: ["sales"]
      });
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates global ask sessions and appends follow-up messages through authenticated API identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false, { organizationId: "org-main", teamIds: ["sales"] });
      const adminToken = await createSession("admin", true, { organizationId: "org-main", teamIds: ["platform-admin"] });
      const form = new FormData();
      form.set("template_id", "customer-360");
      form.set("name", "销售续约资料");
      form.set("visibility", "company");
      form.set("processing_goal", "生成可全域检索的客户续约知识。");
      form.append("files", new File(["Northwind Labs续约风险来自预算延期，机会来自二期扩容。"], "续约资料.md", { type: "text/markdown" }));
      const created = await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const createdBody = await created.json();
      await PATCH(
        new Request(`http://localhost/api/platform/admin/requests/request_${createdBody.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...authHeader(adminToken) },
          body: JSON.stringify({ action: "approve", selected_engine: "GraphRAG" })
        }),
        routeContext("admin", "requests", `request_${createdBody.task.id}`)
      );

      const createdSession = await POST(
        new Request("http://localhost/api/platform/chat-sessions", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "Northwind Labs续约风险是什么？", scope: "company", output_mode: "direct" })
        }),
        routeContext("chat-sessions")
      );
      const createdSessionBody = await createdSession.json();
      const appended = await POST(
        new Request(`http://localhost/api/platform/chat-sessions/${createdSessionBody.session.id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeader(memberToken) },
          body: JSON.stringify({ query: "继续说明机会点" })
        }),
        routeContext("chat-sessions", createdSessionBody.session.id, "messages")
      );
      const appendedBody = await appended.json();
      const history = await GET(new Request("http://localhost/api/platform/chat-sessions", { headers: authHeader(memberToken) }), routeContext("chat-sessions"));
      const historyBody = await history.json();

      expect(createdSession.status).toBe(201);
      expect(createdSessionBody.session.messages).toHaveLength(2);
      expect(createdSessionBody.session.messages[1].citations[0].scenarioName).toBe("销售续约资料");
      expect(appended.status).toBe(200);
      expect(appendedBody.session.messages).toHaveLength(4);
      expect(historyBody.sessions[0].id).toBe(createdSessionBody.session.id);
      expect(historyBody.sessions[0].messageCount).toBe(4);
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves original uploaded file previews only to admins", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-platform-route-"));
    process.env.FF_PLATFORM_DATA_DIR = root;
    await resetPlatformStore();
    await resetAuthStore();
    try {
      const memberToken = await createSession("muyu", false);
      const adminToken = await createSession("admin", true);
      const form = new FormData();
      form.set("template_id", "custom-scenario");
      form.set("name", "预览资料包");
      form.set("visibility", "team");
      form.set("processing_goal", "核验上传资料。");
      form.append("files", new File(["%PDF-1.4\npreview pdf"], "续约合同.pdf", { type: "application/pdf" }));
      form.append("files", new File(["阶段,状态\n接收,完成"], "处理清单.csv", { type: "text/csv" }));
      form.append("files", new File(["# 业务说明\n需要预览"], "业务说明.md", { type: "text/markdown" }));

      await POST(new Request("http://localhost/api/platform/scenarios", { method: "POST", headers: authHeader(memberToken), body: form }), routeContext("scenarios"));
      const requests = await GET(new Request("http://localhost/api/platform/admin/requests", { headers: authHeader(adminToken) }), routeContext("admin", "requests"));
      const requestsBody = await requests.json();
      const pdfFile = requestsBody.requests[0].storedFiles.find((file: any) => file.originalName === "续约合同.pdf");
      const csvFile = requestsBody.requests[0].storedFiles.find((file: any) => file.originalName === "处理清单.csv");

      const forbidden = await GET(new Request(`http://localhost/api/platform/admin/files/${pdfFile.id}/preview`, { headers: authHeader(memberToken) }), routeContext("admin", "files", pdfFile.id, "preview"));
      const pdfPreview = await GET(new Request(`http://localhost/api/platform/admin/files/${pdfFile.id}/preview`, { headers: authHeader(adminToken) }), routeContext("admin", "files", pdfFile.id, "preview"));
      const csvPreview = await GET(new Request(`http://localhost/api/platform/admin/files/${csvFile.id}/preview`, { headers: authHeader(adminToken) }), routeContext("admin", "files", csvFile.id, "preview"));

      expect(forbidden.status).toBe(403);
      expect(pdfPreview.status).toBe(200);
      expect(pdfPreview.headers.get("content-type")).toContain("application/pdf");
      expect(pdfPreview.headers.get("content-disposition")).toContain("inline");
      expect(await pdfPreview.text()).toContain("%PDF-1.4");
      expect(csvPreview.status).toBe(200);
      expect(csvPreview.headers.get("content-type")).toContain("text/csv");
      expect(await csvPreview.text()).toContain("阶段,状态");
    } finally {
      delete process.env.FF_PLATFORM_DATA_DIR;
      await rm(root, { recursive: true, force: true });
    }
  });
});

function routeContext(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

async function createSession(username: string, isAdmin: boolean, options: { organizationId?: string; teamIds?: string[] } = {}) {
  await registerUser({
    username,
    password: `${username}-pass-123`,
    displayName: isAdmin ? "Admin" : "Maya Chen",
    role: isAdmin ? "admin" : "member",
    organizationId: options.organizationId,
    teamIds: options.teamIds
  });
  const session = await authenticateUser({ username, password: `${username}-pass-123` });
  if (!session) throw new Error("session not created");
  return session.token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function officeDocx(text: string) {
  return storedZip({
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`
  });
}

function officeXlsx(rows: string[][]) {
  const strings = Array.from(new Set(rows.flat()));
  const sharedStrings = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join("")}</sst>`;
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, cellIndex) => {
      const ref = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="s"><v>${strings.indexOf(value)}</v></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return storedZip({
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    "xl/sharedStrings.xml": sharedStrings,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  });
}

function storedZip(entries: Record<string, string>) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((total, item) => total + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return concatBytes([...locals, ...centrals, end]);
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, item) => total + item.length, 0));
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
