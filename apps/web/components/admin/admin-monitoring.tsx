"use client";

import { useState } from "react";
import Link from "next/link";

import { AdminShell, AdminPageHead, PanelHead, AdminStatusBadge } from "./admin-pages";
import type { MonitoringOverview, MonitoringTrendPoint, MonitoringFormPanels, StoredChatTrace, TraceFormLabel } from "../../lib/server/platform-store";

type TraceRow = Omit<StoredChatTrace, "spans">;
type FormFilterLabel = TraceFormLabel | "全部";

const FORM_LABEL: Record<FormFilterLabel, string> = {
  文档型: "Documents",
  图谱型: "Graph",
  知识页型: "Knowledge pages",
  全部: "All"
};

function formLabel(form: FormFilterLabel) {
  return FORM_LABEL[form] ?? form;
}

const FORM_BADGE: Record<TraceFormLabel, string> = {
  文档型: "Naive RAG",
  图谱型: "GraphRAG",
  知识页型: "Gbrain"
};

export function AdminMonitoringPage({
  overview,
  traces,
  trends = [],
  formPanels
}: {
  overview: MonitoringOverview;
  traces: TraceRow[];
  trends?: MonitoringTrendPoint[];
  formPanels?: MonitoringFormPanels;
}) {
  const [formFilter, setFormFilter] = useState<TraceFormLabel | "全部">("全部");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [onlyDown, setOnlyDown] = useState(false);

  const filtered = traces.filter((t) => {
    if (formFilter !== "全部" && !t.forms.includes(formFilter)) return false;
    if (onlyFailed && t.success) return false;
    if (onlyDown && t.feedback?.vote !== "down") return false;
    return true;
  });

  const o = overview.overall;
  const reviewQueue = traces.filter((t) => t.feedback?.vote === "down");

  return (
    <AdminShell active="/admin/monitoring" title="Monitoring">
      <AdminPageHead
        eyebrow="Monitoring · observability"
        title="Live Q&A traces, quality, and feedback in one view"
        description="Every company-wide or scenario question records one trace: which evidence was retrieved, how many tokens it took, the latency, and whether the user was satisfied. All metrics come from real Q&A, not sample data."
      />

      {/* Overview health */}
      <section className="admin-panel">
        <PanelHead eyebrow="Overview health" title="Top-level operating metrics (live aggregate)" />
        <div className="monitoring-kpi-grid">
          <article className="monitoring-kpi"><span>Questions</span><b>{o.queries}</b><small>Real questions answered</small></article>
          <article className="monitoring-kpi"><span>Answer success rate</span><b>{o.successRate}%</b><small>Answered with a real citation or directly</small></article>
          <article className="monitoring-kpi"><span>No-answer rate</span><b>{o.noAnswerRate}%</b><small>No source matched during retrieval</small></article>
          <article className="monitoring-kpi"><span>Latency P50 / P95</span><b>{o.p50LatencyMs} / {o.p95LatencyMs}<i>ms</i></b><small>End to end</small></article>
          <article className="monitoring-kpi"><span>Token usage</span><b>{o.totalTokens.toLocaleString("en-US")}</b><small>Total across generation calls</small></article>
          <article className="monitoring-kpi"><span>Upvotes / downvotes</span><b>{o.upvotes} / {o.downvotes}</b><small>{o.pendingReview} to review</small></article>
        </div>
      </section>

      {/* Health by knowledge form */}
      <section className="admin-panel">
        <PanelHead eyebrow="Health by form" title="Retrieval performance for documents, graphs, and pages" />
        <div className="monitoring-form-grid">
          {overview.forms.map((f) => (
            <article key={f.form} className="monitoring-form-card">
              <header>
                <b>{formLabel(f.form)}</b>
                <AdminStatusBadge status={f.queries === 0 ? "观察" : f.hitRate >= 60 ? "正常" : "需复核"} />
              </header>
              <small>{FORM_BADGE[f.form]}</small>
              <div className="monitoring-form-metrics">
                <div><span>Questions</span><b>{f.queries}</b></div>
                <div><span>Retrieval hit rate</span><b>{f.hitRate}%</b></div>
                <div><span>Avg retrieval latency</span><b>{f.avgRetrievalMs}ms</b></div>
                <div><span>Downvotes</span><b>{f.downvotes}</b></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trends: daily series */}
      {trends.length > 0 ? (
        <section className="admin-panel">
          <PanelHead eyebrow="Trends" title="Recent questions, success rate, latency, and downvotes (daily)" />
          <div className="monitoring-trend-table" role="table">
            <div role="row" className="admin-table-head">
              <span>Date</span><span>Questions</span><span>Success rate</span><span>Avg latency</span><span>Downvotes</span><span>Token</span>
            </div>
            {trends.map((p) => (
              <div role="row" key={p.date}>
                <b>{p.date}</b>
                <span><i className="monitoring-bar" style={{ width: `${Math.min(100, p.queries * 12)}%` }} />{p.queries}</span>
                <span>{p.successRate}%</span>
                <span>{p.avgLatencyMs}ms</span>
                <span>{p.downvotes}</span>
                <span>{p.tokens}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Per-form detail: native monitoring for each knowledge form */}
      {formPanels ? (
        <section className="admin-panel">
          <PanelHead eyebrow="Per-form detail" title="Native monitoring metrics for each knowledge form" />
          <div className="monitoring-deep-grid">
            {/* Documents: chunk and source hit distribution */}
            <article className="monitoring-deep-card">
              <header><b>Documents · Naive RAG</b><span>Hits by source</span></header>
              <p className="monitoring-deep-note">{formPanels.文档型.zeroHitSources} sources returned zero hits when retrieved (chunking may be off or the retrieval policy needs tuning).</p>
              <div className="monitoring-source-bars">
                {formPanels.文档型.sources.length === 0 ? <small className="monitoring-empty">No document retrieval records yet.</small> : null}
                {formPanels.文档型.sources.map((s) => (
                  <div key={s.name} className="monitoring-source-bar">
                    <span title={s.name}>{s.name}</span>
                    <i style={{ width: `${Math.min(100, (s.hits / Math.max(1, s.queries)) * 100)}%` }} />
                    <em>{s.hits} hits / {s.queries} retrievals</em>
                  </div>
                ))}
              </div>
            </article>

            {/* Graph: entities, relationships, duplicates (real graph-rag) */}
            <article className="monitoring-deep-card">
              <header><b>Graph · GraphRAG</b><span>Entities / relationships / dedup</span></header>
              {formPanels.图谱型.available ? (
                <>
                  <div className="monitoring-graph-counts">
                    <div><span>Entities</span><b>{formPanels.图谱型.entities}</b></div>
                    <div><span>Relationships</span><b>{formPanels.图谱型.relations}</b></div>
                    <div><span>Graph sources</span><b>{formPanels.图谱型.sources}</b></div>
                    <div><span>Duplicate candidates</span><b>{formPanels.图谱型.duplicateCandidates.length}</b></div>
                  </div>
                  {formPanels.图谱型.duplicateCandidates.length > 0 ? (
                    <div className="monitoring-dup-list">
                      <small>Possible duplicate entities (merge them during curation):</small>
                      {formPanels.图谱型.duplicateCandidates.slice(0, 10).map((dup, i) => (
                        <span key={i} className="monitoring-dup-pair">{dup}</span>
                      ))}
                    </div>
                  ) : <small className="monitoring-empty">No obvious duplicate entities detected.</small>}
                  <div className="monitoring-entity-chips">
                    {formPanels.图谱型.sampleEntities.slice(0, 16).map((e) => <span key={e}>{e}</span>)}
                  </div>
                </>
              ) : <small className="monitoring-empty">GraphRAG graph stats are unavailable (the module did not respond).</small>}
            </article>

            {/* Knowledge pages: citation traceability and freshness */}
            <article className="monitoring-deep-card">
              <header><b>Knowledge pages · Gbrain</b><span>Traceability / freshness</span></header>
              <div className="monitoring-graph-counts">
                <div><span>Citation traceability</span><b>{formPanels.知识页型.traceableRate}%</b></div>
                <div><span>Pages</span><b>{formPanels.知识页型.knowledgePages}</b></div>
                <div><span>Newest page age</span><b>{formPanels.知识页型.latestPageAgeHours === null ? "—" : `${formPanels.知识页型.latestPageAgeHours}h`}</b></div>
              </div>
              <p className="monitoring-deep-note">Citation traceability is the share of knowledge-page answers that actually cite a page source; freshness shows whether pages need a refresh.</p>
            </article>
          </div>
        </section>
      ) : null}

      {/* Feedback: downvotes enter the improvement queue */}
      <section className="admin-panel">
        <PanelHead eyebrow="Feedback / improvement" title={`Improvement queue (${reviewQueue.length} downvotes)`} />
        {reviewQueue.length === 0 ? (
          <p className="monitoring-empty">No downvotes yet. When a workspace answer is downvoted it lands here so an admin can attribute the cause (retrieval missed, retrieved but answered wrong, missing material, poor chunking, or a graph error) and fix it.</p>
        ) : (
          <div className="monitoring-review-queue">
            {reviewQueue.map((t) => (
              <Link key={t.id} href={`/admin/monitoring/${t.id}`} className="monitoring-review-card">
                <b>{t.query || "(empty question)"}</b>
                <small>{t.forms.join(" / ") || "—"} · {t.hitSourceCount} sources hit · {t.totalLatencyMs}ms</small>
                <em>{t.hitSourceCount === 0 ? "Likely cause: retrieval missed (missing material, chunking, or retrieval policy)" : "Likely cause: retrieved but answered wrong (generation or insufficient evidence) → open the trace for span attribution"}</em>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trace drill-down */}
      <section className="admin-panel">
        <PanelHead
          eyebrow="Trace drill-down"
          title={`Q&A log (${filtered.length} entries)`}
          action={
            <div className="monitoring-filters">
              {(["全部", "文档型", "图谱型", "知识页型"] as const).map((f) => (
                <button key={f} type="button" className={formFilter === f ? "active" : ""} onClick={() => setFormFilter(f)}>{formLabel(f)}</button>
              ))}
              <button type="button" className={onlyFailed ? "active" : ""} onClick={() => setOnlyFailed((v) => !v)}>Failed only</button>
              <button type="button" className={onlyDown ? "active" : ""} onClick={() => setOnlyDown((v) => !v)}>Downvotes only</button>
            </div>
          }
        />
        <div className="admin-data-table monitoring-trace-table" role="table" aria-label="Q&A log">
          <div role="row" className="admin-table-head">
            <span>Question</span>
            <span>Form</span>
            <span>Citations</span>
            <span>Latency</span>
            <span>Token</span>
            <span>Feedback</span>
            <span>Status</span>
          </div>
          {filtered.map((t) => (
            <Link role="row" key={t.id} href={`/admin/monitoring/${t.id}`} className={`monitoring-trace-row${t.feedback?.vote === "down" ? " is-down" : ""}`}>
              <b>{t.query || "(empty question)"}<small>{t.userName} · {t.route === "direct" ? "Direct answer" : "Knowledge retrieval"} · {t.scope ?? ""}</small></b>
              <span>{t.forms.length ? t.forms.join(" / ") : "—"}</span>
              <span>{t.citationCount} citations · {t.hitSourceCount} sources</span>
              <span>{t.totalLatencyMs}ms</span>
              <span>{t.totalTokens || "—"}</span>
              <span>{t.feedback ? (t.feedback.vote === "up" ? "👍 Upvote" : "👎 Downvote") : "—"}</span>
              <AdminStatusBadge status={t.success ? "正常" : "需复核"} />
            </Link>
          ))}
          {filtered.length === 0 ? (
            <div role="row" className="admin-empty-ledger-row">
              <b>No Q&A records match the current filters<small>Ask a few real questions from the workspace and traces will appear here.</small></b>
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

export function AdminTraceDetailPage({ trace }: { trace: StoredChatTrace }) {
  return (
    <AdminShell active="/admin/monitoring" title="Q&A trace detail">
      <AdminPageHead
        eyebrow="Trace detail"
        title={trace.query || "(empty question)"}
        description={`${trace.userName} · ${trace.route === "direct" ? "Direct answer" : "Knowledge retrieval"} · ${trace.scope ?? ""} · ${new Date(trace.createdAt).toLocaleString("en-US")}`}
      />

      <section className="admin-panel">
        <PanelHead eyebrow="This question" title="Result and key metrics" action={<AdminStatusBadge status={trace.success ? "正常" : "需复核"} />} />
        <div className="monitoring-trace-summary">
          <div><span>End-to-end latency</span><b>{trace.totalLatencyMs}ms</b></div>
          <div><span>Citations / sources</span><b>{trace.citationCount} / {trace.hitSourceCount}</b></div>
          <div><span>Token</span><b>{trace.totalTokens || "—"}</b></div>
          <div><span>Form</span><b>{trace.forms.join(" / ") || "—"}</b></div>
          <div><span>User feedback</span><b>{trace.feedback ? (trace.feedback.vote === "up" ? "👍 Upvote" : "👎 Downvote") : "Not rated"}</b></div>
        </div>
        <div className="monitoring-answer-box">
          <span>Answer</span>
          <p>{trace.answerExcerpt}</p>
        </div>
      </section>

      {/* Span tree: every step drills down; RETRIEVER shows hit evidence, LLM shows tokens and latency */}
      <section className="admin-panel">
        <PanelHead eyebrow="Trace span tree" title="How this answer was produced" />
        <div className="monitoring-span-tree">
          <article className="monitoring-span chain">
            <header><b>CHAIN · one question</b><span>{trace.totalLatencyMs}ms</span></header>
            <small>question → retrieval → generation</small>
          </article>
          {trace.spans.map((s, i) => (
            <article key={i} className={`monitoring-span ${s.kind.toLowerCase()}`}>
              <header>
                <b>{s.kind} · {s.label}{s.engine ? `（${s.engine}）` : ""}</b>
                <span>{s.latencyMs}ms</span>
              </header>
              {s.kind === "RETRIEVER" ? (
                <div className="monitoring-span-body">
                  <small>{s.form} · source "{s.sourceName}" · {s.hitCount ?? 0} hits</small>
                  {(s.hits ?? []).map((h, hi) => (
                    <blockquote key={hi}>{h.excerpt}{typeof h.score === "number" ? <em> · score {h.score.toFixed(3)}</em> : null}</blockquote>
                  ))}
                  {(s.hits ?? []).length === 0 ? <blockquote className="empty">No citable snippet from this source</blockquote> : null}
                </div>
              ) : (
                <div className="monitoring-span-body">
                  <small>Model {s.model ?? "—"} · prompt {s.promptTokens ?? "—"} · completion {s.completionTokens ?? "—"} · total {s.totalTokens ?? "—"} tokens</small>
                </div>
              )}
            </article>
          ))}
          {trace.spans.length === 0 ? <p className="monitoring-empty">This was a direct answer with no retrieval span.</p> : null}
        </div>
      </section>

      <Link className="monitoring-back" href="/admin/monitoring">← Back to Monitoring</Link>
    </AdminShell>
  );
}
