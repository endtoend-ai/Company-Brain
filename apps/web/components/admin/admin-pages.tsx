"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";
import { LanguageSwitcher } from "../language-switcher";
import { useI18n } from "../../lib/i18n/language-context";
import { adminNavKeys, adminSubnavKeys } from "../../lib/i18n/nav-keys";
import { useAuth } from "../../lib/auth-context";
import type { AdminDashboardSnapshot, StoredAdminTemplate } from "../../lib/server/platform-store";
import { ConfirmDialog } from "./admin-confirm-dialog";
import {
  adminAuditEvents,
  adminDashboardDataOverview,
  adminDashboardHealthCards,
  adminDashboardRiskItems,
  adminGraphSnapshot,
  adminIntakeRequests,
  adminNav,
  adminTemplates,
  evaluationRows,
  isActionableAdminRequestStatus,
  knowledgeBaseInventory,
  ragOperationModes,
  resolveAdminFilePreview,
  strategyProfiles
} from "../../lib/fixtures/admin-governance";

type AdminIntakeRequest = (typeof adminIntakeRequests)[number] & {
  scenarioId?: string;
  storedFiles?: Array<{
    id: string;
    originalName: string;
    relativePath: string;
    size: number;
    accessControl?: {
      scope: "private" | "team" | "company";
      organizationId: string;
      teamIds: string[];
    };
    originalState?: "temporary" | "retained" | "deleted";
    originalAvailable?: boolean;
    retentionPolicy?: "delete_after_ingest" | "retain_source";
    retentionReason?: string;
  }>;
  recommendedEngines?: AdminEngine[];
  selectedEngine?: "待选择" | AdminEngine;
  frontstageMapping?: string;
  parsedArtifactCount?: number;
  knowledgeObjectCount?: number;
};

type AdminStoredFile = NonNullable<AdminIntakeRequest["storedFiles"]>[number];
type AdminEngine = "Gbrain" | "Naive RAG" | "GraphRAG";
type RagOperationMode = (typeof ragOperationModes)[number];
type RagParameter = RagOperationMode["parameters"][number];
type RagAssetView = RagOperationMode["assetViews"][number];
type IngestionRun = {
  requestId: string;
  engine: AdminEngine;
  status: "running" | "completed" | "failed";
  currentStep: number;
  message: string;
};
type AdminFilePreviewState = {
  title: string;
  kind: string;
  label: string;
  url: string;
  status: "loading" | "ready" | "error";
  text?: string;
  message?: string;
};
type AdminKnowledgeAssetDetail = {
  id: string;
  kind: string;
  engine: AdminEngine;
  title: string;
  metric: string;
  status: string;
  sourceOriginalName: string;
  scenarioName: string;
  visibilityLabel: string;
  ownerName: string;
  createdAt: string;
  content: string;
  metadata: Array<{ label: string; value: string }>;
};
type AdminAssetDetailState = {
  mode: Pick<RagOperationMode, "label" | "frontstageLabel">;
  asset: Pick<RagAssetView, "kind" | "label" | "description" | "metric">;
  status: "loading" | "ready" | "error";
  records: AdminKnowledgeAssetDetail[];
  message?: string;
};

const adminKnowledgeSubnav = [
  { label: "Asset Overview", href: "/admin/knowledge-bases" },
  { label: "Gbrain Management", href: "/admin/knowledge-bases/gbrain" },
  { label: "Naive RAG Management", href: "/admin/knowledge-bases/naive" },
  { label: "GraphRAG Management", href: "/admin/graph" }
];

export function AdminOverviewPage({
  initialRequests = [],
  dashboard
}: {
  initialRequests?: AdminIntakeRequest[];
  dashboard?: AdminDashboardSnapshot;
}) {
  const { t, formatNumber } = useI18n();
  const requests = resolveAdminRequests(initialRequests);
  const pendingRequests = requests.filter((request) => !["已发布", "已退回"].includes(request.status));
  const readyRequests = requests.filter((request) => request.status === "已发布");
  const healthCards = dashboard?.healthCards ?? adminDashboardHealthCards;
  const dataOverview = dashboard?.dataOverview ?? adminDashboardDataOverview;
  const dashboardMetrics = [
    { label: t("admin.overview.kpiPending"), value: dashboard?.requests.pending ?? pendingRequests.length, helper: t("admin.overview.kpiPendingHelper"), href: "/admin/pipelines", state: (dashboard?.requests.pending ?? pendingRequests.length) > 0 ? "watch" : "healthy" },
    { label: t("admin.overview.kpiPublished"), value: dashboard?.requests.published ?? readyRequests.length, helper: t("admin.overview.kpiPublishedHelper"), href: "/admin/knowledge-bases", state: "healthy" },
    { label: t("admin.overview.kpiAssets"), value: dashboard?.assets.total ?? knowledgeBaseInventory.length, helper: t("admin.overview.kpiAssetsHelper"), href: "/admin/knowledge-bases", state: "healthy" },
    { label: t("admin.overview.kpiPolicies"), value: strategyProfiles.length, helper: t("admin.overview.kpiPoliciesHelper"), href: "/admin/strategies", state: "healthy" }
  ];
  const dashboardRisks = adminDashboardRiskItems.map((item) => item.label === RISK_PENDING_SUBMISSIONS ? { ...item, count: dashboard?.requests.pending ?? pendingRequests.length } : item);
  const maxDataTotal = Math.max(1, ...dataOverview.map((entry) => entry.total));

  return (
    <AdminShell active="/admin" title={t("admin.overview.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.overview.eyebrow")}
        title={t("admin.overview.title")}
        description={t("admin.overview.description")}
        actions={<Link className="admin-primary-action" href="/admin/pipelines">{t("admin.overview.resolvePending")}</Link>}
      />

      <section className="admin-health-strip" aria-label={t("admin.overview.serviceHealthAria")}>
        {healthCards.map((item) => (
          <Link href={item.route} key={item.id} className="admin-health-card">
            <span>{healthCardLabelText(item.label, t)}</span>
            <b>{healthCardValueText(item.value, t)}</b>
            <small>{healthCardDetailText(item.detail, t)}</small>
            <AdminStatusBadge status={item.status} />
          </Link>
        ))}
      </section>

      <section className="admin-kpi-row admin-kpi-row-dashboard" aria-label={t("admin.overview.keyMetricsAria")}>
        {dashboardMetrics.map((item) => (
          <Link href={item.href} key={item.label} className={`admin-kpi-tile ${item.state}`}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            <small>{item.helper}</small>
          </Link>
        ))}
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-dashboard-map">
          <PanelHead eyebrow={t("admin.overview.dataOverview")} title={t("admin.overview.dataOverviewTitle")} action={<Link href="/admin/knowledge-bases">{t("admin.openAssetLedger")}</Link>} />
          <div className="admin-data-scope-grid">
            {dataOverview.map((item) => {
              const width = Math.max(12, Math.round((item.total / maxDataTotal) * 100));
              return (
                <article key={item.scope}>
                  <header>
                    <span>{visibilityText(item.scope, t)}</span>
                    <AdminStatusBadge status={item.health} />
                  </header>
                  <strong>{formatNumber(item.total)} <small>{unitText(item.unit, t)}</small></strong>
                  <div className="admin-scope-meter" aria-label={t("admin.overview.scopeVolumeAria", { scope: visibilityText(item.scope, t), value: `${formatNumber(item.total)}${unitText(item.unit, t)}` })}>
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <dl>
                    <div><dt>{t("admin.overview.module")}</dt><dd>{item.module}</dd></div>
                    <div><dt>{t("admin.overview.owner")}</dt><dd>{item.owner}</dd></div>
                  </dl>
                  <p>{item.policy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-panel admin-service-panel">
          <PanelHead eyebrow={t("admin.overview.serviceStatus")} title={t("admin.overview.serviceStatusTitle")} action={<Link href="/admin/settings">{t("admin.integrations")}</Link>} />
          <div className="admin-service-stack">
            {ragOperationModes.map((mode) => (
              <article key={mode.id}>
                <div>
                  <b>{mode.label}</b>
                  <AdminStatusBadge status={mode.status} />
                </div>
                <p>{mode.purpose}</p>
                <small>{mode.storage}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-dashboard-grid secondary">
        <section className="admin-panel admin-dashboard-tasks">
          <PanelHead eyebrow={t("admin.overview.pendingTasks")} title={t("admin.overview.pendingTasksTitle")} action={<Link href="/admin/pipelines">{t("admin.overview.openProcessingPipeline")}</Link>} />
          <div className="admin-task-table">
            <div className="admin-table-head">
              <span>{t("admin.overview.thScenario")}</span>
              <span>{t("admin.overview.thScope")}</span>
              <span>{t("admin.overview.thSuggestedEngine")}</span>
              <span>{t("admin.overview.thStatus")}</span>
              <span>{t("admin.overview.thSubmitted")}</span>
            </div>
            {pendingRequests.slice(0, 6).map((request) => (
              <Link href="/admin/pipelines" key={request.id}>
                <b>{request.scenarioName}<small>{request.requester}</small></b>
                <span>{visibilityText(request.visibility, t)}</span>
                <span>{requestRecommendedEngines(request).join(" / ")}</span>
                <AdminStatusBadge status={request.status} />
                <span>{request.submittedAt}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-risk-panel">
          <PanelHead eyebrow={t("admin.overview.risksGates")} title={t("admin.overview.risksGatesTitle")} action={<Link href="/admin/audit">{t("admin.auditLog")}</Link>} />
          <div className="admin-risk-stack">
            {dashboardRisks.map((item) => (
              <article key={item.label}>
                <span>{riskSeverityText(item.severity, t)}</span>
                <div>
                  <b>{riskLabelText(item.label, t)}</b>
                  <p>{item.detail}</p>
                </div>
                <strong>{item.count}</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export function AdminTemplatesPage({ initialTemplates = [] }: { initialTemplates?: StoredAdminTemplate[] }) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<StoredAdminTemplate[]>(initialTemplates.length ? initialTemplates : adminTemplates.map(legacyAdminTemplateToStored));
  const [notice, setNotice] = useState("");
  const [draftName, setDraftName] = useState("");
  const [pending, setPending] = useState<{ title: string; description: string; danger?: boolean; confirmText?: string; run: () => void } | null>(null);
  const [draftCategory, setDraftCategory] = useState("Custom");
  const [draftHeadline, setDraftHeadline] = useState("");
  const officialCount = templates.filter((template) => template.source === "official").length;
  const customCount = templates.filter((template) => template.source === "custom").length;
  const pausedCount = templates.filter((template) => template.state === "paused").length;
  const averageDemoReadiness = templates.length ? Math.round(templates.reduce((total, template) => total + template.demoReadiness, 0) / templates.length) : 0;

  async function createTemplate() {
    if (!draftName.trim()) {
      setNotice(t("admin.templates.noticeNameRequired"));
      return;
    }
    const response = await fetch("/api/platform/admin/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: draftName,
        category: draftCategory,
        headline: draftHeadline || "Business scenario template created by an admin.",
        accepted_files: ["PDF", "Word", "Markdown", "Spreadsheets"],
        input_examples: ["Business brief", "Source files"],
        output_capabilities: ["Follow-up answers", "Cited evidence", "Business deliverables"],
        product_form: ["hybrid", "task_workflow"],
        review_requirement: "Requires admin confirmation"
      })
    });
    const body = await response.json().catch(() => null) as { template?: StoredAdminTemplate; message?: string } | null;
    if (!response.ok || !body?.template) {
      setNotice(body?.message ?? t("admin.templates.noticeCreateFailed"));
      return;
    }
    setTemplates((items) => [body.template!, ...items]);
    setDraftName("");
    setDraftHeadline("");
    setNotice(t("admin.templates.noticeCreated", { name: body.template.name }));
  }

  async function toggleTemplate(template: StoredAdminTemplate) {
    const nextState = template.state === "paused" ? (template.source === "official" ? "official" : "candidate") : "paused";
    const response = await fetch(`/api/platform/admin/templates/${template.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: nextState })
    });
    const body = await response.json().catch(() => null) as { template?: StoredAdminTemplate; message?: string } | null;
    if (!response.ok || !body?.template) {
      setNotice(body?.message ?? t("admin.templates.noticeUpdateFailed"));
      return;
    }
    setTemplates((items) => items.map((item) => item.id === template.id ? body.template! : item));
    setNotice(nextState === "paused" ? t("admin.templates.noticePaused", { name: template.name }) : t("admin.templates.noticeResumed", { name: template.name }));
  }

  async function deleteTemplate(template: StoredAdminTemplate) {
    const response = await fetch(`/api/platform/admin/templates/${template.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setNotice(body?.message ?? t("admin.templates.noticeDeleteFailed"));
      return;
    }
    setTemplates((items) => items.filter((item) => item.id !== template.id));
    setNotice(t("admin.templates.noticeDeleted", { name: template.name }));
  }

  return (
    <AdminShell active="/admin/templates" title={t("admin.templates.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.templates.eyebrow")}
        title={t("admin.templates.title")}
        description={t("admin.templates.description")}
        actions={<button type="button" className="admin-primary-action" disabled={!draftName.trim()} onClick={createTemplate}>{t("admin.templates.newTemplate")}</button>}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-template-metrics" aria-label={t("admin.templates.metricsAria")}>
        <article><span>{t("admin.templates.metricOfficial")}</span><b>{officialCount}</b><small>{t("admin.templates.metricOfficialHelper")}</small></article>
        <article><span>{t("admin.templates.metricCustom")}</span><b>{customCount}</b><small>{t("admin.templates.metricCustomHelper")}</small></article>
        <article><span>{t("admin.templates.metricPaused")}</span><b>{pausedCount}</b><small>{t("admin.templates.metricPausedHelper")}</small></article>
        <article><span>{t("admin.templates.metricDemoReadiness")}</span><b>{averageDemoReadiness}%</b><small>{t("admin.templates.metricDemoReadinessHelper")}</small></article>
      </section>

      <section className="admin-panel admin-template-builder">
        <PanelHead eyebrow={t("admin.templates.creationEyebrow")} title={t("admin.templates.creationTitle")} action={<span>{t("admin.templates.adminsOnly")}</span>} />
        <div className="admin-template-form">
          <label>
            <span>{t("admin.templates.nameLabel")}</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t("admin.templates.namePlaceholder")} />
          </label>
          <label>
            <span>{t("admin.templates.categoryLabel")}</span>
            <input value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} placeholder={t("admin.templates.categoryPlaceholder")} />
          </label>
          <label>
            <span>{t("admin.templates.summaryLabel")}</span>
            <input value={draftHeadline} onChange={(event) => setDraftHeadline(event.target.value)} placeholder={t("admin.templates.summaryPlaceholder")} />
          </label>
          <button type="button" disabled={!draftName.trim()} onClick={createTemplate}>{t("admin.templates.createTemplate")}</button>
        </div>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow={t("admin.templates.ledgerEyebrow")} title={t("admin.templates.ledgerTitle")} />
        <div className="admin-data-table admin-template-table" role="table" aria-label={t("admin.templates.tableAria")}>
          <div role="row" className="admin-table-head">
            <span>{t("admin.templates.thTemplate")}</span>
            <span>{t("admin.templates.thSource")}</span>
            <span>{t("admin.templates.thStatus")}</span>
            <span>{t("admin.templates.thAcceptedFiles")}</span>
            <span>{t("admin.templates.thReleaseGate")}</span>
            <span>{t("admin.templates.thCapabilities")}</span>
            <span>{t("admin.templates.thActions")}</span>
          </div>
          {templates.map((template) => (
            <div role="row" key={template.id}>
              <b>{template.name}<small>{template.headline}</small></b>
              <span>{template.source === "official" ? t("admin.templates.sourceOfficial") : t("admin.templates.sourceCustom")} · {templateCategoryText(template.category, t)}</span>
              <AdminStatusBadge status={template.state} />
              <span>{template.acceptedFiles.slice(0, 4).join(" / ")}</span>
              <span>{template.reviewRequirement}<small>{t("admin.templates.evidenceCoverage", { value: template.evidenceCoverage })}</small></span>
              <span>{template.outputCapabilities.slice(0, 3).join(" / ")}<small>{t("admin.templates.demoReady", { value: template.demoReadiness })}</small></span>
              <div className="admin-row-actions">
                <button type="button" onClick={() => { if (template.state === "paused") { void toggleTemplate(template); } else { setPending({ title: t("admin.templates.pauseTitle"), description: t("admin.templates.pauseDescription", { name: template.name }), confirmText: t("admin.templates.pause"), run: () => toggleTemplate(template) }); } }}>{template.state === "paused" ? t("admin.templates.resume") : t("admin.templates.pause")}</button>
                <button type="button" onClick={async () => { await fetch(`/api/platform/admin/templates/${template.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: "official" }) }); window.location.reload(); }}>{t("admin.templates.review")}</button>
                {template.canDelete ? <button type="button" onClick={() => setPending({ title: t("admin.templates.deleteTitle"), description: t("admin.templates.deleteDescription", { name: template.name }), danger: true, confirmText: t("admin.templates.delete"), run: () => deleteTemplate(template) })}>{t("admin.templates.delete")}</button> : <span>{t("admin.templates.cannotDelete")}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog open={pending !== null} title={pending?.title ?? ""} description={pending?.description ?? ""} danger={pending?.danger} confirmText={pending?.confirmText} onConfirm={() => { const p = pending; setPending(null); if (p) p.run(); }} onCancel={() => setPending(null)} />
    </AdminShell>
  );
}

function legacyAdminTemplateToStored(template: (typeof adminTemplates)[number]): StoredAdminTemplate {
  return {
    id: template.id,
    name: template.name,
    category: "Official",
    state: template.state === "已发布" ? "official" : "candidate",
    source: "official",
    owner: template.owner,
    headline: template.impact,
    acceptedFiles: ["PDF", "Word", "Markdown", "Spreadsheets"],
    inputExamples: ["Business brief", "Source files"],
    outputCapabilities: template.impact.split(" / ").filter(Boolean),
    productForm: ["hybrid"],
    reviewRequirement: template.reviewPolicy === "无需复核" ? "No admin confirmation needed" : template.reviewPolicy === "必须复核" ? "Requires admin confirmation" : "Admin confirmation recommended",
    evidenceSources: template.evidenceSources,
    evidenceCoverage: template.evidenceCoverage,
    demoReadiness: template.demoReadiness,
    canEdit: true,
    canDelete: false,
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z"
  };
}

// ===== Real backend governance calls (same-origin fetch carries the session cookie) =====
async function postRecallVerify(engine: string, query: string, t: T): Promise<string> {
  try {
    const r = await fetch("/api/platform/admin/recall-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine, query })
    });
    if (!r.ok) return t("admin.knowledge.noticeRecallFailedHttp", { status: r.status });
    const d = await r.json();
    if (!d.hits?.length) return t("admin.knowledge.noticeNoMatch", { count: d.checkedSources ?? 0, engine });
    const top = d.hits.slice(0, 2).map((h: { source: string; excerpt: string }, i: number) => `${i + 1}. ${h.source}：${h.excerpt}`).join("　");
    return t("admin.knowledge.noticeRecallHits", { count: d.hits.length, top });
  } catch {
    return t("admin.knowledge.noticeRecallFailedBackend");
  }
}

function triggerAssetExport(engine?: string) {
  const qs = engine && engine !== "全部" ? `?engine=${encodeURIComponent(engine)}` : "";
  window.open(`/api/platform/admin/knowledge-assets/export${qs}`, "_blank");
}

async function postBatchReview(engine: string | undefined, t: T): Promise<string> {
  try {
    const r = await fetch("/api/platform/admin/batch-review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine })
    });
    if (!r.ok) return t("admin.knowledge.noticeBatchFailedHttp", { status: r.status });
    const d = await r.json();
    return t("admin.knowledge.noticeBatchFinished", { approved: d.approved, failed: d.failed });
  } catch {
    return t("admin.knowledge.noticeBatchFailedBackend");
  }
}

export function AdminKnowledgeBasesPage({ initialAssets = [] }: { initialAssets?: AdminKnowledgeAssetDetail[] }) {
  const { t } = useI18n();
  const [assets] = useState(initialAssets);
  const [engineFilter, setEngineFilter] = useState<AdminEngine | "全部">("全部");
  const [scopeFilter, setScopeFilter] = useState("全部");
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? "");
  const [assetDetail, setAssetDetail] = useState<AdminAssetDetailState | null>(null);
  const [consoleNotice, setConsoleNotice] = useState("");
  const scopeOptions = ["全部", ...Array.from(new Set(assets.map((asset) => asset.visibilityLabel)))];
  const filteredAssets = assets.filter((asset) => {
    const engineMatch = engineFilter === "全部" || asset.engine === engineFilter;
    const scopeMatch = scopeFilter === "全部" || asset.visibilityLabel === scopeFilter;
    return engineMatch && scopeMatch;
  });
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? assets[0];
  const stats = knowledgeAssetStats(assets, t);

  return (
    <AdminShell active="/admin/knowledge-bases" title={t("admin.knowledge.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.knowledge.eyebrow")}
        title={t("admin.knowledge.title")}
        description={t("admin.knowledge.description")}
        actions={<button type="button" className="admin-primary-action" onClick={() => { triggerAssetExport(engineFilter); setConsoleNotice(t("admin.knowledge.noticeExport")); }}>{t("admin.knowledge.exportAssetTable")}</button>}
      />
      {consoleNotice ? <p className="admin-console-notice" role="status">{consoleNotice}</p> : null}

      <section className="admin-asset-overview" aria-label={t("admin.knowledge.overviewAria")}>
        {stats.map((item) => (
          <article key={item.label} className={item.state}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            <small>{item.helper}</small>
          </article>
        ))}
      </section>

      <section className="admin-knowledge-console" aria-label={t("admin.knowledge.consoleAria")}>
        <aside className="admin-asset-scope-rail" aria-label={t("admin.knowledge.scopeAria")}>
          <header>
            <span>{t("admin.knowledge.assetScope")}</span>
            <b>{t("admin.knowledge.locateByPermissions")}</b>
          </header>
          <div className="admin-scope-list">
            {["全部", "个人", "团队", "公司"].map((scope) => (
              <button key={scope} type="button" className={scopeFilter === scope ? "active" : ""} onClick={() => setScopeFilter(scope)}>
                <span>{visibilityText(scope, t)}</span>
                <b>{scope === "全部" ? assets.length : assets.filter((asset) => asset.visibilityLabel === scope).length}</b>
              </button>
            ))}
          </div>
          <div className="admin-engine-tree">
            {(["Gbrain", "Naive RAG", "GraphRAG"] as AdminEngine[]).map((engine) => (
              <button key={engine} type="button" className={engineFilter === engine ? "active" : ""} onClick={() => setEngineFilter(engine)}>
                <span>{engine}</span>
                <small>{frontstageLabelForEngine(engine, t)}</small>
                <b>{assets.filter((asset) => asset.engine === engine).length}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-panel admin-asset-ledger">
          <PanelHead
            eyebrow={t("admin.knowledge.ledgerEyebrow")}
            title={t("admin.knowledge.ledgerTitle")}
            action={<span>{t("admin.knowledge.itemsCount", { filtered: filteredAssets.length, total: assets.length })}</span>}
          />
          <div className="admin-asset-filterbar" aria-label={t("admin.knowledge.filtersAria")}>
            <div>
              {(["全部", "Gbrain", "Naive RAG", "GraphRAG"] as Array<AdminEngine | "全部">).map((engine) => (
                <button key={engine} type="button" className={engineFilter === engine ? "active" : ""} onClick={() => setEngineFilter(engine)}>
                  {engine === "全部" ? t("adminVisibility.all") : engine}
                </button>
              ))}
            </div>
            <div>
              {scopeOptions.map((scope) => (
                <button key={scope} type="button" className={scopeFilter === scope ? "active" : ""} onClick={() => setScopeFilter(scope)}>
                  {visibilityText(scope, t)}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-data-table admin-knowledge-ledger-table" role="table" aria-label={t("admin.knowledge.ledgerAria")}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.knowledge.thAsset")}</span>
              <span>{t("admin.knowledge.thEngine")}</span>
              <span>{t("admin.knowledge.thType")}</span>
              <span>{t("admin.knowledge.thPermissions")}</span>
              <span>{t("admin.knowledge.thSource")}</span>
              <span>{t("admin.knowledge.thStatus")}</span>
              <span>{t("admin.knowledge.thActions")}</span>
            </div>
            {filteredAssets.map((asset) => (
              <div
                role="row"
                key={asset.id}
                className={selectedAsset?.id === asset.id ? "active" : ""}
                data-asset-row={asset.id}
              >
                <button type="button" onClick={() => setSelectedAssetId(asset.id)}>
                  <b>{asset.scenarioName}<small>{asset.title}</small></b>
                </button>
                <span>{asset.engine}</span>
                <span>{assetKindLabel(asset.kind, t)}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel, t)}</span>
                <span>{asset.sourceOriginalName}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openLocalAdminAssetDetail(asset, setAssetDetail, t)}>{t("admin.knowledge.preview")}</button>
                  <Link href={engineManagementHref(asset.engine)}>{t("admin.openManagementPage")}</Link>
                  <button type="button" onClick={async () => {
                    setSelectedAssetId(asset.id);
                    setConsoleNotice(t("admin.knowledge.noticeRunningRecall", { name: asset.scenarioName }));
                    setConsoleNotice(await postRecallVerify(asset.engine, asset.scenarioName, t));
                  }}>{t("admin.recallVerification")}</button>
                </div>
              </div>
            ))}
            {filteredAssets.length === 0 ? (
              <div role="row" className="admin-empty-ledger-row">
                <b>{t("admin.knowledge.emptyTitle")}<small>{t("admin.knowledge.emptyBody")}</small></b>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="admin-panel admin-asset-inspector">
          <PanelHead eyebrow={t("admin.knowledge.detailInspector")} title={selectedAsset ? selectedAsset.scenarioName : t("admin.knowledge.noAssetSelected")} />
          {selectedAsset ? (
            <div className="admin-inspector-asset">
              <header>
                <span>{selectedAsset.engine}</span>
                <b>{selectedAsset.title}</b>
                <AdminStatusBadge status={selectedAsset.status} />
              </header>
              <p>{selectedAsset.content}</p>
              <dl>
                <div><dt>{t("admin.knowledge.assetType")}</dt><dd>{assetKindLabel(selectedAsset.kind, t)}</dd></div>
                <div><dt>{t("admin.knowledge.permissions")}</dt><dd>{visibilityText(assetMetadataValue(selectedAsset, "权限范围") ?? selectedAsset.visibilityLabel, t)}</dd></div>
                <div><dt>{t("admin.knowledge.sourceFile")}</dt><dd>{selectedAsset.sourceOriginalName}</dd></div>
                <div><dt>{t("admin.knowledge.owner")}</dt><dd>{selectedAsset.ownerName}</dd></div>
              </dl>
              <div className="admin-inspector-actions">
                <button type="button" onClick={async () => { setConsoleNotice(t("admin.knowledge.noticeRunningRecall", { name: selectedAsset.scenarioName })); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName, t)); }}>{t("admin.recallVerification")}</button>
                <button type="button" onClick={async () => { setConsoleNotice(t("admin.knowledge.noticeReindex", { name: selectedAsset.sourceOriginalName })); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName, t)); }}>{t("admin.knowledge.indexCheck")}</button>
                <button type="button" onClick={async () => { setConsoleNotice(t("admin.knowledge.noticePermissionRecall", { name: selectedAsset.scenarioName })); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName, t)); }}>{t("admin.knowledge.permissionReview")}</button>
                <button type="button" onClick={() => openLocalAdminAssetDetail(selectedAsset, setAssetDetail, t)}>{t("admin.quickPreview")}</button>
              </div>
            </div>
          ) : (
            <div className="admin-asset-empty-inline">
              <b>{t("admin.knowledge.noAssetsYet")}</b>
              <p>{t("admin.knowledge.noAssetsBody")}</p>
            </div>
          )}
        </aside>
      </section>

      <section className="admin-panel admin-engine-governance">
        <PanelHead eyebrow={t("admin.knowledge.engineGovernance")} title={t("admin.knowledge.engineGovernanceTitle")} action={<button type="button" onClick={async () => { setConsoleNotice(t("admin.knowledge.noticeBatchReview")); setConsoleNotice(await postBatchReview(undefined, t)); }}>{t("admin.batchReview")}</button>} />
        <div className="admin-governance-lanes">
          {ragOperationModes.map((mode) => (
            <article key={mode.id}>
              <header>
                <div>
                  <span>{frontstageText(mode.frontstageLabel, t)}</span>
                  <h2>{mode.label} {t("admin.governance")}</h2>
                </div>
                <Link href={engineManagementHref(mode.label)} className="admin-engine-open-link">{t("admin.openManagementPage")}</Link>
              </header>
              <b className="admin-governance-count">{assets.filter((asset) => asset.engine === mode.label).length}</b>
              <ul>
                {governanceStepsForEngine(mode.label, t).map((step) => <li key={step}>{step}</li>)}
              </ul>
              <div className="admin-governance-assets">
                {mode.assetViews.map((asset) => (
                  <button
                    key={asset.kind}
                    type="button"
                    data-asset-kind={asset.kind}
                    aria-label={`${mode.label} ${asset.label}`}
                    onClick={() => void openAdminAssetDetail(mode, asset, setAssetDetail, t)}
                  >
                    <span>{asset.label}</span>
                    <small>{assets.filter((record) => record.engine === mode.label && record.kind === asset.kind).length}</small>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      {assetDetail ? <AdminKnowledgeAssetOverlay detail={assetDetail} onClose={() => setAssetDetail(null)} /> : null}
    </AdminShell>
  );
}

export function AdminKnowledgeEnginePage({ engine, initialAssets = [] }: { engine: AdminEngine; initialAssets?: AdminKnowledgeAssetDetail[] }) {
  const { t } = useI18n();
  const [selectedKind, setSelectedKind] = useState("全部");
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [assetDetail, setAssetDetail] = useState<AdminAssetDetailState | null>(null);
  const mode = modeForEngine(engine);
  const kindOptions = ["全部", ...mode.assetViews.map((asset) => asset.kind)];
  const filteredAssets = initialAssets.filter((asset) => selectedKind === "全部" || asset.kind === selectedKind);
  const selectedAsset = initialAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? initialAssets[0];
  const pageConfig = enginePageConfig(engine, t);

  return (
    <AdminShell active={engineManagementHref(engine)} title={t("admin.engine.shellTitle", { engine })}>
      <AdminPageHead
        eyebrow={t("admin.engine.eyebrow")}
        title={t("admin.engine.title", { engine })}
        description={pageConfig.description}
        actions={<Link className="admin-primary-action" href="/admin/knowledge-bases">{t("admin.backToAssetOverview")}</Link>}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-engine-detail-overview" aria-label={t("admin.engine.overviewAria", { engine })}>
        {pageConfig.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value(initialAssets)}</b>
            <small>{metric.helper}</small>
          </article>
        ))}
      </section>

      <section className="admin-engine-workbench-map" aria-label={t("admin.engine.workbenchAria", { engine })}>
        <header>
          <span>{pageConfig.workbench.eyebrow}</span>
          <h2>{pageConfig.workbench.title}</h2>
          <p>{pageConfig.workbench.description}</p>
        </header>
        <div className="admin-engine-workbench-tabs">
          {pageConfig.workbench.areas.map((area, index) => (
            <button
              key={area.label}
              type="button"
              className={index === 0 ? "active" : ""}
              onClick={() => setNotice(t("admin.engine.noticeAreaActive", { area: area.label }))}
            >
              <b>{area.label}</b>
              <span>{area.description}</span>
            </button>
          ))}
        </div>
        <div className="admin-engine-control-grid">
          {pageConfig.workbench.controls.map((control) => (
            <article key={control.label}>
              <span>{control.label}</span>
              <b>{control.value}</b>
              <small>{control.helper}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-engine-workflow">
        <PanelHead eyebrow={t("admin.engine.processingChain")} title={pageConfig.workflowTitle} action={<button type="button" onClick={async () => { setNotice(t("admin.engine.noticeBatchGovernance", { engine })); setNotice(await postBatchReview(engine, t)); }}>{t("admin.engine.batchGovernance")}</button>} />
        <div className="admin-engine-stage-strip">
          {pageConfig.stages.map((stage, index) => (
            <article key={stage}>
              <i>{index + 1}</i>
              <span>{stage}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-engine-detail-layout">
        <section className="admin-panel admin-engine-asset-panel">
          <PanelHead eyebrow={t("admin.engine.assetData")} title={pageConfig.assetTitle} action={<span>{t("admin.knowledge.itemsCount", { filtered: filteredAssets.length, total: initialAssets.length })}</span>} />
          <div className="admin-asset-filterbar" aria-label={t("admin.engine.filterAria", { engine })}>
            <div>
              {kindOptions.map((kind) => (
                <button key={kind} type="button" className={selectedKind === kind ? "active" : ""} onClick={() => setSelectedKind(kind)}>
                  {kind === "全部" ? t("adminVisibility.all") : assetKindLabel(kind, t)}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-data-table admin-engine-asset-table" role="table" aria-label={t("admin.engine.tableAria", { engine })}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.engine.thAsset")}</span>
              <span>{t("admin.engine.thType")}</span>
              <span>{t("admin.engine.thSource")}</span>
              <span>{t("admin.engine.thPermissions")}</span>
              <span>{t("admin.engine.thStatus")}</span>
              <span>{t("admin.engine.thActions")}</span>
            </div>
            {filteredAssets.map((asset) => (
              <div role="row" key={asset.id} className={selectedAsset?.id === asset.id ? "active" : ""} data-engine-row={asset.id}>
                <button type="button" onClick={() => setSelectedAssetId(asset.id)}>
                  <b>{asset.title}<small>{asset.scenarioName}</small></b>
                </button>
                <span>{assetKindLabel(asset.kind, t)}</span>
                <span>{asset.sourceOriginalName}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel, t)}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openLocalAdminAssetDetail(asset, setAssetDetail, t)}>{t("admin.engine.viewData")}</button>
                  <button type="button" onClick={async () => { setNotice(t("admin.engine.noticeRunningPrimary", { action: pageConfig.primaryAction, title: asset.title })); setNotice(await postRecallVerify(engine, asset.title, t)); }}>{pageConfig.primaryAction}</button>
                </div>
              </div>
            ))}
            {filteredAssets.length === 0 ? (
              <div role="row" className="admin-empty-ledger-row">
                <b>{t("admin.engine.emptyTitle")}<small>{t("admin.engine.emptyBody", { engine })}</small></b>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="admin-panel admin-engine-inspector">
          <PanelHead eyebrow={t("admin.engine.assetInspector")} title={selectedAsset ? selectedAsset.scenarioName : t("admin.knowledge.noAssetSelected")} />
          {selectedAsset ? (
            <div className="admin-inspector-asset">
              <header>
                <span>{assetKindLabel(selectedAsset.kind, t)}</span>
                <b>{selectedAsset.title}</b>
                <AdminStatusBadge status={selectedAsset.status} />
              </header>
              <p>{selectedAsset.content}</p>
              <dl>
                {selectedAsset.metadata.map((item) => (
                  <div key={`${selectedAsset.id}-${item.label}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                ))}
              </dl>
              <div className="admin-inspector-actions">
                {pageConfig.actions.map((action) => (
                  <button key={action} type="button" onClick={async () => { setNotice(t("admin.engine.noticeRunningPrimary", { action, title: selectedAsset.title })); setNotice(await postRecallVerify(engine, selectedAsset.title, t)); }}>{action}</button>
                ))}
                <button type="button" onClick={() => openLocalAdminAssetDetail(selectedAsset, setAssetDetail, t)}>{t("admin.quickPreview")}</button>
              </div>
            </div>
          ) : (
            <div className="admin-asset-empty-inline">
              <b>{t("admin.engine.noAssetsYet", { engine })}</b>
              <p>{t("admin.engine.noAssetsBody")}</p>
            </div>
          )}
        </aside>
      </section>

      <AdminEngineSpecificConsole
        engine={engine}
        assets={initialAssets}
        selectedAsset={selectedAsset}
        pageConfig={pageConfig}
        onNotice={setNotice}
      />
      {assetDetail ? <AdminKnowledgeAssetOverlay detail={assetDetail} onClose={() => setAssetDetail(null)} /> : null}
    </AdminShell>
  );
}

function AdminEngineSpecificConsole({
  engine,
  assets,
  selectedAsset,
  pageConfig,
  onNotice
}: {
  engine: AdminEngine;
  assets: AdminKnowledgeAssetDetail[];
  selectedAsset?: AdminKnowledgeAssetDetail;
  pageConfig: ReturnType<typeof enginePageConfig>;
  onNotice: (message: string) => void;
}) {
  if (engine === "Naive RAG") {
    return <AdminNaiveRagConsole assets={assets} selectedAsset={selectedAsset} onNotice={onNotice} />;
  }
  if (engine === "GraphRAG") {
    return <AdminGraphRagConsole assets={assets} selectedAsset={selectedAsset} onNotice={onNotice} />;
  }
  return <AdminGbrainConsole assets={assets} selectedAsset={selectedAsset} pageConfig={pageConfig} onNotice={onNotice} />;
}

function AdminNaiveRagConsole({
  assets,
  selectedAsset,
  onNotice
}: {
  assets: AdminKnowledgeAssetDetail[];
  selectedAsset?: AdminKnowledgeAssetDetail;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const chunkAssets = assets.filter((asset) => asset.kind === "chunk");
  const vectorAssets = assets.filter((asset) => asset.kind === "embedding");
  const citationAssets = assets.filter((asset) => asset.kind === "citation");
  return (
    <section className="admin-panel admin-engine-specific-console admin-naive-console">
      <PanelHead eyebrow={t("admin.naiveConsole.eyebrow")} title={t("admin.naiveConsole.title")} action={<button type="button" onClick={async () => { onNotice(t("admin.naiveConsole.noticeStart")); onNotice(await postRecallVerify("Naive RAG", "Policy, contract, and report highlights", t)); }}>{t("admin.naiveConsole.newExperiment")}</button>} />
      <div className="admin-naive-layout">
        <section className="admin-engine-subpanel">
          <header>
            <span>{t("admin.naiveConsole.chunkBrowserHeader")}</span>
            <b>{t("admin.naiveConsole.chunks", { count: chunkAssets.length || assets.length })}</b>
          </header>
          <div className="admin-chunk-table" role="table" aria-label={t("admin.naiveConsole.chunkBrowserAria")}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.naiveConsole.thChunk")}</span>
              <span>{t("admin.naiveConsole.thSource")}</span>
              <span>{t("admin.naiveConsole.thScope")}</span>
              <span>{t("admin.naiveConsole.thStatus")}</span>
              <span>{t("admin.naiveConsole.thActions")}</span>
            </div>
            {(chunkAssets.length ? chunkAssets : assets).map((asset, index) => (
              <div role="row" key={asset.id} data-chunk-row={asset.id}>
                <b>{asset.title}<small>{truncateAdminText(asset.content, 72)}</small></b>
                <span>{asset.sourceOriginalName}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel, t)}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={async () => { onNotice(t("admin.naiveConsole.noticeCitationSpotCheck", { title: asset.title })); onNotice(await postRecallVerify("Naive RAG", asset.title, t)); }}>{t("admin.naiveConsole.citationSpotCheck")}</button>
                  <button type="button" onClick={() => onNotice(t("admin.naiveConsole.noticeChunkDisabled", { index: index + 1 }))}>{t("admin.naiveConsole.disable")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-engine-subpanel admin-retrieval-lab">
          <header>
            <span>{t("admin.naiveConsole.topKExperiment")}</span>
            <b>{selectedAsset?.scenarioName ?? t("admin.naiveConsole.currentKnowledgeBase")}</b>
          </header>
          <label>
            <span>{t("admin.naiveConsole.tryAQuestion")}</span>
            <input readOnly value={selectedAsset ? t("admin.naiveConsole.whatQuestions", { name: selectedAsset.scenarioName }) : t("admin.naiveConsole.enterQuestion")} />
          </label>
          <div className="admin-retrieval-controls">
            <div><span>{t("admin.naiveConsole.topK")}</span><b>8</b></div>
            <div><span>{t("admin.naiveConsole.threshold")}</span><b>0.72</b></div>
            <div><span>{t("admin.naiveConsole.rerank")}</span><b>{t("admin.naiveConsole.on")}</b></div>
          </div>
          <button type="button" onClick={async () => { onNotice(t("admin.naiveConsole.noticeTopK")); onNotice(await postRecallVerify("Naive RAG", "Key policies, clauses, and processes", t)); }}>{t("admin.naiveConsole.runRetrieval")}</button>
        </aside>

        <section className="admin-engine-subpanel admin-vector-batches">
          <header>
            <span>{t("admin.naiveConsole.vectorBatches")}</span>
            <b>{t("admin.naiveConsole.batches", { count: vectorAssets.length || assets.length })}</b>
          </header>
          <div>
            {(vectorAssets.length ? vectorAssets : assets).slice(0, 4).map((asset) => (
              <article key={`vector-${asset.id}`}>
                <span>{asset.sourceOriginalName}</span>
                <b>{asset.metric}</b>
                <small>{t("admin.naiveConsole.embeddingRegistered")}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-citation-audit">
          <header>
            <span>{t("admin.naiveConsole.citationEvidence")}</span>
            <b>{t("admin.naiveConsole.entries", { count: citationAssets.length || assets.length })}</b>
          </header>
          {(citationAssets.length ? citationAssets : assets).slice(0, 3).map((asset) => (
            <article key={`citation-${asset.id}`}>
              <b>{asset.title}</b>
              <p>{truncateAdminText(asset.content, 120)}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function AdminGraphRagConsole({
  assets,
  selectedAsset,
  onNotice
}: {
  assets: AdminKnowledgeAssetDetail[];
  selectedAsset?: AdminKnowledgeAssetDetail;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const graphAssets = assets.length ? assets : selectedAsset ? [selectedAsset] : [];
  const primary = selectedAsset ?? graphAssets[0];
  return (
    <section className="admin-panel admin-engine-specific-console admin-graphrag-console">
      <PanelHead eyebrow={t("admin.graphRagConsole.eyebrow")} title={t("admin.graphRagConsole.title")} action={<button type="button" onClick={async () => { onNotice(t("admin.graphRagConsole.noticeStart")); onNotice(await postRecallVerify("GraphRAG", "Key entities and relationships", t)); }}>{t("admin.graphRagConsole.graphReview")}</button>} />
      <div className="admin-graphrag-layout">
        <section className="admin-graph-workbench">
          <header>
            <span>{t("admin.graphRagConsole.graphCanvas")}</span>
            <b>{primary?.scenarioName ?? t("admin.graphRagConsole.relationshipKnowledgeBase")}</b>
          </header>
          <div className="admin-graph-stage" aria-label={t("admin.graphRagConsole.graphCanvasAria")}>
            <svg viewBox="0 0 720 360" role="img" aria-label={t("admin.graphRagConsole.graphAria")}>
              <line x1="165" y1="176" x2="360" y2="90" />
              <line x1="165" y1="176" x2="360" y2="250" />
              <line x1="360" y1="90" x2="560" y2="176" />
              <line x1="360" y1="250" x2="560" y2="176" />
              <g data-graph-node={primary?.scenarioName ?? "Primary entity"} transform="translate(165 176)">
                <circle r="48" className="main" />
                <text textAnchor="middle" y="4">{graphNodeLabel(primary?.scenarioName ?? t("admin.graphRagConsole.businessEntity"))}</text>
              </g>
              <g data-graph-node="Risk signal" transform="translate(360 90)">
                <circle r="38" className="risk" />
                <text textAnchor="middle" y="4">{t("admin.graphRagConsole.riskSignal")}</text>
              </g>
              <g data-graph-node="Evidence source" transform="translate(360 250)">
                <circle r="38" />
                <text textAnchor="middle" y="4">{t("admin.graphRagConsole.evidenceSource")}</text>
              </g>
              <g data-graph-node="Next action" transform="translate(560 176)">
                <circle r="42" className="action" />
                <text textAnchor="middle" y="4">{t("admin.graphRagConsole.nextAction")}</text>
              </g>
            </svg>
          </div>
        </section>

        <section className="admin-engine-subpanel admin-edge-table">
          <header>
            <span>{t("admin.graphRagConsole.edgeTable")}</span>
            <b>{t("admin.graphRagConsole.candidateEdges", { count: graphAssets.length || 1 })}</b>
          </header>
          <div role="table" aria-label={t("admin.graphRagConsole.edgeTableAria")}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.graphRagConsole.thFrom")}</span>
              <span>{t("admin.graphRagConsole.thRelationship")}</span>
              <span>{t("admin.graphRagConsole.thTo")}</span>
              <span>{t("admin.graphRagConsole.thConfidence")}</span>
            </div>
            {graphAssets.map((asset, index) => (
              <div role="row" key={`edge-${asset.id}`}>
                <span>{graphNodeLabel(asset.scenarioName, t("admin.graphRagConsole.entity"))}</span>
                <b>{index % 2 === 0 ? t("admin.graphRagConsole.affects") : t("admin.graphRagConsole.relatesTo")}</b>
                <span>{assetKindLabel(asset.kind, t)}</span>
                <strong>{Math.max(72, 93 - index * 6)}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-path-query">
          <header>
            <span>{t("admin.graphRagConsole.multiHopPathQuery")}</span>
            <b>{t("admin.graphRagConsole.localGlobalDrift")}</b>
          </header>
          <label>
            <span>{t("admin.graphRagConsole.pathQuestion")}</span>
            <input readOnly value={primary ? t("admin.graphRagConsole.howDoRisks", { name: primary.scenarioName }) : t("admin.graphRagConsole.enterPathQuestion")} />
          </label>
          <div className="admin-path-result">
            <span>{graphNodeLabel(primary?.scenarioName ?? t("admin.graphRagConsole.customer"))}</span>
            <i />
            <span>{t("admin.graphRagConsole.riskSignal")}</span>
            <i />
            <span>{t("admin.graphRagConsole.evidenceSource")}</span>
            <i />
            <span>{t("admin.graphRagConsole.nextAction")}</span>
          </div>
          <button type="button" onClick={async () => { onNotice(t("admin.graphRagConsole.noticePathQuery")); onNotice(await postRecallVerify("GraphRAG", "Relationships among customers, owners, and suppliers", t)); }}>{t("admin.graphRagConsole.runPathQuery")}</button>
        </section>

        <section className="admin-engine-subpanel admin-review-queue">
          <header>
            <span>{t("admin.graphRagConsole.lowConfidenceQueue")}</span>
            <b>{t("admin.graphRagConsole.items", { count: Math.max(1, graphAssets.filter((asset) => asset.kind === "review").length) })}</b>
          </header>
          {(graphAssets.length ? graphAssets : []).slice(0, 4).map((asset) => (
            <article key={`review-${asset.id}`}>
              <b>{asset.title}</b>
              <p>{truncateAdminText(asset.content, 96)}</p>
              <button type="button" onClick={async () => { onNotice(t("admin.graphRagConsole.noticeReview", { title: asset.title })); onNotice(await postRecallVerify("GraphRAG", asset.title, t)); }}>{t("admin.graphRagConsole.review")}</button>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function AdminGbrainConsole({
  assets,
  selectedAsset,
  pageConfig,
  onNotice
}: {
  assets: AdminKnowledgeAssetDetail[];
  selectedAsset?: AdminKnowledgeAssetDetail;
  pageConfig: ReturnType<typeof enginePageConfig>;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const wikiAssets = assets.length ? assets : selectedAsset ? [selectedAsset] : [];
  return (
    <section className="admin-panel admin-engine-specific-console admin-gbrain-console">
      <PanelHead eyebrow={t("admin.gbrainConsole.eyebrow")} title={t("admin.gbrainConsole.title")} action={<button type="button" onClick={async () => { onNotice(t("admin.gbrainConsole.noticeStart")); onNotice(await postRecallVerify("Gbrain", "Knowledge page highlights", t)); }}>{t("admin.gbrainConsole.publishReview")}</button>} />
      <div className="admin-gbrain-layout">
        <section className="admin-engine-subpanel admin-page-tree">
          <header>
            <span>{t("admin.gbrainConsole.pageTree")}</span>
            <b>{t("admin.gbrainConsole.pages", { count: wikiAssets.length || 1 })}</b>
          </header>
          <div className="admin-tree-list" role="tree" aria-label={t("admin.gbrainConsole.pageTreeAria")}>
            {wikiAssets.map((asset) => (
              <article key={asset.id} role="treeitem" data-wiki-page={asset.id}>
                <b>{asset.scenarioName}</b>
                <span>{asset.title}</span>
                <small>{asset.sourceOriginalName} · {visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel, t)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-fact-governance">
          <header>
            <span>{t("admin.gbrainConsole.factCardGovernance")}</span>
            <b>{t("admin.gbrainConsole.factMemory")}</b>
          </header>
          {(wikiAssets.length ? wikiAssets : []).slice(0, 4).map((asset, index) => (
            <article key={`fact-${asset.id}`}>
              <span>{t("admin.gbrainConsole.fact", { index: index + 1 })}</span>
              <b>{truncateAdminText(asset.content, 76)}</b>
              <small>{t("admin.gbrainConsole.sourceLabel", { name: asset.sourceOriginalName })}</small>
              <button type="button" onClick={async () => { onNotice(t("admin.gbrainConsole.noticeFactSpotCheck", { title: asset.title })); onNotice(await postRecallVerify("Gbrain", asset.title, t)); }}>{t("admin.gbrainConsole.spotCheck")}</button>
            </article>
          ))}
        </section>

        <section className="admin-engine-subpanel admin-link-map">
          <header>
            <span>{t("admin.gbrainConsole.topicLinks")}</span>
            <b>{t("admin.gbrainConsole.directoriesAndClusters")}</b>
          </header>
          <div className="admin-link-network">
            {pageConfig.stages.slice(1, 5).map((stage) => <span key={stage}>{stage}</span>)}
          </div>
          <button type="button" onClick={async () => { onNotice(t("admin.gbrainConsole.noticeValidate")); onNotice(await postRecallVerify("Gbrain", "Page directories and links", t)); }}>{t("admin.gbrainConsole.rebuildDirectory")}</button>
        </section>

        <section className="admin-engine-subpanel admin-source-map">
          <header>
            <span>{t("admin.gbrainConsole.sourceMapping")}</span>
            <b>{t("admin.gbrainConsole.sources", { count: new Set(wikiAssets.map((asset) => asset.sourceOriginalName)).size })}</b>
          </header>
          {wikiAssets.map((asset) => (
            <article key={`source-${asset.id}`}>
              <b>{asset.sourceOriginalName}</b>
              <p>{asset.title} / {asset.scenarioName}</p>
              <small>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel, t)}</small>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function scopeToEngine(scope: string): string {
  if (scope === "知识百科") return "Gbrain";
  if (scope === "关系图谱") return "GraphRAG";
  return "Naive RAG";
}

export function AdminStrategiesPage({
  initialStrategies = [],
  initialEvaluations = []
}: {
  initialStrategies?: Array<{ id: string; name: string; scope: string; impact: string; controls: string[] }>;
  initialEvaluations?: Array<{ profile: string; evidence: number; score: string; latency: string }>;
} = {}) {
  const { t } = useI18n();
  const profiles = initialStrategies.length
    ? initialStrategies
    : strategyProfiles.map((p) => ({ id: p.id, name: p.name, scope: p.scope, impact: p.impact, controls: p.controls }));
  const evaluations = initialEvaluations.length
    ? initialEvaluations
    : evaluationRows.map((r) => ({ profile: r.profile, evidence: r.evidence, score: String(r.score), latency: r.latency }));
  const [notice, setNotice] = useState("");
  const primaryProfile = profiles[0];
  const profileMode = ragOperationModes.find((mode) => mode.label === primaryProfile?.scope);
  const runStrategyVerify = async (scope: string, label: string) => {
    const engine = scopeToEngine(scope);
    setNotice(t("admin.strategies.noticeVerify", { label, engine }));
    setNotice(await postRecallVerify(engine, label, t));
  };
  const runAllVerify = async () => {
    setNotice(t("admin.strategies.noticeAll"));
    const results = await Promise.all(profiles.map(async (p) => `${p.name}: ${await postRecallVerify(scopeToEngine(p.scope), p.name, t)}`));
    setNotice(results.join(" | "));
  };
  return (
    <AdminShell active="/admin/strategies" title={t("admin.strategies.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.strategies.eyebrow")}
        title={t("admin.strategies.title")}
        description={t("admin.strategies.description")}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-strategy-console" aria-label={t("admin.strategies.consoleAria")}>
        <section className="admin-panel admin-strategy-matrix">
          <PanelHead eyebrow={t("admin.strategies.policyMatrix")} title={t("admin.strategies.policyMatrixTitle")} action={<button type="button" onClick={() => runAllVerify()}>{t("admin.strategies.newPolicy")}</button>} />
          <div className="admin-data-table admin-strategy-table" role="table" aria-label={t("admin.strategies.policyMatrixAria")}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.strategies.thPolicy")}</span>
              <span>{t("admin.strategies.thEngine")}</span>
              <span>{t("admin.strategies.thWorkspaceBinding")}</span>
              <span>{t("admin.strategies.thControls")}</span>
              <span>{t("admin.strategies.thStatus")}</span>
              <span>{t("admin.strategies.thActions")}</span>
            </div>
            {profiles.map((profile) => {
              const mode = ragOperationModes.find((item) => item.label === profile.scope);
              return (
                <div role="row" key={profile.id} data-strategy-id={profile.id}>
                  <b>{profile.name}<small>{profile.impact}</small></b>
                  <span>{frontstageText(profile.scope, t)}</span>
                  <span>{frontstageText(mode?.frontstageLabel ?? "公司大脑", t)}</span>
                  <span>{profile.controls.join(" / ")}</span>
                  <AdminStatusBadge status="启用中" />
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => runStrategyVerify(profile.scope, profile.name)}>{t("admin.strategies.editParameters")}</button>
                    <button type="button" onClick={() => runStrategyVerify(profile.scope, profile.name)}>{t("admin.strategies.regressionCheck")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="admin-panel admin-strategy-parameter-panel">
          <PanelHead eyebrow={t("admin.strategies.parameters")} title={primaryProfile.name} action={<AdminStatusBadge status="启用中" />} />
          <p>{primaryProfile.impact}</p>
          <div className="admin-strategy-parameter-list">
            {(profileMode?.parameters ?? []).slice(0, 5).map((parameter) => (
              <article key={parameter.key}>
                <span>{parameter.label}</span>
                <b>{String(parameter.value)}</b>
                <small>{parameter.description}</small>
              </article>
            ))}
          </div>
          <div className="admin-strategy-rollout">
            <span>{t("admin.strategies.workspaceBinding")}</span>
            <b>{frontstageText(profileMode?.frontstageLabel ?? "公司大脑", t)}</b>
            <p>{profileMode?.reviewGate ?? t("admin.strategies.reviewGateFallback")}</p>
          </div>
        </aside>
      </section>

      <section className="admin-panel admin-strategy-regression">
        <PanelHead eyebrow={t("admin.strategies.regressionChecks")} title={t("admin.strategies.regressionChecksTitle")} action={<button type="button" onClick={() => runAllVerify()}>{t("admin.strategies.runAllChecks")}</button>} />
        <div className="admin-data-table admin-strategy-regression-table" role="table" aria-label={t("admin.strategies.regressionAria")}>
          <div role="row" className="admin-table-head">
            <span>{t("admin.strategies.thEvaluationSet")}</span>
            <span>{t("admin.strategies.thApplicablePolicy")}</span>
            <span>{t("admin.strategies.thRealEvidence")}</span>
            <span>{t("admin.strategies.thReadiness")}</span>
            <span>{t("admin.strategies.thActions")}</span>
          </div>
          {evaluations.map((row) => {
            const scope = profiles.find((p) => p.name === row.profile)?.scope ?? "文档证据";
            return (
              <div role="row" key={row.profile}>
                <b>{row.profile}<small>{t("admin.strategies.evalCovers")}</small></b>
                <span>{row.profile}</span>
                <span>{t("admin.strategies.evidenceItems", { count: row.evidence })}</span>
                <span>{row.score} · {row.latency}</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => runStrategyVerify(scope, row.profile)}>{t("admin.strategies.viewSample")}</button>
                  <button type="button" onClick={() => runStrategyVerify(scope, row.profile)}>{t("admin.strategies.reverify")}</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}

export function AdminPipelinesPage({ initialRequests = [] }: { initialRequests?: AdminIntakeRequest[] }) {
  const { t } = useI18n();
  const [requests, setRequests] = useState(() => resolveAdminRequests(initialRequests));
  const actionableRequests = requests.filter((request) => isActionableAdminRequestStatus(request.status));
  const [selectedRequestId, setSelectedRequestId] = useState(() => actionableRequests[0]?.id ?? requests[0]?.id ?? "");
	  const [pendingAction, setPendingAction] = useState("");
	  const [actionMessage, setActionMessage] = useState("");
	  const [filePreview, setFilePreview] = useState<AdminFilePreviewState | null>(null);
	  const [assetDetail, setAssetDetail] = useState<AdminAssetDetailState | null>(null);
	  const activeRequest = requests.find((request) => request.id === selectedRequestId) ?? actionableRequests[0] ?? requests[0];
  const recommendedEngines = requestRecommendedEngines(activeRequest);
  const [selectedEngine, setSelectedEngine] = useState<AdminEngine>(() => requestSelectedEngine(activeRequest));
  const frontstageMapping = requestFrontstageMapping(activeRequest, t);
  const selectedMode = ragOperationModes.find((mode) => mode.label === selectedEngine) ?? ragOperationModes[0];
  const selectedIsRecommended = recommendedEngines.includes(selectedEngine);
  const [engineParameterValues, setEngineParameterValues] = useState<Record<string, string>>(() => defaultParameterValues(selectedMode));
  const [strategyExpanded, setStrategyExpanded] = useState(false);
  const [ingestionRun, setIngestionRun] = useState<IngestionRun | null>(null);
  const activeIngestionRun = ingestionRun?.requestId === activeRequest?.id ? ingestionRun : null;
  const processMode = ragOperationModes.find((mode) => mode.label === activeIngestionRun?.engine) ?? selectedMode;
  const showIngestedAssets = activeRequest?.status === "已发布" || activeIngestionRun?.status === "completed";
  const canOperateActiveRequest = Boolean(activeRequest?.scenarioId);
  const documentRecords = activeRequest.storedFiles?.length
    ? activeRequest.storedFiles.map((file) => ({ name: file.originalName, storedFile: file }))
    : activeRequest.files.map((name) => ({ name, storedFile: null }));

  useEffect(() => {
    setSelectedEngine(requestSelectedEngine(activeRequest));
    setStrategyExpanded(false);
    setIngestionRun(null);
    setActionMessage("");
  }, [activeRequest?.id]);

  useEffect(() => {
    setEngineParameterValues(defaultParameterValues(selectedMode));
  }, [selectedMode.id]);

  useEffect(() => {
    if (activeRequest && (isActionableAdminRequestStatus(activeRequest.status) || ingestionRun?.requestId === activeRequest.id)) return;
    const nextRequestId = actionableRequests[0]?.id ?? requests[0]?.id ?? "";
    if (nextRequestId && nextRequestId !== selectedRequestId) setSelectedRequestId(nextRequestId);
  }, [activeRequest, actionableRequests, ingestionRun?.requestId, requests, selectedRequestId]);

  async function runAdminAction(action: "approve" | "reject") {
    if (!activeRequest || !canOperateActiveRequest || pendingAction) return;
    if (action === "approve" && !strategyExpanded) {
      setActionMessage(t("admin.pipelines.selectEngineFirst"));
      return;
    }
    setPendingAction(action);
    setActionMessage("");
    if (action === "approve") {
      setIngestionRun({
        requestId: activeRequest.id,
        engine: selectedEngine,
        status: "running",
        currentStep: 0,
        message: t("admin.pipelines.runningStage", { stage: selectedMode.runtimeFlow[0]?.stage ?? "ingest" })
      });
      for (let index = 0; index < selectedMode.runtimeFlow.length; index += 1) {
        setIngestionRun({
          requestId: activeRequest.id,
          engine: selectedEngine,
          status: "running",
          currentStep: index,
          message: t("admin.pipelines.runningStage", { stage: selectedMode.runtimeFlow[index].stage })
        });
        await delay(620);
      }
    }
    try {
      const response = await fetch(`/api/platform/admin/requests/${activeRequest.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          selected_engine: selectedEngine,
          strategy_parameters: action === "approve" ? engineParameterValues : undefined,
          reason: action === "reject" ? "The submission is incomplete; a business brief and the original files are required." : undefined
        })
      });
      if (!response.ok) throw new Error("admin action failed");
      const body = await response.json();
      setRequests((current) => current.map((request) => request.id === activeRequest.id ? body.request : request));
      if (action === "approve") {
        setIngestionRun({
          requestId: activeRequest.id,
          engine: selectedEngine,
          status: "completed",
          currentStep: selectedMode.runtimeFlow.length - 1,
          message: t("admin.pipelines.ingestComplete")
        });
      }
      setActionMessage(action === "approve" ? t("admin.pipelines.ingestConfirmed") : t("admin.pipelines.returned"));
    } catch {
      if (action === "approve") {
        setIngestionRun((current) => current ? { ...current, status: "failed", message: t("admin.pipelines.ingestFailed") } : current);
      }
      setActionMessage(t("admin.pipelines.actionFailed"));
    } finally {
      setPendingAction("");
    }
  }

  async function openFilePreview(fileName: string, storedFile: AdminStoredFile | null) {
    const previewMeta = resolveAdminFilePreview(fileName);
    if (!storedFile) {
      setFilePreview({
        title: fileName,
        kind: previewMeta.kind,
        label: previewMeta.label,
        url: "",
        status: "error",
        message: t("admin.pipelines.noUploadRecord")
      });
      return;
    }
    const url = `/api/platform/admin/files/${encodeURIComponent(storedFile.id)}/preview`;
    setFilePreview({ title: fileName, kind: previewMeta.kind, label: previewMeta.label, url, status: "loading" });
    if (previewMeta.kind === "PDF") {
      setFilePreview({ title: fileName, kind: previewMeta.kind, label: previewMeta.label, url, status: "ready" });
      return;
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("preview failed");
      const text = await response.text();
      setFilePreview({ title: fileName, kind: previewMeta.kind, label: previewMeta.label, url, status: "ready", text });
    } catch {
      setFilePreview({
        title: fileName,
        kind: previewMeta.kind,
        label: previewMeta.label,
        url,
        status: "error",
        message: t("admin.pipelines.fileUnavailable")
      });
    }
  }

  function updateEngineParameter(parameter: RagParameter, value: string) {
    setEngineParameterValues((current) => ({ ...current, [parameter.key]: value }));
  }

  function handlePipelineAction(action: string) {
    if (action === "查看资料") {
      const record = documentRecords.find(({ name }) => resolveAdminFilePreview(name).previewable) ?? documentRecords[0];
      if (!record) {
        setActionMessage(t("admin.pipelines.noViewableFiles"));
        return;
      }
      void openFilePreview(record.name, record.storedFile);
      return;
    }
    if (action === "配置引擎策略") {
      setActionMessage(t("admin.pipelines.policySaved", { engine: selectedEngine }));
      return;
    }
    setActionMessage(t("admin.pipelines.materialRegistered"));
  }

  return (
    <AdminShell active="/admin/pipelines" title={t("admin.pipelines.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.pipelines.eyebrow")}
        title={t("admin.pipelines.title")}
        description={t("admin.pipelines.description")}
        actions={<button type="button" className="admin-primary-action">{t("admin.pipelines.batchProcessPending")}</button>}
        compact
      />

      <section className="admin-pipeline-layout focused">
        <section className="admin-intake-selector">
          <PanelHead
            eyebrow={t("admin.pipelines.pendingQueue")}
            title={t("admin.pipelines.submissionsNeedProcessing", { count: actionableRequests.length })}
            action={<button type="button">{t("admin.pipelines.sortByTime")}</button>}
          />
          <div className="admin-intake-table" role="table" aria-label={t("admin.pipelines.pendingAria")}>
            <div className="admin-intake-table-head" role="row">
              <span>{t("admin.pipelines.thStatus")}</span>
              <span>{t("admin.pipelines.thSubmission")}</span>
              <span>{t("admin.pipelines.thRequester")}</span>
              <span>{t("admin.pipelines.thScope")}</span>
              <span>{t("admin.pipelines.thFiles")}</span>
              <span>{t("admin.pipelines.thSuggestedEngine")}</span>
              <span>{t("admin.pipelines.thSubmitted")}</span>
              <span>{t("admin.pipelines.thActions")}</span>
            </div>
            {actionableRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                role="row"
                className={`admin-intake-row ${request.id === activeRequest.id ? "active" : ""}`}
                onClick={() => setSelectedRequestId(request.id)}
              >
                <span role="cell" className="admin-intake-status">{statusText(request.status, t)}</span>
                <b role="cell">{request.scenarioName}</b>
                <span role="cell">{request.requester}</span>
                <span role="cell">{visibilityText(request.visibility, t)}</span>
                <span role="cell">{t("admin.pipelines.filesCount", { count: request.files.length })}</span>
                <span role="cell" className="admin-intake-engine">{requestRecommendedEngines(request).join(" / ")}</span>
                <span role="cell">{request.submittedAt}</span>
                <strong role="cell">{t("admin.pipelines.process")}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-active-request workbench">
          <PanelHead eyebrow={t("admin.pipelines.scenarioSubmitted")} title={activeRequest.scenarioName} action={<AdminStatusBadge status={activeRequest.status} />} />

          <div className="admin-scenario-brief">
            <div className="admin-scenario-main">
              <span>{t("admin.pipelines.scenario")}</span>
              <h3>{activeRequest.scenarioName}</h3>
              <p>{activeRequest.requestedOutcome}</p>
            </div>
            <dl>
              <div><dt>{t("admin.pipelines.requester")}</dt><dd>{activeRequest.requester}</dd></div>
              <div><dt>{t("admin.pipelines.publishingScope")}</dt><dd>{visibilityText(activeRequest.visibility, t)}</dd></div>
              <div><dt>{t("admin.pipelines.submitted")}</dt><dd>{activeRequest.submittedAt}</dd></div>
              <div><dt>{t("admin.pipelines.suggestedEngine")}</dt><dd>{recommendedEngines.join(" / ")}</dd></div>
              <div><dt>{t("admin.pipelines.knowledgeObjects")}</dt><dd>{activeRequest.knowledgeObjectCount ? `${activeRequest.knowledgeObjectCount}` : t("admin.pipelines.notIngested")}</dd></div>
            </dl>
            <strong>{activeRequest.permissionImpact}</strong>
          </div>

          <div className="admin-uploaded-documents">
            <PanelHead eyebrow={t("admin.pipelines.uploadedFiles")} title={t("admin.pipelines.verifyFilesFirst")} action={<button type="button">{t("admin.pipelines.expandAllPreviews")}</button>} />
            <div className="admin-document-grid">
              {documentRecords.map(({ name, storedFile }, index) => {
                const preview = resolveAdminFilePreview(name);
                const state = storedFile?.originalState ?? "temporary";
                return (
                  <article key={name} className={`${preview.previewable ? "previewable" : ""} ${state}`}>
                    <div className="admin-file-icon" data-kind={preview.kind}>{preview.kind}</div>
                    <div>
                      <b>{name}</b>
                      <span>{preview.label} · {index === 0 ? t("admin.pipelines.businessBrief") : t("admin.pipelines.pendingParse")}</span>
                      <small>{storedFile?.retentionReason ?? (preview.previewable ? t("admin.pipelines.retentionOnlinePreview") : t("admin.pipelines.retentionUnpack"))}</small>
                      <div className="admin-retention-row">
                        <em>{fileStateLabel(storedFile, t)}</em>
                        <em>{retentionPolicyLabel(storedFile?.retentionPolicy, t)}</em>
                        <em>{fileAccessLabel(storedFile, t)}</em>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openFilePreview(name, storedFile)}
                    >
                      {preview.previewable ? t("admin.pipelines.preview") : t("admin.pipelines.unpack")}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="admin-engine-workbench">
            <header className="admin-engine-workbench-head">
              <div>
                <span>{t("admin.pipelines.enginePolicy")}</span>
                <h3>{t("admin.pipelines.enginePolicyTitle")}</h3>
              </div>
              <small>{selectedIsRecommended ? t("admin.pipelines.withinRecommendation") : t("admin.pipelines.manualSelection")}</small>
            </header>
            <p>{t("admin.pipelines.enginePolicyBody")}</p>

            <div className="admin-engine-selector">
              {ragOperationModes.map((mode) => {
                const engine = mode.label as AdminEngine;
                const recommended = recommendedEngines.includes(engine);
                return (
                <button
                  type="button"
                    key={mode.id}
                    className={strategyExpanded && selectedEngine === engine ? "active" : ""}
                    aria-expanded={strategyExpanded && selectedEngine === engine}
                    disabled={Boolean(pendingAction)}
                  onClick={() => {
                    setSelectedEngine(engine);
                    setStrategyExpanded(true);
                      setActionMessage(t("admin.pipelines.selectedEngineNotice", { engine, mapping: frontstageText(mode.frontstageLabel, t) }));
                  }}
                >
                    <b>{mode.label}</b>
                    <span>{mode.service}</span>
                    <small>{recommended ? t("admin.pipelines.recommended") : t("admin.pipelines.optional")} · {t("admin.pipelines.workspaceMapping", { mapping: frontstageText(mode.frontstageLabel, t) })}</small>
                </button>
                );
              })}
            </div>

            {strategyExpanded ? (
              <section className="admin-parameter-panel admin-parameter-panel-expanded">
                <header>
                  <span>{t("admin.pipelines.configurableParameters")}</span>
                  <h4>{t("admin.pipelines.engineParameters", { engine: selectedMode.label })}</h4>
                  <p>{selectedMode.storage}</p>
                </header>
                <div className="admin-parameter-grid">
                  {selectedMode.parameters.map((parameter) => {
                    const value = engineParameterValues[parameter.key] ?? String(parameter.value);
                    return (
                      <label key={parameter.key} className="admin-parameter-field">
                        <span>
                          <b>{parameter.label}</b>
                          <small>{parameter.description}</small>
                        </span>
                        {parameter.type === "select" ? (
                          <select value={value} onChange={(event) => updateEngineParameter(parameter, event.target.value)}>
                            {parameter.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : null}
                        {parameter.type === "number" ? (
                          <div className="admin-number-input">
                            <input
                              type="number"
                              min={parameter.min}
                              max={parameter.max}
                              step={String(parameter.value).includes(".") ? "0.01" : "1"}
                              value={value}
                              onChange={(event) => updateEngineParameter(parameter, event.target.value)}
                            />
                            {parameter.unit ? <em>{parameter.unit}</em> : null}
                          </div>
                        ) : null}
                        {parameter.type === "boolean" ? (
                          <button
                            type="button"
                            className={`admin-toggle-control ${value === "true" ? "on" : ""}`}
                            onClick={() => updateEngineParameter(parameter, value === "true" ? "false" : "true")}
                            aria-pressed={value === "true"}
                          >
                            {value === "true" ? t("status.enabled") : t("status.disabled")}
                          </button>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="admin-engine-collapsed">
                <b>{t("admin.pipelines.selectEngineHint")}</b>
                <p>{t("admin.pipelines.selectEngineHintBody")}</p>
              </div>
            )}
          </div>

          {activeIngestionRun ? (
            <section className={`admin-ingestion-progress ${activeIngestionRun.status}`}>
              <header>
                <div>
                  <span>{t("admin.pipelines.ingestProgress")}</span>
                  <h3>{t("admin.pipelines.processingFiles", { engine: processMode.label })}</h3>
                  <p>{activeIngestionRun.message}</p>
                </div>
                <AdminStatusBadge status={activeIngestionRun.status === "completed" ? "已完成" : activeIngestionRun.status === "failed" ? "阻塞" : "处理中"} />
              </header>
              <div className="admin-process-track">
                {processMode.runtimeFlow.map((step, index) => {
                  const state = activeIngestionRun.status === "failed" && index === activeIngestionRun.currentStep
                    ? "failed"
                    : index < activeIngestionRun.currentStep || activeIngestionRun.status === "completed"
                      ? "done"
                      : index === activeIngestionRun.currentStep
                        ? "running"
                        : "pending";
                  return (
                    <article key={step.stage} className={state}>
                      <i>{index + 1}</i>
                      <div>
                        <b>{step.stage}</b>
                        <span>{step.description}</span>
                        <small>{t("admin.pipelines.artifactLabel", { artifact: step.artifact })}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showIngestedAssets ? (
            <section className="admin-ingested-assets">
	              <PanelHead eyebrow={t("admin.pipelines.knowledgeAssets")} title={t("admin.pipelines.viewableAssets", { engine: processMode.label })} action={<Link href="/admin/knowledge-bases">{t("admin.openAssetLedger")}</Link>} />
	              <div className="admin-asset-view-grid">
	                {processMode.assetViews.map((asset) => (
	                  <article key={asset.kind} className="admin-asset-view-card">
	                    <small>{asset.metric}</small>
	                    <b>{asset.label}</b>
	                    <p>{asset.description}</p>
	                    <button
	                      type="button"
	                      data-asset-kind={asset.kind}
	                      aria-label={`${processMode.label} ${asset.label}`}
	                      onClick={() => void openAdminAssetDetail(processMode, asset, setAssetDetail, t)}
	                    >
	                      {asset.action}
	                    </button>
	                  </article>
	                ))}
	              </div>
	            </section>
          ) : null}

          <div className="admin-decision-bar sticky">
            {activeRequest.actions.map((action) => {
              const approve = action === "确认入库";
              const reject = action === "退回补充";
              const actionable = approve || reject;
              return (
                <button
                  key={action}
                  type="button"
                  disabled={Boolean(pendingAction) || (actionable && !canOperateActiveRequest)}
                  onClick={() => {
                    if (approve) void runAdminAction("approve");
                    else if (reject) void runAdminAction("reject");
                    else handlePipelineAction(action);
                  }}
                >
                  {pendingAction && actionable ? t("admin.pipelines.processing") : action === "配置引擎策略" ? t("admin.pipelines.savePolicyConfiguration") : actionText(action, t)}
                </button>
              );
            })}
          </div>
          {actionMessage && <p className="admin-action-message">{actionMessage}</p>}
        </section>

        <aside className="admin-strategy-inspector">
          <PanelHead eyebrow={t("admin.pipelines.qualityPublishing")} title={selectedMode.label} action={<AdminStatusBadge status={selectedMode.status} />} />
          <div className="admin-inspector-hero">
            <span>{selectedIsRecommended ? t("admin.pipelines.systemRecommendation") : t("admin.pipelines.manualSelection")}</span>
            <h3>{selectedMode.service}</h3>
            <p>{t("admin.pipelines.workspaceMapping", { mapping: frontstageText(selectedMode.frontstageLabel, t) })}</p>
          </div>

          <div className="admin-inspector-section">
            <span>{t("admin.pipelines.whyRecommended")}</span>
            <div className="admin-rag-stage-list compact">
              {selectedMode.inspector.map((item, index) => (
                <span key={item}><i>{index + 1}</i>{item}</span>
              ))}
            </div>
          </div>

          <div className="admin-inspector-section">
            <span>{t("admin.pipelines.qualityGates")}</span>
            <div className="admin-gate-list">
              {selectedMode.qualityGates.map((gate) => (
                <article key={gate.label}>
                  <b>{gate.label}</b>
                  <small>{gateStatusText(gate.status, t)}</small>
                  <p>{gate.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-inspector-section">
            <span>{t("admin.pipelines.expectedOutputs")}</span>
            <div className="admin-output-list">
              {selectedMode.previewOutputs.map((output) => (
                <article key={output.label}>
                  <b>{output.label}</b>
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-inspector-section">
            <span>{t("admin.pipelines.permissionImpact")}</span>
            <p>{activeRequest.permissionImpact}</p>
          </div>

          <div className="admin-inspector-section accent">
            <span>{t("admin.pipelines.workspaceMappingLabel")}</span>
            <b>{frontstageText(selectedMode.frontstageLabel, t)}</b>
            <p>{selectedMode.reviewGate}</p>
          </div>
        </aside>
      </section>

	      {filePreview ? <AdminFilePreviewOverlay preview={filePreview} onClose={() => setFilePreview(null)} /> : null}
	      {assetDetail ? <AdminKnowledgeAssetOverlay detail={assetDetail} onClose={() => setAssetDetail(null)} /> : null}
	    </AdminShell>
	  );
	}

export function AdminGraphPage() {
  const { t } = useI18n();
  const lowConfidenceEdges = adminGraphSnapshot.edges.filter((edge) => edge.confidence < 0.8);
  const [notice, setNotice] = useState("");
  const runGraph = async (query: string) => {
    setNotice(t("admin.graph.noticeGraphQuery", { query }));
    setNotice(await postRecallVerify("GraphRAG", query, t));
  };
  return (
    <AdminShell active="/admin/graph" title={t("admin.graph.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.graph.eyebrow")}
        title={t("admin.graph.title")}
        description={t("admin.graph.description")}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      <section className="admin-graph-ops" aria-label={t("admin.graph.opsConsoleAria")}>
        <section className="admin-panel admin-graph-main">
          <PanelHead eyebrow={t("admin.graph.opsConsole")} title={t("admin.graph.opsConsoleTitle")} action={<button type="button" onClick={() => runGraph("Entity network and relationship layout")}>{t("admin.graph.recomputeLayout")}</button>} />
          <div className="admin-graph-canvas">
            <svg viewBox="0 0 900 480" role="img" aria-label={t("admin.graph.eyebrow")}>
              {adminGraphSnapshot.edges.map((edge, index) => {
                const source = nodePosition(edge.source);
                const target = nodePosition(edge.target);
                return <line key={`${edge.source}-${edge.target}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
              })}
              {adminGraphSnapshot.nodes.map((node) => {
                const pos = nodePosition(node.id);
                return (
                  <g key={node.id} data-graph-detail-node={node.id} transform={`translate(${pos.x} ${pos.y})`}>
                    <circle r="34" className={node.health} />
                    <text y="4" textAnchor="middle">{node.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="admin-graph-node-strip" aria-label={t("admin.graph.entityDirectoryAria")}>
            {adminGraphSnapshot.nodes.map((node) => (
              <article key={node.id}>
                <span>{node.type}</span>
                <b>{node.label}</b>
                <AdminStatusBadge status={node.health === "risk" ? "需复核" : node.health === "watch" ? "观察" : "正常"} />
              </article>
            ))}
          </div>
        </section>

        <aside className="admin-panel admin-graph-sidebar">
          <PanelHead eyebrow={t("admin.graph.entityDirectory")} title={t("admin.graph.entityGroupsHealth")} />
          <div className="admin-graph-entity-list">
            {adminGraphSnapshot.nodes.map((node) => (
              <article key={`entity-${node.id}`}>
                <b>{node.label}</b>
                <span>{node.type}</span>
                <small>{node.health === "risk" ? t("admin.graph.healthNeedsReview") : node.health === "watch" ? t("admin.graph.healthWatching") : t("admin.graph.healthStable")}</small>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="admin-graph-bottom-grid">
        <section className="admin-panel admin-graph-edge-ledger">
          <PanelHead eyebrow={t("admin.graph.edgeLedger")} title={t("admin.graph.edgeLedgerTitle")} action={<button type="button" onClick={() => { triggerAssetExport("GraphRAG"); setNotice(t("admin.graph.noticeExport")); }}>{t("admin.graph.exportEdgeTable")}</button>} />
          <div className="admin-data-table admin-graph-edge-table" role="table" aria-label={t("admin.graph.edgeLedgerAria")}>
            <div role="row" className="admin-table-head">
              <span>{t("admin.graph.thRelationship")}</span>
              <span>{t("admin.graph.thFrom")}</span>
              <span>{t("admin.graph.thTo")}</span>
              <span>{t("admin.graph.thEvidence")}</span>
              <span>{t("admin.graph.thConfidence")}</span>
              <span>{t("admin.graph.thActions")}</span>
            </div>
            {adminGraphSnapshot.edges.map((edge) => (
              <div role="row" key={`${edge.source}-${edge.target}-${edge.label}`}>
                <b>{edge.label}</b>
                <span>{graphNodeName(edge.source)}</span>
                <span>{graphNodeName(edge.target)}</span>
                <span>{edge.evidence}</span>
                <span>{Math.round(edge.confidence * 100)}%</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => runGraph("Evidence sources for the relationship")}>{t("admin.graph.viewSources")}</button>
                  <button type="button" onClick={() => runGraph("Low-confidence relationship review")}>{t("admin.graph.review")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-panel admin-graph-review">
          <PanelHead eyebrow={t("admin.graph.lowConfidenceQueue")} title={t("admin.graph.relationshipsNeedReview", { count: lowConfidenceEdges.length })} />
          <div className="admin-graph-review-list">
            {lowConfidenceEdges.map((edge) => (
              <article key={`review-${edge.source}-${edge.target}`}>
                <b>{graphNodeName(edge.source)} → {graphNodeName(edge.target)}</b>
                <span>{edge.label} · {edge.evidence}</span>
                <small>{t("admin.graph.confidence", { count: Math.round(edge.confidence * 100) })}</small>
              </article>
            ))}
          </div>
        </aside>

        <aside className="admin-panel admin-graph-path">
          <PanelHead eyebrow={t("admin.graph.pathExplorer")} title={t("admin.graph.multiHopVerification")} action={<button type="button" onClick={() => runGraph("Multi-hop paths between customers, owners, and suppliers")}>{t("admin.graph.runPathQuery")}</button>} />
          <div className="admin-path-result">
            <span>Northwind Labs</span>
            <i>renewing</i>
            <span>Annual framework agreement</span>
            <i>tied to expansion</i>
            <span>Phase 2 expansion</span>
          </div>
          <p>{t("admin.graph.pathVerification")}</p>
        </aside>
      </section>
    </AdminShell>
  );
}

async function openAdminAssetDetail(
  mode: RagOperationMode,
  asset: RagAssetView,
  setAssetDetail: (detail: AdminAssetDetailState | null) => void,
  t: T
) {
  const baseDetail: AdminAssetDetailState = {
    mode: { label: mode.label, frontstageLabel: mode.frontstageLabel },
    asset: { kind: asset.kind, label: asset.label, description: asset.description, metric: asset.metric },
    status: "loading",
    records: []
  };
  setAssetDetail(baseDetail);

  try {
    const query = new URLSearchParams({ engine: mode.label, kind: asset.kind });
    const response = await fetch(`/api/platform/admin/knowledge-assets?${query.toString()}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof body.message === "string" ? body.message : t("admin.knowledge.unableToReadAssets"));
    }
    setAssetDetail({
      ...baseDetail,
      status: "ready",
      records: Array.isArray(body.assets) ? body.assets : []
    });
  } catch (error) {
    setAssetDetail({
      ...baseDetail,
      status: "error",
      message: error instanceof Error ? error.message : t("admin.knowledge.unableToReadAssets")
    });
  }
}

function openLocalAdminAssetDetail(record: AdminKnowledgeAssetDetail, setAssetDetail: (detail: AdminAssetDetailState | null) => void, t: T) {
  const mode = modeForEngine(record.engine);
  const asset = mode.assetViews.find((view) => view.kind === record.kind);
  setAssetDetail({
    mode: { label: mode.label, frontstageLabel: mode.frontstageLabel },
    asset: {
      kind: record.kind,
      label: asset?.label ?? assetKindLabel(record.kind, t),
      description: asset?.description ?? t("admin.knowledge.assetDescriptionFallback"),
      metric: record.metric
    },
    status: "ready",
    records: [record]
  });
}

function knowledgeAssetStats(assets: AdminKnowledgeAssetDetail[], t: T) {
  const scenarioCount = new Set(assets.map((asset) => asset.scenarioName)).size;
  const sourceCount = new Set(assets.map((asset) => asset.sourceOriginalName)).size;
  return [
    { label: t("admin.knowledge.statKnowledgeBases"), value: scenarioCount, helper: t("admin.knowledge.statKnowledgeBasesHelper"), state: "healthy" },
    { label: t("admin.knowledge.statIngestedAssets"), value: assets.length, helper: t("admin.knowledge.statIngestedAssetsHelper"), state: "healthy" },
    { label: t("admin.knowledge.statSourceFiles"), value: sourceCount, helper: t("admin.knowledge.statSourceFilesHelper"), state: "watch" },
    { label: t("admin.knowledge.statAwaitingReview"), value: assets.filter((asset) => ["待抽检", "待复核", "观察"].includes(asset.status)).length, helper: t("admin.knowledge.statAwaitingReviewHelper"), state: "watch" }
  ];
}

function modeForEngine(engine: AdminEngine): RagOperationMode {
  return ragOperationModes.find((mode) => mode.label === engine) ?? ragOperationModes[0];
}

function frontstageLabelForEngine(engine: AdminEngine, t: T) {
  return frontstageText(modeForEngine(engine).frontstageLabel, t);
}

function engineManagementHref(engine: string) {
  if (engine === "Naive RAG") return "/admin/knowledge-bases/naive";
  if (engine === "GraphRAG") return "/admin/graph";
  return "/admin/knowledge-bases/gbrain";
}

function assetKindLabel(kind: string, t: T) {
  const keys: Record<string, string> = {
    wiki: "adminAssetKind.page",
    fact: "adminAssetKind.factCard",
    link: "adminAssetKind.link",
    source: "adminAssetKind.source",
    chunk: "adminAssetKind.documentChunk",
    embedding: "adminAssetKind.vectorIndex",
    citation: "adminAssetKind.citationEvidence",
    eval: "adminAssetKind.trialQuestionResult",
    entity: "adminAssetKind.entity",
    relationship: "adminAssetKind.relationshipEdge",
    graph: "adminAssetKind.graph",
    review: "adminAssetKind.reviewItem"
  };
  const key = keys[kind];
  return key ? t(key) : kind;
}

function assetMetadataValue(asset: AdminKnowledgeAssetDetail, label: string) {
  return asset.metadata.find((item) => item.label === label)?.value;
}

function truncateAdminText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function graphNodeLabel(value: string, fallback = "Entity") {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 8) return text || fallback;
  return `${text.slice(0, 7)}…`;
}

function graphNodeName(id: string) {
  return adminGraphSnapshot.nodes.find((node) => node.id === id)?.label ?? id;
}

function governanceStepsForEngine(engine: string, t: T) {
  if (engine === "Naive RAG") return [1, 2, 3, 4, 5].map((index) => t(`admin.knowledge.naiveStep${index}`));
  if (engine === "GraphRAG") return [1, 2, 3, 4, 5].map((index) => t(`admin.knowledge.graphStep${index}`));
  return [1, 2, 3, 4, 5].map((index) => t(`admin.knowledge.gbrainStep${index}`));
}

function enginePageConfig(engine: AdminEngine, t: T) {
  if (engine === "Naive RAG") {
    return {
      description: t("admin.engine.naive.description"),
      workflowTitle: t("admin.engine.naive.workflowTitle"),
      assetTitle: t("admin.engine.naive.assetTitle"),
      primaryAction: t("admin.engine.naive.primaryAction"),
      workbench: {
        eyebrow: t("admin.engine.naive.workbenchEyebrow"),
        title: t("admin.engine.naive.workbenchTitle"),
        description: t("admin.engine.naive.workbenchDescription"),
        areas: [
          { label: t("admin.engine.naive.area1"), description: t("admin.engine.naive.area1Desc") },
          { label: t("admin.engine.naive.area2"), description: t("admin.engine.naive.area2Desc") },
          { label: t("admin.engine.naive.area3"), description: t("admin.engine.naive.area3Desc") },
          { label: t("admin.engine.naive.area4"), description: t("admin.engine.naive.area4Desc") }
        ],
        controls: [
          { label: t("admin.engine.naive.control1"), value: t("admin.engine.naive.control1Value"), helper: t("admin.engine.naive.control1Helper") },
          { label: t("admin.engine.naive.control2"), value: t("admin.engine.naive.control2Value"), helper: t("admin.engine.naive.control2Helper") },
          { label: t("admin.engine.naive.control3"), value: t("admin.engine.naive.control3Value"), helper: t("admin.engine.naive.control3Helper") }
        ]
      },
      stages: [1, 2, 3, 4, 5].map((index) => t(`admin.engine.naive.stage${index}`)),
      actions: [1, 2, 3, 4].map((index) => t(`admin.engine.naive.action${index}`)),
      metrics: [
        { label: t("admin.engine.naive.metric1"), helper: t("admin.engine.naive.metric1Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "chunk").length },
        { label: t("admin.engine.naive.metric2"), helper: t("admin.engine.naive.metric2Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "embedding").length },
        { label: t("admin.engine.naive.metric3"), helper: t("admin.engine.naive.metric3Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "citation").length },
        { label: t("admin.engine.naive.metric4"), helper: t("admin.engine.naive.metric4Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "eval").length }
      ]
    };
  }
  if (engine === "GraphRAG") {
    return {
      description: t("admin.engine.graph.description"),
      workflowTitle: t("admin.engine.graph.workflowTitle"),
      assetTitle: t("admin.engine.graph.assetTitle"),
      primaryAction: t("admin.engine.graph.primaryAction"),
      workbench: {
        eyebrow: t("admin.engine.graph.workbenchEyebrow"),
        title: t("admin.engine.graph.workbenchTitle"),
        description: t("admin.engine.graph.workbenchDescription"),
        areas: [
          { label: t("admin.engine.graph.area1"), description: t("admin.engine.graph.area1Desc") },
          { label: t("admin.engine.graph.area2"), description: t("admin.engine.graph.area2Desc") },
          { label: t("admin.engine.graph.area3"), description: t("admin.engine.graph.area3Desc") },
          { label: t("admin.engine.graph.area4"), description: t("admin.engine.graph.area4Desc") }
        ],
        controls: [
          { label: t("admin.engine.graph.control1"), value: t("admin.engine.graph.control1Value"), helper: t("admin.engine.graph.control1Helper") },
          { label: t("admin.engine.graph.control2"), value: t("admin.engine.graph.control2Value"), helper: t("admin.engine.graph.control2Helper") },
          { label: t("admin.engine.graph.control3"), value: t("admin.engine.graph.control3Value"), helper: t("admin.engine.graph.control3Helper") }
        ]
      },
      stages: [1, 2, 3, 4, 5].map((index) => t(`admin.engine.graph.stage${index}`)),
      actions: [1, 2, 3, 4].map((index) => t(`admin.engine.graph.action${index}`)),
      metrics: [
        { label: t("admin.engine.graph.metric1"), helper: t("admin.engine.graph.metric1Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "entity").length },
        { label: t("admin.engine.graph.metric2"), helper: t("admin.engine.graph.metric2Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "relationship").length },
        { label: t("admin.engine.graph.metric3"), helper: t("admin.engine.graph.metric3Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "graph").length },
        { label: t("admin.engine.graph.metric4"), helper: t("admin.engine.graph.metric4Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "review").length }
      ]
    };
  }
  return {
    description: t("admin.engine.gbrain.description"),
    workflowTitle: t("admin.engine.gbrain.workflowTitle"),
    assetTitle: t("admin.engine.gbrain.assetTitle"),
    primaryAction: t("admin.engine.gbrain.primaryAction"),
    workbench: {
      eyebrow: t("admin.engine.gbrain.workbenchEyebrow"),
      title: t("admin.engine.gbrain.workbenchTitle"),
      description: t("admin.engine.gbrain.workbenchDescription"),
      areas: [
        { label: t("admin.engine.gbrain.area1"), description: t("admin.engine.gbrain.area1Desc") },
        { label: t("admin.engine.gbrain.area2"), description: t("admin.engine.gbrain.area2Desc") },
        { label: t("admin.engine.gbrain.area3"), description: t("admin.engine.gbrain.area3Desc") },
        { label: t("admin.engine.gbrain.area4"), description: t("admin.engine.gbrain.area4Desc") }
      ],
      controls: [
        { label: t("admin.engine.gbrain.control1"), value: t("admin.engine.gbrain.control1Value"), helper: t("admin.engine.gbrain.control1Helper") },
        { label: t("admin.engine.gbrain.control2"), value: t("admin.engine.gbrain.control2Value"), helper: t("admin.engine.gbrain.control2Helper") },
        { label: t("admin.engine.gbrain.control3"), value: t("admin.engine.gbrain.control3Value"), helper: t("admin.engine.gbrain.control3Helper") }
      ]
    },
    stages: [1, 2, 3, 4, 5].map((index) => t(`admin.engine.gbrain.stage${index}`)),
    actions: [1, 2, 3, 4].map((index) => t(`admin.engine.gbrain.action${index}`)),
    metrics: [
      { label: t("admin.engine.gbrain.metric1"), helper: t("admin.engine.gbrain.metric1Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "wiki").length },
      { label: t("admin.engine.gbrain.metric2"), helper: t("admin.engine.gbrain.metric2Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "fact").length },
      { label: t("admin.engine.gbrain.metric3"), helper: t("admin.engine.gbrain.metric3Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "link").length },
      { label: t("admin.engine.gbrain.metric4"), helper: t("admin.engine.gbrain.metric4Helper"), value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "source").length }
    ]
  };
}

function AdminKnowledgeAssetOverlay({ detail, onClose }: { detail: AdminAssetDetailState; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="admin-preview-overlay admin-asset-detail-overlay" role="dialog" aria-modal="true" aria-label={t("admin.knowledge.assetDetailAria", { label: detail.asset.label })} onClick={onClose}>
      <section className="admin-preview-sheet admin-asset-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{detail.mode.label} · {frontstageText(detail.mode.frontstageLabel, t)}</span>
            <h2>{detail.asset.label}</h2>
          </div>
          <button type="button" onClick={onClose}>{t("common.close")}</button>
        </header>

        <div className="admin-preview-body admin-asset-detail-body">
          {detail.status === "loading" ? <div className="admin-preview-state">{t("admin.knowledge.loadingAssets")}</div> : null}
          {detail.status === "error" ? <div className="admin-preview-state error">{detail.message}</div> : null}
          {detail.status === "ready" && detail.records.length === 0 ? (
            <div className="admin-asset-empty">
              <b>{t("admin.knowledge.noRecordsTitle")}</b>
              <p>{t("admin.knowledge.noRecordsBody", { engine: detail.mode.label })}</p>
            </div>
          ) : null}
          {detail.status === "ready" && detail.records.length > 0 ? (
            <div className="admin-asset-detail-stack">
              <section className="admin-asset-detail-summary">
                <div>
                  <span>{t("admin.knowledge.assetType")}</span>
                  <b>{detail.asset.label}</b>
                  <p>{detail.asset.description}</p>
                </div>
                <strong>{detail.records.length}</strong>
              </section>

              <div className="admin-asset-record-list">
                {detail.records.map((record) => (
                  <article key={record.id} className="admin-asset-record-card">
                    <header>
                      <div>
                        <span>{record.status}</span>
                        <h3>{record.title}</h3>
                      </div>
                      <small>{record.metric}</small>
                    </header>
                    <p>{record.content}</p>
                    <dl>
                      {record.metadata.map((item) => (
                        <div key={`${record.id}-${item.label}`}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AdminFilePreviewOverlay({ preview, onClose }: { preview: AdminFilePreviewState; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="admin-preview-overlay" role="dialog" aria-modal="true" aria-label={t("admin.knowledge.filePreviewAria", { title: preview.title })} onClick={onClose}>
      <section className="admin-preview-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{preview.label}</span>
            <h2>{preview.title}</h2>
          </div>
          <button type="button" onClick={onClose}>{t("common.close")}</button>
        </header>

        <div className="admin-preview-body">
          {preview.status === "loading" ? <div className="admin-preview-state">{t("admin.knowledge.loadingFilePreview")}</div> : null}
          {preview.status === "error" ? <div className="admin-preview-state error">{preview.message}</div> : null}
          {preview.status === "ready" && preview.kind === "PDF" ? (
            <iframe className="admin-pdf-preview" title={preview.title} src={preview.url} />
          ) : null}
          {preview.status === "ready" && ["CSV", "XLS"].includes(preview.kind) ? <AdminCsvPreview text={preview.text ?? ""} /> : null}
          {preview.status === "ready" && preview.kind === "MD" ? <AdminMarkdownPreview text={preview.text ?? ""} /> : null}
          {preview.status === "ready" && ["TXT", "JSON"].includes(preview.kind) ? <pre className="admin-text-preview">{formatPreviewText(preview.kind, preview.text ?? "")}</pre> : null}
          {preview.status === "ready" && !["PDF", "CSV", "XLS", "MD", "TXT", "JSON"].includes(preview.kind) ? (
            <div className="admin-preview-state">{t("admin.knowledge.cannotPreview")}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AdminCsvPreview({ text }: { text: string }) {
  const { t } = useI18n();
  const rows = parseDelimitedPreview(text).slice(0, 80);
  const [head = [], ...body] = rows;
  return (
    <div className="admin-csv-preview">
      <table>
        <thead>
          <tr>{head.map((cell, index) => <th key={`${cell}-${index}`}>{cell || t("admin.knowledge.column", { index: index + 1 })}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {head.map((_, cellIndex) => <td key={cellIndex}>{row[cellIndex] ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminMarkdownPreview({ text }: { text: string }) {
  return (
    <article className="admin-markdown-preview">
      {text.split(/\n+/).filter(Boolean).map((line, index) => {
        if (line.startsWith("### ")) return <h4 key={index}>{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={index}>{line.slice(2)}</h2>;
        if (line.startsWith("- ")) return <p key={index} className="list">• {line.slice(2)}</p>;
        return <p key={index}>{line}</p>;
      })}
    </article>
  );
}

export function AdminEvaluationsPage({
  initialEvaluations = []
}: {
  initialEvaluations?: Array<{ profile: string; evidence: number; score: string; latency: string }>;
} = {}) {
  const { t } = useI18n();
  const evaluations = initialEvaluations.length
    ? initialEvaluations
    : evaluationRows.map((r) => ({ profile: r.profile, evidence: r.evidence, score: String(r.score), latency: r.latency }));
  const [notice, setNotice] = useState("");
  const runEvalVerify = async (profile: string) => {
    const engine = profile.includes("knowledge wiki") ? "Gbrain" : profile.includes("knowledge graph") ? "GraphRAG" : "Naive RAG";
    setNotice(t("admin.evaluations.noticeVerify", { profile }));
    setNotice(await postRecallVerify(engine, profile, t));
  };
  const runAllEval = async () => {
    setNotice(t("admin.evaluations.noticeAll"));
    const results = await Promise.all(evaluations.map(async (r) => {
      const engine = r.profile.includes("knowledge wiki") ? "Gbrain" : r.profile.includes("knowledge graph") ? "GraphRAG" : "Naive RAG";
      return `${r.profile}: ${await postRecallVerify(engine, r.profile, t)}`;
    }));
    setNotice(results.join(" | "));
  };
  return (
    <AdminShell active="/admin/evaluations" title={t("admin.evaluations.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.evaluations.eyebrow")}
        title={t("admin.evaluations.title")}
        description={t("admin.evaluations.description")}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      <section className="admin-evaluation-console" aria-label={t("admin.evaluations.consoleAria")}>
        <section className="admin-panel admin-evaluation-datasets">
          <PanelHead eyebrow={t("admin.evaluations.console")} title={t("admin.evaluations.consoleTitle")} action={<button type="button" onClick={() => runAllEval()}>{t("admin.evaluations.newTask")}</button>} />
          <div className="admin-evaluation-dataset-grid">
            {[
              { name: "Policy Q&A question set", scope: "Company", count: "42 questions", gate: "Citations must match the source text" },
              { name: "Customer risk question set", scope: "Team", count: "28 questions", gate: "Relationship paths must be explainable" },
              { name: "Personal knowledge base follow-up set", scope: "Personal", count: "18 questions", gate: "Fact sources must be traceable" }
            ].map((item) => (
              <article key={item.name}>
                <span>{t("admin.evaluations.questionSet")}</span>
                <b>{item.name}</b>
                <small>{item.scope} · {item.count}</small>
                <p>{item.gate}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="admin-panel admin-evaluation-coverage">
          <PanelHead eyebrow={t("admin.evaluations.evidenceCoverage")} title={t("admin.evaluations.evidenceCoverageTitle")} />
          <div className="admin-evidence-coverage-meter">
            {evaluations.map((row) => (
              <article key={row.profile}>
                <header><b>{row.profile}</b><span>{t("admin.strategies.evidenceItems", { count: row.evidence })}</span></header>
                <i style={{ width: `${row.evidence > 0 ? 100 : 0}%` }} />
                <small>{row.score} · {row.latency}</small>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow={t("admin.evaluations.policyComparison")} title={t("admin.evaluations.policyComparisonTitle")} action={<button type="button" onClick={() => runAllEval()}>{t("admin.evaluations.batchReverify")}</button>} />
        <div className="admin-data-table admin-eval-table" role="table" aria-label={t("admin.evaluations.resultsAria")}>
          <div role="row" className="admin-table-head">
            <span>{t("admin.evaluations.thPolicy")}</span>
            <span>{t("admin.evaluations.thReadiness")}</span>
            <span>{t("admin.evaluations.thEvidence")}</span>
            <span>{t("admin.evaluations.thLatency")}</span>
            <span>{t("admin.evaluations.thActions")}</span>
          </div>
          {evaluations.map((row) => (
            <div role="row" key={row.profile}>
              <b>{row.profile}<small>{t("admin.evaluations.rowCovers")}</small></b>
              <span>{row.score}</span>
              <span>{row.evidence}</span>
              <span>{row.latency}</span>
              <div className="admin-row-actions"><button type="button" onClick={() => runEvalVerify(row.profile)}>{t("admin.evaluations.viewCases")}</button><button type="button" onClick={() => runEvalVerify(row.profile)}>{t("admin.evaluations.reverify")}</button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-evaluation-bottom">
        <section className="admin-panel admin-failure-review">
          <PanelHead eyebrow={t("admin.evaluations.failureReview")} title={t("admin.evaluations.failureReviewTitle")} action={<button type="button" onClick={() => runAllEval()}>{t("admin.evaluations.convertToReview")}</button>} />
          <div className="admin-failure-stack">
            {[
              { question: "Does it still answer when no policy supports it?", reason: "A strict evidence policy should refuse, but the candidate answer inferred a conclusion." },
              { question: "Do customer relationship paths leak across teams?", reason: "GraphRAG low-confidence edges need human confirmation before they reach the workspace." }
            ].map((item) => (
              <article key={item.question}>
                <b>{item.question}</b>
                <p>{item.reason}</p>
                <AdminStatusBadge status="需复核" />
              </article>
            ))}
          </div>
        </section>
        <aside className="admin-panel admin-release-gates">
          <PanelHead eyebrow={t("admin.evaluations.releaseGates")} title={t("admin.evaluations.preLaunchChecks")} />
          <div className="admin-gate-list">
            <article><b>{t("admin.evaluations.gateCitationsOpen")}</b><small>{t("adminGate.required")}</small><p>{t("admin.evaluations.gateCitationsOpenBody")}</p></article>
            <article><b>{t("admin.evaluations.gatePermissionFiltering")}</b><small>{t("adminGate.required")}</small><p>{t("admin.evaluations.gatePermissionFilteringBody")}</p></article>
            <article><b>{t("admin.evaluations.gateRefusalWithoutEvidence")}</b><small>{t("adminGate.required")}</small><p>{t("admin.evaluations.gateRefusalWithoutEvidenceBody")}</p></article>
          </div>
        </aside>
      </section>
    </AdminShell>
  );
}

export function AdminAuditPage({ initialEvents = adminAuditEvents }: { initialEvents?: typeof adminAuditEvents }) {
  const { t } = useI18n();
  const [activeModule, setActiveModule] = useState("全部模块");
  const [showRaw, setShowRaw] = useState(false);
  const filteredEvents = activeModule === "全部模块" ? initialEvents : initialEvents.filter((e) => e.area === activeModule);
  const riskEvents = initialEvents.filter((event) => /risk|policy|permission|pipeline|graph/i.test(`${event.area}${event.summary}${event.impact}`));
  const handleExportCSV = () => {
    const escape = (value: unknown) => { const str = String(value ?? ""); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    const header = [t("admin.audit.csvChange"), t("admin.audit.csvModule"), t("admin.audit.csvActor"), t("admin.audit.csvTime"), t("admin.audit.csvImpact")].join(",");
    const rows = initialEvents.map((e) => [e.summary, e.area, e.actor, e.time, e.impact].map(escape).join(","));
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "audit-events.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  return (
    <AdminShell active="/admin/audit" title={t("admin.audit.shellTitle")}>
      <AdminPageHead
        eyebrow={t("admin.audit.eyebrow")}
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
      />
      <section className="admin-panel admin-audit-filter">
        <PanelHead eyebrow={t("admin.audit.filtersEyebrow")} title={t("admin.audit.filtersTitle")} action={<button type="button" onClick={handleExportCSV}>{t("admin.audit.exportAuditPack")}</button>} />
        <div className="admin-audit-filter-row">
          {["全部模块", "模板治理", "检索策略", "处理管线", "关系图谱", "质量验证"].map((item) => (
            <button key={item} type="button" className={item === activeModule ? "active" : ""} onClick={() => setActiveModule(item)}>{auditAreaText(item, t)}</button>
          ))}
        </div>
      </section>

      <section className="admin-audit-summary">
        <article>
          <span>{t("admin.audit.traceableImpact")}</span>
          <b>{filteredEvents.length}</b>
          <small>{t("admin.audit.traceableImpactHelper")}</small>
        </article>
        <article>
          <span>{t("admin.audit.riskyActions")}</span>
          <b>{riskEvents.length}</b>
          <small>{t("admin.audit.riskyActionsHelper")}</small>
        </article>
        <article>
          <span>{t("admin.audit.actors")}</span>
          <b>{new Set(initialEvents.map((event) => event.actor)).size}</b>
          <small>{t("admin.audit.actorsHelper")}</small>
        </article>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow={t("admin.audit.changeLog")} title={t("admin.audit.recentEvents")} action={<button type="button" onClick={() => setShowRaw(true)}>{t("admin.audit.viewRawEvents")}</button>} />
        <div className="admin-data-table admin-audit-table" role="table" aria-label={t("admin.audit.tableAria")}>
          <div role="row" className="admin-table-head">
            <span>{t("admin.audit.thChange")}</span>
            <span>{t("admin.audit.thModule")}</span>
            <span>{t("admin.audit.thActor")}</span>
            <span>{t("admin.audit.thTime")}</span>
            <span>{t("admin.audit.thImpact")}</span>
          </div>
          {filteredEvents.map((event) => (
            <div role="row" key={event.id}>
              <b>{event.summary}</b>
              <span>{auditAreaText(event.area, t)}</span>
              <span>{event.actor}</span>
              <span>{event.time}</span>
              <span>{event.impact}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-audit-risk-actions">
        <PanelHead eyebrow={t("admin.audit.riskyActions")} title={t("admin.audit.riskyActionsTitle")} />
        <div className="admin-risk-stack">
          {riskEvents.map((event) => (
            <article key={`risk-${event.id}`}>
              <span>{auditAreaText(event.area, t)}</span>
              <div>
                <b>{event.summary}</b>
                <p>{event.impact}</p>
              </div>
              <strong>{event.time}</strong>
            </article>
          ))}
        </div>
      </section>
      {showRaw && (
        <div onClick={() => setShowRaw(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", maxWidth: 640, width: "90%", maxHeight: "80vh", overflow: "auto", position: "relative", padding: 16, borderRadius: 8, boxSizing: "border-box" }}>
            <button type="button" onClick={() => setShowRaw(false)} style={{ position: "absolute", top: 8, right: 8 }}>{t("common.close")}</button>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingTop: 24 }}>{JSON.stringify(initialEvents, null, 2)}</pre>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export function AdminShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  const auth = useAuth();
  const { t } = useI18n();
  const currentUser = auth.user?.display_name || auth.user?.username || t("admin.defaultUser");
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-main">{t("admin.skipToMain")}</a>
      <aside className="admin-side">
        <Link href="/" className="admin-brand" aria-label={t("admin.backToHomepage")}>
          <Logo size={30} />
          <small>{t("admin.console")}</small>
        </Link>
        <nav aria-label={t("admin.navLabel")}>
          {adminNav.map((item) => {
            const isKnowledgeNav = item.href === "/admin/knowledge-bases";
            const isActive = isKnowledgeNav ? active.startsWith(item.href) : item.href === active;

            if (isKnowledgeNav) {
              return (
                <div key={item.href} className="admin-nav-group">
                  <Link
                    className={`admin-nav-parent${isActive ? " active" : ""}`}
                    href={item.href}
                    aria-current={active === item.href ? "page" : undefined}
                  >
                    <span>{t(adminNavKeys[item.href] ?? item.label)}</span>
                  </Link>
                  <div className="admin-nav-sub" aria-label={t("admin.knowledgeSubnavLabel")}>
                    {adminKnowledgeSubnav.map((subItem) => (
                      <Link
                        key={subItem.href}
                        className={`admin-subnav-link${subItem.href === active ? " active" : ""}`}
                        href={subItem.href}
                        aria-current={subItem.href === active ? "page" : undefined}
                      >
                        <span>{t(adminSubnavKeys[subItem.href] ?? subItem.label)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link key={item.href} className={item.href === active ? "active" : ""} href={item.href} aria-current={item.href === active ? "page" : undefined}>
                <span>{t(adminNavKeys[item.href] ?? item.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-side-status">
          <span>{t("admin.currentResponsibility")}</span>
          <b>{t("admin.responsibilityValue")}</b>
        </div>
      </aside>
      <main id="admin-main" className="admin-main">
        <header className="admin-top">
          <div>
            <span>{title}</span>
            <small>{currentUser} · {t("admin.adminView")}</small>
          </div>
          <div className="admin-top-actions">
            <Link href="/app">{t("common.workspace")}</Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <button type="button" onClick={auth.logout}>{t("common.signOut")}</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function AdminPageHead({ eyebrow, title, description, actions, compact = false }: { eyebrow: string; title: string; description: string; actions?: ReactNode; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={`admin-head admin-page-toolbar ${compact ? "compact" : ""}`} aria-label={t("admin.toolbarLabel", { title })}>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <small>{t("admin.adminToolbar")}</small>
        <p className="admin-head-context">{description}</p>
      </div>
      {actions ? <div className="admin-head-actions">{actions}</div> : null}
    </section>
  );
}

export function PanelHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <header className="admin-panel-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action ? <div className="admin-panel-action">{action}</div> : null}
    </header>
  );
}

function resolveAdminRequests(initialRequests: AdminIntakeRequest[] = []): AdminIntakeRequest[] {
  return initialRequests.length > 0 ? initialRequests : adminIntakeRequests as AdminIntakeRequest[];
}

function requestRecommendedEngines(request?: AdminIntakeRequest): AdminEngine[] {
  if (!request) return ["Gbrain"];
  if (request.recommendedEngines?.length) return request.recommendedEngines;
  return request.recommendedModes.map(engineForMode);
}

function requestSelectedEngine(request?: AdminIntakeRequest): AdminEngine {
  if (!request) return "Gbrain";
  if (request.selectedEngine && request.selectedEngine !== "待选择") return request.selectedEngine;
  if (request.selectedMode !== "待选择") return engineForMode(request.selectedMode);
  return requestRecommendedEngines(request)[0] ?? "Gbrain";
}

function requestFrontstageMapping(request: AdminIntakeRequest | undefined, t: T) {
  if (!request) return t("admin.pipelines.mapsTo", { modes: t("adminFrontstage.knowledgeWiki") });
  if (request.frontstageMapping) return request.frontstageMapping;
  return t("admin.pipelines.mapsTo", { modes: request.recommendedModes.map((mode) => frontstageText(mode, t)).join(" / ") });
}

function fileStateLabel(file: AdminStoredFile | null | undefined, t: T) {
  if (!file) return t("adminFile.stateUploaded");
  if (file.originalState === "deleted") return t("adminFile.stateCleanedUp");
  if (file.originalState === "retained") return t("adminFile.stateRetained");
  return t("adminFile.stateUploaded");
}

function retentionPolicyLabel(policy: "delete_after_ingest" | "retain_source" | undefined, t: T) {
  if (policy === "retain_source") return t("adminFile.retentionKeep");
  if (policy === "delete_after_ingest") return t("adminFile.retentionCleanup");
  return t("adminFile.retentionPending");
}

function fileAccessLabel(file: AdminStoredFile | null | undefined, t: T) {
  const access = file?.accessControl;
  if (!access) return t("adminFile.accessPending");
  if (access.scope === "private") return t("adminFile.accessOwnerOnly");
  if (access.scope === "company") return t("adminFile.accessCompany", { org: access.organizationId });
  return t("adminFile.accessTeam", { team: access.teamIds.join(" / ") || t("adminFile.accessUnspecified") });
}

function defaultParameterValues(mode: RagOperationMode) {
  return Object.fromEntries(mode.parameters.map((parameter) => [parameter.key, String(parameter.value)]));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDelimitedPreview(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function formatPreviewText(kind: string, text: string) {
  if (kind !== "JSON") return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function engineForMode(mode: string): AdminEngine {
  if (mode === "文档证据") return "Naive RAG";
  if (mode === "关系图谱") return "GraphRAG";
  return "Gbrain";
}

// Fixture discriminators that content-platform keeps verbatim. Display labels are localized here.
const RISK_PENDING_SUBMISSIONS = "待管理员确认资料包";

type T = (key: string, vars?: Record<string, string | number>) => string;

function riskLabelText(label: string, t: T) {
  return label === RISK_PENDING_SUBMISSIONS ? t("adminRisk.pendingConfirmations") : label;
}

const RISK_SEVERITY_KEYS: Record<string, string> = {
  高: "adminRisk.high",
  中: "adminRisk.medium",
  低: "adminRisk.low"
};

function riskSeverityText(severity: string, t: T) {
  const key = RISK_SEVERITY_KEYS[severity];
  return key ? t(key) : severity;
}

const VISIBILITY_KEYS: Record<string, string> = {
  全部: "adminVisibility.all",
  个人: "adminVisibility.personal",
  团队: "adminVisibility.team",
  公司: "adminVisibility.company"
};

function visibilityText(scope: string, t: T) {
  const key = VISIBILITY_KEYS[scope];
  return key ? t(key) : scope;
}

const HEALTH_LABEL_KEYS: Record<string, string> = {
  "Relational databases": "admin.overview.health.relationalDatabases",
  "Answer model": "adminSettings.providerLabels.answerModel",
  "Embedding model": "adminSettings.providerLabels.embeddingModel",
  "Document parsing": "admin.overview.health.documentParsing",
  "Knowledge processing chain": "admin.overview.health.knowledgeProcessingChain"
};

const HEALTH_VALUE_KEYS: Record<string, string> = {
  Available: "admin.overview.health.available",
  Unavailable: "admin.overview.health.unavailable",
  "Needs review": "admin.overview.health.needsReview",
  "Primary model": "admin.overview.health.primaryModel",
  "Layout recognition": "admin.overview.health.layoutRecognition",
  "Not configured": "adminSettings.notConfigured"
};

const UNIT_KEYS: Record<string, string> = {
  assets: "admin.overview.units.assets",
  pages: "admin.overview.units.pages",
  objects: "admin.overview.units.objects",
  documents: "admin.overview.units.documents"
};

function healthCardLabelText(label: string, t: T) {
  const key = HEALTH_LABEL_KEYS[label];
  return key ? t(key) : label;
}

function healthCardValueText(value: string, t: T) {
  const key = HEALTH_VALUE_KEYS[value];
  if (key) return t(key);
  const dimensions = value.match(/^(\d+)\s+dims$/);
  return dimensions ? t("admin.overview.health.dimensions", { count: dimensions[1] }) : value;
}

function healthCardDetailText(detail: string, t: T) {
  if (detail === "fetch failed") return t("admin.overview.health.fetchFailed");
  const counts = detail.match(/^(\d+)\s+file requests,\s+(\d+)\s+asset records$/);
  return counts
    ? t("admin.overview.health.fileAndAssetRecords", { files: counts[1], assets: counts[2] })
    : detail;
}

function unitText(unit: string, t: T) {
  const key = UNIT_KEYS[unit];
  return key ? t(key) : unit;
}

const ACTION_KEYS: Record<string, string> = {
  查看资料: "adminAction.viewFiles",
  配置引擎策略: "adminAction.configureEnginePolicy",
  确认入库: "adminAction.confirmIngest",
  退回补充: "adminAction.returnForAdditions",
  打开证据切片: "adminAction.openEvidenceChunks",
  复核引用: "adminAction.reviewCitations",
  发布场景: "adminAction.publishScenario",
  查看图谱抽取: "adminAction.viewGraphExtraction",
  调整实体类型: "adminAction.adjustEntityTypes",
  运行关系构建: "adminAction.runRelationshipBuilding",
  查看发布结果: "adminAction.viewPublishResult",
  查看退回原因: "adminAction.viewReturnReason"
};

function actionText(action: string, t: T) {
  const key = ACTION_KEYS[action];
  return key ? t(key) : action;
}

const FRONTSTAGE_KEYS: Record<string, string> = {
  知识百科: "adminFrontstage.knowledgeWiki",
  文档证据: "adminFrontstage.documentEvidence",
  关系图谱: "adminFrontstage.knowledgeGraph",
  公司大脑: "adminFrontstage.companyQa"
};

function frontstageText(label: string, t: T) {
  const key = FRONTSTAGE_KEYS[label];
  return key ? t(key) : label;
}

const GATE_STATUS_KEYS: Record<string, string> = {
  必须通过: "adminGate.required",
  建议复核: "adminGate.reviewRecommended"
};

function gateStatusText(status: string, t: T) {
  const key = GATE_STATUS_KEYS[status];
  return key ? t(key) : status;
}

const TEMPLATE_CATEGORY_KEYS: Record<string, string> = {
  官方: "adminTemplateCategory.official"
};

function templateCategoryText(category: string, t: T) {
  const key = TEMPLATE_CATEGORY_KEYS[category];
  return key ? t(key) : category;
}

const AUDIT_AREA_KEYS: Record<string, string> = {
  全部模块: "adminAuditArea.allModules",
  模板治理: "adminAuditArea.templateGovernance",
  检索策略: "adminAuditArea.retrievalPolicies",
  处理管线: "adminAuditArea.processingPipeline",
  关系图谱: "adminAuditArea.knowledgeGraph",
  质量验证: "adminAuditArea.qualityEvaluation"
};

function auditAreaText(area: string, t: T) {
  const key = AUDIT_AREA_KEYS[area];
  return key ? t(key) : area;
}

export function AdminStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <span className={`admin-status ${statusClass(status)}`}>{statusText(status, t)}</span>;
}

const STATUS_KEYS: Record<string, string> = {
  healthy: "adminStatus.healthy",
  正常: "adminStatus.healthy",
  degraded: "adminStatus.needsReview",
  需复核: "adminStatus.needsReview",
  down: "adminStatus.unavailable",
  不可用: "adminStatus.unavailable",
  watch: "adminStatus.watch",
  观察: "adminStatus.watch",
  blocked: "adminStatus.blocked",
  阻塞: "adminStatus.blocked",
  done: "adminStatus.completed",
  已完成: "adminStatus.completed",
  running: "adminStatus.inProgress",
  处理中: "adminStatus.inProgress",
  queued: "adminStatus.queued",
  排队中: "adminStatus.queued",
  official: "adminStatus.published",
  已发布: "adminStatus.published",
  candidate: "adminStatus.candidate",
  候选: "adminStatus.candidate",
  experimental: "adminStatus.pilot",
  试点: "adminStatus.pilot",
  custom: "adminStatus.custom",
  自定义: "adminStatus.custom",
  paused: "adminStatus.paused",
  已暂停: "adminStatus.paused",
  archived: "adminStatus.archived",
  已归档: "adminStatus.archived",
  待管理员确认: "adminStatus.pendingAdminReview",
  等待复核: "adminStatus.awaitingReview",
  待复核: "adminStatus.awaitingReview",
  已退回: "adminStatus.returned",
  审核中: "adminStatus.underReview",
  可运行: "adminStatus.runnable",
  启用中: "adminStatus.active",
  需更新: "adminStatus.needsUpdate",
  待抽检: "adminStatus.awaitingSpotCheck",
  已切片: "adminStatus.chunked",
  已抽取: "adminStatus.extracted",
  已读取: "adminStatus.loaded",
  等待解析: "adminStatus.awaitingParse"
};

function statusText(status: string, t: T) {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
}

function statusClass(status: string) {
  if (["正常", "可运行", "已发布", "已读取", "启用中", "healthy", "done", "official"].includes(status)) return "ok";
  if (["待管理员确认", "等待复核", "观察", "需复核", "等待解析", "watch", "running", "queued", "degraded", "candidate", "experimental", "custom"].includes(status)) return "warn";
  if (["阻塞", "需更新", "blocked", "down", "不可用", "paused", "archived"].includes(status)) return "danger";
  return "neutral";
}

function pipelineStatusText(status: string) {
  if (status === "done") return "Completed";
  if (status === "running") return "In progress";
  if (status === "queued") return "Queued";
  return status;
}

function nodePosition(id: string) {
  const map: Record<string, { x: number; y: number }> = {
    ff: { x: 430, y: 220 },
    zl: { x: 180, y: 140 },
    wh: { x: 680, y: 135 },
    contract: { x: 300, y: 355 },
    expansion: { x: 650, y: 355 },
    risk: { x: 450, y: 80 }
  };
  return map[id] ?? { x: 80, y: 80 };
}
