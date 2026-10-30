import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminAuditPage, AdminEvaluationsPage, AdminGraphPage, AdminKnowledgeBasesPage, AdminKnowledgeEnginePage, AdminOverviewPage, AdminPipelinesPage, AdminStrategiesPage, AdminTemplatesPage } from "./admin-pages";
import { AdminSettingsPage } from "./admin-settings-page";
import { AuthProvider } from "../../lib/auth-context";
import { ThemeProvider } from "../theme-provider";
import { adminIntegrationSettings, adminIntakeRequests } from "../../lib/fixtures/admin-governance";

function renderAdminPage(element: ReactNode) {
  return renderToStaticMarkup(
    <ThemeProvider>
      <AuthProvider>
        {element}
      </AuthProvider>
    </ThemeProvider>,
  );
}

const sampleAsset = {
  id: "asset-naive-chunk",
  kind: "chunk",
  engine: "Naive RAG" as const,
  title: "Document chunk · Maya Chen sales notes.md",
  metric: "About 120 characters",
  status: "已切片",
  sourceOriginalName: "Maya Chen sales notes.md",
  scenarioName: "Maya Chen sales notes",
  visibilityLabel: "个人",
  ownerName: "Maya Chen",
  createdAt: "2026-06-25T12:00:00.000Z",
  content: "Customer budget cycles, renewal risk, and launch blockers.",
  metadata: [
    { label: "Source file", value: "Maya Chen sales notes.md" },
    { label: "Business scenario", value: "Maya Chen sales notes" },
    { label: "Permissions", value: "Personal · Maya Chen" },
    { label: "Knowledge object", value: "ko_sales_notes" }
  ]
};

const graphAsset = {
  ...sampleAsset,
  id: "asset-graph-entity",
  kind: "entity",
  engine: "GraphRAG" as const,
  title: "Entity table · Acme Health account map",
  metric: "12 entities",
  status: "已抽取",
  sourceOriginalName: "Customer relationships.pdf",
  scenarioName: "Acme Health account map",
  content: "Customers, contracts, risk signals, and key stakeholder entities.",
  metadata: [
    { label: "Source file", value: "Customer relationships.pdf" },
    { label: "Business scenario", value: "Acme Health account map" },
    { label: "Permissions", value: "Team · sales" },
    { label: "Knowledge object", value: "ko_graph" }
  ]
};

const gbrainAsset = {
  ...sampleAsset,
  id: "asset-gbrain-wiki",
  kind: "wiki",
  engine: "Gbrain" as const,
  title: "Page · Onboarding handbook",
  metric: "1 page",
  status: "已发布",
  sourceOriginalName: "Onboarding handbook.md",
  scenarioName: "New hire onboarding handbook",
  content: "Onboarding steps, common questions, and policy guidance.",
  metadata: [
    { label: "Source file", value: "Onboarding handbook.md" },
    { label: "Business scenario", value: "New hire onboarding handbook" },
    { label: "Permissions", value: "Team · sales" },
    { label: "Knowledge object", value: "ko_gbrain" }
  ]
};

const dashboardSnapshot = {
  requests: { total: 3, pending: 1, processing: 1, published: 1, rejected: 0 },
  assets: { total: 12, gbrain: 4, naive: 5, graph: 3 },
  healthCards: [
    { id: "platform-store" as const, label: "Platform store", value: "Available", detail: "3 submissions, 12 asset records", status: "healthy" as const, route: "/admin/pipelines" },
    { id: "Gbrain" as const, label: "Gbrain", value: "Available", detail: "nano-brain service available", status: "healthy" as const, route: "/admin/knowledge-bases/gbrain" },
    { id: "Naive RAG" as const, label: "Naive RAG", value: "Available", detail: "traditional-rag service available", status: "healthy" as const, route: "/admin/knowledge-bases/naive" },
    { id: "GraphRAG" as const, label: "GraphRAG", value: "Needs review", detail: "LightRAG service needs review", status: "degraded" as const, route: "/admin/knowledge-bases/graph" }
  ],
  dataOverview: [
    { scope: "个人" as const, total: 2, unit: "assets", module: "Personal knowledge space", owner: "Creator", policy: "Readable only by the creator and admins", health: "healthy" as const },
    { scope: "团队" as const, total: 6, unit: "assets", module: "Team knowledge space", owner: "Team lead", policy: "Readable only by team members", health: "healthy" as const },
    { scope: "公司" as const, total: 4, unit: "assets", module: "CompanyBrain", owner: "Admin", policy: "Retrievable by company-wide Q&A once published", health: "healthy" as const }
  ]
};

describe("admin dashboard page", () => {
  test("renders dashboard from real platform snapshot instead of static fixture health", () => {
    const html = renderAdminPage(<AdminOverviewPage initialRequests={[adminIntakeRequests[0]]} dashboard={dashboardSnapshot} />);

    expect(html).toContain("System health, knowledge assets, and pending work in one view");
    expect(html).toContain("Platform store");
    expect(html).toContain("3 submissions, 12 asset records");
    expect(html).toContain("GraphRAG");
    expect(html).toContain("LightRAG service needs review");
    expect(html).toContain("Pending submissions");
    expect(html).toContain("Knowledge assets");
    expect(html).toContain("Team knowledge space");
  });
});

describe("admin knowledge base page", () => {
  test("shows a full knowledge asset management console instead of asset cards only", () => {
    const html = renderAdminPage(<AdminKnowledgeBasesPage initialAssets={[sampleAsset, graphAsset, gbrainAsset]} />);

    expect(html).toContain("Knowledge asset console");
    expect(html).toContain("Asset overview");
    expect(html).toContain("Asset ledger");
    expect(html).toContain("Detail inspector");
    expect(html).toContain("Engine governance");
    expect(html).toContain("Naive RAG governance");
    expect(html).toContain("GraphRAG governance");
    expect(html).toContain("Gbrain governance");
    expect(html).toContain("Maya Chen sales notes");
    expect(html).toContain("Document chunk · Maya Chen sales notes.md");
    expect(html).toContain("Permissions");
    expect(html).toContain("Recall verification");
    expect(html).toContain('aria-label="Knowledge asset sub-navigation"');
    expect(html).toContain("Asset overview");
    expect(html).toContain("Gbrain Management");
    expect(html).toContain("Naive RAG Management");
    expect(html).toContain("GraphRAG Management");
    expect(html).toContain('data-asset-row="asset-naive-chunk"');
    expect(html).toContain('href="/admin/knowledge-bases/naive"');
    expect(html).toContain('href="/admin/graph"');
    expect(html).toContain('href="/admin/knowledge-bases/gbrain"');
  });

  test("shows dedicated Naive RAG management page with chunk and vector operations", () => {
    const html = renderAdminPage(<AdminKnowledgeEnginePage engine="Naive RAG" initialAssets={[sampleAsset]} />);

    expect(html).toContain("Naive RAG asset management");
    expect(html).toContain("Admin toolbar");
    expect(html).toContain("Document library workbench");
    expect(html).toContain("Chunk queue");
    expect(html).toContain("Vector records");
    expect(html).toContain("Metadata filters");
    expect(html).toContain("Recall debugging");
    expect(html).toContain("Chunk browser");
    expect(html).toContain("TopK recall experiment");
    expect(html).toContain("Vector index batches");
    expect(html).toContain('data-chunk-row="asset-naive-chunk"');
    expect(html).toContain("Documents and chunks");
    expect(html).toContain("Vector indexes");
    expect(html).toContain("Citation evidence");
    expect(html).toContain("Recall verification");
    expect(html).toContain("Document chunk · Maya Chen sales notes.md");
    expect(html).toContain('data-engine-row="asset-naive-chunk"');
    expect(html).toContain('class="admin-subnav-link active" aria-current="page" href="/admin/knowledge-bases/naive"');
  });

  test("shows dedicated GraphRAG management page with graph-specific governance", () => {
    const html = renderAdminPage(<AdminKnowledgeEnginePage engine="GraphRAG" initialAssets={[graphAsset]} />);

    expect(html).toContain("GraphRAG asset management");
    expect(html).toContain("Admin toolbar");
    expect(html).toContain("Graph workbench");
    expect(html).toContain("Entity directory");
    expect(html).toContain("Relationship review");
    expect(html).toContain("Community summaries");
    expect(html).toContain("Path queries");
    expect(html).toContain("Graph canvas");
    expect(html).toContain("Edge table");
    expect(html).toContain("Low-confidence review queue");
    expect(html).toContain("Multi-hop path query");
    expect(html).toContain('data-graph-node="Acme Health account map"');
    expect(html).toContain("Entity table");
    expect(html).toContain("Relationship edges");
    expect(html).toContain("Graph canvas");
    expect(html).toContain("Review queue");
    expect(html).toContain("Acme Health account map");
  });

  test("shows dedicated Gbrain management page with wiki-specific governance", () => {
    const html = renderAdminPage(<AdminKnowledgeEnginePage engine="Gbrain" initialAssets={[gbrainAsset]} />);

    expect(html).toContain("Gbrain asset management");
    expect(html).toContain("Admin toolbar");
    expect(html).toContain("Knowledge workbench");
    expect(html).toContain("Page directory");
    expect(html).toContain("Fact memory");
    expect(html).toContain("Topic links");
    expect(html).toContain("Permission publishing");
    expect(html).toContain("Page tree");
    expect(html).toContain("Fact card governance");
    expect(html).toContain("Source mapping");
    expect(html).toContain('data-wiki-page="asset-gbrain-wiki"');
    expect(html).toContain("Pages");
    expect(html).toContain("Fact cards");
    expect(html).toContain("Directory links");
    expect(html).toContain("Source directory");
    expect(html).toContain("New hire onboarding handbook");
  });
});

describe("admin template governance page", () => {
  test("renders template governance as an admin operation console with permissions and destructive action boundaries", () => {
    const html = renderAdminPage(<AdminTemplatesPage initialTemplates={[
      {
        id: "customer-360",
        name: "Customer 360 brief",
        category: "Sales",
        state: "official",
        source: "official",
        owner: "Platform operations",
        headline: "Enter a customer name to generate a pre-meeting brief, risk signals, opportunity signals, and next steps.",
        acceptedFiles: ["Spreadsheets", "Relationship data", "Documents"],
        inputExamples: ["Customer profile", "Meeting notes", "Contracts"],
        outputCapabilities: ["Customer brief", "Relationship leads", "Action items"],
        productForm: ["report_generator", "graph_explorer", "hybrid"],
        reviewRequirement: "Admin confirmation recommended",
        evidenceSources: ["_research/official-template-best-practice-research.md", "https://ragflow.io/"],
        evidenceCoverage: 92,
        demoReadiness: 90,
        canEdit: true,
        canDelete: false,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z"
      },
      {
        id: "template-custom-service-quality",
        name: "Support quality review",
        category: "Customer success",
        state: "candidate",
        source: "custom",
        owner: "Knowledge operations",
        headline: "Analyze support calls, tickets, and QA sheets to produce service risks and improvement suggestions.",
        acceptedFiles: ["Audio", "Spreadsheets", "Documents"],
        inputExamples: ["Support calls", "Ticket export", "QA sheet"],
        outputCapabilities: ["QA summary", "Risk list", "Improvement suggestions"],
        productForm: ["report_generator", "task_workflow"],
        reviewRequirement: "Requires admin confirmation",
        evidenceSources: ["Internal template review"],
        evidenceCoverage: 66,
        demoReadiness: 45,
        canEdit: true,
        canDelete: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z"
      }
    ]} />);

    expect(html).toContain("Template permissions and publishing governance");
    expect(html).toContain("New template");
    expect(html).toContain("Official");
    expect(html).toContain("Custom templates");
    expect(html).toContain("Official template, cannot delete");
    expect(html).toContain("Delete");
    expect(html).toContain("Spreadsheets / Relationship data / Documents");
    expect(html).toContain("Audio / Spreadsheets / Documents");
    expect(html).toContain("Release gate");
    expect(html).toContain("Capabilities");
  });
});

describe("admin pipeline page", () => {
  test("keeps engine parameters collapsed until an engine is selected", () => {
    const html = renderAdminPage(<AdminPipelinesPage initialRequests={[adminIntakeRequests[0]]} />);

    expect(html).toContain("Select an ingest engine to expand its parameters");
    expect(html).not.toContain("Ingest progress");
    expect(html).not.toContain("Configurable parameters");
  });

  test("shows generated assets for a published request", () => {
    const publishedRequest = {
      ...adminIntakeRequests[0],
      status: "已发布" as const,
      selectedEngine: "GraphRAG" as const,
      actions: ["查看资料"]
    };
    const html = renderAdminPage(<AdminPipelinesPage initialRequests={[publishedRequest]} />);

    expect(html).toContain("Viewable assets generated by GraphRAG");
    expect(html).toContain('data-asset-kind="graph"');
    expect(html).toContain('data-asset-kind="entity"');
    expect(html).toContain('data-asset-kind="relationship"');
  });

  test("shows uploaded file access scope in the admin intake workbench", () => {
    const request = {
      ...adminIntakeRequests[0],
      visibility: "团队" as const,
      storedFiles: [
        {
          id: "file-team",
          originalName: "Customer profile.md",
          relativePath: "uploads/team/customer.md",
          size: 42,
          accessControl: { scope: "team" as const, organizationId: "org-main", teamIds: ["sales"] },
          originalState: "temporary" as const,
          originalAvailable: true,
          retentionPolicy: "retain_source" as const,
          retentionReason: "Markdown is a readable, versionable knowledge source; it is kept after ingest."
        }
      ]
    };
    const html = renderAdminPage(<AdminPipelinesPage initialRequests={[request]} />);

    expect(html).toContain("Permissions: Team · sales");
  });
});

describe("admin governance modules", () => {
  test("renders retrieval strategies as an operational matrix with parameter and rollout controls", () => {
    const html = renderAdminPage(<AdminStrategiesPage />);

    expect(html).toContain("Policy matrix");
    expect(html).toContain("Parameters");
    expect(html).toContain("Workspace binding");
    expect(html).toContain("Regression checks");
    expect(html).toContain('data-strategy-id="traditional-evidence-first"');
    expect(html).toContain("Evidence-first Retrieval");
  });

  test("renders graph governance as a graph operations console rather than a simple canvas", () => {
    const html = renderAdminPage(<AdminGraphPage />);

    expect(html).toContain("Graph operations console");
    expect(html).toContain("Entity directory");
    expect(html).toContain("Edge ledger");
    expect(html).toContain("Low-confidence queue");
    expect(html).toContain("Path explorer");
    expect(html).toContain('data-graph-detail-node="ff"');
  });

  test("renders quality evaluations with datasets, comparisons, evidence coverage and failure review", () => {
    const html = renderAdminPage(<AdminEvaluationsPage />);

    expect(html).toContain("Evaluation console");
    expect(html).toContain("Question set");
    expect(html).toContain("Policy comparison");
    expect(html).toContain("Evidence coverage");
    expect(html).toContain("Failure review");
  });

  test("renders audit logs with filters and risk-oriented traceability", () => {
    const html = renderAdminPage(<AdminAuditPage />);

    expect(html).toContain("Audit filters");
    expect(html).toContain("Change log");
    expect(html).toContain("Risky actions");
    expect(html).toContain("Traceable impact");
  });

  test("renders system integrations as a service operations cockpit", () => {
    const html = renderAdminPage(<AdminSettingsPage initialSettings={adminIntegrationSettings} />);

    expect(html).toContain("Integrations control center");
    expect(html).toContain("Secret status matrix");
    expect(html).toContain("RAG module health");
    expect(html).toContain("Database access boundaries");
    expect(html).toContain("Runtime policies");
  });
});
