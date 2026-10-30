# Frontstage Chat-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontstage so `/app` starts with “问公司大脑”, then turns answers into task actions and task canvases.

**Architecture:** Keep the existing Next.js app and the existing three-column Chat component. Add task/action fixture models first, then swap `/app` from the scenario dashboard to an ask-first home, upgrade Chat with action cards and a right-side task canvas, and relabel scenario/deliverable surfaces as secondary template/task areas.

**Tech Stack:** Next.js App Router, React client components, TypeScript fixtures, Bun test/build.

---

### Task 1: Task And Action Fixtures

**Files:**
- Modify: `apps/web/lib/fixtures/chat.ts`
- Create: `apps/web/lib/fixtures/chat.test.ts`

- [ ] **Step 1: Write failing fixture tests**

```ts
import { describe, expect, test } from "bun:test";
import { answerFor, taskForAction } from "./chat";

describe("chat-first task actions", () => {
  test("relation answers expose a business task action", () => {
    const answer = answerFor("Northwind Labs 值不值得续约？");

    expect(answer.actions?.map((item) => item.label)).toContain("生成续约风险简报");
    expect(answer.actions?.[0].taskId).toBe("renewal-brief");
  });

  test("task canvas has ordered steps and a reusable artifact", () => {
    const task = taskForAction("renewal-brief");

    expect(task?.title).toBe("续约风险简报");
    expect(task?.steps.map((step) => step.title)).toEqual(["确认对象", "收集证据", "生成草稿", "保存成品"]);
    expect(task?.artifact.title).toContain("Northwind Labs");
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `bun test apps/web/lib/fixtures/chat.test.ts`

Expected: fail because `taskForAction` and `answer.actions` do not exist.

- [ ] **Step 3: Add minimal fixture model**

Add `ChatAction`, `TaskCanvas`, `TaskStep`, `TaskArtifact`, `taskCanvases`, and `taskForAction(id)` to `chat.ts`. Convert existing `answer.action` strings into `answer.actions` arrays while keeping `action` as a compatibility field.

- [ ] **Step 4: Run tests and confirm they pass**

Run: `bun test apps/web/lib/fixtures/chat.test.ts`

Expected: 2 pass.

### Task 2: Ask-First Home

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Modify: `apps/web/app/app/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Replace `/app` shell content with `AskHome`**

Add an exported `AskHome` client component that renders a focused hero input, starter prompts, and secondary links to `/app/chat`, `/app/tasks`, `/app/library`, and `/app/knowledge`.

- [ ] **Step 2: Route `/app` to `AskHome`**

Change `apps/web/app/app/page.tsx` to import and render `AskHome`.

- [ ] **Step 3: Style the ask-first home**

Add `.ask-*` CSS classes for the centered question input, starter cards, and secondary rails. Ensure mobile stacks vertically.

- [ ] **Step 4: Verify route HTML contains the new primary prompt**

Run: `curl -s http://localhost:3001/app | rg "今天想问公司什么|问公司大脑"`

Expected: both phrases appear.

### Task 3: Chat Action Cards And Task Canvas

**Files:**
- Modify: `apps/web/components/app/workspace.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Render answer action cards**

In `Bubble`, render `m.answer.actions` under the answer after streaming completes. Clicking an action calls `onStartTask(taskId)`.

- [ ] **Step 2: Add task canvas state**

In `Workspace`, store `activeTaskId`; derive `taskForAction(activeTaskId)`; show the task canvas in the right rail above or instead of evidence after a task starts.

- [ ] **Step 3: Implement `TaskCanvasView`**

Render task title, status, ordered steps, evidence sources, artifact preview, and buttons for “继续追问”, “保存成品”, and “沉淀为团队场景”.

- [ ] **Step 4: Verify Chat route HTML and build**

Run: `bun --cwd apps/web build`

Expected: build exits 0 and includes `/app/chat`.

### Task 4: Secondary Routes And Labels

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Create: `apps/web/app/app/tasks/page.tsx`
- Create: `apps/web/app/app/knowledge/page.tsx`
- Modify: `apps/web/app/app/outputs/page.tsx`

- [ ] **Step 1: Rename “成品库” surface to task center**

Export `TaskCenterPage` from `platform.tsx`, keeping `OutputsPage` as a compatibility alias.

- [ ] **Step 2: Add `/app/tasks` and `/app/knowledge`**

`/app/tasks` renders task center. `/app/knowledge` renders a lightweight knowledge space page from existing fixture knowledge bases.

- [ ] **Step 3: Update shell navigation**

Change the platform shell labels to `问公司大脑`, `知识空间`, `任务中心`, `场景库`, `我的`. Keep `/app/create` reachable from templates/detail pages, not primary nav.

- [ ] **Step 4: Verify routes**

Run:
`for p in /app /app/chat /app/tasks /app/knowledge /app/library /app/create; do curl -I "http://localhost:3001$p"; done`

Expected: each route returns `HTTP/1.1 200 OK`.

### Task 5: Final Verification

**Files:**
- No source edits unless verification finds defects.

- [ ] **Step 1: Run tests**

Run: `bun test apps/web/lib/fixtures/chat.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `bun --cwd apps/web build`

Expected: exit 0.

- [ ] **Step 3: Capture desktop and mobile screenshots**

Run Chromium screenshots for `/app`, `/app/chat`, and `/app/tasks`.

Expected: no obvious overlapping text or broken layout on 1440px and 390px widths.
