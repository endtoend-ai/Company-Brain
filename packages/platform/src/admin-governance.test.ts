import { describe, expect, test } from "bun:test";
import {
  buildAdminAuditEvents,
  buildAdminGraphSnapshot,
  buildAdminOperationSummary,
  buildAdminTemplateGovernance,
  buildStrategyProfiles
} from "./admin-governance";
import { buildAdminIntegrationSettings } from "./admin-settings";

describe("admin governance", () => {
  test("exposes governance rows for official templates", () => {
    const templates = buildAdminTemplateGovernance();

    expect(templates.length).toBeGreaterThanOrEqual(5);
    expect(templates.every((item) => item.evidenceCoverage >= 50)).toBe(true);
    expect(templates.every((item) => item.demoReadiness >= 50)).toBe(true);
    expect(templates.every((item) => item.productForms.length > 0)).toBe(true);
    expect(templates.every((item) => item.limitations.length > 0)).toBe(true);
  });

  test("strategy profiles cover all product-visible retrieval families", () => {
    const profiles = buildStrategyProfiles();
    expect(profiles.map((item) => item.scope)).toEqual(expect.arrayContaining([
      "traditional-rag",
      "graph-rag",
      "nano-brain",
      "company-brain"
    ]));
  });

  test("graph snapshot has visible nodes, edges, filters, and evidence", () => {
    const graph = buildAdminGraphSnapshot();
    expect(graph.nodes.length).toBeGreaterThanOrEqual(5);
    expect(graph.edges.length).toBeGreaterThanOrEqual(5);
    expect(graph.edges.every((edge) => edge.evidence)).toBe(true);
    expect(graph.filters.entityTypes.length).toBeGreaterThan(0);
  });

  test("operation summary and audit events cover admin surfaces", () => {
    expect(buildAdminOperationSummary().map((item) => item.area)).toEqual(expect.arrayContaining([
      "templates",
      "knowledge_bases",
      "strategies",
      "pipelines",
      "graph",
      "evaluations",
      "settings",
      "audit"
    ]));
    expect(buildAdminAuditEvents().length).toBeGreaterThanOrEqual(5);
  });

  test("integration settings expose masked service configuration", () => {
    const settings = buildAdminIntegrationSettings({
      env: {
        AGENT_API_KEY: "sk-test-agent-secret",
        AGENT_BASE_URL: "https://openrouter.ai/api/v1",
        AGENT_MODEL: "deepseek/deepseek-v4-flash",
        EMBEDDING_API_KEY: "sk-test-embedding-secret",
        EMBEDDING_BASE_URL: "https://openrouter.ai/api/v1",
        EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
        EMBEDDING_DIMENSIONS: "4096",
        MINERU_API_KEY: "mineru-secret",
        POSTGRES_ADMIN_URL: "postgres://muyu:secret@localhost:5432/postgres",
        IDENTITY_DATABASE_URL: "postgres://muyu:secret@localhost:5432/ff_identity",
        NANO_BRAIN_DATABASE_URL: "postgres://muyu:secret@localhost:5432/ff_nano_brain",
        TRADITIONAL_RAG_DATABASE_URL: "postgres://muyu:secret@localhost:5432/ff_traditional_rag",
        GRAPH_RAG_DATABASE_URL: "postgres://muyu:secret@localhost:5432/ff_graph_rag",
        AGENT_DATABASE_URL: "postgres://muyu:secret@localhost:5432/ff_agent"
      },
      moduleHealth: {
        "nano-brain": { status: "ok", service: "nano-brain" },
        "traditional-rag": { status: "ok", service: "traditional-rag" },
        "graph-rag": { status: "ok", service: "graph-rag" }
      },
      checkedAt: new Date("2026-06-25T00:00:00.000Z")
    });

    expect(settings.overallStatus).toBe("ready");
    expect(settings.providers[0].secrets[0].configured).toBe(true);
    expect(settings.providers[0].secrets[0].fingerprint).toBe("...cret");
    expect(JSON.stringify(settings)).not.toContain("sk-test-agent-secret");
    expect(JSON.stringify(settings)).not.toContain("muyu:secret");
  });
});
