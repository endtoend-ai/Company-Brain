/**
 * Captures the English screenshots used by the open-source README.
 * Requires a running stack and `bun run demo:seed` (eval/manifest.json).
 */
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "docs", "assets", "screenshots");
const WEB_BASE = (process.env.WEB_INTERNAL_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const MEMBER_USERNAME = process.env.DEMO_MEMBER_USERNAME ?? "maya.chen";
const MEMBER_PASSWORD = process.env.DEMO_MEMBER_PASSWORD ?? "maya123456";

if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is required");

type Manifest = {
  scenarios: Array<{ key: string; id: string; sessionId: string; name: string }>;
};

async function login(username: string, password: string): Promise<string> {
  const response = await fetch(`${WEB_BASE}/api/platform/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const body = await response.json();
  if (!response.ok || typeof body?.token !== "string") {
    throw new Error(`Login failed: HTTP ${response.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.token;
}

async function main() {
  const manifest = JSON.parse(await readFile(join(ROOT, "eval", "manifest.json"), "utf8")) as Manifest;
  const adminToken = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
  const memberToken = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  async function makeContext(token: string) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "light"
    });
    await context.addCookies([
      { name: "ff_companybrain_session", value: token, domain: "localhost", path: "/" }
    ]);
    await context.addInitScript((authToken: string) => {
      try {
        localStorage.setItem("ff-theme", "light");
        localStorage.setItem("ff_companybrain_token", authToken);
      } catch {}
      const style = document.createElement("style");
      style.textContent = [
        "nextjs-portal{display:none!important}",
        "[data-nextjs-toast]{display:none!important}",
        "*{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}"
      ].join("\n");
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
    }, token);
    return context;
  }

  const memberContext = await makeContext(memberToken);
  const adminContext = await makeContext(adminToken);
  const page = await memberContext.newPage();
  const adminPage = await adminContext.newPage();
  page.setDefaultTimeout(60000);
  adminPage.setDefaultTimeout(60000);

  const shots: Array<{ file: string; url: string; waitMs?: number; admin?: boolean }> = [
    { file: "01-home.png", url: `${WEB_BASE}/` },
    { file: "02-workspace.png", url: `${WEB_BASE}/app` },
    {
      file: "03-gbrain-answer.png",
      url: `${WEB_BASE}/app/scenarios/${manifest.scenarios.find((s) => s.key === "gbrain")?.id}/ask?session=${manifest.scenarios.find((s) => s.key === "gbrain")?.sessionId}`,
      waitMs: 4000
    },
    {
      file: "04-naive-answer.png",
      url: `${WEB_BASE}/app/scenarios/${manifest.scenarios.find((s) => s.key === "naive")?.id}/ask?session=${manifest.scenarios.find((s) => s.key === "naive")?.sessionId}`,
      waitMs: 4000
    },
    {
      file: "05-graph-answer.png",
      url: `${WEB_BASE}/app/scenarios/${manifest.scenarios.find((s) => s.key === "graph")?.id}/ask?session=${manifest.scenarios.find((s) => s.key === "graph")?.sessionId}`,
      waitMs: 4000
    },
    { file: "06-graph-explorer.png", url: `${WEB_BASE}/admin/graph`, waitMs: 9000, admin: true },
    { file: "07-evaluation.png", url: `${WEB_BASE}/admin/evaluations`, admin: true },
    { file: "08-integrations.png", url: `${WEB_BASE}/admin/settings`, admin: true }
  ];

  for (const shot of shots) {
    console.log(`Capturing ${shot.file}...`);
    const target = shot.admin ? adminPage : page;
    await target.goto(shot.url, { waitUntil: "load" });
    await target.waitForTimeout(shot.waitMs ?? 1800);
    await target.screenshot({ path: join(OUT_DIR, shot.file), fullPage: false });
    console.log(`  saved ${shot.file}`);
  }

  await browser.close();
  console.log(`Screenshots written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
