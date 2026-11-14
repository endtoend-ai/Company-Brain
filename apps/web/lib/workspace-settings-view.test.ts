import { describe, expect, test } from "bun:test";

import type { PlatformSnapshot } from "../components/app/platform-live";
import { workspaceProfile } from "./fixtures/frontstage";
import { en } from "./i18n/dictionaries/en";
import { translate } from "./i18n";
import { buildWorkspaceSettingsModel, normalizeWorkspaceRole, roleDisplayName } from "./workspace-settings-view";

const t = (key: string, vars?: Record<string, string | number>) => translate(en, key, vars);

const snapshot: PlatformSnapshot = {
  scenarios: [
    { id: "s1", templateId: "t1", name: "Acme Health renewal brief", description: "", visibility: "team", ownerName: "Maya Chen", status: "ready", sourceCount: 2, processingGoal: "", updatedAt: new Date().toISOString() }
  ],
  tasks: [
    { id: "task-1", scenarioId: "s1", title: "File ingest", status: "submitted", kind: "Admin review", ragMode: "文档证据", visibility: "team", owner: "Maya Chen", submittedAt: "just now", updatedAt: "just now", files: [], waitingFor: "Admin", progress: 15, currentStep: "Waiting for confirmation", userMessage: "", nextActions: [], adminEntry: "" }
  ],
  knowledge: [
    { id: "k1", scenarioId: "s1", title: "Contract evidence", content: "Policy", visibility: "company", ownerName: "Legal", ragEngine: "Naive RAG", sourceOriginalName: "policy.pdf", createdAt: new Date().toISOString() },
    { id: "k2", scenarioId: "s1", title: "Sales graph", content: "Relationships", visibility: "team", ownerName: "Sales", ragEngine: "GraphRAG", sourceOriginalName: "crm.csv", createdAt: new Date().toISOString() }
  ]
};

describe("workspace settings view model", () => {
  test("normalizes roles for frontstage workspace settings", () => {
    expect(normalizeWorkspaceRole("admin")).toBe("admin");
    expect(normalizeWorkspaceRole("unknown")).toBe("member");
    expect(roleDisplayName("owner")).toBe("roles.owner");
    expect(t(roleDisplayName("owner"))).toBe("Workspace owner");
  });

  test("builds settings rows from real snapshot counts", () => {
    const model = buildWorkspaceSettingsModel({ profile: workspaceProfile, role: "member", snapshot, t });
    expect(model.identityRows.find((row) => row.label === "Current role")?.value).toBe("Business member");
    expect(model.permissionRows.find((row) => row.label === "Company knowledge")?.value).toContain("1 assets");
    expect(model.auditRows.find((row) => row.label === "Pending tasks")?.status).toBe("review");
    expect(model.connectorRows.map((row) => row.label)).toContain("Model and parsing services");
  });
});
