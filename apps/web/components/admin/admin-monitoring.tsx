"use client";

import { useState } from "react";
import Link from "next/link";

import { AdminShell, AdminPageHead, PanelHead, AdminStatusBadge } from "./admin-pages";
import { useI18n } from "../../lib/i18n/language-context";
import type { MonitoringOverview, MonitoringTrendPoint, MonitoringFormPanels, StoredChatTrace, TraceFormLabel } from "../../lib/server/platform-store";

type TraceRow = Omit<StoredChatTrace, "spans">;
type FormFilterLabel = TraceFormLabel | "全部";

const FORM_LABEL_KEYS: Record<FormFilterLabel, string> = {
  文档型: "adminMonitoring.formDocuments",
  图谱型: "adminMonitoring.formGraph",
  知识页型: "adminMonitoring.formKnowledgePages",
  全部: "adminMonitoring.formAll"
};

function formLabel(form: FormFilterLabel, t: (key: string) => string) {
  const key = FORM_LABEL_KEYS[form];
  return key ? t(key) : form;
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
  const { t, formatNumber } = useI18n();
  const [formFilter, setFormFilter] = useState<TraceFormLabel | "全部">("全部");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [onlyDown, setOnlyDown] = useState(false);

  const filtered = traces.filter((row) => {
    if (formFilter !== "全部" && !row.forms.includes(formFilter)) return false;
    if (onlyFailed && row.success) return false;
    if (onlyDown && row.feedback?.vote !== "down") return false;
    return true;
  });

  const o = overview.overall;
  const reviewQueue = traces.filter((row) => row.feedback?.vote === "down");

  return (
    <AdminShell active="/admin/monitoring" title={t("adminMonitoring.shellTitle")}>
      <AdminPageHead
        eyebrow={t("adminMonitoring.eyebrow")}
        title={t("adminMonitoring.title")}
        description={t("adminMonitoring.description")}
      />

      {/* Overview health */}
      <section className="admin-panel">
        <PanelHead eyebrow={t("adminMonitoring.overviewHealth")} title={t("adminMonitoring.overviewHealthTitle")} />
        <div className="monitoring-kpi-grid">
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiQuestions")}</span><b>{o.queries}</b><small>{t("adminMonitoring.kpiQuestionsHelper")}</small></article>
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiSuccessRate")}</span><b>{o.successRate}%</b><small>{t("adminMonitoring.kpiSuccessRateHelper")}</small></article>
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiNoAnswerRate")}</span><b>{o.noAnswerRate}%</b><small>{t("adminMonitoring.kpiNoAnswerRateHelper")}</small></article>
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiLatency")}</span><b>{o.p50LatencyMs} / {o.p95LatencyMs}<i>ms</i></b><small>{t("adminMonitoring.kpiLatencyHelper")}</small></article>
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiTokens")}</span><b>{formatNumber(o.totalTokens)}</b><small>{t("adminMonitoring.kpiTokensHelper")}</small></article>
          <article className="monitoring-kpi"><span>{t("adminMonitoring.kpiVotes")}</span><b>{o.upvotes} / {o.downvotes}</b><small>{t("adminMonitoring.kpiVotesHelper", { count: o.pendingReview })}</small></article>
        </div>
      </section>

      {/* Health by knowledge form */}
      <section className="admin-panel">
        <PanelHead eyebrow={t("adminMonitoring.healthByForm")} title={t("adminMonitoring.healthByFormTitle")} />
        <div className="monitoring-form-grid">
          {overview.forms.map((f) => (
            <article key={f.form} className="monitoring-form-card">
              <header>
                <b>{formLabel(f.form, t)}</b>
                <AdminStatusBadge status={f.queries === 0 ? "观察" : f.hitRate >= 60 ? "正常" : "需复核"} />
              </header>
              <small>{FORM_BADGE[f.form]}</small>
              <div className="monitoring-form-metrics">
                <div><span>{t("adminMonitoring.formQuestions")}</span><b>{f.queries}</b></div>
                <div><span>{t("adminMonitoring.formHitRate")}</span><b>{f.hitRate}%</b></div>
                <div><span>{t("adminMonitoring.formAvgLatency")}</span><b>{f.avgRetrievalMs}ms</b></div>
                <div><span>{t("adminMonitoring.formDownvotes")}</span><b>{f.downvotes}</b></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trends: daily series */}
      {trends.length > 0 ? (
        <section className="admin-panel">
          <PanelHead eyebrow={t("adminMonitoring.trends")} title={t("adminMonitoring.trendsTitle")} />
          <div className="monitoring-trend-table" role="table">
            <div role="row" className="admin-table-head">
              <span>{t("adminMonitoring.thDate")}</span><span>{t("adminMonitoring.thQuestions")}</span><span>{t("adminMonitoring.thSuccessRate")}</span><span>{t("adminMonitoring.thAvgLatency")}</span><span>{t("adminMonitoring.thDownvotes")}</span><span>{t("adminMonitoring.thToken")}</span>
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
          <PanelHead eyebrow={t("adminMonitoring.perFormDetail")} title={t("adminMonitoring.perFormDetailTitle")} />
          <div className="monitoring-deep-grid">
            {/* Documents: chunk and source hit distribution */}
            <article className="monitoring-deep-card">
              <header><b>{t("adminMonitoring.formDocuments")} · Naive RAG</b><span>{t("adminMonitoring.hitsBySource")}</span></header>
              <p className="monitoring-deep-note">{t("adminMonitoring.zeroHitSources", { count: formPanels.文档型.zeroHitSources })}</p>
              <div className="monitoring-source-bars">
                {formPanels.文档型.sources.length === 0 ? <small className="monitoring-empty">{t("adminMonitoring.noDocumentRecords")}</small> : null}
                {formPanels.文档型.sources.map((s) => (
                  <div key={s.name} className="monitoring-source-bar">
                    <span title={s.name}>{s.name}</span>
                    <i style={{ width: `${Math.min(100, (s.hits / Math.max(1, s.queries)) * 100)}%` }} />
                    <em>{t("adminMonitoring.hitsPerRetrievals", { hits: s.hits, queries: s.queries })}</em>
                  </div>
                ))}
              </div>
            </article>

            {/* Graph: entities, relationships, duplicates (real graph-rag) */}
            <article className="monitoring-deep-card">
              <header><b>{t("adminMonitoring.formGraph")} · GraphRAG</b><span>{t("adminMonitoring.entitiesRelationships")}</span></header>
              {formPanels.图谱型.available ? (
                <>
                  <div className="monitoring-graph-counts">
                    <div><span>{t("adminMonitoring.entities")}</span><b>{formPanels.图谱型.entities}</b></div>
                    <div><span>{t("adminMonitoring.relationships")}</span><b>{formPanels.图谱型.relations}</b></div>
                    <div><span>{t("adminMonitoring.graphSources")}</span><b>{formPanels.图谱型.sources}</b></div>
                    <div><span>{t("adminMonitoring.duplicateCandidates")}</span><b>{formPanels.图谱型.duplicateCandidates.length}</b></div>
                  </div>
                  {formPanels.图谱型.duplicateCandidates.length > 0 ? (
                    <div className="monitoring-dup-list">
                      <small>{t("adminMonitoring.duplicateHint")}</small>
                      {formPanels.图谱型.duplicateCandidates.slice(0, 10).map((dup, i) => (
                        <span key={i} className="monitoring-dup-pair">{dup}</span>
                      ))}
                    </div>
                  ) : <small className="monitoring-empty">{t("adminMonitoring.noDuplicates")}</small>}
                  <div className="monitoring-entity-chips">
                    {formPanels.图谱型.sampleEntities.slice(0, 16).map((e) => <span key={e}>{e}</span>)}
                  </div>
                </>
              ) : <small className="monitoring-empty">{t("adminMonitoring.graphUnavailable")}</small>}
            </article>

            {/* Knowledge pages: citation traceability and freshness */}
            <article className="monitoring-deep-card">
              <header><b>{t("adminMonitoring.formKnowledgePages")} · Gbrain</b><span>{t("adminMonitoring.traceabilityFreshness")}</span></header>
              <div className="monitoring-graph-counts">
                <div><span>{t("adminMonitoring.citationTraceability")}</span><b>{formPanels.知识页型.traceableRate}%</b></div>
                <div><span>{t("adminMonitoring.pages")}</span><b>{formPanels.知识页型.knowledgePages}</b></div>
                <div><span>{t("adminMonitoring.newestPageAge")}</span><b>{formPanels.知识页型.latestPageAgeHours === null ? "—" : `${formPanels.知识页型.latestPageAgeHours}h`}</b></div>
              </div>
              <p className="monitoring-deep-note">{t("adminMonitoring.traceabilityNote")}</p>
            </article>
          </div>
        </section>
      ) : null}

      {/* Feedback: downvotes enter the improvement queue */}
      <section className="admin-panel">
        <PanelHead eyebrow={t("adminMonitoring.feedbackImprovement")} title={t("adminMonitoring.improvementQueue", { count: reviewQueue.length })} />
        {reviewQueue.length === 0 ? (
          <p className="monitoring-empty">{t("adminMonitoring.noDownvotes")}</p>
        ) : (
          <div className="monitoring-review-queue">
            {reviewQueue.map((row) => (
              <Link key={row.id} href={`/admin/monitoring/${row.id}`} className="monitoring-review-card">
                <b>{row.query || t("adminMonitoring.emptyQuestion")}</b>
                <small>{row.forms.join(" / ") || "—"} · {t("adminMonitoring.sourcesHit", { count: row.hitSourceCount })} · {row.totalLatencyMs}ms</small>
                <em>{row.hitSourceCount === 0 ? t("adminMonitoring.causeMiss") : t("adminMonitoring.causeWrong")}</em>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trace drill-down */}
      <section className="admin-panel">
        <PanelHead
          eyebrow={t("adminMonitoring.traceDrilldown")}
          title={t("adminMonitoring.qaLog", { count: filtered.length })}
          action={
            <div className="monitoring-filters">
              {(["全部", "文档型", "图谱型", "知识页型"] as const).map((f) => (
                <button key={f} type="button" className={formFilter === f ? "active" : ""} onClick={() => setFormFilter(f)}>{formLabel(f, t)}</button>
              ))}
              <button type="button" className={onlyFailed ? "active" : ""} onClick={() => setOnlyFailed((v) => !v)}>{t("adminMonitoring.failedOnly")}</button>
              <button type="button" className={onlyDown ? "active" : ""} onClick={() => setOnlyDown((v) => !v)}>{t("adminMonitoring.downvotesOnly")}</button>
            </div>
          }
        />
        <div className="admin-data-table monitoring-trace-table" role="table" aria-label={t("adminMonitoring.qaLogAria")}>
          <div role="row" className="admin-table-head">
            <span>{t("adminMonitoring.thQuestion")}</span>
            <span>{t("adminMonitoring.thForm")}</span>
            <span>{t("adminMonitoring.thCitations")}</span>
            <span>{t("adminMonitoring.thLatency")}</span>
            <span>{t("adminMonitoring.thToken")}</span>
            <span>{t("adminMonitoring.thFeedback")}</span>
            <span>{t("adminMonitoring.thStatus")}</span>
          </div>
          {filtered.map((row) => (
            <Link role="row" key={row.id} href={`/admin/monitoring/${row.id}`} className={`monitoring-trace-row${row.feedback?.vote === "down" ? " is-down" : ""}`}>
              <b>{row.query || t("adminMonitoring.emptyQuestion")}<small>{row.userName} · {row.route === "direct" ? t("adminMonitoring.directAnswer") : t("adminMonitoring.knowledgeRetrieval")} · {row.scope ?? ""}</small></b>
              <span>{row.forms.length ? row.forms.join(" / ") : "—"}</span>
              <span>{t("adminMonitoring.citationsSources", { citations: row.citationCount, sources: row.hitSourceCount })}</span>
              <span>{row.totalLatencyMs}ms</span>
              <span>{row.totalTokens || "—"}</span>
              <span>{row.feedback ? (row.feedback.vote === "up" ? t("adminMonitoring.upvote") : t("adminMonitoring.downvote")) : "—"}</span>
              <AdminStatusBadge status={row.success ? "正常" : "需复核"} />
            </Link>
          ))}
          {filtered.length === 0 ? (
            <div role="row" className="admin-empty-ledger-row">
              <b>{t("adminMonitoring.noRecordsTitle")}<small>{t("adminMonitoring.noRecordsBody")}</small></b>
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

export function AdminTraceDetailPage({ trace }: { trace: StoredChatTrace }) {
  const { t, formatDate } = useI18n();
  return (
    <AdminShell active="/admin/monitoring" title={t("adminMonitoring.traceShellTitle")}>
      <AdminPageHead
        eyebrow={t("adminMonitoring.traceDetail")}
        title={trace.query || t("adminMonitoring.emptyQuestion")}
        description={`${trace.userName} · ${trace.route === "direct" ? t("adminMonitoring.directAnswer") : t("adminMonitoring.knowledgeRetrieval")} · ${trace.scope ?? ""} · ${formatDate(trace.createdAt, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
      />

      <section className="admin-panel">
        <PanelHead eyebrow={t("adminMonitoring.thisQuestion")} title={t("adminMonitoring.resultAndMetrics")} action={<AdminStatusBadge status={trace.success ? "正常" : "需复核"} />} />
        <div className="monitoring-trace-summary">
          <div><span>{t("adminMonitoring.endToEndLatency")}</span><b>{trace.totalLatencyMs}ms</b></div>
          <div><span>{t("adminMonitoring.citationsSourcesLabel")}</span><b>{trace.citationCount} / {trace.hitSourceCount}</b></div>
          <div><span>{t("adminMonitoring.token")}</span><b>{trace.totalTokens || "—"}</b></div>
          <div><span>{t("adminMonitoring.form")}</span><b>{trace.forms.join(" / ") || "—"}</b></div>
          <div><span>{t("adminMonitoring.userFeedback")}</span><b>{trace.feedback ? (trace.feedback.vote === "up" ? t("adminMonitoring.upvote") : t("adminMonitoring.downvote")) : t("adminMonitoring.notRated")}</b></div>
        </div>
        <div className="monitoring-answer-box">
          <span>{t("adminMonitoring.answer")}</span>
          <p>{trace.answerExcerpt}</p>
        </div>
      </section>

      {/* Span tree: every step drills down; RETRIEVER shows hit evidence, LLM shows tokens and latency */}
      <section className="admin-panel">
        <PanelHead eyebrow={t("adminMonitoring.traceSpanTree")} title={t("adminMonitoring.howProduced")} />
        <div className="monitoring-span-tree">
          <article className="monitoring-span chain">
            <header><b>{t("adminMonitoring.chainOneQuestion")}</b><span>{trace.totalLatencyMs}ms</span></header>
            <small>{t("adminMonitoring.chainFlow")}</small>
          </article>
          {trace.spans.map((s, i) => (
            <article key={i} className={`monitoring-span ${s.kind.toLowerCase()}`}>
              <header>
                <b>{s.kind} · {s.label}{s.engine ? `（${s.engine}）` : ""}</b>
                <span>{s.latencyMs}ms</span>
              </header>
              {s.kind === "RETRIEVER" ? (
                <div className="monitoring-span-body">
                  <small>{t("adminMonitoring.spanRetriever", { form: s.form ?? "", source: s.sourceName ?? "", count: s.hitCount ?? 0 })}</small>
                  {(s.hits ?? []).map((h, hi) => (
                    <blockquote key={hi}>{h.excerpt}{typeof h.score === "number" ? <em> · {t("adminMonitoring.score", { value: h.score.toFixed(3) })}</em> : null}</blockquote>
                  ))}
                  {(s.hits ?? []).length === 0 ? <blockquote className="empty">{t("adminMonitoring.noCitableSnippet")}</blockquote> : null}
                </div>
              ) : (
                <div className="monitoring-span-body">
                  <small>{t("adminMonitoring.spanModel", { model: s.model ?? "—", prompt: s.promptTokens ?? "—", completion: s.completionTokens ?? "—", total: s.totalTokens ?? "—" })}</small>
                </div>
              )}
            </article>
          ))}
          {trace.spans.length === 0 ? <p className="monitoring-empty">{t("adminMonitoring.directNoSpan")}</p> : null}
        </div>
      </section>

      <Link className="monitoring-back" href="/admin/monitoring">{t("adminMonitoring.backToMonitoring")}</Link>
    </AdminShell>
  );
}
