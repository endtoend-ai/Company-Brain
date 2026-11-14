import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { workspaceNav } from "./fixtures/frontstage";
import { en } from "./i18n/dictionaries/en";
import { workspaceNavKeys } from "./i18n/nav-keys";
import { translate } from "./i18n";

const checkedFiles = [
  "app/page.tsx",
  "components/site/site-header.tsx",
  "components/site/site-footer.tsx",
  "components/app/platform.tsx",
  "components/admin/admin-pages.tsx"
];

describe("navigation policy", () => {
  test("keeps first-party navigation in the current browser tab", () => {
    const source = checkedFiles.map((file) => readFileSync(`apps/web/${file}`, "utf8")).join("\n");

    expect(source).not.toContain('target="_blank"');
    expect(source).not.toContain("window.open");
  });

  test("homepage footer points at existing frontstage routes", () => {
    const footer = readFileSync("apps/web/components/site/site-footer.tsx", "utf8");

    expect(footer).toContain('href="/app"');
    expect(footer).toContain('href="/app/knowledge"');
    expect(footer).toContain('href="/app/settings"');
    expect(footer).not.toContain('href="/app/browse"');
    expect(footer).not.toContain('href="/app/me"');
  });

  test("homepage uses professional entry labels and no demo-data framing", () => {
    const header = readFileSync("apps/web/components/site/site-header.tsx", "utf8");
    const page = readFileSync("apps/web/app/page.tsx", "utf8");
    const heroAnswer = readFileSync("apps/web/components/site/hero-answer.tsx", "utf8");
    const scenarioRows = readFileSync("apps/web/components/site/scenario-rows.tsx", "utf8");

    expect(header.indexOf("nav.openWorkspace")).toBeLessThan(header.indexOf("nav.adminConsole"));
    expect(header.lastIndexOf("ThemeToggle")).toBeGreaterThan(header.indexOf("nav.adminConsole"));
    expect(en.nav.openWorkspace).toBe("Open workspace");
    expect(en.nav.adminConsole).toBe("Admin console");
    expect(page).not.toContain("Demo data");
    expect(heroAnswer).not.toContain("Live demo");
    expect(page).toContain("site.ctaTitleLine1");
    expect(en.site.ctaTitleLine1).toBe("Turn company knowledge into");
    expect(en.site.ctaWorkspace).toBe("Open the workspace");
    expect(en.site.ctaAdmin).toBe("Open the admin console");
    expect(scenarioRows).toContain("siteDemo.rowRelationBadge");
    expect(scenarioRows).toContain("siteDemo.rowRelationTitle");
    expect(en.siteDemo.rowRelationBadge).toBe("Relationship knowledge base · Accounts / Risk / Due diligence");
    expect(en.siteDemo.rowRelationTitle).toBe(
      "Connect entities, events, and evidence into a business graph you can question"
    );
  });

  test("frontstage account controls are grouped into an account menu", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("ux-account-menu");
    expect(platform).toContain("shell.permissionScope");
    expect(platform).toContain("common.signOut");
    expect(en.shell.permissionScope).toBe("Permission scope");
    expect(en.common.signOut).toBe("Sign out");
    expect(platform).toContain("handleLogout");
    expect(platform).not.toContain('className="ux-logout"');
  });

  test("frontstage home summary entries remain clickable and permission-aware", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain('<KpiCard href="/app/scenarios"');
    expect(platform).toContain('<KpiCard href="/app/knowledge"');
    expect(platform).toContain('<KpiCard href="/app/tasks"');
    expect(platform).toContain('<KpiCard href="/app/templates"');
    expect(platform).toContain("home-scenario-row");
    expect(platform).toContain("home-task-row");
    expect(platform).toContain("home-scope-badge scope-${scenario.visibility}");
    expect(platform).toContain("home-scope-badge scope-${task.visibility}");
    expect(platform).toContain("href={`/app/scenarios/${scenario.id}`}");
    expect(platform).toContain("href={`/app/scenarios/${task.scenarioId}/tasks`}");
  });

  test("frontstage sidebar uses product-specific navigation labels", () => {
    const fixtures = readFileSync("apps/web/lib/fixtures/frontstage.ts", "utf8");
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");
    const workspaceNavBlock = fixtures.slice(
      fixtures.indexOf("export const workspaceNav"),
      fixtures.indexOf("export const scenarioLifecycle")
    );

    expect(workspaceNav.map((item) => item.href)).toEqual([
      "/app",
      "/app/ask",
      "/app/templates",
      "/app/scenarios",
      "/app/tasks",
      "/app/knowledge",
      "/app/settings"
    ]);
    expect(new Set(workspaceNav.map((item) => item.label)).size).toBe(workspaceNav.length);
    workspaceNav.forEach((item) => {
      expect(workspaceNavBlock).toContain(item.label);
    });
    const navKeysSource = readFileSync("apps/web/lib/i18n/nav-keys.ts", "utf8");
    ["/app", "/app/ask", "/app/knowledge", "/app/settings"].forEach((href) => {
      const keys = workspaceNavKeys[href];
      expect(keys).toBeDefined();
      expect(navKeysSource).toContain(keys.label);
      const label = workspaceNav.find((item) => item.href === href)?.label ?? "";
      expect(translate(en, keys.label)).toBe(label);
    });
    expect(platform).toContain("workspaceNavKeys[item.href]");
  });

  test("global ask is a professional mixed-retrieval workspace", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("global-ask-workspace");
    expect(platform).toContain("global-chat-history");
    expect(platform).toContain("global-chat-thread");
    expect(platform).toContain("global-source-rail");
    expect(platform).toContain("/api/platform/chat-sessions");
    expect(platform).toContain("shell.askEmptyTitle");
    expect(en.shell.askEmptyTitle).toBe("Ask a business question and let CompanyBrain assemble the evidence.");
    expect(platform).toContain("recentGlobalEntries");
    expect(platform).toContain("shell.recentlyUsed");
    expect(platform).toContain("shell.currentScope");
    expect(en.shell.recentlyUsed).toBe("Recently used");
    expect(en.shell.currentScope).toBe("Current knowledge scope");
    expect(platform).toContain("Document evidence");
    expect(platform).toContain("Knowledge graph");
    expect(platform).toContain("Knowledge wiki");
    expect(platform).toContain("shell.answerScope");
    expect(platform).toContain("shell.followUps");
    expect(en.shell.answerScope).toBe("Answer scope");
    expect(en.shell.followUps).toBe("Follow-ups");
    expect(platform).toContain("global-answer-scope-list");
    expect(platform).toContain("shell.uploadFiles");
    expect(platform).toContain('accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"');
    expect(platform).toContain("shell.suggestedCapture");
    expect(en.shell.suggestedCapture).toBe("Suggested capture");
    expect(platform).toContain("routeReason");
    expect(platform).toContain("global-inline-references");
    expect(platform).toContain("global-followup-templates");
    expect(platform).toContain("global-source-section");
    expect(platform).toContain("recommendedTemplates");
    expect(platform).not.toContain('className="global-retrieval-strip"');
    expect(platform).not.toContain("Attachment analysis");
    expect(platform).not.toContain("Context management");
    expect(platform).not.toContain("Long-term memory");
  });

  test("home ask entry accepts attachments before routing to global ask", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("home-ask-attachments");
    expect(platform).toContain("shell.askFileHint");
    expect(en.shell.askFileHint).toBe("Supports PDF, Word, Markdown, spreadsheets, images, audio, and video");
    expect(platform).toContain("home-attachment-list");
    expect(platform).toContain("setHomeAttachments");
    expect(platform).toContain('router.push(`/app/ask?q=${encodeURIComponent(q)}`)');
    expect(platform).toContain('accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"');
  });

  test("home ask exposes context controls instead of ambiguous prompt shortcut buttons", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("home-context-tools");
    expect(platform).toContain("shell.uploadFiles");
    expect(platform).toContain("shell.knowledgeScope");
    expect(platform).toContain("shell.outputFormat");
    expect(platform).toContain("shell.scopeCompany");
    expect(platform).toContain("shell.outputDirect");
    expect(en.shell.uploadFiles).toBe("Upload files");
    expect(en.shell.knowledgeScope).toBe("Knowledge scope");
    expect(en.shell.outputFormat).toBe("Output format");
    expect(en.shell.scopeCompany).toBe("Company-wide");
    expect(en.shell.outputDirect).toBe("Direct answer");
    expect(platform).not.toContain('setQuestion("');
  });
});
