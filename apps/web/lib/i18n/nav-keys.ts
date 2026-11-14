/**
 * Maps workspace nav routes to translation keys. Keyed by href so the stored
 * fixture labels stay untouched and only the rendered text is localized.
 */
export const workspaceNavKeys: Record<string, { label: string; description: string }> = {
  "/app": { label: "shell.navOverview", description: "shell.navOverviewDescription" },
  "/app/ask": { label: "shell.navAsk", description: "shell.navAskDescription" },
  "/app/templates": { label: "shell.navTemplates", description: "shell.navTemplatesDescription" },
  "/app/scenarios": { label: "shell.navScenarios", description: "shell.navScenariosDescription" },
  "/app/tasks": { label: "shell.navTasks", description: "shell.navTasksDescription" },
  "/app/knowledge": { label: "shell.navKnowledge", description: "shell.navKnowledgeDescription" },
  "/app/settings": { label: "shell.navSettings", description: "shell.navSettingsDescription" }
};

/** Admin console nav labels, keyed by href so fixture labels stay untouched. */
export const adminNavKeys: Record<string, string> = {
  "/admin": "admin.nav.overview",
  "/admin/templates": "admin.nav.templates",
  "/admin/knowledge-bases": "admin.nav.knowledge",
  "/admin/strategies": "admin.nav.strategies",
  "/admin/pipelines": "admin.nav.pipelines",
  "/admin/monitoring": "admin.nav.monitoring",
  "/admin/graph": "admin.nav.graph",
  "/admin/evaluations": "admin.nav.evaluations",
  "/admin/settings": "admin.nav.settings",
  "/admin/audit": "admin.nav.audit"
};

/** Knowledge asset sub-navigation labels, keyed by href. */
export const adminSubnavKeys: Record<string, string> = {
  "/admin/knowledge-bases": "admin.subnav.assetOverview",
  "/admin/knowledge-bases/gbrain": "admin.subnav.gbrain",
  "/admin/knowledge-bases/naive": "admin.subnav.naive",
  "/admin/graph": "admin.subnav.graph"
};
