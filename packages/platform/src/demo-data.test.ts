import { describe, expect, test } from "bun:test";
import {
  PRODUCT_FACING_FORBIDDEN_WORDS,
  buildDeliveryDemoDataPlan,
  buildDemoScenarioSeedRequests,
  buildScenarioIngestFiles,
  buildTemplateDemoWalkthroughs
} from "./demo-data";

describe("delivery seed data", () => {
  test("covers every official template with high-volume assets", () => {
    const plan = buildDeliveryDemoDataPlan();
    const templateIds = new Set(plan.scenarios.map((item) => item.templateId));

    expect(templateIds).toEqual(new Set([
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
    ]));
    expect(plan.scenarios.length).toBeGreaterThanOrEqual(30);
    expect(plan.assets.length).toBeGreaterThanOrEqual(120);
  });

  test("includes reusable file formats for upload and ingestion flows", () => {
    const formats = new Set(buildDeliveryDemoDataPlan().assets.map((item) => item.format));
    expect(formats).toContain("md");
    expect(formats).toContain("pdf");
    expect(formats).toContain("csv");
    expect(formats).toContain("txt");
    expect(formats).toContain("json");
  });

  test("product-facing names do not expose local data labels", () => {
    const plan = buildDeliveryDemoDataPlan();
    const visibleText = [
      ...plan.scenarios.flatMap((item) => [item.name, item.description, item.department, item.ownerUsername]),
      ...plan.assets.flatMap((item) => [item.fileName, item.title])
    ].join("\n").toLowerCase();

    for (const word of PRODUCT_FACING_FORBIDDEN_WORDS) {
      expect(visibleText.includes(word)).toBe(false);
    }
  });

  test("builds one walkthrough per official template", () => {
    const walkthroughs = buildTemplateDemoWalkthroughs();
    expect(walkthroughs).toHaveLength(14);
    for (const walkthrough of walkthroughs) {
      expect(walkthrough.sampleInputs.length).toBeGreaterThanOrEqual(2);
      expect(walkthrough.citations.length).toBeGreaterThanOrEqual(2);
      expect(walkthrough.sampleQuestion.length).toBeGreaterThan(8);
      expect(walkthrough.sampleAnswer.length).toBeGreaterThan(30);
    }
  });

  test("seed requests connect scenario creation to uploaded file metadata", () => {
    const requests = buildDemoScenarioSeedRequests();
    expect(requests.length).toBeGreaterThanOrEqual(30);
    for (const request of requests) {
      expect(request.uploaded_files.length).toBeGreaterThanOrEqual(4);
      expect(request.business_options.seed_asset_ids.length).toBe(request.uploaded_files.length);
    }
  });

  test("worker can resolve ingest files from seed asset ids", () => {
    const request = buildDemoScenarioSeedRequests()[0];
    const files = buildScenarioIngestFiles({
      scenarioName: request.name,
      scenarioDescription: request.description,
      businessOptions: request.business_options
    });

    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files[0].name).toBe(request.uploaded_files[0].name);
    expect(files[0].text.length).toBeGreaterThan(300);
  });
});
