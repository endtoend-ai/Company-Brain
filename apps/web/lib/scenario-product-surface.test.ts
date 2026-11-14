import { describe, expect, test } from "bun:test";

import { buildScenarioProductSurface, scenarioProductFormLabel } from "./scenario-product-surface";
import { en } from "./i18n/dictionaries/en";
import { translate } from "./i18n";

const t = (key: string) => translate(en, key);

describe("scenario product surface", () => {
  test("maps official templates to business workbench surfaces instead of a generic chatbot", () => {
    expect(buildScenarioProductSurface("support-agent").kind).toBe("embedded_assistant");
    expect(buildScenarioProductSurface("contract-playbook").kind).toBe("document_review");
    expect(buildScenarioProductSurface("risk-investigation").kind).toBe("graph_explorer");
    expect(buildScenarioProductSurface("customer-360").kind).toBe("report_generator");
    expect(buildScenarioProductSurface("team-handbook").kind).toBe("knowledge_portal");
  });

  test("returns surface-specific actions and prompts for ready scenarios", () => {
    const review = buildScenarioProductSurface("contract-playbook");
    const graph = buildScenarioProductSurface("risk-investigation");
    const support = buildScenarioProductSurface("support-agent");

    expect(t(review.primaryAction.label)).toBe("Start document review");
    expect(review.quickPrompts).toEqual(expect.arrayContaining(["List the high-risk clauses and suggest edits."]));
    expect(t(graph.primaryAction.label)).toBe("Open relationship analysis");
    expect(t(graph.contextPanelTitle)).toBe("Relationships and evidence");
    expect(t(support.primaryAction.label)).toBe("Open support assistant");
    expect(support.rightRailMode).toBe("widget");
  });

  test("keeps frontstage labels business-readable", () => {
    expect(scenarioProductFormLabel("embedded_assistant")).toBe("platform.surface.embedded_assistant.label");
    expect(t(scenarioProductFormLabel("embedded_assistant"))).toBe("Embedded assistant");
    expect(t(scenarioProductFormLabel("document_review"))).toBe("Document review");
    expect(t(scenarioProductFormLabel("graph_explorer"))).toBe("Relationship analysis");
  });
});
