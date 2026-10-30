import { describe, expect, test } from "bun:test";
import {
  adminAuditEvents,
  adminDashboardDataOverview,
  adminDashboardHealthCards,
  adminDashboardRiskItems,
  adminGraphSnapshot,
  adminIntakeRequests,
  adminNav,
  adminOperationSummary,
  adminPipelineWorkflowSteps,
  adminTemplates,
  isActionableAdminRequestStatus,
  ragOperationModes,
  resolveAdminFilePreview,
  strategyProfiles
} from "./admin-governance";

describe("admin governance fixtures", () => {
  test("ships every admin route", () => {
    expect(adminNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/templates",
      "/admin/knowledge-bases",
      "/admin/strategies",
      "/admin/pipelines",
      "/admin/graph",
      "/admin/evaluations",
      "/admin/settings",
      "/admin/audit"
    ]);
  });

  test("template governance exposes evidence and demo gates", () => {
    expect(adminTemplates.every((item) => item.evidenceCoverage >= 50)).toBe(true);
    expect(adminTemplates.every((item) => item.demoReadiness >= 50)).toBe(true);
    expect(adminTemplates.every((item) => item.demoScenarioName.length > 0)).toBe(true);
    expect(adminTemplates.every((item) => item.sampleQuestion.length > 0)).toBe(true);
  });

  test("strategy profiles and graph explorer are populated", () => {
    expect(strategyProfiles.length).toBeGreaterThanOrEqual(4);
    expect(adminGraphSnapshot.nodes.length).toBeGreaterThanOrEqual(5);
    expect(adminGraphSnapshot.edges.every((edge) => edge.evidence)).toBe(true);
  });

  test("summary and audit cover operations", () => {
    expect(adminOperationSummary.length).toBeGreaterThanOrEqual(7);
    expect(adminAuditEvents.length).toBeGreaterThanOrEqual(5);
  });

  test("admin console exposes intake requests and three rag operation modes", () => {
    expect(adminIntakeRequests.length).toBeGreaterThanOrEqual(3);
    expect(adminIntakeRequests[0].actions).toContain("确认入库");
    expect(ragOperationModes.map((item) => item.label)).toEqual(["Gbrain", "Naive RAG", "GraphRAG"]);
    expect(ragOperationModes.map((item) => item.frontstageLabel)).toEqual(["知识百科", "文档证据", "关系图谱"]);
    expect(adminIntakeRequests[0].recommendedEngines).toEqual(["Gbrain", "Naive RAG", "GraphRAG"]);
    expect(adminIntakeRequests[0].frontstageMapping).toContain("workspace");
    expect(ragOperationModes.every((item) => item.stages.length >= 5)).toBe(true);
  });

  test("admin pipeline workbench exposes workflow steps and strategy inspector inputs", () => {
    expect(adminPipelineWorkflowSteps.map((item) => item.label)).toEqual(["Verify files", "Engine policy", "Permissions and publishing", "Confirm ingest"]);
    expect(adminPipelineWorkflowSteps.filter((item) => item.state === "active")).toHaveLength(1);
    expect(ragOperationModes.every((item) => item.inspector.length >= 3)).toBe(true);
  });

  test("rag operation modes expose engine-specific processing parameters and gates", () => {
    const naive = ragOperationModes.find((item) => item.label === "Naive RAG");
    const graph = ragOperationModes.find((item) => item.label === "GraphRAG");
    const gbrain = ragOperationModes.find((item) => item.label === "Gbrain");

    expect(ragOperationModes.every((item) => item.runtimeFlow.length >= 5)).toBe(true);
    expect(ragOperationModes.every((item) => item.parameters.length >= 5)).toBe(true);
    expect(ragOperationModes.every((item) => item.qualityGates.length >= 3)).toBe(true);
    expect(ragOperationModes.every((item) => item.previewOutputs.length >= 3)).toBe(true);
    expect(naive?.parameters.map((item) => item.key)).toEqual(expect.arrayContaining(["chunk_size", "chunk_overlap", "top_k", "citation_threshold"]));
    expect(graph?.parameters.map((item) => item.key)).toEqual(expect.arrayContaining(["entity_schema", "relation_schema", "max_hops", "min_confidence"]));
    expect(gbrain?.parameters.map((item) => item.key)).toEqual(expect.arrayContaining(["page_granularity", "link_depth", "fact_extraction", "publish_mapping"]));
  });

  test("rag operation modes expose knowledge asset views after ingestion", () => {
    const naive = ragOperationModes.find((item) => item.label === "Naive RAG");
    const graph = ragOperationModes.find((item) => item.label === "GraphRAG");
    const gbrain = ragOperationModes.find((item) => item.label === "Gbrain");

    expect(ragOperationModes.every((item) => item.assetViews.length >= 4)).toBe(true);
    expect(naive?.assetViews.map((item) => item.kind)).toEqual(expect.arrayContaining(["chunk", "citation"]));
    expect(graph?.assetViews.map((item) => item.kind)).toEqual(expect.arrayContaining(["graph", "entity", "relationship"]));
    expect(gbrain?.assetViews.map((item) => item.kind)).toEqual(expect.arrayContaining(["wiki", "fact", "link"]));
  });

  test("admin pipeline queue only exposes requests that still need operations", () => {
    expect(isActionableAdminRequestStatus("待管理员确认")).toBe(true);
    expect(isActionableAdminRequestStatus("等待复核")).toBe(true);
    expect(isActionableAdminRequestStatus("处理中")).toBe(true);
    expect(isActionableAdminRequestStatus("已发布")).toBe(false);
  });

  test("admin uploaded files resolve to professional preview metadata", () => {
    expect(resolveAdminFilePreview("Northwind Labs renewal risk analysis.pdf")).toMatchObject({ kind: "PDF", previewable: true });
    expect(resolveAdminFilePreview("Legal clause review checklist.md")).toMatchObject({ kind: "MD", previewable: true });
    expect(resolveAdminFilePreview("Reference pack.zip")).toMatchObject({ kind: "ZIP", previewable: false });
  });

  test("admin dashboard exposes health, data distribution and risk signals", () => {
    expect(adminDashboardHealthCards.map((item) => item.label)).toContain("Relational databases");
    expect(adminDashboardHealthCards.map((item) => item.label)).toContain("Answer model");
    expect(adminDashboardDataOverview.some((item) => item.scope === "公司")).toBe(true);
    expect(adminDashboardDataOverview.every((item) => item.total > 0)).toBe(true);
    expect(adminDashboardRiskItems.length).toBeGreaterThanOrEqual(3);
  });
});
