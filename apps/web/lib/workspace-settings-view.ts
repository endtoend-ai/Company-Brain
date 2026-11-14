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

/** Returns a translation key; callers resolve it with `t`. */
export function workspaceSettingStatusLabel(status: WorkspaceSettingStatus) {
  if (status === "needs-setup") return "status.needsSetup";
  if (status === "review") return "status.reviewSuggested";
  return "status.enabled";
}

/** Returns a translation key; callers resolve it with `t`. */
export function roleDisplayName(role: WorkspaceRole) {
  if (role === "owner") return "roles.owner";
  if (role === "admin") return "roles.admin";
  return "roles.member";
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function buildWorkspaceSettingsModel(input: {
  profile: WorkspaceProfile;
  role?: string;
  snapshot: PlatformSnapshot;
  t: Translate;
}): WorkspaceSettingsModel {
  const role = normalizeWorkspaceRole(input.role);
  const t = input.t;
  const companyKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "company").length;
  const teamKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "team").length;
  const privateKnowledge = input.snapshot.knowledge.filter((item) => item.visibility === "private").length;
  const pendingTasks = input.snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed").length;

  return {
    identityRows: [
      { label: t("workspaceSettings.organization"), value: input.profile.organizationName, status: "enabled" },
      { label: t("workspaceSettings.workspace"), value: input.profile.workspaceName, status: "enabled" },
      { label: t("workspaceSettings.currentRole"), value: t(roleDisplayName(role)), status: role === "member" ? "review" : "enabled" }
    ],
    permissionRows: [
      { label: t("workspaceSettings.personalKnowledge"), value: t("workspaceSettings.personalKnowledgeValue", { count: privateKnowledge }), status: "enabled" },
      { label: t("workspaceSettings.teamKnowledge"), value: t("workspaceSettings.teamKnowledgeValue", { count: teamKnowledge }), status: teamKnowledge > 0 ? "enabled" : "review" },
      { label: t("workspaceSettings.companyKnowledge"), value: t("workspaceSettings.companyKnowledgeValue", { count: companyKnowledge }), status: companyKnowledge > 0 ? "enabled" : "review" }
    ],
    connectorRows: [
      { label: t("workspaceSettings.fileUpload"), value: t("workspaceSettings.fileUploadValue"), status: "enabled" },
      { label: t("workspaceSettings.connectors"), value: t("workspaceSettings.connectorsValue"), status: "needs-setup" },
      { label: t("workspaceSettings.modelServices"), value: t("workspaceSettings.modelServicesValue"), status: "needs-setup" }
    ],
    auditRows: [
      { label: t("workspaceSettings.pendingTasks"), value: t("workspaceSettings.pendingTasksValue", { count: pendingTasks }), status: pendingTasks > 0 ? "review" : "enabled" },
      { label: t("workspaceSettings.scenarios"), value: t("workspaceSettings.scenariosValue", { count: input.snapshot.scenarios.length }), status: "enabled" },
      { label: t("workspaceSettings.knowledgeAssets"), value: t("workspaceSettings.knowledgeAssetsValue", { count: input.snapshot.knowledge.length }), status: "enabled" }
    ]
  };
}
