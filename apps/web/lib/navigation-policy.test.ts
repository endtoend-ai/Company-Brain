import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { workspaceNav } from "./fixtures/frontstage";

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

    expect(header.indexOf("Open workspace")).toBeLessThan(header.indexOf("Admin console"));
    expect(header.lastIndexOf("ThemeToggle")).toBeGreaterThan(header.indexOf("Admin console"));
    expect(page).not.toContain("Demo data");
    expect(heroAnswer).not.toContain("Live demo");
    expect(page).toContain("Turn company knowledge into");
    expect(page).toContain("Open the workspace");
    expect(page).toContain("Open the admin console");
    expect(scenarioRows).toContain("Relationship knowledge base · Accounts / Risk / Due diligence");
    expect(scenarioRows).toContain("business graph you can question");
  });

  test("frontstage account controls are grouped into an account menu", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("ux-account-menu");
    expect(platform).toContain("Permission scope");
    expect(platform).toContain("Sign out");
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
    ["/app", "/app/ask", "/app/knowledge", "/app/settings"].forEach((href) => {
      const label = workspaceNav.find((item) => item.href === href)?.label ?? "";
      expect(platform).toContain(`title="${label}"`);
    });
  });

  test("global ask is a professional mixed-retrieval workspace", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("global-ask-workspace");
    expect(platform).toContain("global-chat-history");
    expect(platform).toContain("global-chat-thread");
    expect(platform).toContain("global-source-rail");
    expect(platform).toContain("/api/platform/chat-sessions");
    expect(platform).toContain("Ask a business question and let CompanyBrain assemble the evidence.");
    expect(platform).toContain("recentGlobalEntries");
    expect(platform).toContain("Recently used");
    expect(platform).toContain("Current knowledge scope");
    expect(platform).toContain("Document evidence");
    expect(platform).toContain("Knowledge graph");
    expect(platform).toContain("Knowledge wiki");
    expect(platform).toContain("Answer scope");
    expect(platform).toContain("Follow-ups");
    expect(platform).toContain("global-answer-scope-list");
    expect(platform).toContain("Upload files");
    expect(platform).toContain('accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"');
    expect(platform).toContain("Suggested capture");
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
    expect(platform).toContain("Supports PDF, Word, Markdown, spreadsheets, images, audio, and video");
    expect(platform).toContain("home-attachment-list");
    expect(platform).toContain("setHomeAttachments");
    expect(platform).toContain('router.push(`/app/ask?q=${encodeURIComponent(q)}`)');
    expect(platform).toContain('accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"');
  });

  test("home ask exposes context controls instead of ambiguous prompt shortcut buttons", () => {
    const platform = readFileSync("apps/web/components/app/platform.tsx", "utf8");

    expect(platform).toContain("home-context-tools");
    expect(platform).toContain("Upload files");
    expect(platform).toContain("Knowledge scope");
    expect(platform).toContain("Output format");
    expect(platform).toContain("Company-wide");
    expect(platform).toContain("Direct answer");
    expect(platform).not.toContain('setQuestion("');
  });
});
