/**
 * Renders the benchmark chart used by the README from eval/reports/*-en-summary.json.
 * Requires a running browser install (Playwright chromium).
 */
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = join(import.meta.dir, "..");
const REPORTS = join(ROOT, "eval", "reports");
const OUT = join(ROOT, "docs", "assets", "benchmarks.png");

type Summary = {
  module: string;
  tag: string;
  summary: Record<string, any>;
};

async function readSummary(module: string): Promise<Summary> {
  return JSON.parse(await readFile(join(REPORTS, `${module}-en-summary.json`), "utf8")) as Summary;
}

function bar(label: string, value: number, max: number, color: string) {
  const width = Math.max(2, Math.round((value / max) * 100));
  return `<div class="row"><span>${label}</span><div class="track"><i style="width:${width}%;background:${color}"></i></div><b>${value.toFixed(3)}</b></div>`;
}

async function main() {
  const traditional = await readSummary("traditional");
  const nano = await readSummary("nano-brain");
  const graph = await readSummary("graph-rag");

  const t = traditional.summary;
  const n = nano.summary;
  const g = graph.summary;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 44px; font-family: "Hanken Grotesk", "Helvetica Neue", Arial, sans-serif; background: #f7f5ef; color: #14171a; }
  h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.02em; }
  .sub { color: #5b6168; font-size: 14px; margin-bottom: 26px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .card { background: #fffdf8; border: 1px solid #e4dfd4; border-radius: 14px; padding: 20px 20px 14px; }
  .card h2 { font-size: 16px; margin: 0 0 2px; }
  .card .meta { color: #6b7078; font-size: 12px; margin-bottom: 14px; }
  .row { display: grid; grid-template-columns: 92px 1fr 46px; gap: 8px; align-items: center; margin: 9px 0; font-size: 12px; }
  .track { height: 8px; background: #ece7dc; border-radius: 999px; overflow: hidden; }
  .track i { display: block; height: 100%; border-radius: 999px; }
  .row b { font-variant-numeric: tabular-nums; text-align: right; }
  .foot { margin-top: 22px; color: #6b7078; font-size: 12px; line-height: 1.5; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ece7dc; font-size: 11px; margin-right: 6px; }
</style></head>
<body>
  <h1>CompanyBrain retrieval benchmark</h1>
  <div class="sub">7-document English corpus · 10 queries per vector engine · 8 relationship queries · measured on local PostgreSQL + pgvector</div>
  <div class="grid">
    <section class="card">
      <h2>Naive RAG</h2>
      <div class="meta">document-level recall · p50 ${t.latency_ms?.p50 ?? "—"} ms</div>
      ${bar("Recall@1", t["recall@1"] ?? 0, 1, "#2f6f66")}
      ${bar("Recall@3", t["recall@3"] ?? 0, 1, "#2f6f66")}
      ${bar("Recall@5", t["recall@5"] ?? 0, 1, "#2f6f66")}
      ${bar("MRR", t.mrr ?? 0, 1, "#8b6f3e")}
    </section>
    <section class="card">
      <h2>Gbrain (Nano Brain)</h2>
      <div class="meta">document-level recall · p50 ${n.latency_ms?.p50 ?? "—"} ms</div>
      ${bar("Recall@1", n["recall@1"] ?? 0, 1, "#3d5a8a")}
      ${bar("Recall@3", n["recall@3"] ?? 0, 1, "#3d5a8a")}
      ${bar("Recall@5", n["recall@5"] ?? 0, 1, "#3d5a8a")}
      ${bar("MRR", n.mrr ?? 0, 1, "#8b6f3e")}
    </section>
    <section class="card">
      <h2>GraphRAG</h2>
      <div class="meta">evidence coverage · p50 ${g.latency_ms?.p50 ?? "—"} ms</div>
      ${bar("Keyword coverage", g.keyword_coverage_avg ?? 0, 1, "#8a4b3d")}
      ${bar("Non-empty rate", g.nonempty_rate ?? 0, 1, "#8a4b3d")}
      <div class="row"><span>Queries</span><div class="track"><i style="width:100%;background:#8a4b3d"></i></div><b>${g.total}/${g.total}</b></div>
    </section>
  </div>
  <div class="foot">
    <span class="pill">${t.total} queries</span><span class="pill">${n.total} queries</span><span class="pill">${g.total} queries</span>
    Metrics are measured against a small, deliberately public demo corpus; they are not a production benchmark.
    GraphRAG returns graph context rather than ranked document IDs, so it is scored by keyword coverage and the share of queries that returned context.
  </div>
</body></html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 720 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await mkdir(join(ROOT, "docs", "assets"), { recursive: true });
  const body = await page.locator("body").boundingBox();
  await page.screenshot({
    path: OUT,
    clip: { x: 0, y: 0, width: 1240, height: Math.ceil(body?.height ?? 720) }
  });
  await browser.close();
  console.log(`Benchmark chart written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
