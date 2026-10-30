import { randomUUID } from "node:crypto";
import { buildScenarioIngestFiles } from "./demo-data";
import { createMockModuleSource, ingestTextIntoMockModule, platformReferenceFromIngestResult } from "./module-adapters";
import { getScenarioTemplate } from "./templates";
import type { AccessControl, CreateScenarioInput, KnowledgeObjectMode, KnowledgeSpaceObject, PlatformUser, ProcessingTask, ScenarioInstance, TemplateModulePlan, Visibility } from "./types";

const scenarios: ScenarioInstance[] = [];
const tasks: ProcessingTask[] = [];
const knowledgeObjects: KnowledgeSpaceObject[] = [];

export function resetPlatformState() {
  scenarios.length = 0;
  tasks.length = 0;
  knowledgeObjects.length = 0;
}

export async function createScenario(user: PlatformUser, input: CreateScenarioInput): Promise<{ instance: ScenarioInstance; task: ProcessingTask }> {
  const template = getScenarioTemplate(input.templateId);
  if (!template) throw new Error(`Unknown template: ${input.templateId}`);

  const now = new Date();
  const visibility = input.visibility ?? template.defaultVisibility;
  const accessControl = accessControlFor(visibility, user);
  const instance: ScenarioInstance = {
    id: `scene_${randomUUID()}`,
    templateId: template.id,
    name: input.name,
    description: input.description ?? template.description,
    ownerUserId: user.userId,
    ownerUsername: user.username,
    organizationId: accessControl.organizationId,
    teamIds: accessControl.teamIds,
    accessControl,
    visibility,
    status: template.needsAdminReview ? "waiting_review" : "submitted",
    businessOptions: {
      ...(input.businessOptions ?? {}),
      uploaded_file_names: input.uploadedFiles?.map((file) => file.name) ?? [],
      asset_ids: input.assetIds ?? []
    },
    createdAt: now,
    updatedAt: now
  };

  const task: ProcessingTask = {
    id: `task_${randomUUID()}`,
    scenarioId: instance.id,
    templateId: template.id,
    title: `Process ${template.name}`,
    status: instance.status,
    progress: instance.status === "waiting_review" ? 10 : 18,
    currentStep: instance.status === "waiting_review" ? "Waiting for admin confirmation" : "Files submitted",
    userMessage: instance.status === "waiting_review" ? "This template needs admin confirmation before processing starts." : "Files are submitted and the system is preparing to process them.",
    nextActions: instance.status === "waiting_review" ? ["Wait for confirmation", "Add details"] : ["View task center", "Keep uploading files"],
    error: null,
    createdAt: now,
    updatedAt: now
  };

  scenarios.unshift(instance);
  tasks.unshift(task);
  return { instance, task };
}

export async function processProcessingTask(taskId: string): Promise<ProcessingTask> {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  const scenario = scenarios.find((item) => item.id === task.scenarioId);
  if (!scenario) throw new Error(`Missing scenario for task: ${taskId}`);
  const template = getScenarioTemplate(task.templateId);
  if (!template) throw new Error(`Missing template for task: ${taskId}`);

  task.status = "processing";
  task.progress = 66;
  task.currentStep = "Organizing files and building sources";
  task.userMessage = "The system is organizing files, building sources, and generating knowledge objects.";
  task.updatedAt = new Date();

  const files = buildScenarioIngestFiles({
    scenarioName: scenario.name,
    scenarioDescription: scenario.description,
    businessOptions: scenario.businessOptions
  });

  const references = template.modulePlan.flatMap((plan, planIndex) => {
    const source = createMockModuleSource({ moduleId: plan.moduleId, sourceName: `${plan.createSourceName}/${scenario.id.slice(0, 8)}` });
    const selected = files[planIndex % files.length] ?? files[0];
    const result = ingestTextIntoMockModule({
      moduleId: plan.moduleId,
      ingestMode: plan.ingestMode,
      sourceId: source.sourceId,
      file: selected
    });
    return platformReferenceFromIngestResult({
      moduleId: plan.moduleId,
      ingestMode: plan.ingestMode,
      sourceId: source.sourceId,
      result
    });
  });

  const now = new Date();
  task.status = "ready";
  task.progress = 100;
  task.currentStep = "Knowledge objects generated";
  task.userMessage = "The scenario is ready to use.";
  task.nextActions = ["Open scenario", "View knowledge space", "Start asking questions"];
  task.updatedAt = now;

  scenario.status = "ready";
  scenario.updatedAt = now;

  const object: KnowledgeSpaceObject = {
    id: `knowledge_${randomUUID()}`,
    scenarioId: scenario.id,
    templateId: template.id,
    mode: knowledgeModeForTemplate(template.id),
    title: scenario.name,
    summary: `${template.name} is ready for Q&A, traceability, and deliverable reuse.`,
    sourceLabel: template.name,
    accessControl: accessControlFromScenario(scenario),
    status: template.needsAdminReview ? "needs_review" : "ready",
    citations: template.demoWalkthrough.citations,
    actions: actionsForMode(knowledgeModeForTemplate(template.id)),
    createdAt: now,
    updatedAt: now
  };
  object.summary += ` ${references.length} source citations were created.`;
  knowledgeObjects.unshift(object);

  return task;
}

export function listScenarioInstances(user?: PlatformUser): ScenarioInstance[] {
  if (!user?.isAdmin) return scenarios.filter((item) => !user || canAccess(user, accessControlFromScenario(item)));
  return scenarios;
}

export function getScenarioInstance(id: string): ScenarioInstance | undefined {
  return scenarios.find((item) => item.id === id);
}

export function listProcessingTasks(user?: PlatformUser): ProcessingTask[] {
  const allowedScenarioIds = new Set(listScenarioInstances(user).map((item) => item.id));
  return tasks.filter((item) => allowedScenarioIds.has(item.scenarioId));
}

export function listKnowledgeObjects(user?: PlatformUser): KnowledgeSpaceObject[] {
  const allowedScenarioIds = new Set(listScenarioInstances(user).map((item) => item.id));
  return knowledgeObjects.filter((item) => allowedScenarioIds.has(item.scenarioId));
}

export function knowledgeModeForTemplate(templateId: string): KnowledgeObjectMode {
  if (["personal-wiki", "team-handbook", "research-guide", "it-runbook", "meeting-media-memory"].includes(templateId)) return "wiki";
  if (["customer-360", "risk-investigation", "domain-relationship", "voice-of-customer"].includes(templateId)) return "relationship";
  if (["rfp-security", "contract-playbook", "data-analyst"].includes(templateId)) return "artifact";
  return "document";
}

function actionsForMode(mode: KnowledgeObjectMode): string[] {
  const map: Record<KnowledgeObjectMode, string[]> = {
    wiki: ["Browse entries", "Keep asking", "Share knowledge"],
    document: ["View evidence", "Keep asking", "Export the answer"],
    relationship: ["View relationship graph", "Trace the path", "Generate a brief"],
    artifact: ["View the deliverable", "Export files", "Submit for review"]
  };
  return map[mode];
}

export function modulePlansForScenario(templateId: string): TemplateModulePlan[] {
  return getScenarioTemplate(templateId)?.modulePlan ?? [];
}

function canAccess(user: PlatformUser, accessControl: AccessControl) {
  if (user.isAdmin) return true;
  if (accessControl.ownerUserId === user.userId) return true;
  if (accessControl.scope === "private") return false;
  if (accessControl.organizationId !== normalizeOrganizationId(user.organizationId)) return false;
  if (accessControl.scope === "company") return true;
  const userTeamIds = normalizeTeamIds(user.teamIds);
  return accessControl.teamIds.some((teamId) => userTeamIds.includes(teamId));
}

function accessControlFor(scope: Visibility, user: PlatformUser): AccessControl {
  return {
    scope,
    ownerUserId: user.userId,
    ownerUsername: user.username,
    organizationId: normalizeOrganizationId(user.organizationId),
    teamIds: normalizeTeamIds(user.teamIds)
  };
}

function accessControlFromScenario(scenario: ScenarioInstance): AccessControl {
  return scenario.accessControl ?? {
    scope: scenario.visibility,
    ownerUserId: scenario.ownerUserId,
    ownerUsername: scenario.ownerUsername,
    organizationId: normalizeOrganizationId(scenario.organizationId),
    teamIds: normalizeTeamIds(scenario.teamIds)
  };
}

function normalizeOrganizationId(value?: string) {
  return value?.trim() || "org_companybrain";
}

function normalizeTeamIds(value?: string[]) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}
