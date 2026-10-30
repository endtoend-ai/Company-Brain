import type { PlatformSnapshot } from "../components/app/platform-live";
import type { WorkspaceProfile } from "./fixtures/frontstage";

export type WorkspaceRole = "member" | "admin" | "owner";

export type WorkspaceSettingStatus = "enabled" | "needs-setup" | "review";

export type WorkspaceSettingRow = {
  label: string;
  value: string;
  status: WorkspaceSettingStatus;
};

export type WorkspaceSettingsModel = {
  identityRows: WorkspaceSettingRow[];
  permissionRows: WorkspaceSettingRow[];
  connectorRows: WorkspaceSettingRow[];
  auditRows: WorkspaceSettingRow[];
};

export function normalizeWorkspaceRole(role?: string): WorkspaceRole {
  if (role === "admin") return "admin";
  if (role === "owner") return "owner";
  return "member";
}

export function workspaceSettingStatusLabel(status: WorkspaceSettingStatus) {
  if (status === "needs-setup") return "Needs admin setup";
  if (status === "review") return "Review suggested";
  return "Enabled";
}

export function roleDisplayName(role: WorkspaceRole) {
  if (role === "owner") return "Workspace owner";
  if (role === "admin") return "Admin";
  return "Business member";
}

export function buildWorkspaceSettingsModel(input: {
  profile: WorkspaceProfile;
  role?: string;
  snapshot: PlatformSnapshot;
}): WorkspaceSettingsModel {
  const role = normalizeWorkspaceRole(input.role);
  const companyKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "company").length;
  const teamKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "team").length;
  const privateKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "private").length;
  const pendingTasks = input.snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed").length;

  return {
    identityRows: [
      { label: "Organization", value: input.profile.organizationName, status: "enabled" },
      { label: "Workspace", value: input.profile.workspaceName, status: "enabled" },
      { label: "Current role", value: roleDisplayName(role), status: role === "member" ? "review" : "enabled" }
    ],
    permissionRows: [
      { label: "Personal knowledge", value: `${privateKnowledge} assets, retrievable by their creator`, status: "enabled" },
      { label: "Team knowledge", value: `${teamKnowledge} assets, retrievable inside the team`, status: teamKnowledge > 0 ? "enabled" : "review" },
      { label: "Company knowledge", value: `${companyKnowledge} assets, included in company-wide Q&A`, status: companyKnowledge > 0 ? "enabled" : "review" }
    ],
    connectorRows: [
      { label: "File upload", value: "PDF, Word, Markdown, spreadsheets, images, audio, and video", status: "enabled" },
      { label: "Business system connectors", value: "CRM, ticketing, meetings, and document library sync", status: "needs-setup" },
      { label: "Model and parsing services", value: "Models, embeddings, document parsing, and multimodal processing", status: "needs-setup" }
    ],
    auditRows: [
      { label: "Pending tasks", value: `${pendingTasks} ingest or review tasks`, status: pendingTasks > 0 ? "review" : "enabled" },
      { label: "Scenarios", value: `${input.snapshot.scenarios.length} scenarios created`, status: "enabled" },
      { label: "Knowledge assets", value: `${input.snapshot.knowledge.length} visible assets`, status: "enabled" }
    ]
  };
}
