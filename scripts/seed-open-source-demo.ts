/**
 * Seeds the open-source demo dataset:
 * 1. English corpus into dedicated module sources (used by eval/run_eval.py).
 * 2. Three product scenarios (Gbrain, Naive RAG, GraphRAG) with real ingest and one chat session
 *    each (used by scripts/capture-open-source-assets.ts).
 *
 * Run with `bun run demo:seed` after `db:init` + `admin:create`. The script is not idempotent
 * across resets; run `bun run demo:reset` first for a clean slate.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CORPUS_DIR = join(ROOT, "eval", "corpus", "en", "docs");
const MANIFEST_PATH = join(ROOT, "eval", "manifest.json");

const API_BASE = (process.env.API_INTERNAL_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const WEB_BASE = (process.env.WEB_INTERNAL_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const NANO_BASE = (process.env.NANO_BRAIN_HTTP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
const TRADITIONAL_BASE = (process.env.TRADITIONAL_RAG_HTTP_URL ?? "http://127.0.0.1:8101").replace(/\/+$/, "");
const GRAPH_BASE = (process.env.GRAPH_RAG_HTTP_URL ?? "http://127.0.0.1:8102").replace(/\/+$/, "");

const INTERNAL_TOKEN = required("RAG_INTERNAL_TOKEN");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = required("ADMIN_PASSWORD");
const MEMBER_USERNAME = process.env.DEMO_MEMBER_USERNAME ?? "maya.chen";
const MEMBER_PASSWORD = process.env.DEMO_MEMBER_PASSWORD ?? "maya123456";

const EVAL_SOURCE_NAMES = {
  traditional: "Northwind Labs — Benchmark Corpus",
  graph: "Northwind Labs — Benchmark Corpus",
  nano: "Northwind-Labs-Benchmark-Corpus"
};

const SCENARIOS = [
  {
    key: "gbrain",
    templateId: "personal-wiki",
    name: "Personal Knowledge — Maya Chen",
    description: "Personal notes, QBR follow-ups, and engineering context for Northwind Labs.",
    visibility: "private",
    engine: "Gbrain",
    files: ["06-acme-qbr-notes.md", "07-engineering-runbook.md"],
    question: "What did Maya Chen commit to after the Acme Health QBR?"
  },
  {
    key: "naive",
    templateId: "policy-evidence",
    name: "Policy & Evidence — Northwind Handbook",
    description: "Travel, expense, and security policy answers with citations.",
    visibility: "company",
    engine: "Naive RAG",
    files: ["04-travel-expense-policy.md", "05-security-compliance.md"],
    question: "What is the hotel cap in San Francisco?"
  },
  {
    key: "graph",
    templateId: "customer-360",
    name: "Customer 360 — Acme Health",
    description: "Account plan and QBR notes mapped into an entity and relationship graph.",
    visibility: "team",
    engine: "GraphRAG",
    files: ["02-acme-health-account.md", "06-acme-qbr-notes.md"],
    question: "Which customer uses Project Atlas, and who is the executive sponsor?"
  }
] as const;

type Manifest = {
  generatedAt: string;
  adminId: string;
  moduleSources: { traditional: string; graph: string; nano: string };
  docs: Array<{ file: string; slug: string }>;
  scenarios: Array<{
    key: string;
    id: string;
    name: string;
    templateId: string;
    engine: string;
    sessionId: string;
    question: string;
  }>;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function internalHeaders(adminId: string) {
  return {
    "x-ff-internal-token": INTERNAL_TOKEN,
    "x-ff-user-id": adminId,
    "x-ff-username": ADMIN_USERNAME,
    "x-ff-is-admin": "true"
  };
}

async function jsonRequest<T = any>(
  url: string,
  input: { method?: string; headers?: Record<string, string>; body?: unknown; form?: FormData } = {}
): Promise<T> {
  const headers = new Headers(input.headers ?? {});
  let body: BodyInit | undefined;
  if (input.form) body = input.form;
  else if (input.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(input.body);
  }
  const response = await fetch(url, { method: input.method ?? "GET", headers, body });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${input.method ?? "GET"} ${url} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return parsed as T;
}

async function loginApi(): Promise<{ token: string; userId: string }> {
  const body = await jsonRequest<{ token: string; user: { id: string } }>(`${API_BASE}/auth/login`, {
    method: "POST",
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  return { token: body.token, userId: body.user.id };
}

async function ensureMember(): Promise<string> {
  try {
    await jsonRequest(`${WEB_BASE}/api/platform/auth/register`, {
      method: "POST",
      body: { username: MEMBER_USERNAME, password: MEMBER_PASSWORD, display_name: "Maya Chen" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/HTTP 400|already|exists|用户已存在/i.test(message)) throw error;
  }
  return loginWeb(MEMBER_USERNAME, MEMBER_PASSWORD);
}

async function loginWeb(username: string, password: string): Promise<string> {
  const login = await jsonRequest<{ token: string }>(`${WEB_BASE}/api/platform/auth/login`, {
    method: "POST",
    body: { username, password }
  });
  return login.token;
}

async function ensureModuleSource(
  baseUrl: string,
  path: string,
  name: string,
  adminId: string,
  kind: "private" | "public"
): Promise<string> {
  const headers = internalHeaders(adminId);
  const list = await jsonRequest<{ sources: Array<{ id: string; name: string }> }>(`${baseUrl}${path}`, { headers });
  const existing = list.sources.find((source) => source.name === name);
  if (existing) return existing.id;
  const created = await jsonRequest<{ source: { id: string } }>(`${baseUrl}${path}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: { name, kind, description: "English benchmark corpus for the open-source demo." }
  });
  return created.source.id;
}

async function waitForDocument(
  baseUrl: string,
  path: string,
  documentId: string,
  adminId: string,
  label: string
): Promise<void> {
  const headers = internalHeaders(adminId);
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const body = await jsonRequest<{ document: { status: string; metadata?: Record<string, any> } }>(
      `${baseUrl}${path}/${documentId}`,
      { headers }
    );
    const status = body.document.status;
    if (status === "ready") return;
    if (status === "failed") {
      throw new Error(`${label} ingest failed: ${JSON.stringify(body.document.metadata ?? {})}`);
    }
    await sleep(4000);
  }
  throw new Error(`${label} ingest timed out`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestTraditional(sourceId: string, adminId: string, docs: Array<{ file: string; text: string }>) {
  const headers = internalHeaders(adminId);
  const existing = await jsonRequest<{ documents: Array<{ original_filename: string }> }>(
    `${TRADITIONAL_BASE}/traditional/documents?source_id=${encodeURIComponent(sourceId)}`,
    { headers }
  );
  const names = new Set(existing.documents.map((doc) => doc.original_filename));
  for (const doc of docs) {
    if (names.has(doc.file)) continue;
    const form = new FormData();
    form.set("source_id", sourceId);
    form.set("file", new File([doc.text], doc.file, { type: "text/markdown" }));
    const created = await jsonRequest<{ document: { id: string } }>(`${TRADITIONAL_BASE}/traditional/documents`, {
      method: "POST",
      headers,
      form
    });
    await waitForDocument(TRADITIONAL_BASE, "/traditional/documents", created.document.id, adminId, doc.file);
    console.log(`  traditional: ${doc.file} ready`);
  }
}

async function ingestGraph(sourceId: string, adminId: string, docs: Array<{ file: string; text: string }>) {
  const headers = internalHeaders(adminId);
  const existing = await jsonRequest<{ documents: Array<{ original_filename: string }> }>(
    `${GRAPH_BASE}/graph/documents?source_id=${encodeURIComponent(sourceId)}`,
    { headers }
  );
  const names = new Set(existing.documents.map((doc) => doc.original_filename));
  for (const doc of docs) {
    if (names.has(doc.file)) continue;
    const created = await jsonRequest<{ document: { id: string } }>(`${GRAPH_BASE}/graph/documents/text`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: { source_id: sourceId, text: doc.text, title: doc.file.replace(/\.md$/, "") }
    });
    await waitForDocument(GRAPH_BASE, "/graph/documents", created.document.id, adminId, doc.file);
    console.log(`  graph: ${doc.file} ready`);
  }
}

async function ingestNano(sourceId: string, adminId: string, docs: Array<{ file: string; slug: string; text: string }>) {
  const headers = internalHeaders(adminId);
  const existing = await jsonRequest<{ pages: Array<{ slug: string }> }>(
    `${NANO_BASE}/nano/sources/${encodeURIComponent(sourceId)}/pages`,
    { headers }
  );
  const slugs = new Set(existing.pages.map((page) => page.slug));
  for (const doc of docs) {
    if (slugs.has(doc.slug)) continue;
    await jsonRequest(`${NANO_BASE}/nano/pages`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: {
        source_id: sourceId,
        slug: doc.slug,
        title: doc.file.replace(/\.md$/, ""),
        body: doc.text,
        content_type: "text/markdown"
      }
    });
    console.log(`  nano: ${doc.file} ready (${doc.slug})`);
  }
}

async function waitForScenarioReady(memberToken: string, scenarioId: string) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const body = await jsonRequest<{ knowledge_objects: unknown[]; tasks: Array<{ status?: string }> }>(
      `${WEB_BASE}/api/platform/scenarios/${scenarioId}/workbench`,
      { headers: { authorization: `Bearer ${memberToken}` } }
    );
    if (body.knowledge_objects.length > 0) return;
    const failed = body.tasks.find((task) => /fail|退回|失败/i.test(String(task.status ?? "")));
    if (failed) throw new Error(`scenario ingest failed: ${JSON.stringify(failed)}`);
    await sleep(4000);
  }
  throw new Error(`scenario ${scenarioId} ingest timed out`);
}

async function main() {
  console.log("Loading English corpus...");
  const files = (await Array.fromAsync(new Bun.Glob("*.md").scan(CORPUS_DIR))).sort();
  if (files.length === 0) throw new Error(`No corpus docs found in ${CORPUS_DIR}`);
  const docs = await Promise.all(
    files.map(async (file, index) => ({
      file,
      slug: `en-${String(index).padStart(2, "0")}`,
      text: await readFile(join(CORPUS_DIR, file), "utf8")
    }))
  );

  const admin = await loginApi();
  console.log(`Admin: ${admin.userId}`);
  const adminWebToken = await loginWeb(ADMIN_USERNAME, ADMIN_PASSWORD);

  console.log("Ensuring module sources...");
  const traditionalSource = await ensureModuleSource(
    TRADITIONAL_BASE,
    "/traditional/sources",
    EVAL_SOURCE_NAMES.traditional,
    admin.userId,
    "private"
  );
  const graphSource = await ensureModuleSource(
    GRAPH_BASE,
    "/graph/sources",
    EVAL_SOURCE_NAMES.graph,
    admin.userId,
    "private"
  );
  const nanoSource = await ensureModuleSource(
    NANO_BASE,
    "/nano/sources",
    EVAL_SOURCE_NAMES.nano,
    admin.userId,
    "public"
  );

  console.log("Ingesting benchmark corpus (traditional)...");
  await ingestTraditional(traditionalSource, admin.userId, docs);
  console.log("Ingesting benchmark corpus (graph)...");
  await ingestGraph(graphSource, admin.userId, docs);
  console.log("Ingesting benchmark corpus (nano)...");
  await ingestNano(nanoSource, admin.userId, docs);

  console.log("Ensuring demo member...");
  const memberToken = await ensureMember();

  const scenarios: Manifest["scenarios"] = [];
  for (const scenario of SCENARIOS) {
    const selected = scenario.files.map((file) => {
      const doc = docs.find((item) => item.file === file);
      if (!doc) throw new Error(`Corpus file missing: ${file}`);
      return doc;
    });
    console.log(`Creating scenario ${scenario.name} (${scenario.engine})...`);
    const created = await jsonRequest<{ scenario: { id: string }; task: { id: string } }>(
      `${WEB_BASE}/api/platform/scenarios`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${memberToken}` },
        body: {
          template_id: scenario.templateId,
          name: scenario.name,
          description: scenario.description,
          visibility: scenario.visibility,
          processing_goal: "Ingest the corpus and answer with citations.",
          uploaded_files: selected.map((doc) => ({ name: doc.file, type: "text/markdown", text: doc.text }))
        }
      }
    );
    const requestId = `request_${created.task.id}`;
    console.log(`  approving with ${scenario.engine}...`);
    await jsonRequest(`${WEB_BASE}/api/platform/admin/requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminWebToken}`, "content-type": "application/json" },
      body: { action: "approve", selected_engine: scenario.engine }
    });
    await waitForScenarioReady(memberToken, created.scenario.id);
    console.log("  creating chat session...");
    const session = await jsonRequest<{ session: { id: string } }>(
      `${WEB_BASE}/api/platform/scenarios/${created.scenario.id}/sessions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
        body: { query: scenario.question }
      }
    );
    scenarios.push({
      key: scenario.key,
      id: created.scenario.id,
      name: scenario.name,
      templateId: scenario.templateId,
      engine: scenario.engine,
      sessionId: session.session.id,
      question: scenario.question
    });
    console.log(`  scenario ready: ${created.scenario.id}`);
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    adminId: admin.userId,
    moduleSources: { traditional: traditionalSource, graph: graphSource, nano: nanoSource },
    docs: docs.map((doc) => ({ file: doc.file, slug: doc.slug })),
    scenarios
  };
  await mkdir(join(ROOT, "eval"), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written: ${MANIFEST_PATH}`);
  console.log(`Docs: ${docs.length}; scenarios: ${scenarios.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
