import { describe, expect, test } from "bun:test";
import { buildDemoScenarioSeedRequests } from "./demo-data";
import {
  createScenario,
  listKnowledgeObjects,
  listProcessingTasks,
  listScenarioInstances,
  processProcessingTask,
  resetPlatformState
} from "./scenarios";

const user = { userId: "user-1", username: "Maya Chen", isAdmin: false };

describe("scenario lifecycle", () => {
  test("creates a scenario and first processing task from a template", async () => {
    resetPlatformState();
    const result = await createScenario(user, {
      templateId: "personal-wiki",
      name: "Maya's Sales Notes Wiki",
      visibility: "private",
      uploadedFiles: [{ name: "West Coast account retrospectives.md", text: "Account retrospective material" }]
    });

    expect(result.instance.templateId).toBe("personal-wiki");
    expect(result.instance.status).toBe("submitted");
    expect(result.task.scenarioId).toBe(result.instance.id);
    expect(result.task.status).toBe("submitted");
    expect(listScenarioInstances(user)).toHaveLength(1);
  });

  test("processing task creates a ready knowledge projection", async () => {
    resetPlatformState();
    const request = buildDemoScenarioSeedRequests().find((item) => item.template_id === "customer-360")!;
    const created = await createScenario(user, {
      templateId: request.template_id,
      name: request.name,
      description: request.description,
      visibility: request.visibility,
      uploadedFiles: request.uploaded_files,
      businessOptions: request.business_options
    });

    const processed = await processProcessingTask(created.task.id);
    const tasks = listProcessingTasks(user);
    const objects = listKnowledgeObjects(user);

    expect(processed.status).toBe("ready");
    expect(tasks[0].status).toBe("ready");
    expect(objects).toHaveLength(1);
    expect(objects[0].mode).toBe("relationship");
    expect(objects[0].citations.length).toBeGreaterThanOrEqual(2);
  });

  test("bulk seed requests can create at least thirty ready scenarios", async () => {
    resetPlatformState();
    for (const request of buildDemoScenarioSeedRequests()) {
      const created = await createScenario(user, {
        templateId: request.template_id,
        name: request.name,
        description: request.description,
        visibility: request.visibility,
        uploadedFiles: request.uploaded_files,
        businessOptions: request.business_options
      });
      await processProcessingTask(created.task.id);
    }

    expect(listScenarioInstances(user).length).toBeGreaterThanOrEqual(30);
    expect(listProcessingTasks(user).every((task) => task.status === "ready")).toBe(true);
    expect(listKnowledgeObjects(user).length).toBeGreaterThanOrEqual(30);
  });

  test("filters scenario and knowledge access by team and organization", async () => {
    resetPlatformState();
    const salesOwner = { userId: "sales-owner", username: "Sales owner", isAdmin: false, organizationId: "org-main", teamIds: ["sales"] };
    const salesPeer = { userId: "sales-peer", username: "Sales teammate", isAdmin: false, organizationId: "org-main", teamIds: ["sales"] };
    const legalPeer = { userId: "legal-peer", username: "Legal teammate", isAdmin: false, organizationId: "org-main", teamIds: ["legal"] };
    const outsideOrg = { userId: "outside", username: "External org", isAdmin: false, organizationId: "org-other", teamIds: ["sales"] };

    const teamScenario = await createScenario(salesOwner, {
      templateId: "customer-360",
      name: "Sales team customer profile",
      visibility: "team",
      uploadedFiles: [{ name: "Customer material.md", text: "Sales material" }]
    });
    const companyScenario = await createScenario(salesOwner, {
      templateId: "policy-evidence",
      name: "Company policy Q&A",
      visibility: "company",
      uploadedFiles: [{ name: "Policy.md", text: "Company policy" }]
    });
    await processProcessingTask(teamScenario.task.id);
    await processProcessingTask(companyScenario.task.id);

    expect(listScenarioInstances(salesPeer).map((item) => item.id)).toEqual(expect.arrayContaining([teamScenario.instance.id, companyScenario.instance.id]));
    expect(listScenarioInstances(legalPeer).map((item) => item.id)).not.toContain(teamScenario.instance.id);
    expect(listScenarioInstances(legalPeer).map((item) => item.id)).toContain(companyScenario.instance.id);
    expect(listKnowledgeObjects(outsideOrg)).toHaveLength(0);
    expect(listKnowledgeObjects(salesPeer).find((item) => item.scenarioId === teamScenario.instance.id)?.accessControl).toMatchObject({
      scope: "team",
      organizationId: "org-main",
      teamIds: ["sales"]
    });
  });

  test("keeps unassigned team scenarios private to owner and admins", async () => {
    resetPlatformState();
    const owner = { userId: "owner", username: "Owner", isAdmin: false, organizationId: "org-main" };
    const peerWithoutTeam = { userId: "peer", username: "Same-org member", isAdmin: false, organizationId: "org-main" };

    const created = await createScenario(owner, {
      templateId: "team-handbook",
      name: "Unassigned team handbook",
      visibility: "team",
      uploadedFiles: [{ name: "Handbook.md", text: "Team material" }]
    });
    await processProcessingTask(created.task.id);

    expect(listKnowledgeObjects(owner)).toHaveLength(1);
    expect(listKnowledgeObjects(peerWithoutTeam)).toHaveLength(0);
  });
});
