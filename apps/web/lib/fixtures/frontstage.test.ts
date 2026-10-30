import { describe, expect, test } from "bun:test";
import {
  createScenarioDraft,
  frontstageNav,
  officialTemplates,
  processingTasks,
  productDataForbiddenWords,
  scenarioDataSources,
  scenarioInstances,
  scenarioAvailability,
  scenarioLifecycle,
  scenarioOutputs,
  scenarioSettings,
  scenarioWorkbenchById,
  scenarioWorkbenchTabs,
  templateById,
  visibleFrontendText,
  workspaceDashboard,
  workspaceNav,
  workspaceProfile
} from "./frontstage";

describe("frontstage fixtures", () => {
  test("navigation follows the approved product model", () => {
    expect(frontstageNav.map((item) => item.label)).toEqual([
      "Company Q&A",
      "Templates",
      "Scenarios",
      "Tasks",
      "Knowledge"
    ]);
  });

  test("workspace navigation behaves like a full user system", () => {
    expect(workspaceProfile.organizationName).toBe("Northwind Labs");
    expect(workspaceNav.map((item) => item.label)).toEqual([
      "Overview",
      "Company Q&A",
      "Templates",
      "Scenarios",
      "Tasks",
      "Knowledge",
      "Space Settings"
    ]);
    expect(workspaceNav.map((item) => item.href)).toEqual([
      "/app",
      "/app/ask",
      "/app/templates",
      "/app/scenarios",
      "/app/tasks",
      "/app/knowledge",
      "/app/settings"
    ]);
  });

  test("ships evidence-backed official templates with demo walkthroughs", () => {
    expect(officialTemplates).toHaveLength(14);
    expect(officialTemplates.map((item) => item.id)).toEqual(
      expect.arrayContaining(["data-analyst", "it-runbook", "meeting-media-memory", "voice-of-customer"])
    );
    expect(officialTemplates.every((item) => item.templateState === "official")).toBe(true);
    expect(officialTemplates.every((item) => item.demoWalkthrough.sampleInputs.length >= 2)).toBe(true);
    expect(officialTemplates.every((item) => item.demoWalkthrough.citations.length >= 2)).toBe(true);
  });

  test("customer 360 explains what users can see before creation", () => {
    const template = templateById("customer-360")!;
    expect(template.name).toBe("Customer 360 Brief");
    expect(template.demoWalkthrough.scenarioName).toContain("Renewal");
    expect(template.demoWalkthrough.sampleQuestion).toContain("Northstar Cloud");
  });

  test("scenario draft connects template to task and knowledge object", () => {
    const draft = createScenarioDraft({
      templateId: "personal-wiki",
      name: "Maya's Sales Notes Wiki",
      visibility: "private",
      fileNames: ["West Coast account retrospectives.md", "Renewal sales playbook.pdf"]
    });

    expect(draft.instance.templateId).toBe("personal-wiki");
    expect(draft.task.scenarioId).toBe(draft.instance.id);
    expect(draft.task.waitingFor).toBe("Admin");
    expect(draft.task.files).toHaveLength(2);
    expect(draft.knowledge.linkedScenarioId).toBe(draft.instance.id);
    expect(draft.knowledge.permissionNote).toContain("Only the creator");
  });

  test("workspace dashboard aggregates user-owned assets", () => {
    expect(workspaceDashboard.recentScenarioIds).toContain("scenario-customer-360");
    expect(workspaceDashboard.pendingTaskIds.length).toBeGreaterThan(0);
    expect(workspaceDashboard.quickActions.map((item) => item.href)).toContain("/app/templates");
    expect(workspaceDashboard.knowledgeHealth.readyObjects).toBeGreaterThan(0);
  });

  test("scenario workbench exposes the full lifecycle surface", () => {
    expect(scenarioWorkbenchTabs.map((tab) => tab.key)).toEqual([
      "overview",
      "data",
      "tasks",
      "ask",
      "outputs",
      "settings"
    ]);
    expect(scenarioLifecycle.map((stage) => stage.key)).toEqual([
      "template",
      "sources",
      "processing",
      "validation",
      "published"
    ]);

    const workbench = scenarioWorkbenchById("scenario-customer-360")!;
    expect(workbench.scenario.name).toBe("Northstar Cloud Renewal Brief");
    expect(workbench.tabs.map((tab) => tab.href)).toContain("/app/scenarios/scenario-customer-360/data");
    expect(workbench.dataSources.length).toBeGreaterThanOrEqual(3);
    expect(workbench.tasks.length).toBeGreaterThanOrEqual(1);
    expect(workbench.outputs.length).toBeGreaterThanOrEqual(2);
    expect(workbench.settings.publicationMode).toBe("Team");
  });

  test("ready scenario represents a directly usable business app", () => {
    const scenario = scenarioInstances.find((item) => item.id === "scenario-customer-360")!;
    const availability = scenarioAvailability(scenario);
    const workbench = scenarioWorkbenchById(scenario.id)!;

    expect(availability.label).toBe("Ready");
    expect(availability.description).toContain("Ingest, knowledge construction, and publishing are complete");
    expect(workbench.tabs.map((tab) => tab.label)).toEqual(["Use", "Files", "Business tasks", "Q&A", "Deliverables", "Manage"]);
    expect(workbench.dataSources.every((source) => source.status === "Ingested")).toBe(true);
    expect(workbench.outputs.every((output) => output.status === "Ready")).toBe(true);
    expect(workbench.tasks[0]?.userMessage).toContain("can use the scenario now");
  });

  test("scenario assets are connected by scenario id", () => {
    const scenarioId = "scenario-customer-360";
    expect(scenarioDataSources.filter((item) => item.scenarioId === scenarioId).length).toBeGreaterThanOrEqual(3);
    expect(scenarioOutputs.filter((item) => item.scenarioId === scenarioId).map((item) => item.type)).toContain("Customer brief");
    expect(scenarioSettings.find((item) => item.scenarioId === scenarioId)?.retrievalPolicy).toContain("Hybrid");
  });

  test("tasks expose rag mode, files, time and permission scope", () => {
    expect(processingTasks.every((task) => task.ragMode.length > 0)).toBe(true);
    expect(processingTasks.every((task) => task.files.length > 0)).toBe(true);
    expect(processingTasks.every((task) => task.submittedAt.length > 0 && task.updatedAt.length > 0)).toBe(true);
    expect(processingTasks.map((task) => task.visibility)).toContain("private");
    expect(processingTasks.map((task) => task.visibility)).toContain("team");
  });

  test("visible copy avoids fake-data and demo framing", () => {
    const text = visibleFrontendText().toLowerCase();
    for (const word of productDataForbiddenWords) {
      expect(text.includes(word)).toBe(false);
    }
    expect(scenarioInstances.length).toBeGreaterThanOrEqual(10);
  });
});
