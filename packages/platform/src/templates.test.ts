import { describe, expect, test } from "bun:test";
import {
  OFFICIAL_TEMPLATE_IDS,
  getScenarioTemplate,
  listScenarioTemplates,
  modulePlanForTemplate,
  seedScenarioTemplatesSqlRows,
  validateOfficialTemplateEvidence
} from "./templates";

describe("platform scenario templates", () => {
  test("contains the approved fourteen official templates", () => {
    expect(OFFICIAL_TEMPLATE_IDS).toEqual([
      "personal-wiki",
      "team-handbook",
      "policy-evidence",
      "contract-playbook",
      "rfp-security",
      "customer-360",
      "risk-investigation",
      "domain-relationship",
      "support-agent",
      "research-guide",
      "data-analyst",
      "it-runbook",
      "meeting-media-memory",
      "voice-of-customer"
    ]);
    expect(listScenarioTemplates()).toHaveLength(14);
  });

  test("official templates pass evidence and demo walkthrough gates", () => {
    for (const template of listScenarioTemplates()) {
      expect(validateOfficialTemplateEvidence(template)).toBe(true);
      expect(template.state).toBe("official");
      expect(template.evidenceLevel).toBe("validated");
      expect(template.evidenceSources.length).toBeGreaterThanOrEqual(2);
      expect(template.productForms.length).toBeGreaterThanOrEqual(1);
      expect(template.limitations.length).toBeGreaterThanOrEqual(1);
      expect(template.demoWalkthrough.sampleInputs.length).toBeGreaterThanOrEqual(2);
      expect(template.demoWalkthrough.citations.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("customer 360 is a hybrid template with relationship-first routing", () => {
    const template = getScenarioTemplate("customer-360");
    const plan = modulePlanForTemplate("customer-360");

    expect(template?.name).toBe("Customer 360 Brief");
    expect(template?.demoWalkthrough.scenarioName).toContain("Renewal");
    expect(plan.map((item) => item.moduleId)).toEqual(["graph-rag", "traditional-rag", "nano-brain"]);
    expect(plan[0].sourcePurpose).toBe("relationship");
  });

  test("seed rows serialize all template metadata", () => {
    const rows = seedScenarioTemplatesSqlRows();
    const customer360 = rows.find((row) => row.id === "customer-360");

    expect(customer360?.state).toBe("official");
    expect(JSON.parse(customer360?.modulePlanJson ?? "[]")[0].moduleId).toBe("graph-rag");
    expect(JSON.parse(customer360?.demoWalkthroughJson ?? "{}").sampleQuestion).toContain("renewal");
  });
});
