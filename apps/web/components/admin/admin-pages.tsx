"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";
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
  const requests = resolveAdminRequests(initialRequests);
  const pendingRequests = requests.filter((request) => !["已发布", "已退回"].includes(request.status));
  const readyRequests = requests.filter((request) => request.status === "已发布");
  const healthCards = dashboard?.healthCards ?? adminDashboardHealthCards;
  const dataOverview = dashboard?.dataOverview ?? adminDashboardDataOverview;
  const dashboardMetrics = [
    { label: "Pending submissions", value: dashboard?.requests.pending ?? pendingRequests.length, helper: "Needs permission, quality, and engine policy confirmation", href: "/admin/pipelines", state: (dashboard?.requests.pending ?? pendingRequests.length) > 0 ? "watch" : "healthy" },
    { label: "Published knowledge bases", value: dashboard?.requests.published ?? readyRequests.length, helper: "Ingested and available to the workspace", href: "/admin/knowledge-bases", state: "healthy" },
    { label: "Knowledge assets", value: dashboard?.assets.total ?? knowledgeBaseInventory.length, helper: "Personal, team, and company knowledge boundaries", href: "/admin/knowledge-bases", state: "healthy" },
    { label: "Retrieval policies", value: strategyProfiles.length, helper: "Tunable policies exposed to scenarios", href: "/admin/strategies", state: "healthy" }
  ];
  const dashboardRisks = adminDashboardRiskItems.map((item) => item.label === RISK_PENDING_SUBMISSIONS ? { ...item, count: dashboard?.requests.pending ?? pendingRequests.length } : item);
  const maxDataTotal = Math.max(1, ...dataOverview.map((entry) => entry.total));

  return (
    <AdminShell active="/admin" title="Operations Overview">
      <AdminPageHead
        eyebrow="Operations overview"
        title="System health, knowledge assets, and pending work in one view"
        description="On entering the console, an admin first checks whether services are available, whether the data is healthy, and which submissions need action, then moves into the actual ingest, review, and publish paths."
        actions={<Link className="admin-primary-action" href="/admin/pipelines">Resolve pending</Link>}
      />

      <section className="admin-health-strip" aria-label="Service health">
        {healthCards.map((item) => (
          <Link href={item.route} key={item.id} className="admin-health-card">
            <span>{item.label}</span>
            <b>{item.value}</b>
            <small>{item.detail}</small>
            <AdminStatusBadge status={item.status} />
          </Link>
        ))}
      </section>

      <section className="admin-kpi-row admin-kpi-row-dashboard" aria-label="Admin key metrics">
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
          <PanelHead eyebrow="Data overview" title="Knowledge assets by permission scope" action={<Link href="/admin/knowledge-bases">Open asset ledger</Link>} />
          <div className="admin-data-scope-grid">
            {dataOverview.map((item) => {
              const width = Math.max(12, Math.round((item.total / maxDataTotal) * 100));
              return (
                <article key={item.scope}>
                  <header>
                    <span>{visibilityText(item.scope)}</span>
                    <AdminStatusBadge status={item.health} />
                  </header>
                  <strong>{item.total.toLocaleString("en-US")} <small>{item.unit}</small></strong>
                  <div className="admin-scope-meter" aria-label={`${visibilityText(item.scope)} volume ${item.total}${item.unit}`}>
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <dl>
                    <div><dt>Module</dt><dd>{item.module}</dd></div>
                    <div><dt>Owner</dt><dd>{item.owner}</dd></div>
                  </dl>
                  <p>{item.policy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-panel admin-service-panel">
          <PanelHead eyebrow="Service status" title="The three RAG engine paths" action={<Link href="/admin/settings">Integrations</Link>} />
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
          <PanelHead eyebrow="Pending tasks" title="Submissions that need an admin" action={<Link href="/admin/pipelines">Open processing pipeline</Link>} />
          <div className="admin-task-table">
            <div className="admin-table-head">
              <span>Scenario</span>
              <span>Scope</span>
              <span>Suggested engine</span>
              <span>Status</span>
              <span>Submitted</span>
            </div>
            {pendingRequests.slice(0, 6).map((request) => (
              <Link href="/admin/pipelines" key={request.id}>
                <b>{request.scenarioName}<small>{request.requester}</small></b>
                <span>{visibilityText(request.visibility)}</span>
                <span>{requestRecommendedEngines(request).join(" / ")}</span>
                <AdminStatusBadge status={request.status} />
                <span>{request.submittedAt}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-risk-panel">
          <PanelHead eyebrow="Risks and gates" title="Governance signals to watch right now" action={<Link href="/admin/audit">Audit log</Link>} />
          <div className="admin-risk-stack">
            {dashboardRisks.map((item) => (
              <article key={item.label}>
                <span>{riskSeverityText(item.severity)}</span>
                <div>
                  <b>{riskLabelText(item.label)}</b>
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
      setNotice("Enter a template name first.");
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
      setNotice(body?.message ?? "Template creation failed. Check your session and admin permissions.");
      return;
    }
    setTemplates((items) => [body.template!, ...items]);
    setDraftName("");
    setDraftHeadline("");
    setNotice(`Created template "${body.template.name}"; it starts as a candidate.`);
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
      setNotice(body?.message ?? "Failed to update the template state.");
      return;
    }
    setTemplates((items) => items.map((item) => item.id === template.id ? body.template! : item));
    setNotice(`${nextState === "paused" ? "Paused" : "Resumed"} "${template.name}".`);
  }

  async function deleteTemplate(template: StoredAdminTemplate) {
    const response = await fetch(`/api/platform/admin/templates/${template.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setNotice(body?.message ?? "Failed to delete the template.");
      return;
    }
    setTemplates((items) => items.filter((item) => item.id !== template.id));
    setNotice(`Deleted custom template "${template.name}".`);
  }

  return (
    <AdminShell active="/admin/templates" title="Template Governance">
      <AdminPageHead
        eyebrow="Template governance"
        title="Template permissions and publishing governance"
        description="Templates are not static cards but the entry point for best-practice scenarios in the workspace. The console manages official and custom templates, accepted file types, release gates, and deletion boundaries."
        actions={<button type="button" className="admin-primary-action" disabled={!draftName.trim()} onClick={createTemplate}>New template</button>}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-template-metrics" aria-label="Template governance overview">
        <article><span>Official</span><b>{officialCount}</b><small>Best-practice templates that cannot be hard-deleted</small></article>
        <article><span>Custom templates</span><b>{customCount}</b><small>Admins can create, pause, and delete these</small></article>
        <article><span>Paused</span><b>{pausedCount}</b><small>The workspace cannot create scenarios from a paused template</small></article>
        <article><span>Demo readiness</span><b>{averageDemoReadiness}%</b><small>Demo material, evaluation questions, and citations in place</small></article>
      </section>

      <section className="admin-panel admin-template-builder">
        <PanelHead eyebrow="Template creation" title="Add a governable scenario template" action={<span>Admins only</span>} />
        <div className="admin-template-form">
          <label>
            <span>Template name</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="e.g. Support quality review" />
          </label>
          <label>
            <span>Business category</span>
            <input value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} placeholder="e.g. Customer success, sales, legal" />
          </label>
          <label>
            <span>Summary</span>
            <input value={draftHeadline} onChange={(event) => setDraftHeadline(event.target.value)} placeholder="Explain what this template solves, what material it needs, and what it produces" />
          </label>
          <button type="button" disabled={!draftName.trim()} onClick={createTemplate}>Create template</button>
        </div>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow="Template ledger" title="Release gates, accepted files, and capabilities" />
        <div className="admin-data-table admin-template-table" role="table" aria-label="Template governance list">
          <div role="row" className="admin-table-head">
            <span>Template</span>
            <span>Source</span>
            <span>Status</span>
            <span>Accepted files</span>
            <span>Release gate</span>
            <span>Capabilities</span>
            <span>Actions</span>
          </div>
          {templates.map((template) => (
            <div role="row" key={template.id}>
              <b>{template.name}<small>{template.headline}</small></b>
              <span>{template.source === "official" ? "Official" : "Custom"} · {templateCategoryText(template.category)}</span>
              <AdminStatusBadge status={template.state} />
              <span>{template.acceptedFiles.slice(0, 4).join(" / ")}</span>
              <span>{template.reviewRequirement}<small>{template.evidenceCoverage}% evidence coverage</small></span>
              <span>{template.outputCapabilities.slice(0, 3).join(" / ")}<small>{template.demoReadiness}% demo ready</small></span>
              <div className="admin-row-actions">
                <button type="button" onClick={() => { if (template.state === "paused") { void toggleTemplate(template); } else { setPending({ title: "Pause template", description: `Once paused, the workspace can no longer create scenarios from "${template.name}". Pause it?`, confirmText: "Pause", run: () => toggleTemplate(template) }); } }}>{template.state === "paused" ? "Resume" : "Pause"}</button>
                <button type="button" onClick={async () => { await fetch(`/api/platform/admin/templates/${template.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: "official" }) }); window.location.reload(); }}>Review</button>
                {template.canDelete ? <button type="button" onClick={() => setPending({ title: "Delete template", description: `Deleting cannot be undone. Delete template "${template.name}"?`, danger: true, confirmText: "Delete", run: () => deleteTemplate(template) })}>Delete</button> : <span>Official template, cannot delete</span>}
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
async function postRecallVerify(engine: string, query: string): Promise<string> {
  try {
    const r = await fetch("/api/platform/admin/recall-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine, query })
    });
    if (!r.ok) return `Recall verification failed (HTTP ${r.status}).`;
    const d = await r.json();
    if (!d.hits?.length) return `Searched ${d.checkedSources ?? 0} real sources for "${engine}"; nothing citable matched this time.`;
    const top = d.hits.slice(0, 2).map((h: { source: string; excerpt: string }, i: number) => `${i + 1}. ${h.source}：${h.excerpt}`).join("　");
    return `Recall verification (real retrieval · ${d.hits.length} hits): ${top}`;
  } catch {
    return "Recall verification failed: cannot reach the backend.";
  }
}

function triggerAssetExport(engine?: string) {
  const qs = engine && engine !== "全部" ? `?engine=${encodeURIComponent(engine)}` : "";
  window.open(`/api/platform/admin/knowledge-assets/export${qs}`, "_blank");
}

async function postBatchReview(engine?: string): Promise<string> {
  try {
    const r = await fetch("/api/platform/admin/batch-review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine })
    });
    if (!r.ok) return `Batch review failed (HTTP ${r.status}).`;
    const d = await r.json();
    return `Batch review finished: ${d.approved} ingested and published, ${d.failed} failed.`;
  } catch {
    return "Batch review failed: cannot reach the backend.";
  }
}

export function AdminKnowledgeBasesPage({ initialAssets = [] }: { initialAssets?: AdminKnowledgeAssetDetail[] }) {
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
  const stats = knowledgeAssetStats(assets);

  return (
    <AdminShell active="/admin/knowledge-bases" title="Asset Overview">
      <AdminPageHead
        eyebrow="Knowledge assets"
        title="Knowledge asset console"
        description="This is the admin console for long-term knowledge asset governance: review every ingested asset by knowledge base, permissions, engine, source, and status, then move into recall verification, reindexing, and publish review."
        actions={<button type="button" className="admin-primary-action" onClick={() => { triggerAssetExport(engineFilter); setConsoleNotice("Generated a real asset CSV and started the download (the current engine filter is the export condition)."); }}>Export asset table</button>}
      />
      {consoleNotice ? <p className="admin-console-notice" role="status">{consoleNotice}</p> : null}

      <section className="admin-asset-overview" aria-label="Asset overview">
        {stats.map((item) => (
          <article key={item.label} className={item.state}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            <small>{item.helper}</small>
          </article>
        ))}
      </section>

      <section className="admin-knowledge-console" aria-label="Knowledge asset console">
        <aside className="admin-asset-scope-rail" aria-label="Asset scope">
          <header>
            <span>Asset scope</span>
            <b>Locate by permissions and engine</b>
          </header>
          <div className="admin-scope-list">
            {["全部", "个人", "团队", "公司"].map((scope) => (
              <button key={scope} type="button" className={scopeFilter === scope ? "active" : ""} onClick={() => setScopeFilter(scope)}>
                <span>{visibilityText(scope)}</span>
                <b>{scope === "全部" ? assets.length : assets.filter((asset) => asset.visibilityLabel === scope).length}</b>
              </button>
            ))}
          </div>
          <div className="admin-engine-tree">
            {(["Gbrain", "Naive RAG", "GraphRAG"] as AdminEngine[]).map((engine) => (
              <button key={engine} type="button" className={engineFilter === engine ? "active" : ""} onClick={() => setEngineFilter(engine)}>
                <span>{engine}</span>
                <small>{frontstageLabelForEngine(engine)}</small>
                <b>{assets.filter((asset) => asset.engine === engine).length}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-panel admin-asset-ledger">
          <PanelHead
            eyebrow="Asset ledger"
            title="Govern assets by knowledge base, engine, and permissions"
            action={<span>{filteredAssets.length} / {assets.length} items</span>}
          />
          <div className="admin-asset-filterbar" aria-label="Asset filters">
            <div>
              {(["全部", "Gbrain", "Naive RAG", "GraphRAG"] as Array<AdminEngine | "全部">).map((engine) => (
                <button key={engine} type="button" className={engineFilter === engine ? "active" : ""} onClick={() => setEngineFilter(engine)}>
                  {engine === "全部" ? "All" : engine}
                </button>
              ))}
            </div>
            <div>
              {scopeOptions.map((scope) => (
                <button key={scope} type="button" className={scopeFilter === scope ? "active" : ""} onClick={() => setScopeFilter(scope)}>
                  {visibilityText(scope)}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-data-table admin-knowledge-ledger-table" role="table" aria-label="Ingested asset ledger">
            <div role="row" className="admin-table-head">
              <span>Asset</span>
              <span>Engine</span>
              <span>Type</span>
              <span>Permissions</span>
              <span>Source</span>
              <span>Status</span>
              <span>Actions</span>
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
                <span>{assetKindLabel(asset.kind)}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel)}</span>
                <span>{asset.sourceOriginalName}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openLocalAdminAssetDetail(asset, setAssetDetail)}>Preview</button>
                  <Link href={engineManagementHref(asset.engine)}>Open management page</Link>
                  <button type="button" onClick={async () => {
                    setSelectedAssetId(asset.id);
                    setConsoleNotice(`Running real recall verification for "${asset.scenarioName}"…`);
                    setConsoleNotice(await postRecallVerify(asset.engine, asset.scenarioName));
                  }}>Recall verification</button>
                </div>
              </div>
            ))}
            {filteredAssets.length === 0 ? (
              <div role="row" className="admin-empty-ledger-row">
                <b>No assets match the current filters<small>Adjust the engine or permission scope, or confirm ingestion in the processing pipeline first.</small></b>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="admin-panel admin-asset-inspector">
          <PanelHead eyebrow="Detail inspector" title={selectedAsset ? selectedAsset.scenarioName : "No asset selected"} />
          {selectedAsset ? (
            <div className="admin-inspector-asset">
              <header>
                <span>{selectedAsset.engine}</span>
                <b>{selectedAsset.title}</b>
                <AdminStatusBadge status={selectedAsset.status} />
              </header>
              <p>{selectedAsset.content}</p>
              <dl>
                <div><dt>Asset type</dt><dd>{assetKindLabel(selectedAsset.kind)}</dd></div>
                <div><dt>Permissions</dt><dd>{visibilityText(assetMetadataValue(selectedAsset, "权限范围") ?? selectedAsset.visibilityLabel)}</dd></div>
                <div><dt>Source file</dt><dd>{selectedAsset.sourceOriginalName}</dd></div>
                <div><dt>Owner</dt><dd>{selectedAsset.ownerName}</dd></div>
              </dl>
              <div className="admin-inspector-actions">
                <button type="button" onClick={async () => { setConsoleNotice(`Running real recall verification for "${selectedAsset.scenarioName}"…`); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName)); }}>Recall verification</button>
                <button type="button" onClick={async () => { setConsoleNotice(`Re-running retrieval on "${selectedAsset.sourceOriginalName}" to check index availability…`); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName)); }}>Index check</button>
                <button type="button" onClick={async () => { setConsoleNotice(`Running a permission-scoped recall review for "${selectedAsset.scenarioName}"…`); setConsoleNotice(await postRecallVerify(selectedAsset.engine, selectedAsset.scenarioName)); }}>Permission review</button>
                <button type="button" onClick={() => openLocalAdminAssetDetail(selectedAsset, setAssetDetail)}>Quick preview</button>
              </div>
            </div>
          ) : (
            <div className="admin-asset-empty-inline">
              <b>No ingested assets yet</b>
              <p>Once an admin confirms workspace submissions for ingestion, governable knowledge objects appear here.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="admin-panel admin-engine-governance">
        <PanelHead eyebrow="Engine governance" title="Asset governance entry points for the three RAG engines" action={<button type="button" onClick={async () => { setConsoleNotice("Running a real batch ingest review…"); setConsoleNotice(await postBatchReview()); }}>Batch review</button>} />
        <div className="admin-governance-lanes">
          {ragOperationModes.map((mode) => (
            <article key={mode.id}>
              <header>
                <div>
                  <span>{frontstageText(mode.frontstageLabel)}</span>
                  <h2>{mode.label} governance</h2>
                </div>
                <Link href={engineManagementHref(mode.label)} className="admin-engine-open-link">Open management page</Link>
              </header>
              <b className="admin-governance-count">{assets.filter((asset) => asset.engine === mode.label).length}</b>
              <ul>
                {governanceStepsForEngine(mode.label).map((step) => <li key={step}>{step}</li>)}
              </ul>
              <div className="admin-governance-assets">
                {mode.assetViews.map((asset) => (
                  <button
                    key={asset.kind}
                    type="button"
                    data-asset-kind={asset.kind}
                    aria-label={`${mode.label} ${asset.label}`}
                    onClick={() => void openAdminAssetDetail(mode, asset, setAssetDetail)}
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
  const [selectedKind, setSelectedKind] = useState("全部");
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [assetDetail, setAssetDetail] = useState<AdminAssetDetailState | null>(null);
  const mode = modeForEngine(engine);
  const kindOptions = ["全部", ...mode.assetViews.map((asset) => asset.kind)];
  const filteredAssets = initialAssets.filter((asset) => selectedKind === "全部" || asset.kind === selectedKind);
  const selectedAsset = initialAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? initialAssets[0];
  const pageConfig = enginePageConfig(engine);

  return (
    <AdminShell active={engineManagementHref(engine)} title={`${engine} Management`}>
      <AdminPageHead
        eyebrow="Knowledge assets"
        title={`${engine} asset management`}
        description={pageConfig.description}
        actions={<Link className="admin-primary-action" href="/admin/knowledge-bases">Back to asset overview</Link>}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-engine-detail-overview" aria-label={`${engine} admin overview`}>
        {pageConfig.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value(initialAssets)}</b>
            <small>{metric.helper}</small>
          </article>
        ))}
      </section>

      <section className="admin-engine-workbench-map" aria-label={`${engine} management workbench`}>
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
              onClick={() => setNotice(`${area.label} is now the active workspace.`)}
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
        <PanelHead eyebrow="Processing chain" title={pageConfig.workflowTitle} action={<button type="button" onClick={async () => { setNotice(`Running real batch governance (ingest review) for ${engine}…`); setNotice(await postBatchReview(engine)); }}>Batch governance</button>} />
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
          <PanelHead eyebrow="Asset data" title={pageConfig.assetTitle} action={<span>{filteredAssets.length} / {initialAssets.length} items</span>} />
          <div className="admin-asset-filterbar" aria-label={`${engine} asset type filter`}>
            <div>
              {kindOptions.map((kind) => (
                <button key={kind} type="button" className={selectedKind === kind ? "active" : ""} onClick={() => setSelectedKind(kind)}>
                  {kind === "全部" ? "All" : assetKindLabel(kind)}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-data-table admin-engine-asset-table" role="table" aria-label={`${engine} asset table`}>
            <div role="row" className="admin-table-head">
              <span>Asset</span>
              <span>Type</span>
              <span>Source</span>
              <span>Permissions</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredAssets.map((asset) => (
              <div role="row" key={asset.id} className={selectedAsset?.id === asset.id ? "active" : ""} data-engine-row={asset.id}>
                <button type="button" onClick={() => setSelectedAssetId(asset.id)}>
                  <b>{asset.title}<small>{asset.scenarioName}</small></b>
                </button>
                <span>{assetKindLabel(asset.kind)}</span>
                <span>{asset.sourceOriginalName}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel)}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openLocalAdminAssetDetail(asset, setAssetDetail)}>View data</button>
                  <button type="button" onClick={async () => { setNotice(`Running real ${pageConfig.primaryAction} retrieval for "${asset.title}"…`); setNotice(await postRecallVerify(engine, asset.title)); }}>{pageConfig.primaryAction}</button>
                </div>
              </div>
            ))}
            {filteredAssets.length === 0 ? (
              <div role="row" className="admin-empty-ledger-row">
                <b>No assets of this type<small>Finish {engine} ingestion in the processing pipeline first, or switch the filter.</small></b>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="admin-panel admin-engine-inspector">
          <PanelHead eyebrow="Asset inspector" title={selectedAsset ? selectedAsset.scenarioName : "No asset selected"} />
          {selectedAsset ? (
            <div className="admin-inspector-asset">
              <header>
                <span>{assetKindLabel(selectedAsset.kind)}</span>
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
                  <button key={action} type="button" onClick={async () => { setNotice(`Running real ${action} retrieval for "${selectedAsset.title}"…`); setNotice(await postRecallVerify(engine, selectedAsset.title)); }}>{action}</button>
                ))}
                <button type="button" onClick={() => openLocalAdminAssetDetail(selectedAsset, setAssetDetail)}>Quick preview</button>
              </div>
            </div>
          ) : (
            <div className="admin-asset-empty-inline">
              <b>No {engine} assets yet</b>
              <p>Governable data objects appear here once ingestion is confirmed.</p>
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
  const chunkAssets = assets.filter((asset) => asset.kind === "chunk");
  const vectorAssets = assets.filter((asset) => asset.kind === "embedding");
  const citationAssets = assets.filter((asset) => asset.kind === "citation");
  return (
    <section className="admin-panel admin-engine-specific-console admin-naive-console">
      <PanelHead eyebrow="Naive RAG console" title="Chunk browser, vector index batches, and TopK recall experiments" action={<button type="button" onClick={async () => { onNotice("Starting a real Naive RAG recall experiment…"); onNotice(await postRecallVerify("Naive RAG", "Policy, contract, and report highlights")); }}>New recall experiment</button>} />
      <div className="admin-naive-layout">
        <section className="admin-engine-subpanel">
          <header>
            <span>Documents and chunks · Chunk browser</span>
            <b>{chunkAssets.length || assets.length} chunks</b>
          </header>
          <div className="admin-chunk-table" role="table" aria-label="Naive RAG chunk browser">
            <div role="row" className="admin-table-head">
              <span>Chunk</span>
              <span>Source</span>
              <span>Scope</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {(chunkAssets.length ? chunkAssets : assets).map((asset, index) => (
              <div role="row" key={asset.id} data-chunk-row={asset.id}>
                <b>{asset.title}<small>{truncateAdminText(asset.content, 72)}</small></b>
                <span>{asset.sourceOriginalName}</span>
                <span>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel)}</span>
                <AdminStatusBadge status={asset.status} />
                <div className="admin-row-actions">
                  <button type="button" onClick={async () => { onNotice(`Running a real citation spot check on "${asset.title}"…`); onNotice(await postRecallVerify("Naive RAG", asset.title)); }}>Citation spot check</button>
                  <button type="button" onClick={() => onNotice(`Chunk ${index + 1} disabled.`)}>Disable</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-engine-subpanel admin-retrieval-lab">
          <header>
            <span>TopK recall experiment</span>
            <b>{selectedAsset?.scenarioName ?? "Current knowledge base"}</b>
          </header>
          <label>
            <span>Try a question</span>
            <input readOnly value={selectedAsset ? `What questions can ${selectedAsset.scenarioName} answer?` : "Enter a business question to verify retrieval"} />
          </label>
          <div className="admin-retrieval-controls">
            <div><span>TopK</span><b>8</b></div>
            <div><span>Threshold</span><b>0.72</b></div>
            <div><span>Rerank</span><b>On</b></div>
          </div>
          <button type="button" onClick={async () => { onNotice("Running real TopK retrieval…"); onNotice(await postRecallVerify("Naive RAG", "Key policies, clauses, and processes")); }}>Run retrieval</button>
        </aside>

        <section className="admin-engine-subpanel admin-vector-batches">
          <header>
            <span>Vector index batches</span>
            <b>{vectorAssets.length || assets.length} batches</b>
          </header>
          <div>
            {(vectorAssets.length ? vectorAssets : assets).slice(0, 4).map((asset) => (
              <article key={`vector-${asset.id}`}>
                <span>{asset.sourceOriginalName}</span>
                <b>{asset.metric}</b>
                <small>Embedding, payload, and metadata filter registered</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-citation-audit">
          <header>
            <span>Citation evidence</span>
            <b>{citationAssets.length || assets.length} entries</b>
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
  const graphAssets = assets.length ? assets : selectedAsset ? [selectedAsset] : [];
  const primary = selectedAsset ?? graphAssets[0];
  return (
    <section className="admin-panel admin-engine-specific-console admin-graphrag-console">
      <PanelHead eyebrow="GraphRAG console" title="Graph canvas, edge table, low-confidence review queue, and multi-hop path queries" action={<button type="button" onClick={async () => { onNotice("Running a real graph review retrieval for GraphRAG…"); onNotice(await postRecallVerify("GraphRAG", "Key entities and relationships")); }}>Graph review</button>} />
      <div className="admin-graphrag-layout">
        <section className="admin-graph-workbench">
          <header>
            <span>Graph canvas</span>
            <b>{primary?.scenarioName ?? "Relationship knowledge base"}</b>
          </header>
          <div className="admin-graph-stage" aria-label="GraphRAG graph canvas">
            <svg viewBox="0 0 720 360" role="img" aria-label="Entity relationship graph">
              <line x1="165" y1="176" x2="360" y2="90" />
              <line x1="165" y1="176" x2="360" y2="250" />
              <line x1="360" y1="90" x2="560" y2="176" />
              <line x1="360" y1="250" x2="560" y2="176" />
              <g data-graph-node={primary?.scenarioName ?? "Primary entity"} transform="translate(165 176)">
                <circle r="48" className="main" />
                <text textAnchor="middle" y="4">{graphNodeLabel(primary?.scenarioName ?? "Business entity")}</text>
              </g>
              <g data-graph-node="Risk signal" transform="translate(360 90)">
                <circle r="38" className="risk" />
                <text textAnchor="middle" y="4">Risk signal</text>
              </g>
              <g data-graph-node="Evidence source" transform="translate(360 250)">
                <circle r="38" />
                <text textAnchor="middle" y="4">Evidence source</text>
              </g>
              <g data-graph-node="Next action" transform="translate(560 176)">
                <circle r="42" className="action" />
                <text textAnchor="middle" y="4">Next action</text>
              </g>
            </svg>
          </div>
        </section>

        <section className="admin-engine-subpanel admin-edge-table">
          <header>
            <span>Edge table</span>
            <b>{graphAssets.length || 1} candidate edges</b>
          </header>
          <div role="table" aria-label="GraphRAG edge table">
            <div role="row" className="admin-table-head">
              <span>From</span>
              <span>Relationship</span>
              <span>To</span>
              <span>Confidence</span>
            </div>
            {graphAssets.map((asset, index) => (
              <div role="row" key={`edge-${asset.id}`}>
                <span>{graphNodeLabel(asset.scenarioName)}</span>
                <b>{index % 2 === 0 ? "affects" : "relates to"}</b>
                <span>{assetKindLabel(asset.kind)}</span>
                <strong>{Math.max(72, 93 - index * 6)}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-path-query">
          <header>
            <span>Multi-hop path query</span>
            <b>Local / Global / DRIFT</b>
          </header>
          <label>
            <span>Path question</span>
            <input readOnly value={primary ? `How do risks at ${primary.scenarioName} affect the renewal?` : "Enter an entity path question"} />
          </label>
          <div className="admin-path-result">
            <span>{graphNodeLabel(primary?.scenarioName ?? "Customer")}</span>
            <i />
            <span>Risk signal</span>
            <i />
            <span>Evidence source</span>
            <i />
            <span>Next action</span>
          </div>
          <button type="button" onClick={async () => { onNotice("Running a real multi-hop path query…"); onNotice(await postRecallVerify("GraphRAG", "Relationships among customers, owners, and suppliers")); }}>Run path query</button>
        </section>

        <section className="admin-engine-subpanel admin-review-queue">
          <header>
            <span>Low-confidence review queue</span>
            <b>{Math.max(1, graphAssets.filter((asset) => asset.kind === "review").length)} items</b>
          </header>
          {(graphAssets.length ? graphAssets : []).slice(0, 4).map((asset) => (
            <article key={`review-${asset.id}`}>
              <b>{asset.title}</b>
              <p>{truncateAdminText(asset.content, 96)}</p>
              <button type="button" onClick={async () => { onNotice(`Running a real relationship review retrieval for "${asset.title}"…`); onNotice(await postRecallVerify("GraphRAG", asset.title)); }}>Review</button>
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
  const wikiAssets = assets.length ? assets : selectedAsset ? [selectedAsset] : [];
  return (
    <section className="admin-panel admin-engine-specific-console admin-gbrain-console">
      <PanelHead eyebrow="Gbrain console" title="Page tree, fact card governance, topic links, and source mapping" action={<button type="button" onClick={async () => { onNotice("Running a real recall review for Gbrain…"); onNotice(await postRecallVerify("Gbrain", "Knowledge page highlights")); }}>Publish review</button>} />
      <div className="admin-gbrain-layout">
        <section className="admin-engine-subpanel admin-page-tree">
          <header>
            <span>Page tree</span>
            <b>{wikiAssets.length || 1} pages</b>
          </header>
          <div className="admin-tree-list" role="tree" aria-label="Gbrain page tree">
            {wikiAssets.map((asset) => (
              <article key={asset.id} role="treeitem" data-wiki-page={asset.id}>
                <b>{asset.scenarioName}</b>
                <span>{asset.title}</span>
                <small>{asset.sourceOriginalName} · {visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-engine-subpanel admin-fact-governance">
          <header>
            <span>Fact card governance</span>
            <b>Fact memory</b>
          </header>
          {(wikiAssets.length ? wikiAssets : []).slice(0, 4).map((asset, index) => (
            <article key={`fact-${asset.id}`}>
              <span>Fact {index + 1}</span>
              <b>{truncateAdminText(asset.content, 76)}</b>
              <small>Source: {asset.sourceOriginalName}</small>
              <button type="button" onClick={async () => { onNotice(`Running a real fact spot-check retrieval for "${asset.title}"…`); onNotice(await postRecallVerify("Gbrain", asset.title)); }}>Spot check</button>
            </article>
          ))}
        </section>

        <section className="admin-engine-subpanel admin-link-map">
          <header>
            <span>Topic links</span>
            <b>Directories and topic clusters</b>
          </header>
          <div className="admin-link-network">
            {pageConfig.stages.slice(1, 5).map((stage) => <span key={stage}>{stage}</span>)}
          </div>
          <button type="button" onClick={async () => { onNotice("Validating real recall for Gbrain pages…"); onNotice(await postRecallVerify("Gbrain", "Page directories and links")); }}>Rebuild directory</button>
        </section>

        <section className="admin-engine-subpanel admin-source-map">
          <header>
            <span>Source mapping</span>
            <b>{new Set(wikiAssets.map((asset) => asset.sourceOriginalName)).size} sources</b>
          </header>
          {wikiAssets.map((asset) => (
            <article key={`source-${asset.id}`}>
              <b>{asset.sourceOriginalName}</b>
              <p>{asset.title} / {asset.scenarioName}</p>
              <small>{visibilityText(assetMetadataValue(asset, "权限范围") ?? asset.visibilityLabel)}</small>
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
    setNotice(`Running a real regression verification retrieval for "${label}" (${engine})…`);
    setNotice(await postRecallVerify(engine, label));
  };
  const runAllVerify = async () => {
    setNotice("Running real regression verification for every policy…");
    const results = await Promise.all(profiles.map(async (p) => `${p.name}: ${await postRecallVerify(scopeToEngine(p.scope), p.name)}`));
    setNotice(results.join(" | "));
  };
  return (
    <AdminShell active="/admin/strategies" title="Retrieval Policies">
      <AdminPageHead
        eyebrow="Retrieval policies"
        title="Expose configurable retrieval and answering policies per scenario"
        description="Every policy needs a scope, a default path, and tunable parameters so an admin can pick a stable, explainable RAG engine policy for each business scenario."
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      <section className="admin-strategy-console" aria-label="Retrieval policy console">
        <section className="admin-panel admin-strategy-matrix">
          <PanelHead eyebrow="Policy matrix" title="Policies, engines, workspace mapping, and status" action={<button type="button" onClick={() => runAllVerify()}>New policy</button>} />
          <div className="admin-data-table admin-strategy-table" role="table" aria-label="Policy matrix">
            <div role="row" className="admin-table-head">
              <span>Policy</span>
              <span>Engine</span>
              <span>Workspace binding</span>
              <span>Controls</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {profiles.map((profile) => {
              const mode = ragOperationModes.find((item) => item.label === profile.scope);
              return (
                <div role="row" key={profile.id} data-strategy-id={profile.id}>
                  <b>{profile.name}<small>{profile.impact}</small></b>
                  <span>{frontstageText(profile.scope)}</span>
                  <span>{frontstageText(mode?.frontstageLabel ?? "公司大脑")}</span>
                  <span>{profile.controls.join(" / ")}</span>
                  <AdminStatusBadge status="启用中" />
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => runStrategyVerify(profile.scope, profile.name)}>Edit parameters</button>
                    <button type="button" onClick={() => runStrategyVerify(profile.scope, profile.name)}>Regression check</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="admin-panel admin-strategy-parameter-panel">
          <PanelHead eyebrow="Parameters" title={primaryProfile.name} action={<AdminStatusBadge status="启用中" />} />
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
            <span>Workspace binding</span>
            <b>{frontstageText(profileMode?.frontstageLabel ?? "公司大脑")}</b>
            <p>{profileMode?.reviewGate ?? "Company-wide policies require an admin to confirm citation and permission boundaries."}</p>
          </div>
        </aside>
      </section>

      <section className="admin-panel admin-strategy-regression">
        <PanelHead eyebrow="Regression checks" title="Business question sets that must pass before publishing" action={<button type="button" onClick={() => runAllVerify()}>Run all checks</button>} />
        <div className="admin-data-table admin-strategy-regression-table" role="table" aria-label="Policy regression checks">
          <div role="row" className="admin-table-head">
            <span>Evaluation set</span>
            <span>Applicable policy</span>
            <span>Real evidence</span>
            <span>Readiness</span>
            <span>Actions</span>
          </div>
          {evaluations.map((row) => {
            const scope = profiles.find((p) => p.name === row.profile)?.scope ?? "文档证据";
            return (
              <div role="row" key={row.profile}>
                <b>{row.profile}<small>Covers official documents, relationship paths, and refusal boundaries</small></b>
                <span>{row.profile}</span>
                <span>{row.evidence} real evidence items</span>
                <span>{row.score} · {row.latency}</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => runStrategyVerify(scope, row.profile)}>View sample</button>
                  <button type="button" onClick={() => runStrategyVerify(scope, row.profile)}>Re-verify</button>
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
  const frontstageMapping = requestFrontstageMapping(activeRequest);
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
      setActionMessage("Select an ingest engine and confirm its parameters first.");
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
        message: `Running: ${selectedMode.runtimeFlow[0]?.stage ?? "ingest"}`
      });
      for (let index = 0; index < selectedMode.runtimeFlow.length; index += 1) {
        setIngestionRun({
          requestId: activeRequest.id,
          engine: selectedEngine,
          status: "running",
          currentStep: index,
          message: `Running: ${selectedMode.runtimeFlow[index].stage}`
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
          message: "Ingest complete. Knowledge assets were generated and are available in the asset area."
        });
      }
      setActionMessage(action === "approve" ? "Ingest confirmed. The workspace task is now usable and the console generated its assets." : "Returned to the user for more material; the workspace task state is updated.");
    } catch {
      if (action === "approve") {
        setIngestionRun((current) => current ? { ...current, status: "failed", message: "Ingest failed. Check the material, model services, and permission settings, then retry." } : current);
      }
      setActionMessage("The action failed. Try again later.");
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
        message: "This entry has only a sample file name and no real upload record, so it cannot be previewed online."
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
        message: "The original file is unavailable; it may have been cleaned up per the ingest retention policy."
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
        setActionMessage("This submission has no viewable files.");
        return;
      }
      void openFilePreview(record.name, record.storedFile);
      return;
    }
    if (action === "配置引擎策略") {
      setActionMessage(`Saved the ${selectedEngine} policy draft; the current parameters are applied when ingest is confirmed.`);
      return;
    }
    setActionMessage("Material files are registered on the current request.");
  }

  return (
    <AdminShell active="/admin/pipelines" title="Processing Pipeline">
      <AdminPageHead
        eyebrow="Processing pipeline"
        title="Intake, policy configuration, ingest review, and publishing"
        description="After the workspace submits material, an admin reviews the files here, confirms the permission scope, chooses the real ingest engine (Gbrain / Naive RAG / GraphRAG), and decides the business form it maps to in the workspace."
        actions={<button type="button" className="admin-primary-action">Batch process pending</button>}
        compact
      />

      <section className="admin-pipeline-layout focused">
        <section className="admin-intake-selector">
          <PanelHead
            eyebrow="Pending queue"
            title={`${actionableRequests.length} submissions need processing`}
            action={<button type="button">Sort by time</button>}
          />
          <div className="admin-intake-table" role="table" aria-label="Pending submissions">
            <div className="admin-intake-table-head" role="row">
              <span>Status</span>
              <span>Submission</span>
              <span>Requester</span>
              <span>Scope</span>
              <span>Files</span>
              <span>Suggested engine</span>
              <span>Submitted</span>
              <span>Actions</span>
            </div>
            {actionableRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                role="row"
                className={`admin-intake-row ${request.id === activeRequest.id ? "active" : ""}`}
                onClick={() => setSelectedRequestId(request.id)}
              >
                <span role="cell" className="admin-intake-status">{statusText(request.status)}</span>
                <b role="cell">{request.scenarioName}</b>
                <span role="cell">{request.requester}</span>
                <span role="cell">{visibilityText(request.visibility)}</span>
                <span role="cell">{request.files.length} files</span>
                <span role="cell" className="admin-intake-engine">{requestRecommendedEngines(request).join(" / ")}</span>
                <span role="cell">{request.submittedAt}</span>
                <strong role="cell">Process</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-active-request workbench">
          <PanelHead eyebrow="Scenario submitted from the workspace" title={activeRequest.scenarioName} action={<AdminStatusBadge status={activeRequest.status} />} />

          <div className="admin-scenario-brief">
            <div className="admin-scenario-main">
              <span>Scenario</span>
              <h3>{activeRequest.scenarioName}</h3>
              <p>{activeRequest.requestedOutcome}</p>
            </div>
            <dl>
              <div><dt>Requester</dt><dd>{activeRequest.requester}</dd></div>
              <div><dt>Publishing scope</dt><dd>{visibilityText(activeRequest.visibility)}</dd></div>
              <div><dt>Submitted</dt><dd>{activeRequest.submittedAt}</dd></div>
              <div><dt>Suggested engine</dt><dd>{recommendedEngines.join(" / ")}</dd></div>
              <div><dt>Knowledge objects</dt><dd>{activeRequest.knowledgeObjectCount ? `${activeRequest.knowledgeObjectCount}` : "Not ingested"}</dd></div>
            </dl>
            <strong>{activeRequest.permissionImpact}</strong>
          </div>

          <div className="admin-uploaded-documents">
            <PanelHead eyebrow="Uploaded files" title="Verify the files submitted from the workspace first" action={<button type="button">Expand all previews</button>} />
            <div className="admin-document-grid">
              {documentRecords.map(({ name, storedFile }, index) => {
                const preview = resolveAdminFilePreview(name);
                const state = storedFile?.originalState ?? "temporary";
                return (
                  <article key={name} className={`${preview.previewable ? "previewable" : ""} ${state}`}>
                    <div className="admin-file-icon" data-kind={preview.kind}>{preview.kind}</div>
                    <div>
                      <b>{name}</b>
                      <span>{preview.label} · {index === 0 ? "Business brief" : "Pending parse"}</span>
                      <small>{storedFile?.retentionReason ?? (preview.previewable ? "Online preview supported; the original file is handled per policy after ingest." : "Unpack before preview; the archive is cleaned up after ingest by default.")}</small>
                      <div className="admin-retention-row">
                        <em>{fileStateLabel(storedFile)}</em>
                        <em>{retentionPolicyLabel(storedFile?.retentionPolicy)}</em>
                        <em>{fileAccessLabel(storedFile)}</em>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openFilePreview(name, storedFile)}
                    >
                      {preview.previewable ? "Preview" : "Unpack"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="admin-engine-workbench">
            <header className="admin-engine-workbench-head">
              <div>
                <span>Engine policy</span>
                <h3>Choose an ingest engine and set retrieval parameters</h3>
              </div>
              <small>{selectedIsRecommended ? "Within the system recommendation" : "Manually selected by an admin"}</small>
            </header>
            <p>An admin decides here which real RAG path the material enters and configures that path’s runtime parameters; the workspace mapping is applied at publish time.</p>

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
                      setActionMessage(`Selected ${engine}; the workspace mapping is ${frontstageText(mode.frontstageLabel)}.`);
                  }}
                >
                    <b>{mode.label}</b>
                    <span>{mode.service}</span>
                    <small>{recommended ? "Recommended" : "Optional"} · Workspace mapping: {frontstageText(mode.frontstageLabel)}</small>
                </button>
                );
              })}
            </div>

            {strategyExpanded ? (
              <section className="admin-parameter-panel admin-parameter-panel-expanded">
                <header>
                  <span>Configurable parameters</span>
                  <h4>{selectedMode.label} parameters</h4>
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
                            {value === "true" ? "Enabled" : "Disabled"}
                          </button>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="admin-engine-collapsed">
                <b>Select an ingest engine to expand its parameters</b>
                <p>Only the parameters an admin needs are exposed here; the actual parse, chunk, extract, embed, and publish steps appear live after ingestion is confirmed.</p>
              </div>
            )}
          </div>

          {activeIngestionRun ? (
            <section className={`admin-ingestion-progress ${activeIngestionRun.status}`}>
              <header>
                <div>
                  <span>Ingest progress</span>
                  <h3>{processMode.label} is processing files</h3>
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
                        <small>Artifact: {step.artifact}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showIngestedAssets ? (
            <section className="admin-ingested-assets">
	              <PanelHead eyebrow="Knowledge assets" title={`Viewable assets generated by ${processMode.label}`} action={<Link href="/admin/knowledge-bases">Open asset ledger</Link>} />
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
	                      onClick={() => void openAdminAssetDetail(processMode, asset, setAssetDetail)}
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
                  {pendingAction && actionable ? "Processing" : action === "配置引擎策略" ? "Save policy configuration" : actionText(action)}
                </button>
              );
            })}
          </div>
          {actionMessage && <p className="admin-action-message">{actionMessage}</p>}
        </section>

        <aside className="admin-strategy-inspector">
          <PanelHead eyebrow="Quality and publishing" title={selectedMode.label} action={<AdminStatusBadge status={selectedMode.status} />} />
          <div className="admin-inspector-hero">
            <span>{selectedIsRecommended ? "System recommendation" : "Manual selection"}</span>
            <h3>{selectedMode.service}</h3>
            <p>Workspace mapping: {frontstageText(selectedMode.frontstageLabel)}</p>
          </div>

          <div className="admin-inspector-section">
            <span>Why recommended</span>
            <div className="admin-rag-stage-list compact">
              {selectedMode.inspector.map((item, index) => (
                <span key={item}><i>{index + 1}</i>{item}</span>
              ))}
            </div>
          </div>

          <div className="admin-inspector-section">
            <span>Quality gates</span>
            <div className="admin-gate-list">
              {selectedMode.qualityGates.map((gate) => (
                <article key={gate.label}>
                  <b>{gate.label}</b>
                  <small>{gateStatusText(gate.status)}</small>
                  <p>{gate.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-inspector-section">
            <span>Expected outputs</span>
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
            <span>Permission impact</span>
            <p>{activeRequest.permissionImpact}</p>
          </div>

          <div className="admin-inspector-section accent">
            <span>Workspace mapping</span>
            <b>{frontstageText(selectedMode.frontstageLabel)}</b>
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
  const lowConfidenceEdges = adminGraphSnapshot.edges.filter((edge) => edge.confidence < 0.8);
  const [notice, setNotice] = useState("");
  const runGraph = async (query: string) => {
    setNotice(`Running a real graph retrieval for GraphRAG: ${query}…`);
    setNotice(await postRecallVerify("GraphRAG", query));
  };
  return (
    <AdminShell active="/admin/graph" title="Knowledge Graph">
      <AdminPageHead
        eyebrow="Knowledge graph"
        title="Nodes, relationships, evidence, and confidence"
        description="The knowledge graph powers customer profiles, risk due diligence, and multi-hop retrieval. The console must expose entity relationships, evidence sources, confidence, and low-confidence review items."
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      <section className="admin-graph-ops" aria-label="Graph operations console">
        <section className="admin-panel admin-graph-main">
          <PanelHead eyebrow="Graph operations console" title="Entity network, edges, and evidence chains" action={<button type="button" onClick={() => runGraph("Entity network and relationship layout")}>Recompute layout</button>} />
          <div className="admin-graph-canvas">
            <svg viewBox="0 0 900 480" role="img" aria-label="Knowledge graph">
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
          <div className="admin-graph-node-strip" aria-label="Entity directory">
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
          <PanelHead eyebrow="Entity directory" title="Entity groups and health" />
          <div className="admin-graph-entity-list">
            {adminGraphSnapshot.nodes.map((node) => (
              <article key={`entity-${node.id}`}>
                <b>{node.label}</b>
                <span>{node.type}</span>
                <small>{node.health === "risk" ? "Needs review" : node.health === "watch" ? "Watching" : "Stable"}</small>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="admin-graph-bottom-grid">
        <section className="admin-panel admin-graph-edge-ledger">
          <PanelHead eyebrow="Edge ledger" title="Edges, evidence, confidence, and actions" action={<button type="button" onClick={() => { triggerAssetExport("GraphRAG"); setNotice("Generated a real knowledge-graph asset CSV and started the download."); }}>Export edge table</button>} />
          <div className="admin-data-table admin-graph-edge-table" role="table" aria-label="Edge ledger">
            <div role="row" className="admin-table-head">
              <span>Relationship</span>
              <span>From</span>
              <span>To</span>
              <span>Evidence</span>
              <span>Confidence</span>
              <span>Actions</span>
            </div>
            {adminGraphSnapshot.edges.map((edge) => (
              <div role="row" key={`${edge.source}-${edge.target}-${edge.label}`}>
                <b>{edge.label}</b>
                <span>{graphNodeName(edge.source)}</span>
                <span>{graphNodeName(edge.target)}</span>
                <span>{edge.evidence}</span>
                <span>{Math.round(edge.confidence * 100)}%</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => runGraph("Evidence sources for the relationship")}>View sources</button>
                  <button type="button" onClick={() => runGraph("Low-confidence relationship review")}>Review</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-panel admin-graph-review">
          <PanelHead eyebrow="Low-confidence queue" title={`${lowConfidenceEdges.length} relationships need review`} />
          <div className="admin-graph-review-list">
            {lowConfidenceEdges.map((edge) => (
              <article key={`review-${edge.source}-${edge.target}`}>
                <b>{graphNodeName(edge.source)} → {graphNodeName(edge.target)}</b>
                <span>{edge.label} · {edge.evidence}</span>
                <small>{Math.round(edge.confidence * 100)}% confidence</small>
              </article>
            ))}
          </div>
        </aside>

        <aside className="admin-panel admin-graph-path">
          <PanelHead eyebrow="Path explorer" title="Multi-hop path verification" action={<button type="button" onClick={() => runGraph("Multi-hop paths between customers, owners, and suppliers")}>Run path query</button>} />
          <div className="admin-path-result">
            <span>Northwind Labs</span>
            <i>renewing</i>
            <span>Annual framework agreement</span>
            <i>tied to expansion</i>
            <span>Phase 2 expansion</span>
          </div>
          <p>Verifies that workspace risk due diligence, customer 360, and opportunity analysis get explainable paths.</p>
        </aside>
      </section>
    </AdminShell>
  );
}

async function openAdminAssetDetail(
  mode: RagOperationMode,
  asset: RagAssetView,
  setAssetDetail: (detail: AdminAssetDetailState | null) => void
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
      throw new Error(typeof body.message === "string" ? body.message : "Unable to read knowledge base assets.");
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
      message: error instanceof Error ? error.message : "Unable to read knowledge base assets."
    });
  }
}

function openLocalAdminAssetDetail(record: AdminKnowledgeAssetDetail, setAssetDetail: (detail: AdminAssetDetailState | null) => void) {
  const mode = modeForEngine(record.engine);
  const asset = mode.assetViews.find((view) => view.kind === record.kind);
  setAssetDetail({
    mode: { label: mode.label, frontstageLabel: mode.frontstageLabel },
    asset: {
      kind: record.kind,
      label: asset?.label ?? assetKindLabel(record.kind),
      description: asset?.description ?? "Inspect the body, source, and governance metadata of this ingested asset.",
      metric: record.metric
    },
    status: "ready",
    records: [record]
  });
}

function knowledgeAssetStats(assets: AdminKnowledgeAssetDetail[]) {
  const scenarioCount = new Set(assets.map((asset) => asset.scenarioName)).size;
  const sourceCount = new Set(assets.map((asset) => asset.sourceOriginalName)).size;
  return [
    { label: "Knowledge bases", value: scenarioCount, helper: "Published to the console asset ledger", state: "healthy" },
    { label: "Ingested assets", value: assets.length, helper: "Chunks, graphs, pages, and citation objects", state: "healthy" },
    { label: "Source files", value: sourceCount, helper: "Permissions and source tracking preserved", state: "watch" },
    { label: "Awaiting review", value: assets.filter((asset) => ["待抽检", "待复核", "观察"].includes(asset.status)).length, helper: "Low confidence, permissions, and citation boundaries", state: "watch" }
  ];
}

function modeForEngine(engine: AdminEngine): RagOperationMode {
  return ragOperationModes.find((mode) => mode.label === engine) ?? ragOperationModes[0];
}

function frontstageLabelForEngine(engine: AdminEngine) {
  return frontstageText(modeForEngine(engine).frontstageLabel);
}

function engineManagementHref(engine: string) {
  if (engine === "Naive RAG") return "/admin/knowledge-bases/naive";
  if (engine === "GraphRAG") return "/admin/graph";
  return "/admin/knowledge-bases/gbrain";
}

function assetKindLabel(kind: string) {
  const labels: Record<string, string> = {
    wiki: "Page",
    fact: "Fact card",
    link: "Link",
    source: "Source",
    chunk: "Document chunk",
    embedding: "Vector index",
    citation: "Citation evidence",
    eval: "Trial question result",
    entity: "Entity",
    relationship: "Relationship edge",
    graph: "Graph",
    review: "Review item"
  };
  return labels[kind] ?? kind;
}

function assetMetadataValue(asset: AdminKnowledgeAssetDetail, label: string) {
  return asset.metadata.find((item) => item.label === label)?.value;
}

function truncateAdminText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function graphNodeLabel(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 8) return text || "Entity";
  return `${text.slice(0, 7)}…`;
}

function graphNodeName(id: string) {
  return adminGraphSnapshot.nodes.find((node) => node.id === id)?.label ?? id;
}

function governanceStepsForEngine(engine: string) {
  if (engine === "Naive RAG") return ["Document parsing and cleanup", "Chunking and overlap checks", "Vector index status", "Citation evidence spot checks", "Recall verification"];
  if (engine === "GraphRAG") return ["Entity extraction", "Edge construction", "Graph visualization", "Low-confidence review", "Multi-hop verification"];
  return ["Page generation", "Fact card capture", "Directory links", "Source tracking", "Publish boundary review"];
}

function enginePageConfig(engine: AdminEngine) {
  if (engine === "Naive RAG") {
    return {
      description: "Manage document parsing, chunking, vector indexes, citation evidence, and recall verification. You should be able to inspect every chunk, index status, source snippet, and Q&A hit directly.",
      workflowTitle: "Governance chain from document ingest to citable answers",
      assetTitle: "Documents, chunks, indexes, and citation assets",
      primaryAction: "Recall verification",
      consoleTitle: "Naive RAG console",
      workbench: {
        eyebrow: "Document library workbench",
        title: "Govern the evidence library by document, chunk, vector, and recall result",
        description: "Suited to policies, contracts, handbooks, and spreadsheets. Admins need to see parse results, chunk boundaries, embedding status, metadata filters, and recall debugging records directly.",
        areas: [
          { label: "Chunk queue", description: "Inspect page numbers, paragraphs, chunk_size, overlap, and enabled state" },
          { label: "Vector records", description: "Inspect the embedding model, dimensions, index batches, and rebuild status" },
          { label: "Metadata filters", description: "Limit retrieval by department, file, version, permission scope, and tags" },
          { label: "Recall debugging", description: "Use business questions to check TopK, thresholds, reranking, and evidence-free refusals" }
        ],
        controls: [
          { label: "Indexing", value: "Chunk + Embedding", helper: "Document chunks enter the vector index and answers must keep their sources" },
          { label: "Retrieval policy", value: "TopK / threshold / rerank", helper: "Verify retrieval hits and citation coverage before publishing" },
          { label: "Governance actions", value: "Re-chunk · reindex · disable a chunk", helper: "Handle anomalous chunks precisely" }
        ]
      },
      stages: ["Document parsing", "Chunk cleanup", "Embedding", "Citation indexing", "Recall verification"],
      actions: ["Recall verification", "Reindex", "Citation spot check", "Disable chunk"],
      metrics: [
        { label: "Document chunks", helper: "Inspect body, source, and overlap", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "chunk").length },
        { label: "Vector indexes", helper: "Index batches and retrievability", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "embedding").length },
        { label: "Citation evidence", helper: "Answer citations, sources, and boundaries", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "citation").length },
        { label: "Trial question results", helper: "TopK, threshold, and refusal verification", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "eval").length }
      ],
      sections: [
        { label: "Chunks", title: "Documents and chunks", description: "Manage every chunk by file, page number, paragraph, overlap, and enabled state.", actions: ["Batch disable", "Re-chunk"] },
        { label: "Vectors", title: "Vector indexes", description: "Inspect embedding batches, model dimensions, index status, and rebuild jobs.", actions: ["Reindex", "View batches"] },
        { label: "Evidence", title: "Citation evidence", description: "Spot-check citable snippets, source files, and evidence-free refusal boundaries.", actions: ["Citation spot check", "Export evidence"] },
        { label: "Retrieval", title: "Recall verification", description: "Use business questions to verify TopK, thresholds, reranking, and refusal policy.", actions: ["New verification", "View records"] }
      ]
    };
  }
  if (engine === "GraphRAG") {
    return {
      description: "Manage entities, relationship edges, the graph canvas, community summaries, and low-confidence review. The GraphRAG console must show how entities are extracted, how relationships are built, and how the graph serves multi-hop retrieval.",
      workflowTitle: "Governance chain from documents to an entity relationship graph",
      assetTitle: "Entities, relationships, graphs, and review assets",
      primaryAction: "Graph review",
      consoleTitle: "GraphRAG console",
      workbench: {
        eyebrow: "Graph workbench",
        title: "Govern the relationship knowledge base by entity, relationship, community, and path",
        description: "Suited to customer profiles, risk due diligence, supply chains, and multi-hop relationship analysis. Admins must be able to review entity extraction, edge evidence, community summaries, low-confidence review, and path query results.",
        areas: [
          { label: "Entity directory", description: "Manage entities by type: customer, person, project, event, and more" },
          { label: "Relationship review", description: "Inspect relationship direction, confidence, evidence sources, and conflicting edges" },
          { label: "Community summaries", description: "Check graph clusters, topic communities, and cross-document summaries" },
          { label: "Path queries", description: "Verify multi-hop paths, shortest routes, and risk propagation clues" }
        ],
        controls: [
          { label: "Indexing", value: "Entity + Edge + Community", helper: "The entity graph serves multi-hop Q&A and relationship tracing" },
          { label: "Retrieval policy", value: "Path expansion / community recall", helper: "Low-confidence relationships go through human review before publishing" },
          { label: "Governance actions", value: "Merge entities · review edges · recompute communities", helper: "Keep the graph clean, explainable, and traceable" }
        ]
      },
      stages: ["Entity extraction", "Relationship building", "Disambiguation and merge", "Graph publishing", "Multi-hop verification"],
      actions: ["Graph review", "Merge entities", "Relationship spot check", "Multi-hop verification"],
      metrics: [
        { label: "Entity table", helper: "Customers, people, projects, and events", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "entity").length },
        { label: "Relationship edges", helper: "Edge type, direction, and confidence", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "relationship").length },
        { label: "Knowledge graph", helper: "Graph views and community summaries", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "graph").length },
        { label: "Review queue", helper: "Low-confidence and conflicting relationships", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "review").length }
      ],
      sections: [
        { label: "Entities", title: "Entity table", description: "Govern entities by type, source, confidence, and permission scope.", actions: ["Merge entities", "Fix type"] },
        { label: "Edges", title: "Relationship edges", description: "Inspect relationship direction, evidence sources, confidence, and conflicting edges.", actions: ["Relationship spot check", "Resolve conflicts"] },
        { label: "Graph", title: "Graph canvas", description: "Review the entity network, community summaries, key paths, and cross-document connections.", actions: ["Open graph", "Path analysis"] },
        { label: "Review", title: "Review queue", description: "Handle low-confidence entities, conflicting relationships, and cross-permission boundaries in one place.", actions: ["Batch review", "Return for re-extraction"] }
      ]
    };
  }
  return {
    description: "Manage knowledge pages, fact cards, directory links, the source directory, and publish boundaries. The Gbrain console is closer to enterprise wiki governance: you need to see how pages, facts, and sources form a browsable knowledge space.",
    workflowTitle: "Governance chain from source material to a knowledge wiki space",
    assetTitle: "Pages, fact cards, links, and source assets",
    primaryAction: "Publish review",
    consoleTitle: "Gbrain console",
    workbench: {
      eyebrow: "Knowledge workbench",
      title: "Govern a long-lived knowledge space by page, fact, link, and publish boundary",
      description: "Suited to personal knowledge bases, team handbooks, research guides, and runbooks. Admins focus on page quality, fact accuracy, topic links, source tracking, and permission boundaries at publish time.",
      areas: [
        { label: "Page directory", description: "Inspect the wiki structure, section hierarchy, summaries, and page status" },
        { label: "Fact memory", description: "Capture definitions, decisions, action items, and stable fact cards" },
        { label: "Topic links", description: "Govern bidirectional links, topic clusters, and broken links between pages" },
        { label: "Permission publishing", description: "Control visibility and retrieval boundaries per personal, team, and company scope" }
      ],
      controls: [
        { label: "Indexing", value: "Page + Fact + Link", helper: "Compile material into a browsable, question-ready knowledge space" },
        { label: "Retrieval policy", value: "Directory navigation / facts first", helper: "Find stable facts first, then add sources and context" },
        { label: "Governance actions", value: "Fact spot check · rebuild directory · publish review", helper: "Built for long-term maintenance and organizational knowledge capture" }
      ]
    },
    stages: ["Source parsing", "Page generation", "Fact extraction", "Directory links", "Publish review"],
    actions: ["Publish review", "Fact spot check", "Rebuild directory", "Source tracking"],
    metrics: [
      { label: "Pages", helper: "Browsable wiki pages", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "wiki").length },
      { label: "Fact cards", helper: "Definitions, conclusions, and key facts", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "fact").length },
      { label: "Directory links", helper: "Page relationships and navigation structure", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "link").length },
      { label: "Source directory", helper: "Tracking from pages back to source material", value: (assets: AdminKnowledgeAssetDetail[]) => assets.filter((asset) => asset.kind === "source").length }
    ],
    sections: [
      { label: "Pages", title: "Pages", description: "Review page titles, summaries, body structure, publish state, and visibility.", actions: ["Publish review", "Regenerate"] },
      { label: "Facts", title: "Fact cards", description: "Spot-check fact accuracy, source grounding, and retrievable boundaries.", actions: ["Fact spot check", "Disable fact"] },
      { label: "Links", title: "Directory links", description: "Govern the page directory, bidirectional links, topic clusters, and navigation paths.", actions: ["Rebuild directory", "Check broken links"] },
      { label: "Sources", title: "Source directory", description: "Trace how each page, fact card, and source file relate to one another.", actions: ["Source tracking", "Export directory"] }
    ]
  };
}

function AdminKnowledgeAssetOverlay({ detail, onClose }: { detail: AdminAssetDetailState; onClose: () => void }) {
  return (
    <div className="admin-preview-overlay admin-asset-detail-overlay" role="dialog" aria-modal="true" aria-label={`${detail.asset.label} asset details`} onClick={onClose}>
      <section className="admin-preview-sheet admin-asset-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{detail.mode.label} · {frontstageText(detail.mode.frontstageLabel)}</span>
            <h2>{detail.asset.label}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        <div className="admin-preview-body admin-asset-detail-body">
          {detail.status === "loading" ? <div className="admin-preview-state">Loading ingested assets...</div> : null}
          {detail.status === "error" ? <div className="admin-preview-state error">{detail.message}</div> : null}
          {detail.status === "ready" && detail.records.length === 0 ? (
            <div className="admin-asset-empty">
              <b>No ingested records of this type yet</b>
              <p>Confirm ingestion in the processing pipeline first, or check whether the current scenario uses {detail.mode.label}.</p>
            </div>
          ) : null}
          {detail.status === "ready" && detail.records.length > 0 ? (
            <div className="admin-asset-detail-stack">
              <section className="admin-asset-detail-summary">
                <div>
                  <span>Asset type</span>
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
  return (
    <div className="admin-preview-overlay" role="dialog" aria-modal="true" aria-label={`${preview.title} file preview`} onClick={onClose}>
      <section className="admin-preview-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{preview.label}</span>
            <h2>{preview.title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        <div className="admin-preview-body">
          {preview.status === "loading" ? <div className="admin-preview-state">Loading file preview...</div> : null}
          {preview.status === "error" ? <div className="admin-preview-state error">{preview.message}</div> : null}
          {preview.status === "ready" && preview.kind === "PDF" ? (
            <iframe className="admin-pdf-preview" title={preview.title} src={preview.url} />
          ) : null}
          {preview.status === "ready" && ["CSV", "XLS"].includes(preview.kind) ? <AdminCsvPreview text={preview.text ?? ""} /> : null}
          {preview.status === "ready" && preview.kind === "MD" ? <AdminMarkdownPreview text={preview.text ?? ""} /> : null}
          {preview.status === "ready" && ["TXT", "JSON"].includes(preview.kind) ? <pre className="admin-text-preview">{formatPreviewText(preview.kind, preview.text ?? "")}</pre> : null}
          {preview.status === "ready" && !["PDF", "CSV", "XLS", "MD", "TXT", "JSON"].includes(preview.kind) ? (
            <div className="admin-preview-state">This file type cannot be previewed online yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AdminCsvPreview({ text }: { text: string }) {
  const rows = parseDelimitedPreview(text).slice(0, 80);
  const [head = [], ...body] = rows;
  return (
    <div className="admin-csv-preview">
      <table>
        <thead>
          <tr>{head.map((cell, index) => <th key={`${cell}-${index}`}>{cell || `Column ${index + 1}`}</th>)}</tr>
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
  const evaluations = initialEvaluations.length
    ? initialEvaluations
    : evaluationRows.map((r) => ({ profile: r.profile, evidence: r.evidence, score: String(r.score), latency: r.latency }));
  const [notice, setNotice] = useState("");
  const runEvalVerify = async (profile: string) => {
    const engine = profile.includes("knowledge wiki") ? "Gbrain" : profile.includes("knowledge graph") ? "GraphRAG" : "Naive RAG";
    setNotice(`Running a real evaluation retrieval for "${profile}"…`);
    setNotice(await postRecallVerify(engine, profile));
  };
  const runAllEval = async () => {
    setNotice("Running real evaluation retrieval for every policy…");
    const results = await Promise.all(evaluations.map(async (r) => {
      const engine = r.profile.includes("knowledge wiki") ? "Gbrain" : r.profile.includes("knowledge graph") ? "GraphRAG" : "Naive RAG";
      return `${r.profile}: ${await postRecallVerify(engine, r.profile)}`;
    }));
    setNotice(results.join(" | "));
  };
  return (
    <AdminShell active="/admin/evaluations" title="Quality Evaluation">
      <AdminPageHead
        eyebrow="Quality evaluation"
        title="Policy comparison, evidence coverage, and latency"
        description="Admins verify policy quality with business questions so published workspace scenarios do not answer without evidence, drop citations, or respond too slowly."
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      <section className="admin-evaluation-console" aria-label="Evaluation console">
        <section className="admin-panel admin-evaluation-datasets">
          <PanelHead eyebrow="Evaluation console" title="Question sets, policies, and release gates" action={<button type="button" onClick={() => runAllEval()}>New evaluation task</button>} />
          <div className="admin-evaluation-dataset-grid">
            {[
              { name: "Policy Q&A question set", scope: "Company", count: "42 questions", gate: "Citations must match the source text" },
              { name: "Customer risk question set", scope: "Team", count: "28 questions", gate: "Relationship paths must be explainable" },
              { name: "Personal knowledge base follow-up set", scope: "Personal", count: "18 questions", gate: "Fact sources must be traceable" }
            ].map((item) => (
              <article key={item.name}>
                <span>Question set</span>
                <b>{item.name}</b>
                <small>{item.scope} · {item.count}</small>
                <p>{item.gate}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="admin-panel admin-evaluation-coverage">
          <PanelHead eyebrow="Evidence coverage" title="Does every answer cite a source?" />
          <div className="admin-evidence-coverage-meter">
            {evaluations.map((row) => (
              <article key={row.profile}>
                <header><b>{row.profile}</b><span>{row.evidence} real evidence items</span></header>
                <i style={{ width: `${row.evidence > 0 ? 100 : 0}%` }} />
                <small>{row.score} · {row.latency}</small>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow="Policy comparison" title="Retrieval, evidence, latency, and refusal boundaries" action={<button type="button" onClick={() => runAllEval()}>Batch re-verify</button>} />
        <div className="admin-data-table admin-eval-table" role="table" aria-label="Policy evaluation results">
          <div role="row" className="admin-table-head">
            <span>Policy</span>
            <span>Readiness</span>
            <span>Evidence</span>
            <span>Latency</span>
            <span>Actions</span>
          </div>
          {evaluations.map((row) => (
            <div role="row" key={row.profile}>
              <b>{row.profile}<small>Covers citations, refusals, permission filtering, and multi-turn follow-ups</small></b>
              <span>{row.score}</span>
              <span>{row.evidence}</span>
              <span>{row.latency}</span>
              <div className="admin-row-actions"><button type="button" onClick={() => runEvalVerify(row.profile)}>View cases</button><button type="button" onClick={() => runEvalVerify(row.profile)}>Re-verify</button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-evaluation-bottom">
        <section className="admin-panel admin-failure-review">
          <PanelHead eyebrow="Failure review" title="Typical answers that must not ship" action={<button type="button" onClick={() => runAllEval()}>Convert to review task</button>} />
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
          <PanelHead eyebrow="Release gates" title="Pre-launch checks" />
          <div className="admin-gate-list">
            <article><b>Citations open</b><small>Required</small><p>Every piece of evidence links to its source snippet.</p></article>
            <article><b>Permission filtering</b><small>Required</small><p>Personal and team material is never retrieved across permission boundaries.</p></article>
            <article><b>Refusal without evidence</b><small>Required</small><p>No conclusions are invented when retrieval finds no evidence.</p></article>
          </div>
        </aside>
      </section>
    </AdminShell>
  );
}

export function AdminAuditPage({ initialEvents = adminAuditEvents }: { initialEvents?: typeof adminAuditEvents }) {
  const [activeModule, setActiveModule] = useState("全部模块");
  const [showRaw, setShowRaw] = useState(false);
  const filteredEvents = activeModule === "全部模块" ? initialEvents : initialEvents.filter((e) => e.area === activeModule);
  const riskEvents = initialEvents.filter((event) => /risk|policy|permission|pipeline|graph/i.test(`${event.area}${event.summary}${event.impact}`));
  const handleExportCSV = () => {
    const escape = (value: unknown) => { const str = String(value ?? ""); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    const header = ["Change", "Module", "Actor", "Time", "Impact"].join(",");
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
    <AdminShell active="/admin/audit" title="Audit Log">
      <AdminPageHead
        eyebrow="Audit log"
        title="Changelog with user impact"
        description="Key changes to templates, policies, the pipeline, the graph, evaluations, and knowledge assets must all be traceable."
      />
      <section className="admin-panel admin-audit-filter">
        <PanelHead eyebrow="Audit filters" title="Find changes by module, action risk, and actor" action={<button type="button" onClick={handleExportCSV}>Export audit pack</button>} />
        <div className="admin-audit-filter-row">
          {["全部模块", "模板治理", "检索策略", "处理管线", "关系图谱", "质量验证"].map((item) => (
            <button key={item} type="button" className={item === activeModule ? "active" : ""} onClick={() => setActiveModule(item)}>{auditAreaText(item)}</button>
          ))}
        </div>
      </section>

      <section className="admin-audit-summary">
        <article>
          <span>Traceable impact</span>
          <b>{filteredEvents.length}</b>
          <small>Every key change records its impact</small>
        </article>
        <article>
          <span>Risky actions</span>
          <b>{riskEvents.length}</b>
          <small>Involves policy, graph, permissions, or the processing chain</small>
        </article>
        <article>
          <span>Actors</span>
          <b>{new Set(initialEvents.map((event) => event.actor)).size}</b>
          <small>System accounts are separate from admin accounts</small>
        </article>
      </section>

      <section className="admin-panel">
        <PanelHead eyebrow="Change log" title="Recent audit events" action={<button type="button" onClick={() => setShowRaw(true)}>View raw events</button>} />
        <div className="admin-data-table admin-audit-table" role="table" aria-label="Audit log">
          <div role="row" className="admin-table-head">
            <span>Change</span>
            <span>Module</span>
            <span>Actor</span>
            <span>Time</span>
            <span>Traceable impact</span>
          </div>
          {filteredEvents.map((event) => (
            <div role="row" key={event.id}>
              <b>{event.summary}</b>
              <span>{auditAreaText(event.area)}</span>
              <span>{event.actor}</span>
              <span>{event.time}</span>
              <span>{event.impact}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-audit-risk-actions">
        <PanelHead eyebrow="Risky actions" title="Changes that keep review evidence" />
        <div className="admin-risk-stack">
          {riskEvents.map((event) => (
            <article key={`risk-${event.id}`}>
              <span>{auditAreaText(event.area)}</span>
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
            <button type="button" onClick={() => setShowRaw(false)} style={{ position: "absolute", top: 8, right: 8 }}>Close</button>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingTop: 24 }}>{JSON.stringify(initialEvents, null, 2)}</pre>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export function AdminShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  const auth = useAuth();
  const currentUser = auth.user?.display_name || auth.user?.username || "Admin";
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-main">Skip to main content</a>
      <aside className="admin-side">
        <Link href="/" className="admin-brand" aria-label="Back to homepage">
          <Logo size={30} />
          <small>Admin console</small>
        </Link>
        <nav aria-label="Admin navigation">
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
                    <span>{item.label}</span>
                  </Link>
                  <div className="admin-nav-sub" aria-label="Knowledge asset sub-navigation">
                    {adminKnowledgeSubnav.map((subItem) => (
                      <Link
                        key={subItem.href}
                        className={`admin-subnav-link${subItem.href === active ? " active" : ""}`}
                        href={subItem.href}
                        aria-current={subItem.href === active ? "page" : undefined}
                      >
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link key={item.href} className={item.href === active ? "active" : ""} href={item.href} aria-current={item.href === active ? "page" : undefined}>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-side-status">
          <span>Current responsibility</span>
          <b>Ingest, permission review, knowledge publishing</b>
        </div>
      </aside>
      <main id="admin-main" className="admin-main">
        <header className="admin-top">
          <div>
            <span>{title}</span>
            <small>{currentUser} · Admin view</small>
          </div>
          <div className="admin-top-actions">
            <Link href="/app">Workspace</Link>
            <ThemeToggle />
            <button type="button" onClick={auth.logout}>Sign out</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function AdminPageHead({ eyebrow, title, description, actions, compact = false }: { eyebrow: string; title: string; description: string; actions?: ReactNode; compact?: boolean }) {
  return (
    <section className={`admin-head admin-page-toolbar ${compact ? "compact" : ""}`} aria-label={`${title} admin toolbar`}>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <small>Admin toolbar</small>
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

function AdminRequestQueue({ requests, compact = false }: { requests: AdminIntakeRequest[]; compact?: boolean }) {
  return (
    <div className={`admin-request-list ${compact ? "compact" : ""}`}>
      {requests.map((request, index) => (
        <article key={request.id} className={index === 0 ? "active" : ""}>
          <header>
            <AdminStatusBadge status={request.status} />
            <small>{request.submittedAt}</small>
          </header>
          <h3>{request.scenarioName}</h3>
          {!compact ? <p>{request.requestedOutcome}</p> : null}
          <dl>
            <div><dt>Requester</dt><dd>{request.requester}</dd></div>
            <div><dt>Scope</dt><dd>{visibilityText(request.visibility)}</dd></div>
            {!compact ? <div><dt>Suggested engine</dt><dd className="admin-engine-dd">{requestRecommendedEngines(request).join(" / ")}</dd></div> : null}
          </dl>
        </article>
      ))}
    </div>
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

function requestFrontstageMapping(request?: AdminIntakeRequest) {
  if (!request) return "Maps to the workspace as: Knowledge wiki.";
  if (request.frontstageMapping) return request.frontstageMapping;
  return `Maps to the workspace as: ${request.recommendedModes.map(frontstageText).join(" / ")}.`;
}

function fileStateLabel(file?: AdminStoredFile | null) {
  if (!file) return "Uploaded, temporary";
  if (file.originalState === "deleted") return "Original cleaned up";
  if (file.originalState === "retained") return "Source file retained";
  return "Uploaded, temporary";
}

function retentionPolicyLabel(policy?: "delete_after_ingest" | "retain_source") {
  if (policy === "retain_source") return "Keep source material";
  if (policy === "delete_after_ingest") return "Clean up after ingest";
  return "Policy pending";
}

function fileAccessLabel(file?: AdminStoredFile | null) {
  const access = file?.accessControl;
  if (!access) return "Permissions pending";
  if (access.scope === "private") return "Permissions: Owner only";
  if (access.scope === "company") return `Permissions: Company · ${access.organizationId}`;
  return `Permissions: Team · ${access.teamIds.join(" / ") || "unspecified"}`;
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

const RISK_LABEL_TEXT: Record<string, string> = {
  [RISK_PENDING_SUBMISSIONS]: "Pending admin confirmations"
};

function riskLabelText(label: string) {
  return RISK_LABEL_TEXT[label] ?? label;
}

const RISK_SEVERITY_TEXT: Record<string, string> = {
  高: "High",
  中: "Medium",
  低: "Low"
};

function riskSeverityText(severity: string) {
  return RISK_SEVERITY_TEXT[severity] ?? severity;
}

const VISIBILITY_TEXT: Record<string, string> = {
  全部: "All",
  个人: "Personal",
  团队: "Team",
  公司: "Company"
};

function visibilityText(scope: string) {
  return VISIBILITY_TEXT[scope] ?? scope;
}

const ACTION_TEXT: Record<string, string> = {
  查看资料: "View files",
  配置引擎策略: "Configure engine policy",
  确认入库: "Confirm ingest",
  退回补充: "Return for additions",
  打开证据切片: "Open evidence chunks",
  复核引用: "Review citations",
  发布场景: "Publish scenario",
  查看图谱抽取: "View graph extraction",
  调整实体类型: "Adjust entity types",
  运行关系构建: "Run relationship building",
  查看发布结果: "View publish result",
  查看退回原因: "View return reason"
};

function actionText(action: string) {
  return ACTION_TEXT[action] ?? action;
}

const FRONTSTAGE_TEXT: Record<string, string> = {
  知识百科: "Knowledge wiki",
  文档证据: "Document evidence",
  关系图谱: "Knowledge graph",
  公司大脑: "Company-wide Q&A"
};

function frontstageText(label: string) {
  return FRONTSTAGE_TEXT[label] ?? label;
}

const GATE_STATUS_TEXT: Record<string, string> = {
  必须通过: "Required",
  建议复核: "Review recommended"
};

function gateStatusText(status: string) {
  return GATE_STATUS_TEXT[status] ?? status;
}

const TEMPLATE_CATEGORY_TEXT: Record<string, string> = {
  官方: "Official"
};

function templateCategoryText(category: string) {
  return TEMPLATE_CATEGORY_TEXT[category] ?? category;
}

const AUDIT_AREA_TEXT: Record<string, string> = {
  全部模块: "All modules",
  模板治理: "Template governance",
  检索策略: "Retrieval policies",
  处理管线: "Processing pipeline",
  关系图谱: "Knowledge graph",
  质量验证: "Quality evaluation"
};

function auditAreaText(area: string) {
  return AUDIT_AREA_TEXT[area] ?? area;
}

export function AdminStatusBadge({ status }: { status: string }) {
  return <span className={`admin-status ${statusClass(status)}`}>{statusText(status)}</span>;
}

function statusText(status: string) {
  if (status === "healthy" || status === "正常") return "Healthy";
  if (status === "degraded" || status === "需复核") return "Needs review";
  if (status === "down" || status === "不可用") return "Unavailable";
  if (status === "watch" || status === "观察") return "Watch";
  if (status === "blocked" || status === "阻塞") return "Blocked";
  if (status === "done" || status === "已完成") return "Completed";
  if (status === "running" || status === "处理中") return "In progress";
  if (status === "queued" || status === "排队中") return "Queued";
  if (status === "official" || status === "已发布") return "Published";
  if (status === "candidate" || status === "候选") return "Candidate";
  if (status === "experimental" || status === "试点") return "Pilot";
  if (status === "custom" || status === "自定义") return "Custom";
  if (status === "paused" || status === "已暂停") return "Paused";
  if (status === "archived" || status === "已归档") return "Archived";
  if (status === "待管理员确认") return "Pending admin review";
  if (status === "等待复核") return "Awaiting review";
  if (status === "待复核") return "Awaiting review";
  if (status === "已退回") return "Returned";
  if (status === "审核中") return "Under review";
  if (status === "可运行") return "Runnable";
  if (status === "启用中") return "Active";
  if (status === "需更新") return "Needs update";
  if (status === "待抽检") return "Awaiting spot check";
  if (status === "已切片") return "Chunked";
  if (status === "已抽取") return "Extracted";
  if (status === "已读取") return "Loaded";
  if (status === "等待解析") return "Awaiting parse";
  return status;
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
