import { describe, expect, test } from "bun:test";

import {
  computePlatformSnapshotMetrics,
  toKnowledgeSpaceObject,
  toScenarioInstance,
  type LiveKnowledgeRecord,
  type LiveScenarioRecord
} from "./platform-live";

describe("frontstage live platform data mapping", () => {
  test("maps stored scenarios into directly usable scenario cards", () => {
    const scenario: LiveScenarioRecord = {
      id: "scene_real_customer",
      templateId: "customer-360",
      name: "Acme Health renewal scenario",
      description: "Analyze renewal risk and opportunity from the uploaded files.",
      visibility: "team",
      ownerName: "Maya Chen",
      status: "ready",
      sourceCount: 3,
      processingGoal: "Generate a renewal analysis.",
      updatedAt: "2026-06-25T12:00:00.000Z"
    };

    const mapped = toScenarioInstance(scenario);

    expect(mapped.id).toBe("scene_real_customer");
    expect(mapped.owner).toBe("Maya Chen");
    expect(mapped.visibility).toBe("team");
    expect(mapped.status).toBe("ready");
    expect(mapped.readyActions).toEqual(expect.arrayContaining(["Ask directly", "View files", "Generate deliverable"]));
    expect(mapped.recommendedQuestions[0]).toContain("Acme Health renewal scenario");
  });

  test("maps live knowledge records to permission-aware knowledge cards", () => {
    const record: LiveKnowledgeRecord = {
      id: "ko_real_chunk",
      scenarioId: "scene_real_customer",
      title: "Acme Health renewal scenario · Renewal review.pdf",
      content: "Renewal risk comes from approval delays and integration scheduling.",
      visibility: "company",
      ownerName: "Maya Chen",
      ragEngine: "Naive RAG",
      sourceOriginalName: "Renewal review.pdf",
      createdAt: "2026-06-25T12:00:00.000Z"
    };

    const mapped = toKnowledgeSpaceObject(record);

    expect(mapped.id).toBe("ko_real_chunk");
    expect(mapped.mode).toBe("document");
    expect(mapped.linkedScenarioId).toBe("scene_real_customer");
    expect(mapped.sourceLabel).toBe("Renewal review.pdf");
    expect(mapped.permissionNote).toContain("company");
    expect(mapped.summary).toContain("Renewal risk");
  });

  test("computes dashboard metrics from real scenarios tasks and knowledge", () => {
    const metrics = computePlatformSnapshotMetrics({
      scenarios: [
        {
          id: "scene_ready",
          templateId: "customer-360",
          name: "Published scenario",
          description: "",
          visibility: "team",
          ownerName: "Maya Chen",
          status: "ready",
          sourceCount: 1,
          processingGoal: "",
          updatedAt: "2026-06-25T12:00:00.000Z"
        },
        {
          id: "scene_pending",
          templateId: "custom-scenario",
          name: "Pending scenario",
          description: "",
          visibility: "private",
          ownerName: "Maya Chen",
          status: "submitted",
          sourceCount: 1,
          processingGoal: "",
          updatedAt: "2026-06-25T12:00:00.000Z"
        }
      ],
      tasks: [
        {
          id: "task_pending",
          scenarioId: "scene_pending",
          title: "Process pending scenario",
          status: "submitted",
          kind: "Admin review",
          ragMode: "知识百科",
          visibility: "private",
          owner: "Maya Chen",
          submittedAt: "just now",
          updatedAt: "just now",
          files: ["Scope.md"],
          waitingFor: "Admin",
          progress: 18,
          currentStep: "Waiting for the admin to configure the engine policy",
          userMessage: "Waiting for the admin console.",
          nextActions: ["Wait for admin confirmation"],
          adminEntry: "Pending admin review"
        }
      ],
      knowledge: [
        {
          id: "ko_ready",
          scenarioId: "scene_ready",
          title: "Published scenario · Files.md",
          content: "Published content",
          visibility: "team",
          ownerName: "Maya Chen",
          ragEngine: "Gbrain",
          sourceOriginalName: "Files.md",
          createdAt: "2026-06-25T12:00:00.000Z"
        }
      ]
    });

    expect(metrics.scenarioCount).toBe(2);
    expect(metrics.readyScenarioCount).toBe(1);
    expect(metrics.pendingTaskCount).toBe(1);
    expect(metrics.readyKnowledgeCount).toBe(1);
  });
});
