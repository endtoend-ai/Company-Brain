import { Hono } from "hono";
import {
  buildAdminAuditEvents,
  buildAdminGraphSnapshot,
  buildAdminIntegrationSettings,
  buildAdminOperationSummary,
  buildAdminTemplateGovernance,
  buildStrategyProfiles,
  createScenario,
  getScenarioTemplate,
  listKnowledgeObjects,
  listProcessingTasks,
  listScenarioInstances,
  listScenarioTemplates,
  processProcessingTask
} from "@ff/platform";
import type { UserContext } from "@ff/contracts";
import { getModuleHealth, getRegisteredModules } from "@ff/gateway";

export const platformRouter = new Hono();

const demoUser: UserContext = {
  userId: "demo-user",
  username: "Maya Chen",
  isAdmin: true,
  organizationId: "org_ff_demo",
  teamIds: ["sales", "platform-admin"]
};

platformRouter.get("/platform/templates", (c) => {
  return c.json({ templates: listScenarioTemplates().map(toPublicTemplate) });
});

platformRouter.get("/platform/templates/:templateId", (c) => {
  const template = getScenarioTemplate(c.req.param("templateId"));
  if (!template) return c.json({ error: "not_found", message: "Template not found" }, 404);
  return c.json({ template: toPublicTemplate(template) });
});

platformRouter.post("/platform/scenarios", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = await createScenario(demoUser, {
    templateId: body.template_id,
    name: body.name,
    description: body.description,
    visibility: body.visibility,
    uploadedFiles: body.uploaded_files,
    assetIds: body.asset_ids,
    businessOptions: body.business_options
  });
  return c.json({
    scenario: toSnakeObject(result.instance),
    task: toSnakeObject(result.task)
  }, 201);
});

platformRouter.get("/platform/scenarios", (c) => {
  return c.json({ scenarios: listScenarioInstances(demoUser).map(toSnakeObject) });
});

platformRouter.get("/platform/tasks", (c) => {
  return c.json({ tasks: listProcessingTasks(demoUser).map(toSnakeObject) });
});

platformRouter.post("/platform/tasks/:taskId/process", async (c) => {
  const task = await processProcessingTask(c.req.param("taskId"));
  return c.json({ task: toSnakeObject(task) });
});

platformRouter.get("/platform/knowledge", (c) => {
  return c.json({ objects: listKnowledgeObjects(demoUser).map(toSnakeObject) });
});

platformRouter.post("/platform/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const query = String(body.query ?? "");
  return c.json({
    answer: {
      text: `Searched the knowledge sources you can access for "${query}" and answered against the cited evidence. You can save this question as a scenario task or track it in a knowledge space.`,
      citations: listKnowledgeObjects(demoUser).slice(0, 2).flatMap((item) => item.citations),
      next_actions: ["Create scenario", "Save task", "View knowledge space"]
    }
  });
});

platformRouter.get("/platform/admin/summary", (c) => c.json({ summary: buildAdminOperationSummary().map(toSnakeObject) }));
platformRouter.get("/platform/admin/templates", (c) => c.json({ templates: buildAdminTemplateGovernance().map(toSnakeObject) }));
platformRouter.get("/platform/admin/strategies", (c) => c.json({ strategies: buildStrategyProfiles().map(toSnakeObject) }));
platformRouter.get("/platform/admin/graph", (c) => c.json({ graph: toSnakeObjectDeep(buildAdminGraphSnapshot()) }));
platformRouter.get("/platform/admin/audit", (c) => c.json({ events: buildAdminAuditEvents().map(toSnakeObject) }));
platformRouter.get("/platform/admin/settings", async (c) => {
  const healthEntries = await Promise.all(
    getRegisteredModules().map(async (module) => [module.id, await getModuleHealth(module.id)] as const)
  );
  const moduleHealth = Object.fromEntries(healthEntries);
  return c.json({ settings: toSnakeObjectDeep(buildAdminIntegrationSettings({ moduleHealth })) });
});

function toPublicTemplate(template: any) {
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    state: template.state,
    evidence_level: template.evidenceLevel,
    evidence_sources: template.evidenceSources,
    product_forms: template.productForms,
    limitations: template.limitations,
    headline: template.headline,
    description: template.description,
    required_inputs: template.requiredInputs,
    accepted_file_types: template.acceptedFileTypes,
    output_capabilities: template.outputCapabilities,
    demo_walkthrough: toSnakeObjectDeep(template.demoWalkthrough),
    needs_admin_review: template.needsAdminReview,
    default_visibility: template.defaultVisibility
  };
}

function toSnakeObject(row: any) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = value;
  }
  return out;
}

function toSnakeObjectDeep(value: any): any {
  if (Array.isArray(value)) return value.map(toSnakeObjectDeep);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = toSnakeObjectDeep(nested);
  }
  return out;
}
