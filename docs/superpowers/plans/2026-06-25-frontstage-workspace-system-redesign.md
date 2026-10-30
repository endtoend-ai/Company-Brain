# Frontstage Workspace System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the frontstage from isolated pages into a coherent SaaS user system with a workspace shell and a scenario lifecycle workbench.

**Architecture:** Keep the current fixture-driven demo approach, but promote the frontstage model from page data into workspace objects: organization, user, scenarios, lifecycle stages, data sources, tasks, knowledge objects, outputs, and settings. Rebuild the UI around one persistent App Shell and make `ScenarioDetailPage` the central workbench with tabs for overview, data sources, tasks, ask/test, outputs, and settings.

**Tech Stack:** Next.js App Router, React client components, Bun tests, local TypeScript fixtures, existing CSS files.

---

### Task 1: Workspace Data Model

**Files:**
- Modify: `apps/web/lib/fixtures/frontstage.ts`
- Modify: `apps/web/lib/fixtures/frontstage.test.ts`

- [ ] **Step 1: Write failing fixture tests**

Add tests proving the frontstage has a workspace nav, lifecycle steps, scenario workbench tabs, data sources, outputs, and settings.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `bun test apps/web/lib/fixtures/frontstage.test.ts`

- [ ] **Step 3: Implement workspace model**

Add exported objects and helpers: `workspaceProfile`, `workspaceNav`, `scenarioWorkbenchTabs`, `scenarioLifecycle`, `scenarioDataSources`, `scenarioOutputs`, `scenarioSettings`, `workspaceDashboard`, `scenarioWorkbenchById`.

- [ ] **Step 4: Run focused tests and confirm pass**

Run: `bun test apps/web/lib/fixtures/frontstage.test.ts`

### Task 2: Unified App Shell

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Modify: `apps/web/app/app.css`

- [ ] **Step 1: Write route/content assertions through fixture tests**

Ensure nav order and labels are locked by fixtures before changing UI.

- [ ] **Step 2: Replace topbar-only shell with workspace shell**

The shell must include persistent sidebar navigation, workspace switcher, search, notification/status entry, user area, breadcrumbs/title area, and a primary content region.

- [ ] **Step 3: Ensure every frontstage page uses this shell**

Pages should feel like one product, not independent landing pages.

### Task 3: Workspace Home And Asset Centers

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Add: `apps/web/app/app/scenarios/page.tsx`
- Add: `apps/web/app/app/ask/page.tsx`
- Add: `apps/web/app/app/settings/page.tsx`
- Modify: legacy route files under `apps/web/app/app/*/page.tsx` as needed

- [ ] **Step 1: Make `/app` a workspace dashboard**

Show recent scenarios, pending tasks, knowledge health, quick ask, and recommended next actions.

- [ ] **Step 2: Make `/app/scenarios` the canonical scenario asset center**

Keep `/app/my-scenarios` as compatibility route, but navigation should point to `/app/scenarios`.

- [ ] **Step 3: Make `/app/ask` the canonical company brain route**

Keep `/app/chat` as compatibility route, but navigation should point to `/app/ask`.

- [ ] **Step 4: Add `/app/settings`**

Expose organization, members, permissions, connectors, and publication policy at a product level.

### Task 4: Scenario Workbench

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Add: nested scenario routes under `apps/web/app/app/scenarios/[id]/`

- [ ] **Step 1: Convert scenario detail into a tabbed workbench**

Tabs: overview, data sources, processing tasks, ask/test, outputs, settings.

- [ ] **Step 2: Add each tab route**

Routes should be directly addressable: `/data`, `/tasks`, `/ask`, `/outputs`, `/settings`.

- [ ] **Step 3: Keep `/run` compatibility**

Map `/run` to the ask/test tab so old links still work.

### Task 5: Verification

**Files:**
- No production files unless a verification issue is found.

- [ ] **Step 1: Run tests**

Run: `bun test`

- [ ] **Step 2: Run production build**

Run: `bun --cwd apps/web build`

- [ ] **Step 3: Run page checks against production server**

Verify: `/app`, `/app/ask`, `/app/scenarios`, `/app/scenarios/scenario-customer-360`, `/app/scenarios/scenario-customer-360/data`, `/app/settings`, `/admin`.

- [ ] **Step 4: Run diff hygiene**

Run: `git diff --check`
