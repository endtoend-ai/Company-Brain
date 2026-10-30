# SaaS Frontstage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the FF-CompanyBrain frontstage into a polished SaaS-grade product where users start with “问公司大脑”, create usable business scenarios from official templates, track processing tasks, browse knowledge outputs, and use a low-noise Chat experience.

**Architecture:** Keep the existing Next.js App Router app and fixture/API-backed demo mode, but replace the current mixed “场景库/工作台” mental model with explicit frontstage domain objects: `ScenarioTemplate`, `ScenarioInstance`, `ProcessingTask`, and `KnowledgeSpaceObject`. The frontend fixture mode must mirror the backend delivery data catalog so templates, scenario instances, tasks, knowledge objects, and chat examples share stable IDs and realistic product-facing names. Split the current large `platform.tsx` and `workspace.tsx` into focused components, then apply one coherent visual system across home, templates, my scenarios, tasks, knowledge space, and chat.

**Tech Stack:** Next.js App Router, React client components, TypeScript fixture modules, CSS in `apps/web/app/app/app.css`, Bun tests, Next build, Playwright layout audit.

---

## Related Admin And Product Depth Plan

This frontstage plan must be implemented together with `docs/superpowers/plans/2026-06-25-admin-operations-console-product-depth-implementation.md`.

The frontstage should expose business-facing advanced controls such as source selection, evidence requirement, output audience, visibility, refresh cadence, and review requirement. Technical strategy controls, pipeline diagnostics, graph exploration, and quality testing belong in the admin operations console. Do not solve product depth by putting raw backend controls into frontstage pages.

## Product And Visual Constraints

- Homepage `/app` must only show the company brain input and very light natural-language examples. It must not show scenario cards, task panels, metrics, pending counts, or technical status.
- Top navigation labels and order are fixed: `问公司大脑 / 场景模板 / 我的场景 / 任务中心 / 知识空间`.
- New primary template route is `/app/templates`. Existing `/app/library` remains a compatibility alias that renders the same template library.
- Frontstage copy must not expose `RAG`, `GraphRAG`, `NaiveRAG`, `LightRAG`, `embedding`, `chunk`, `vector`, `entity extraction`, `prompt`, `topK`, or `rerank`.
- Chat must feel like a serious AI product, not a three-column control console: main conversation first, subtle top bar, bottom composer, right drawer only when evidence or task details are requested.
- Template detail pages must include a pre-create demo walkthrough. A user should see realistic sample inputs, the processing path, a sample question, a sample answer, source citations, and resulting deliverables before choosing `用这个模板创建`.
- Cards are only for repeated items, task rows, drawers, and framed tools. Do not nest cards inside cards.
- Visual palette should remain quiet and enterprise-grade, but avoid a one-note beige/amber-only UI. Keep amber as accent and use restrained blue/green status accents only where they carry meaning.
- All desktop and mobile views must be checked for text overlap, horizontal overflow, and button label clipping.
- Frontstage demo data must feel like normal enterprise sample data. User-facing screens must not display `mock`, `fixture`, `synthetic`, `fake`, `伪造`, or `虚构`.
- Fixture/API data should cover all ten official templates, at least 30 scenario instances, at least 30 processing tasks, at least 30 knowledge objects, and enough source assets to stress list, table, card, drawer, and chat layouts.

## Delivery Data Contract

- Backend canonical data lives in `packages/platform/src/demo-data.ts` and generated files under `_demo-data/companybrain/`.
- Frontend fixture mode must use the same business names and IDs where possible. It can keep a TypeScript fixture copy for static rendering, but it must not invent a separate product universe.
- Every official template must have one canonical demo walkthrough tied to the same delivery data catalog. The walkthrough is not labeled as demo data in the UI; it is shown as a sample business case.
- API mode should read `/platform/templates`, `/platform/scenarios`, `/platform/tasks`, and `/platform/knowledge` once those endpoints exist. Fixture mode remains the fallback for frontend-only development.
- The high-volume dataset is part of QA: long customer names, PDF/CSV-like file names, multi-status task rows, relationship objects, and knowledge cards must not break responsive layout.

## Official Template Evidence Gate

Official templates are best-practice product recipes. They must be evidence-backed before being presented as official.

- Required research source: `_research/official-template-best-practice-research.md`.
- A template can be `official`, `candidate`, `experimental`, `custom`, `paused`, or `archived`.
- Only `official` templates appear in the default template gallery. `candidate` and `experimental` templates can appear in admin preview or future advanced filters, but not as official best practices.
- An `official` template needs at least two evidence sources, a product form, input expectations, lifecycle explanation, output capabilities, limitations, and a default backend plan.
- Frontstage copy should explain what the template is for and what data it needs. It should not claim industry best-practice status without evidence metadata.

## File Structure

Create:

- `apps/web/lib/fixtures/frontstage.ts`  
  Canonical product-facing fixture model for templates, instances, processing tasks, knowledge objects, navigation, language checks, and creation helpers.
- `apps/web/lib/fixtures/frontstage.test.ts`  
  Contract tests for navigation order, 10 official templates, lifecycle states, scenario creation draft, and banned technical terms.
- `apps/web/components/app/frontstage-shell.tsx`  
  Shared top navigation shell for non-chat pages. It owns the five-item nav and responsive mobile nav.
- `apps/web/components/app/home.tsx`  
  Premium ask-first homepage with one central input and no secondary cards.
- `apps/web/components/app/templates.tsx`  
  Template library, template detail, and template creation entry UI.
- `apps/web/components/app/scenario-pages.tsx`  
  My scenarios list/detail views, using `ScenarioInstance` rather than old official scenario cards.
- `apps/web/components/app/task-pages.tsx`  
  Task center list/detail surfaces for processing tasks and business generation tasks.
- `apps/web/components/app/knowledge-pages.tsx`  
  Knowledge space browsing modes: Wiki, document evidence, relationship objects, and artifacts.
- `apps/web/components/app/company-chat.tsx`  
  Rebuilt low-noise company brain chat experience.
- `apps/web/app/app/templates/page.tsx`  
  Route for `场景模板`.
- `apps/web/app/app/templates/[id]/page.tsx`  
  Route for template details.
- `apps/web/app/app/scenarios/[id]/manage/page.tsx`  
  Route for scenario instance management.

Modify:

- `apps/web/app/app/page.tsx`  
  Render `CompanyBrainHome`.
- `apps/web/app/app/chat/page.tsx`  
  Render `CompanyChat`.
- `apps/web/app/app/library/page.tsx`  
  Render `TemplateLibraryPage` as a compatibility alias.
- `apps/web/app/app/create/page.tsx`  
  Render `CreateScenarioPage` backed by `frontstage.ts`.
- `apps/web/app/app/my-scenarios/page.tsx`  
  Render `MyScenariosPage` from `scenario-pages.tsx`.
- `apps/web/app/app/tasks/page.tsx`  
  Render `TaskCenterPage` from `task-pages.tsx`.
- `apps/web/app/app/knowledge/page.tsx`  
  Render `KnowledgeSpacePage` from `knowledge-pages.tsx`.
- `apps/web/app/app/scenarios/[id]/page.tsx`  
  Render scenario instance detail, not official template detail.
- `apps/web/app/app/app.css`  
  Replace old `ask`, `sp`, and `cw` styles with a unified SaaS frontstage visual system.
- `scripts/audit-web-layout.ts`  
  Add new selectors for frontstage pages so the existing layout audit checks the rebuilt UI.

Delete only after replacements compile:

- Old exports in `apps/web/components/app/platform.tsx` that are superseded by the new focused page modules.
- Old exports in `apps/web/components/app/workspace.tsx` after `company-chat.tsx` fully replaces it.

Do not revert unrelated deleted legacy routes already present in the dirty working tree.

---

### Task 0: Execution Guard

**Files:**
- No source edits.

- [ ] **Step 1: Confirm current branch and dirty worktree**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

- The branch is visible.
- Existing dirty changes are visible.
- Do not run `git reset`, `git checkout --`, or any destructive cleanup command.

- [ ] **Step 2: Confirm the product spec is present**

Run:

```bash
test -f docs/superpowers/specs/2026-06-24-frontstage-saas-product-design.md
sed -n '1,80p' docs/superpowers/specs/2026-06-24-frontstage-saas-product-design.md
```

Expected:

- The file exists.
- The output includes `首页只承担一个动作：问公司大脑` and the five navigation labels.

---

### Task 1: Frontstage Domain Fixtures

**Files:**
- Create: `apps/web/lib/fixtures/frontstage.ts`
- Create: `apps/web/lib/fixtures/frontstage.test.ts`
- Modify: `apps/web/lib/fixtures/chat.ts`
- Modify: `apps/web/lib/fixtures/chat.test.ts`

- [ ] **Step 1: Write failing frontstage fixture tests**

Create `apps/web/lib/fixtures/frontstage.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  createScenarioDraft,
  forbiddenFrontendTerms,
  frontstageNav,
  knowledgeSpaceObjects,
  officialTemplates,
  productDataForbiddenWords,
  processingTasks,
  scenarioInstances,
  sourceAssets,
  templateById,
  visibleFrontendText
} from "./frontstage";

describe("frontstage product contract", () => {
  test("navigation order matches the approved product model", () => {
    expect(frontstageNav.map((item) => item.label)).toEqual([
      "问公司大脑",
      "场景模板",
      "我的场景",
      "任务中心",
      "知识空间"
    ]);
    expect(frontstageNav.map((item) => item.href)).toEqual([
      "/app",
      "/app/templates",
      "/app/my-scenarios",
      "/app/tasks",
      "/app/knowledge"
    ]);
  });

  test("ships ten official business templates", () => {
    expect(officialTemplates.map((item) => item.name)).toEqual([
      "个人知识 Wiki",
      "团队知识手册",
      "制度政策证据问答",
      "合同 Playbook 审阅",
      "RFP / 安全问卷响应",
      "客户 360 简报",
      "关系风险尽调",
      "垂域关系知识库",
      "智能客服知识代理",
      "研究报告 / 学习指南"
    ]);
  });

  test("official templates pass the evidence gate", () => {
    expect(officialTemplates.every((item) => item.templateState === "official")).toBe(true);
    expect(officialTemplates.every((item) => item.evidenceLevel === "validated")).toBe(true);
    expect(officialTemplates.every((item) => item.evidenceSources.length >= 2)).toBe(true);
    expect(officialTemplates.every((item) => item.productForm.length > 0)).toBe(true);
    expect(officialTemplates.every((item) => item.limitations.length > 0)).toBe(true);
  });

  test("template details explain input, output, lifecycle, and sample artifact", () => {
    const wiki = templateById("personal-wiki");

    expect(wiki?.inputExamples).toContain("Markdown 笔记");
    expect(wiki?.outputCapabilities).toContain("可浏览 Wiki 条目");
    expect(wiki?.creationSteps.map((step) => step.label)).toEqual([
      "选择模板",
      "上传资料",
      "提交处理",
      "等待就绪",
      "开始使用"
    ]);
    expect(wiki?.sampleArtifact.title).toContain("知识 Wiki");
  });

  test("official templates include a pre-create demo walkthrough", () => {
    for (const template of officialTemplates) {
      expect(template.demoWalkthrough.sampleInputs.length).toBeGreaterThanOrEqual(2);
      expect(template.demoWalkthrough.processingPreview.length).toBeGreaterThanOrEqual(3);
      expect(template.demoWalkthrough.sampleQuestion.length).toBeGreaterThan(8);
      expect(template.demoWalkthrough.sampleAnswer.length).toBeGreaterThan(30);
      expect(template.demoWalkthrough.citations.length).toBeGreaterThanOrEqual(2);
      expect(template.demoWalkthrough.resultHighlights.length).toBeGreaterThanOrEqual(2);
    }

    const customer360 = templateById("customer-360");
    expect(customer360?.demoWalkthrough.scenarioName).toContain("续约");
    expect(customer360?.demoWalkthrough.sampleQuestion).toContain("客户");
  });

  test("scenario creation draft connects template to processing task", () => {
    const draft = createScenarioDraft({
      templateId: "personal-wiki",
      name: "张磊的销售笔记 Wiki",
      visibility: "private",
      fileNames: ["客户复盘.md", "销售打法.md"]
    });

    expect(draft.instance.templateId).toBe("personal-wiki");
    expect(draft.instance.status).toBe("submitted");
    expect(draft.task.scenarioId).toBe(draft.instance.id);
    expect(draft.task.status).toBe("submitted");
    expect(draft.task.userMessage).toBe("资料已提交，等待系统整理。");
  });

  test("processing and knowledge fixtures cover the user journey", () => {
    expect(processingTasks.map((item) => item.status)).toContain("processing");
    expect(processingTasks.map((item) => item.status)).toContain("needs_input");
    expect(processingTasks.map((item) => item.status)).toContain("ready");
    expect(scenarioInstances.some((item) => item.status === "ready")).toBe(true);
    expect(new Set(knowledgeSpaceObjects.map((item) => item.mode))).toEqual(new Set([
      "wiki",
      "document",
      "relationship",
      "artifact"
    ]));
  });

  test("delivery dataset is large enough for frontend and backend QA", () => {
    expect(scenarioInstances.length).toBeGreaterThanOrEqual(30);
    expect(processingTasks.length).toBeGreaterThanOrEqual(30);
    expect(knowledgeSpaceObjects.length).toBeGreaterThanOrEqual(30);
    expect(sourceAssets.length).toBeGreaterThanOrEqual(120);
    expect(new Set(sourceAssets.map((item) => item.fileType))).toEqual(new Set(["md", "pdf", "csv", "txt", "json"]));
  });

  test("frontstage visible text does not leak technical backend terms", () => {
    const text = visibleFrontendText().toLowerCase();
    for (const term of forbiddenFrontendTerms) {
      expect(text.includes(term.toLowerCase())).toBe(false);
    }
    for (const term of productDataForbiddenWords) {
      expect(text.includes(term.toLowerCase())).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts
```

Expected:

- The command fails because `./frontstage` does not exist.

- [ ] **Step 3: Create frontstage fixture types and constants**

Create `apps/web/lib/fixtures/frontstage.ts` with these exported types and constants:

```ts
export type FrontstageNavItem = {
  label: "问公司大脑" | "场景模板" | "我的场景" | "任务中心" | "知识空间";
  href: "/app" | "/app/templates" | "/app/my-scenarios" | "/app/tasks" | "/app/knowledge";
};

export type TemplateCategory =
  | "personal"
  | "team"
  | "policy"
  | "legal"
  | "sales"
  | "risk"
  | "support"
  | "research";

export type Visibility = "private" | "team" | "company";
export type TemplateState = "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
export type TemplateEvidenceLevel = "validated" | "partial" | "internal_only";
export type TemplateProductForm =
  | "chat"
  | "embedded_assistant"
  | "knowledge_portal"
  | "document_review"
  | "report_generator"
  | "graph_explorer"
  | "task_workflow"
  | "hybrid";

export type ProcessingStatus =
  | "draft"
  | "submitted"
  | "waiting_review"
  | "processing"
  | "needs_input"
  | "ready"
  | "failed"
  | "archived";

export type ScenarioStatus = ProcessingStatus;

export type TemplateStep = {
  label: string;
  description: string;
};

export type TemplateDemoWalkthrough = {
  scenarioName: string;
  sampleInputs: Array<{
    title: string;
    fileName: string;
    fileType: "md" | "pdf" | "csv" | "txt" | "json";
    description: string;
  }>;
  processingPreview: string[];
  sampleQuestion: string;
  sampleAnswer: string;
  citations: Array<{
    label: string;
    source: string;
    excerpt: string;
  }>;
  resultHighlights: string[];
};

export type ScenarioTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  templateState: TemplateState;
  evidenceLevel: TemplateEvidenceLevel;
  evidenceSources: string[];
  productForm: TemplateProductForm[];
  limitations: string[];
  headline: string;
  bestFor: string[];
  inputExamples: string[];
  acceptedFiles: string[];
  setupTime: string;
  reviewRequirement: "无需管理员确认" | "需要管理员确认" | "建议管理员确认";
  processingExplanation: string[];
  outputCapabilities: string[];
  businessOptions: { label: string; values: string[] }[];
  creationSteps: TemplateStep[];
  sampleArtifact: {
    title: string;
    summary: string;
    sections: string[];
  };
  demoWalkthrough: TemplateDemoWalkthrough;
  suggestedQuestions: string[];
};

export type ScenarioInstance = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  owner: string;
  visibility: Visibility;
  status: ScenarioStatus;
  updatedAt: string;
  sourceCount: number;
  readyActions: string[];
  recommendedQuestions: string[];
};

export type SourceAsset = {
  id: string;
  scenarioId: string;
  title: string;
  fileName: string;
  fileType: "md" | "pdf" | "csv" | "txt" | "json";
  sizeLabel: string;
  owner: string;
  updatedAt: string;
};

export type ProcessingTask = {
  id: string;
  scenarioId: string;
  templateName: string;
  title: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  userMessage: string;
  nextActions: string[];
  createdAt: string;
};

export type KnowledgeSpaceObject = {
  id: string;
  mode: "wiki" | "document" | "relationship" | "artifact";
  title: string;
  summary: string;
  sourceLabel: string;
  updatedAt: string;
  linkedScenarioId: string;
  actions: string[];
};

export const frontstageNav: FrontstageNavItem[] = [
  { label: "问公司大脑", href: "/app" },
  { label: "场景模板", href: "/app/templates" },
  { label: "我的场景", href: "/app/my-scenarios" },
  { label: "任务中心", href: "/app/tasks" },
  { label: "知识空间", href: "/app/knowledge" }
];

export const forbiddenFrontendTerms = [
  "RAG",
  "GraphRAG",
  "NaiveRAG",
  "LightRAG",
  "embedding",
  "chunk",
  "vector",
  "entity extraction",
  "prompt",
  "topK",
  "rerank"
];

export const productDataForbiddenWords = ["mock", "fake", "fixture", "synthetic", "伪造", "虚构"];

const standardCreationSteps: TemplateStep[] = [
  { label: "选择模板", description: "先确认这个模板是否适合当前业务目标。" },
  { label: "上传资料", description: "上传文件或选择已有知识来源。" },
  { label: "提交处理", description: "系统开始整理资料并建立可引用来源。" },
  { label: "等待就绪", description: "在任务中心查看处理进度和补充要求。" },
  { label: "开始使用", description: "场景就绪后进入问答、浏览或生成成品。" }
];

function templateEvidence(productForm: TemplateProductForm[], limitations: string[]): Pick<
  ScenarioTemplate,
  "templateState" | "evidenceLevel" | "evidenceSources" | "productForm" | "limitations"
> {
  return {
    templateState: "official",
    evidenceLevel: "validated",
    evidenceSources: [
      "_research/official-template-best-practice-research.md",
      "https://docs.dify.ai/en/use-dify/knowledge/knowledge-pipeline/create-knowledge-pipeline",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html"
    ],
    productForm,
    limitations
  };
}

function templateDemo(input: Omit<TemplateDemoWalkthrough, "processingPreview">): TemplateDemoWalkthrough {
  return {
    ...input,
    processingPreview: [
      "读取样例资料并识别可用来源",
      "整理成当前模板需要的知识结构",
      "生成可追问答案、引用依据和成品预览"
    ]
  };
}
```

In the same file, add `officialTemplates` with exactly these ten objects. Every object must spread `templateEvidence(...)` immediately after `category`, and every object must include `demoWalkthrough: templateDemo(...)` immediately after `sampleArtifact`:

```ts
export const officialTemplates: ScenarioTemplate[] = [
  {
    id: "personal-wiki",
    name: "个人知识 Wiki",
    category: "personal",
    ...templateEvidence(["knowledge_portal", "chat"], ["不适合直接生成未经复核的对外正式文件。"]),
    headline: "把个人笔记、Markdown 和资料包整理成可浏览、可追问的个人知识空间。",
    bestFor: ["个人笔记沉淀", "学习资料整理", "项目记录复用"],
    inputExamples: ["Markdown 笔记", "TXT 摘录", "PDF 资料", "网页摘录"],
    acceptedFiles: ["md", "txt", "pdf", "html"],
    setupTime: "约 5-15 分钟",
    reviewRequirement: "无需管理员确认",
    processingExplanation: ["整理资料结构", "建立来源引用", "生成互链目录"],
    outputCapabilities: ["可浏览 Wiki 条目", "基于来源问答", "生成主题综述"],
    businessOptions: [
      { label: "整理粒度", values: ["简洁", "标准", "详细"] },
      { label: "可见范围", values: ["仅自己", "团队可见"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "张磊的销售笔记知识 Wiki",
      summary: "按客户复盘、销售打法、常见异议和案例素材整理成可追问知识条目。",
      sections: ["客户复盘", "销售打法", "案例素材", "可复用话术"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "张磊销售笔记知识 Wiki",
      sampleInputs: [
        { title: "客户复盘笔记", fileName: "华东客户复盘.md", fileType: "md", description: "记录客户异议、推进动作和会议结论。" },
        { title: "销售打法清单", fileName: "续约销售打法.pdf", fileType: "pdf", description: "包含续约阶段的话术、风险识别和跟进节奏。" }
      ],
      sampleQuestion: "这批笔记里最常见的客户异议是什么？",
      sampleAnswer: "最常见的异议集中在预算周期、系统集成成本和上线周期。建议先用已完成案例说明实施节奏，再把预算问题拆成续约保留、二期扩容和服务包三类处理。",
      citations: [
        { label: "客户复盘笔记", source: "华东客户复盘.md", excerpt: "客户担心二期上线周期超过预算审批窗口。" },
        { label: "销售打法清单", source: "续约销售打法.pdf", excerpt: "预算异议优先拆分为保留价值和新增价值。" }
      ],
      resultHighlights: ["自动生成客户异议目录", "答案保留引用来源", "可继续追问销售打法"]
    }),
    suggestedQuestions: ["这批笔记里最常见的客户异议是什么？", "帮我整理一份本周客户复盘。"]
  },
  {
    id: "team-handbook",
    name: "团队知识手册",
    category: "team",
    ...templateEvidence(["knowledge_portal", "task_workflow"], ["需要管理员复核后再作为团队统一口径发布。"]),
    headline: "把团队资料、会议纪要和项目复盘整理成可分享的团队手册。",
    bestFor: ["新人上手", "项目复盘", "销售 SOP", "团队经验库"],
    inputExamples: ["新人手册", "会议纪要", "项目复盘", "FAQ 文档"],
    acceptedFiles: ["md", "docx", "pdf", "txt"],
    setupTime: "约 10-20 分钟",
    reviewRequirement: "建议管理员确认",
    processingExplanation: ["整理章节目录", "合并重复内容", "标注来源资料"],
    outputCapabilities: ["章节化知识手册", "按章节提问", "团队分享"],
    businessOptions: [
      { label: "面向受众", values: ["新人", "项目组", "管理层"] },
      { label: "维护方式", values: ["个人维护", "团队共同维护"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "销售新人上手手册",
      summary: "把销售材料、客户简报模板和复盘经验整理成第一周学习路径。",
      sections: ["认识产品", "准备客户会议", "完成复盘", "常见问题"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "销售新人上手手册",
      sampleInputs: [
        { title: "销售 SOP", fileName: "销售新人第一周.md", fileType: "md", description: "新人上手路径、每日任务和检查标准。" },
        { title: "客户会议模板", fileName: "客户会议准备清单.pdf", fileType: "pdf", description: "会前信息收集、会议目标和复盘字段。" }
      ],
      sampleQuestion: "新人第一周应该先看哪些材料？",
      sampleAnswer: "第一天先阅读产品定位和典型客户画像，第二天完成客户会议准备清单，第三到五天跟读三个复盘案例并提交一次模拟会议计划。",
      citations: [
        { label: "销售 SOP", source: "销售新人第一周.md", excerpt: "前三天目标是理解客户画像和会议准备流程。" },
        { label: "客户会议模板", source: "客户会议准备清单.pdf", excerpt: "会前必须明确客户目标、历史触点和风险假设。" }
      ],
      resultHighlights: ["形成章节化学习路径", "沉淀团队统一口径", "支持按章节追问"]
    }),
    suggestedQuestions: ["新人第一周应该先看哪些材料？", "把这个手册改成项目组版本。"]
  },
  {
    id: "policy-evidence",
    name: "制度政策证据问答",
    category: "policy",
    ...templateEvidence(["chat", "knowledge_portal"], ["制度类答案必须保留引用，不应替代 HR 或法务最终解释。"]),
    headline: "让员工获得带原文依据的制度、流程和报销答复。",
    bestFor: ["HR 制度查询", "财务报销答疑", "行政流程问答", "IT 规则查询"],
    inputExamples: ["制度 PDF", "流程文档", "表格", "公告"],
    acceptedFiles: ["pdf", "docx", "xlsx", "txt"],
    setupTime: "约 5-10 分钟",
    reviewRequirement: "建议管理员确认",
    processingExplanation: ["整理制度条款", "建立原文引用", "识别适用范围"],
    outputCapabilities: ["直接制度答复", "原文依据", "可转发标准口径"],
    businessOptions: [
      { label: "答复口径", values: ["员工可读", "HR 标准", "财务标准"] },
      { label: "取证范围", values: ["聚焦", "平衡", "全面"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "差旅报销标准答复",
      summary: "直接说明报销标准、审批例外和制度依据。",
      sections: ["答复结论", "适用标准", "审批例外", "制度依据"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "差旅报销制度问答",
      sampleInputs: [
        { title: "差旅制度", fileName: "2026差旅报销制度.pdf", fileType: "pdf", description: "住宿、交通、餐补和审批规则。" },
        { title: "审批流程", fileName: "费用审批流程.csv", fileType: "csv", description: "不同金额、城市和部门的审批路径。" }
      ],
      sampleQuestion: "一线城市住宿报销标准是多少，需要什么审批？",
      sampleAnswer: "一线城市普通员工住宿标准为每晚 650 元以内；超过标准需要直属负责人和财务复核。若因客户会议或展会导致价格异常，需要在申请中补充说明。",
      citations: [
        { label: "住宿标准", source: "2026差旅报销制度.pdf", excerpt: "一线城市住宿标准为 650 元/晚。" },
        { label: "超标审批", source: "费用审批流程.csv", excerpt: "超标准报销需负责人确认并提交财务复核。" }
      ],
      resultHighlights: ["回答给出制度依据", "自动提示审批例外", "适合员工自助查询"]
    }),
    suggestedQuestions: ["一线城市住宿报销标准是多少？", "超出标准怎么审批？"]
  },
  {
    id: "contract-playbook",
    name: "合同 Playbook 审阅",
    category: "legal",
    ...templateEvidence(["document_review", "task_workflow"], ["只能作为合同初筛和条款建议，不能替代法律审阅。"]),
    headline: "上传合同并按公司审阅规则生成风险条款、缺失条款和替换建议。",
    bestFor: ["销售合同审阅", "采购协议审阅", "框架协议复核"],
    inputExamples: ["合同文本", "条款库", "风险审阅清单"],
    acceptedFiles: ["pdf", "docx", "txt"],
    setupTime: "约 10-20 分钟",
    reviewRequirement: "需要管理员确认",
    processingExplanation: ["识别关键条款", "对照公司规则", "生成审阅摘要"],
    outputCapabilities: ["风险条款", "缺失条款", "替换建议", "审阅报告"],
    businessOptions: [
      { label: "合同类型", values: ["销售框架合同", "采购协议", "NDA", "订阅合同"] },
      { label: "风险口径", values: ["保守", "标准", "业务友好"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "Northwind Labs 框架合同审阅结果",
      summary: "标出自动续约、违约上限和数据归属条款的风险与建议。",
      sections: ["整体结论", "高风险条款", "建议替换", "待法务确认"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "SaaS 订阅合同审阅",
      sampleInputs: [
        { title: "客户合同", fileName: "Northwind Labs 订阅合同.pdf", fileType: "pdf", description: "客户提供的待审合同文本。" },
        { title: "审阅规则", fileName: "法务条款审阅清单.md", fileType: "md", description: "公司对自动续约、赔偿上限和数据条款的要求。" }
      ],
      sampleQuestion: "这份合同有哪些高风险条款，应该怎么改？",
      sampleAnswer: "主要风险是自动续约通知期过短、违约赔偿上限缺失、客户数据使用边界不清。建议补充 30 天续约提醒、设置年度服务费上限，并明确数据仅用于交付和支持。",
      citations: [
        { label: "客户合同", source: "Northwind Labs 订阅合同.pdf", excerpt: "协议期满后默认自动续约。" },
        { label: "审阅规则", source: "法务条款审阅清单.md", excerpt: "自动续约需保留提前通知机制。" }
      ],
      resultHighlights: ["逐条列出风险", "给出替换建议", "保留待法务确认项"]
    }),
    suggestedQuestions: ["这份合同有哪些风险条款？", "把建议整理成给法务看的版本。"]
  },
  {
    id: "rfp-security",
    name: "RFP / 安全问卷响应",
    category: "sales",
    ...templateEvidence(["document_review", "report_generator"], ["客户问卷答案需要责任人确认后才能对外发送。"]),
    headline: "导入客户问卷，生成可信答案草稿、待确认项和引用依据。",
    bestFor: ["售前 RFP", "安全问卷", "合规问卷", "供应商评估"],
    inputExamples: ["客户问卷", "历史答案库", "安全白皮书", "合规资料"],
    acceptedFiles: ["xlsx", "csv", "pdf", "docx"],
    setupTime: "约 15-30 分钟",
    reviewRequirement: "需要管理员确认",
    processingExplanation: ["读取问题列表", "匹配历史答案", "标记待确认项"],
    outputCapabilities: ["批量答案草稿", "待审核清单", "引用依据", "答案导出"],
    businessOptions: [
      { label: "回答口径", values: ["标准", "保守", "销售友好"] },
      { label: "审核方式", values: ["逐条审核", "只审核低置信项"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "华东银行安全问卷答案包",
      summary: "生成 42 条答案草稿，标记 6 条需要安全同事确认。",
      sections: ["已生成答案", "需确认问题", "知识缺口", "引用来源"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "华东银行安全问卷响应",
      sampleInputs: [
        { title: "客户问卷", fileName: "华东银行安全问卷.csv", fileType: "csv", description: "客户逐条安全、权限和合规问题。" },
        { title: "安全白皮书", fileName: "平台安全白皮书.pdf", fileType: "pdf", description: "可引用的安全能力和合规说明。" }
      ],
      sampleQuestion: "把客户安全问卷生成标准答案草稿，并标出待确认项。",
      sampleAnswer: "已生成可直接复核的答案草稿。身份认证、权限控制和日志留存可引用安全白皮书；数据驻留和专属部署条款缺少当前项目配置，需要安全负责人确认。",
      citations: [
        { label: "客户问卷", source: "华东银行安全问卷.csv", excerpt: "请说明系统是否支持最小权限控制。" },
        { label: "安全白皮书", source: "平台安全白皮书.pdf", excerpt: "平台支持基于角色的访问控制和审计日志。" }
      ],
      resultHighlights: ["批量生成答案草稿", "区分可回答和待确认问题", "保留客户可读引用"]
    }),
    suggestedQuestions: ["这份问卷还有哪些问题需要人工确认？", "导出客户可读版本。"]
  },
  {
    id: "customer-360",
    name: "客户 360 简报",
    category: "sales",
    ...templateEvidence(["report_generator", "graph_explorer", "hybrid"], ["客户判断依赖数据新鲜度，过期 CRM 或会议记录会降低可靠性。"]),
    headline: "输入客户名，生成会前客户简报、风险信号、机会信号和下一步建议。",
    bestFor: ["销售会前准备", "客户成功续约", "客户画像", "扩容判断"],
    inputExamples: ["客户档案", "会议记录", "合同", "项目记录"],
    acceptedFiles: ["pdf", "docx", "xlsx", "txt"],
    setupTime: "约 10-20 分钟",
    reviewRequirement: "建议管理员确认",
    processingExplanation: ["整理客户对象", "识别关键关系", "汇总风险和机会"],
    outputCapabilities: ["客户简报", "风险信号", "机会信号", "下一步行动"],
    businessOptions: [
      { label: "简报受众", values: ["销售负责人", "客户成功", "管理层"] },
      { label: "关系识别方向", values: ["客户关系", "项目关系", "组织关系"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "Northwind Labs 续约会前简报",
      summary: "续约风险偏高，但存在二期扩容机会，建议本周触达 CTO。",
      sections: ["客户背景", "关键关系", "风险信号", "行动建议"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "Northwind Labs 续约简报",
      sampleInputs: [
        { title: "CRM 导出", fileName: "Northwind Labs CRM.csv", fileType: "csv", description: "商机阶段、合同金额、联系人和跟进记录。" },
        { title: "关系资料", fileName: "Northwind Labs 关系图.json", fileType: "json", description: "客户组织、项目角色和关键联系人关系。" },
        { title: "会议纪要", fileName: "续约会议纪要.md", fileType: "md", description: "近期会议、阻塞点和下一步承诺。" }
      ],
      sampleQuestion: "Northwind Labs 这个客户当前续约风险和机会是什么？",
      sampleAnswer: "续约风险来自采购审批延迟和技术负责人对集成成本的担忧；机会来自二期扩容需求已被业务负责人确认。建议本周由客户成功同步上线成效，销售负责人约 CTO 确认集成排期。",
      citations: [
        { label: "CRM 导出", source: "Northwind Labs CRM.csv", excerpt: "续约商机处于采购评估，预计金额 120 万。" },
        { label: "会议纪要", source: "续约会议纪要.md", excerpt: "业务负责人希望二期覆盖华南团队。" },
        { label: "关系资料", source: "Northwind Labs 关系图.json", excerpt: "CTO 对集成排期有最终确认权。" }
      ],
      resultHighlights: ["生成会前客户画像", "展示关键关系路径", "给出下一步行动建议"]
    }),
    suggestedQuestions: ["Northwind Labs 值不值得续约？", "生成给销售总监看的版本。"]
  },
  {
    id: "risk-investigation",
    name: "关系风险尽调",
    category: "risk",
    ...templateEvidence(["graph_explorer", "report_generator"], ["关系线索需要证据支撑，低置信关系不能直接作为结论。"]),
    headline: "围绕公司、供应商或项目追踪关系链、风险事件和证据链。",
    bestFor: ["投资尽调", "供应商风险", "客户风险", "项目风险"],
    inputExamples: ["尽调报告", "合同", "访谈记录", "公开资料"],
    acceptedFiles: ["pdf", "docx", "xlsx", "txt"],
    setupTime: "约 20-40 分钟",
    reviewRequirement: "需要管理员确认",
    processingExplanation: ["识别关键对象", "建立关系线索", "汇总风险证据"],
    outputCapabilities: ["关系链", "风险清单", "证据链", "尽调报告"],
    businessOptions: [
      { label: "排查范围", values: ["股权与关联方", "供应链依赖", "合同与诉讼", "全面排查"] },
      { label: "风险口径", values: ["保守", "标准", "管理层摘要"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "云启网络关系风险尽调",
      summary: "整体风险中等，主要风险来自供应商集中和历史诉讼关联。",
      sections: ["关系路径", "风险清单", "待核验问题", "证据来源"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "云启网络关系风险尽调",
      sampleInputs: [
        { title: "供应商清单", fileName: "云启供应商清单.csv", fileType: "csv", description: "供应商、合同金额、服务范围和负责人。" },
        { title: "事件记录", fileName: "历史风险事件.txt", fileType: "txt", description: "历史诉讼、交付延期和争议记录。" },
        { title: "关系资料", fileName: "云启关系资料.json", fileType: "json", description: "公司、人员、项目和供应商关系。" }
      ],
      sampleQuestion: "这家供应商有哪些关联风险？",
      sampleAnswer: "主要风险是关键服务集中在同一供应商，且该供应商与历史延期项目存在人员交集。当前证据足以提示复核，但低置信关系需要人工确认后才能形成正式结论。",
      citations: [
        { label: "供应商清单", source: "云启供应商清单.csv", excerpt: "核心运维服务由北辰云服承接。" },
        { label: "事件记录", source: "历史风险事件.txt", excerpt: "2025 年出现两次交付延期争议。" }
      ],
      resultHighlights: ["生成关系链视图", "标记风险事件", "区分高低置信线索"]
    }),
    suggestedQuestions: ["这家供应商有哪些关联风险？", "生成一份管理层尽调摘要。"]
  },
  {
    id: "domain-relationship",
    name: "垂域关系知识库",
    category: "risk",
    ...templateEvidence(["graph_explorer", "knowledge_portal", "hybrid"], ["垂域实体和关系类型需要管理员按领域配置后效果更稳定。"]),
    headline: "为医疗、金融、制造、供应链等领域资料建立关键对象和关系问答能力。",
    bestFor: ["医疗领域知识", "金融风险分析", "制造供应链", "行业研究"],
    inputExamples: ["领域 PDF", "标准文档", "项目资料", "表格"],
    acceptedFiles: ["pdf", "docx", "xlsx", "csv", "txt"],
    setupTime: "约 30-60 分钟",
    reviewRequirement: "需要管理员确认",
    processingExplanation: ["识别领域对象", "整理关系线索", "保留来源证据"],
    outputCapabilities: ["领域对象", "关系线索", "多步问题回答", "分析报告"],
    businessOptions: [
      { label: "领域方向", values: ["医疗", "金融", "制造", "供应链"] },
      { label: "关系识别方向", values: ["客户关系", "项目关系", "组织关系", "供应链关系"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "医疗客户关系知识库",
      summary: "整理医院、科室、设备、供应商和项目之间的关系线索。",
      sections: ["关键对象", "关系线索", "证据来源", "分析问题"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "医疗客户关系知识库",
      sampleInputs: [
        { title: "医院项目资料", fileName: "医疗客户项目资料.pdf", fileType: "pdf", description: "医院、科室、项目阶段和设备需求。" },
        { title: "领域关系表", fileName: "医疗对象关系.csv", fileType: "csv", description: "科室、设备、供应商和决策角色。" }
      ],
      sampleQuestion: "这个领域里哪些关系最影响采购决策？",
      sampleAnswer: "采购决策主要受临床科室需求、设备科评估和信息科集成要求共同影响。若供应商已有同类设备落地案例，通常能缩短评估周期。",
      citations: [
        { label: "医院项目资料", source: "医疗客户项目资料.pdf", excerpt: "影像科提出设备升级需求，信息科关注接口集成。" },
        { label: "领域关系表", source: "医疗对象关系.csv", excerpt: "设备科负责供应商评估，临床科室提出采购必要性。" }
      ],
      resultHighlights: ["生成领域对象清单", "展示影响路径", "支持多跳关系追问"]
    }),
    suggestedQuestions: ["这个领域里哪些关系最影响采购决策？", "生成一个客户画像。"]
  },
  {
    id: "support-agent",
    name: "智能客服知识代理",
    category: "support",
    ...templateEvidence(["embedded_assistant", "chat", "task_workflow"], ["上线前需要测试拒答、转人工和知识缺口处理。"]),
    headline: "把帮助中心和售后流程封装成可嵌入网页的客服知识代理。",
    bestFor: ["帮助中心", "订单售后", "产品咨询", "人工接管"],
    inputExamples: ["帮助文档", "售后流程", "FAQ", "订单规则"],
    acceptedFiles: ["pdf", "docx", "txt", "html"],
    setupTime: "约 15-30 分钟",
    reviewRequirement: "建议管理员确认",
    processingExplanation: ["整理问答口径", "识别转人工条件", "保留答案依据"],
    outputCapabilities: ["客服问答组件", "转人工建议", "答案审核", "知识缺口"],
    businessOptions: [
      { label: "运行入口", values: ["网页小组件", "客服模拟台", "内部审核"] },
      { label: "接管策略", values: ["宽松", "标准", "严格"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "订单售后客服代理",
      summary: "回答订单延迟、退换货和发票问题，并准备人工接管摘要。",
      sections: ["用户问题", "建议回复", "接管条件", "依据来源"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "订单与发票客服代理",
      sampleInputs: [
        { title: "帮助中心", fileName: "订单售后帮助中心.md", fileType: "md", description: "订单延迟、发票、退换货和物流规则。" },
        { title: "客服工单", fileName: "近30天客服工单.csv", fileType: "csv", description: "用户问题、处理结果和转人工原因。" }
      ],
      sampleQuestion: "客户说订单延迟三天，应该怎么回复？",
      sampleAnswer: "可以先说明已按订单号查询物流状态，并告知预计补发或延迟原因；如果订单超过承诺时效，应提供补偿规则或转人工处理。",
      citations: [
        { label: "帮助中心", source: "订单售后帮助中心.md", excerpt: "超过承诺时效可申请补偿或人工协助。" },
        { label: "客服工单", source: "近30天客服工单.csv", excerpt: "物流异常超过 48 小时的咨询通常转人工处理。" }
      ],
      resultHighlights: ["可嵌入网页客服入口", "回答带依据", "识别转人工条件"]
    }),
    suggestedQuestions: ["模拟一个订单延迟的客户咨询。", "哪些问题应该转人工？"]
  },
  {
    id: "research-guide",
    name: "研究报告 / 学习指南",
    category: "research",
    ...templateEvidence(["report_generator", "knowledge_portal"], ["适合内部研究和学习材料，不应直接当作无引用的正式报告。"]),
    headline: "把资料包整理成研究报告、学习指南、摘要和带引用版本。",
    bestFor: ["市场研究", "行业分析", "内部学习", "资料综述"],
    inputExamples: ["研究资料包", "网页摘录", "报告", "会议纪要"],
    acceptedFiles: ["pdf", "docx", "md", "txt", "html"],
    setupTime: "约 10-25 分钟",
    reviewRequirement: "无需管理员确认",
    processingExplanation: ["归纳主题结构", "整理引用来源", "生成不同受众版本"],
    outputCapabilities: ["研究报告", "学习指南", "摘要", "引用来源"],
    businessOptions: [
      { label: "输出受众", values: ["新人", "管理层", "客户", "研究团队"] },
      { label: "输出深度", values: ["摘要", "标准报告", "深入报告"] }
    ],
    creationSteps: standardCreationSteps,
    sampleArtifact: {
      title: "医疗行业客户复购学习指南",
      summary: "从客户案例和行业资料中提炼复购驱动因素和销售行动建议。",
      sections: ["核心结论", "驱动因素", "案例引用", "行动建议"]
    },
    demoWalkthrough: templateDemo({
      scenarioName: "医疗行业复购研究指南",
      sampleInputs: [
        { title: "行业资料", fileName: "医疗行业复购资料包.pdf", fileType: "pdf", description: "行业趋势、采购周期和客户案例。" },
        { title: "销售案例", fileName: "复购客户案例.md", fileType: "md", description: "历史复购客户的触发因素和行动记录。" }
      ],
      sampleQuestion: "把资料整理成给销售团队看的学习指南。",
      sampleAnswer: "复购通常由上线成效、科室扩展需求和信息科集成稳定性共同驱动。学习指南建议按客户阶段组织：已上线客户看成效证明，扩容客户看跨科室案例，新客户看采购路径。",
      citations: [
        { label: "行业资料", source: "医疗行业复购资料包.pdf", excerpt: "医院复购往往发生在首个科室稳定上线后。" },
        { label: "销售案例", source: "复购客户案例.md", excerpt: "跨科室扩展前需要准备上线成效材料。" }
      ],
      resultHighlights: ["生成学习指南", "保留案例引用", "可改写成不同受众版本"]
    }),
    suggestedQuestions: ["把资料整理成学习指南。", "改写成给销售团队看的版本。"]
  }
];
```

Add the helper data and functions below the templates:

```ts
export function templateById(id: string): ScenarioTemplate | undefined {
  return officialTemplates.find((item) => item.id === id);
}

const baseScenarioInstances: ScenarioInstance[] = [
  {
    id: "scene-sales-notes",
    templateId: "personal-wiki",
    name: "张磊的销售笔记 Wiki",
    description: "个人销售笔记、客户复盘和话术沉淀。",
    owner: "张磊",
    visibility: "private",
    status: "ready",
    updatedAt: "今天 09:20",
    sourceCount: 18,
    readyActions: ["打开 Wiki", "继续提问", "生成综述"],
    recommendedQuestions: ["最近客户最常问什么？", "整理一份本周销售复盘。"]
  },
  {
    id: "scene-renewal",
    templateId: "customer-360",
    name: "重点客户续约场景",
    description: "面向销售团队的客户续约判断和会前简报。",
    owner: "销售增长团队",
    visibility: "team",
    status: "ready",
    updatedAt: "今天 10:24",
    sourceCount: 64,
    readyActions: ["生成客户简报", "查看关系线索", "分享给团队"],
    recommendedQuestions: ["Northwind Labs 值不值得续约？", "恒生医疗有哪些扩容机会？"]
  },
  {
    id: "scene-support-draft",
    templateId: "support-agent",
    name: "售后知识客服代理",
    description: "订单售后、退换货和发票问题的客服问答代理。",
    owner: "客户体验组",
    visibility: "team",
    status: "processing",
    updatedAt: "今天 11:42",
    sourceCount: 23,
    readyActions: ["查看处理进度"],
    recommendedQuestions: ["订单延迟如何回复？"]
  }
];

const baseProcessingTasks: ProcessingTask[] = [
  {
    id: "task-sales-notes",
    scenarioId: "scene-sales-notes",
    templateName: "个人知识 Wiki",
    title: "整理销售笔记资料",
    status: "ready",
    progress: 100,
    currentStep: "已可使用",
    userMessage: "资料整理完成，个人知识 Wiki 已可使用。",
    nextActions: ["打开场景", "开始提问", "分享给团队"],
    createdAt: "今天 09:20"
  },
  {
    id: "task-support-agent",
    scenarioId: "scene-support-draft",
    templateName: "智能客服知识代理",
    title: "整理售后知识资料",
    status: "processing",
    progress: 62,
    currentStep: "正在整理答案依据",
    userMessage: "系统正在整理帮助文档和售后流程。",
    nextActions: ["查看详情"],
    createdAt: "今天 11:42"
  },
  {
    id: "task-domain-medical",
    scenarioId: "scene-medical-domain",
    templateName: "垂域关系知识库",
    title: "医疗行业关系资料处理",
    status: "needs_input",
    progress: 44,
    currentStep: "需要补充资料",
    userMessage: "缺少客户对象说明，请补充字段解释或样例表格。",
    nextActions: ["补充资料", "联系管理员"],
    createdAt: "昨天 17:40"
  }
];

const baseKnowledgeSpaceObjects: KnowledgeSpaceObject[] = [
  {
    id: "know-sales-wiki",
    mode: "wiki",
    title: "销售笔记 Wiki",
    summary: "客户复盘、销售打法和常见异议已整理成互链条目。",
    sourceLabel: "张磊的销售笔记 Wiki",
    updatedAt: "今天 09:20",
    linkedScenarioId: "scene-sales-notes",
    actions: ["浏览条目", "在这里提问", "生成综述"]
  },
  {
    id: "know-policy-answer",
    mode: "document",
    title: "差旅报销制度依据",
    summary: "制度条款、审批例外和可转发答复口径。",
    sourceLabel: "制度政策证据问答",
    updatedAt: "今天 15:01",
    linkedScenarioId: "scene-policy",
    actions: ["查看原文", "复制答复", "继续提问"]
  },
  {
    id: "know-renewal-relation",
    mode: "relationship",
    title: "Northwind Labs 客户关系线索",
    summary: "客户、关键人、项目和合同之间的关系线索。",
    sourceLabel: "重点客户续约场景",
    updatedAt: "今天 10:24",
    linkedScenarioId: "scene-renewal",
    actions: ["查看关系", "生成简报", "继续提问"]
  },
  {
    id: "know-renewal-brief",
    mode: "artifact",
    title: "Northwind Labs 续约风险简报",
    summary: "可分享给销售负责人和客户成功的续约判断材料。",
    sourceLabel: "客户 360 简报",
    updatedAt: "今天 10:24",
    linkedScenarioId: "scene-renewal",
    actions: ["打开成品", "分享", "改写版本"]
  }
];

const deliveryScenarioSeeds = officialTemplates.flatMap((template, templateIndex) =>
  Array.from({ length: 3 }, (_, index) => {
    const serial = index + 1;
    return {
      id: `scene-${template.id}-${serial}`,
      templateId: template.id,
      name: `${template.name} · ${["华东业务组", "总部运营组", "行业研究组"][index]}`,
      description: `${template.headline} 当前已接入正式资料、表格明细和访谈记录。`,
      owner: ["张磊", "林澄", "周琪", "刘洋", "何晴"][templateIndex % 5],
      visibility: (templateIndex % 3 === 0 ? "private" : templateIndex % 3 === 1 ? "team" : "company") as Visibility,
      status: (index === 0 ? "ready" : index === 1 ? "processing" : "needs_input") as ScenarioStatus,
      updatedAt: ["今天 09:20", "今天 11:42", "昨天 17:40"][index],
      sourceCount: 12 + templateIndex * 3 + index,
      readyActions: ["打开场景", "继续提问", "查看任务"],
      recommendedQuestions: template.suggestedQuestions
    };
  })
);

export const scenarioInstances: ScenarioInstance[] = [
  ...baseScenarioInstances,
  ...deliveryScenarioSeeds
];

export const sourceAssets: SourceAsset[] = scenarioInstances.flatMap((scenario, scenarioIndex) =>
  (["md", "pdf", "csv", "txt", "json"] as const).flatMap((fileType, fileIndex) =>
    Array.from({ length: fileType === "md" ? 2 : 1 }, (_, copyIndex) => ({
      id: `src-${scenario.id}-${fileType}-${fileIndex}-${copyIndex}`,
      scenarioId: scenario.id,
      title: `${scenario.name}-${["资料笔记", "正式文件", "业务明细", "访谈记录", "关系数据"][fileIndex]}`,
      fileName: `${scenario.name}-${["资料笔记", "正式文件", "业务明细", "访谈记录", "关系数据"][fileIndex]}-${copyIndex + 1}.${fileType}`,
      fileType,
      sizeLabel: `${Math.round(18 + scenarioIndex * 1.7 + fileIndex * 3)} KB`,
      owner: scenario.owner,
      updatedAt: scenario.updatedAt
    }))
  )
);

export const processingTasks: ProcessingTask[] = [
  ...baseProcessingTasks,
  ...deliveryScenarioSeeds.map((scenario, index) => ({
    id: `task-${scenario.id}`,
    scenarioId: scenario.id,
    templateName: templateById(scenario.templateId)?.name ?? "业务场景",
    title: `整理${scenario.name}`,
    status: scenario.status === "ready" ? "ready" : scenario.status === "needs_input" ? "needs_input" : "processing",
    progress: scenario.status === "ready" ? 100 : scenario.status === "needs_input" ? 48 : 66,
    currentStep: scenario.status === "ready" ? "已可使用" : scenario.status === "needs_input" ? "需要补充资料" : "正在整理资料",
    userMessage: scenario.status === "ready" ? "资料整理完成，场景已可使用。" : scenario.status === "needs_input" ? "需要补充字段说明或示例文件。" : "系统正在整理资料并建立可引用来源。",
    nextActions: scenario.status === "ready" ? ["打开场景", "继续提问"] : scenario.status === "needs_input" ? ["补充资料", "联系管理员"] : ["查看详情"],
    createdAt: index % 2 === 0 ? "今天 10:10" : "昨天 16:30"
  }))
];

const modes = ["wiki", "document", "relationship", "artifact"] as const;

export const knowledgeSpaceObjects: KnowledgeSpaceObject[] = [
  ...baseKnowledgeSpaceObjects,
  ...deliveryScenarioSeeds.map((scenario, index) => ({
    id: `know-${scenario.id}`,
    mode: modes[index % modes.length],
    title: `${scenario.name} · 知识结果`,
    summary: "已整理成可浏览、可追问、可继续生成任务的业务知识结果。",
    sourceLabel: templateById(scenario.templateId)?.name ?? "业务场景",
    updatedAt: scenario.updatedAt,
    linkedScenarioId: scenario.id,
    actions: ["打开", "在这里提问", "生成成品"]
  }))
];

export function createScenarioDraft(input: {
  templateId: string;
  name: string;
  visibility: Visibility;
  fileNames: string[];
}): { instance: ScenarioInstance; task: ProcessingTask } {
  const template = templateById(input.templateId);
  if (!template) throw new Error(`Unknown template: ${input.templateId}`);
  const id = `scene-${input.templateId}-${input.fileNames.length}`;
  const instance: ScenarioInstance = {
    id,
    templateId: input.templateId,
    name: input.name,
    description: template.headline,
    owner: "张磊",
    visibility: input.visibility,
    status: "submitted",
    updatedAt: "刚刚",
    sourceCount: input.fileNames.length,
    readyActions: ["查看任务"],
    recommendedQuestions: template.suggestedQuestions
  };
  const task: ProcessingTask = {
    id: `task-${id}`,
    scenarioId: id,
    templateName: template.name,
    title: `创建${template.name}`,
    status: "submitted",
    progress: 8,
    currentStep: "已提交",
    userMessage: "资料已提交，等待系统整理。",
    nextActions: ["查看任务中心"],
    createdAt: "刚刚"
  };
  return { instance, task };
}

export function visibleFrontendText(): string {
  return JSON.stringify({
    frontstageNav,
    officialTemplates,
    scenarioInstances,
    sourceAssets,
    processingTasks,
    knowledgeSpaceObjects
  });
}
```

- [ ] **Step 4: Run fixture tests**

Run:

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts
```

Expected:

- 6 tests pass.

- [ ] **Step 5: Update Chat fallback wording to avoid technical framing**

Modify `apps/web/lib/fixtures/chat.ts` fallback answer so it says:

```ts
text: `已在你有权限的知识来源中查找「${t}」，并核对依据后作答[1]。如果这个问题适合沉淀为固定流程，我会在答案后建议你创建场景或保存成任务。`,
```

Change `ragMeta` labels to business-facing copy:

```ts
export const ragMeta: Record<Rag, { label: string; c: string; soft: string }> = {
  doc: { label: "文档来源", c: "var(--c-document)", soft: "var(--c-document-soft)" },
  relation: { label: "关系线索", c: "var(--c-relation)", soft: "var(--c-relation-soft)" },
  compile: { label: "知识条目", c: "var(--c-personal)", soft: "var(--c-personal-soft)" }
};
```

- [ ] **Step 6: Expand Chat tests for business copy**

Modify `apps/web/lib/fixtures/chat.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { answerFor, ragMeta, taskForAction } from "./chat";

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

  test("fallback answer uses product language", () => {
    const answer = answerFor("一个没有命中样例的问题");

    expect(answer.text).toContain("有权限的知识来源");
    expect(answer.text).toContain("创建场景或保存成任务");
    expect(answer.text).not.toMatch(/RAG|GraphRAG|embedding|chunk|vector/i);
  });

  test("source labels are business-facing", () => {
    expect(Object.values(ragMeta).map((item) => item.label)).toEqual([
      "文档来源",
      "关系线索",
      "知识条目"
    ]);
  });
});
```

- [ ] **Step 7: Run all fixture tests**

Run:

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts apps/web/lib/fixtures/chat.test.ts
```

Expected:

- 10 tests pass.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add apps/web/lib/fixtures/frontstage.ts apps/web/lib/fixtures/frontstage.test.ts apps/web/lib/fixtures/chat.ts apps/web/lib/fixtures/chat.test.ts
git commit -m "feat: define frontstage product fixtures"
```

Expected:

- Commit contains only the four fixture/test files.

---

### Task 2: Premium Frontstage Shell And Ask-Only Home

**Files:**
- Create: `apps/web/components/app/frontstage-shell.tsx`
- Create: `apps/web/components/app/home.tsx`
- Modify: `apps/web/app/app/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create the shared frontstage shell**

Create `apps/web/components/app/frontstage-shell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { frontstageNav } from "../../lib/fixtures/frontstage";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";

export function FrontstageShell({
  children,
  title,
  className = ""
}: {
  children: ReactNode;
  title: string;
  className?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={`fs-shell ${className}`}>
      <header className="fs-topbar">
        <Link href="/" className="fs-brand" aria-label="返回官网">
          <Logo size={26} />
        </Link>
        <nav className="fs-nav" aria-label="前台导航">
          {frontstageNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button className="fs-mobile-menu" type="button" onClick={() => setOpen(true)} aria-label="打开导航">
          <span />
          <span />
          <span />
        </button>
        <ThemeToggle />
      </header>

      {open && (
        <div className="fs-mobile-panel" role="dialog" aria-label="前台导航">
          <button className="fs-mobile-backdrop" type="button" onClick={() => setOpen(false)} aria-label="关闭导航" />
          <div className="fs-mobile-sheet">
            <div className="fs-mobile-head">
              <Logo size={24} />
              <button type="button" onClick={() => setOpen(false)}>关闭</button>
            </div>
            {frontstageNav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <main className="fs-main" aria-label={title}>
        {children}
      </main>
    </div>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 2: Create the ask-only homepage**

Create `apps/web/components/app/home.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FrontstageShell } from "./frontstage-shell";

const examples = [
  "差旅报销标准是多少？",
  "Northwind Labs 值不值得续约？",
  "把这些 Markdown 做成个人知识 Wiki",
  "整理成给销售总监看的客户简报"
];

export function CompanyBrainHome() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const ask = (input = value) => {
    const q = input.trim();
    if (!q) return;
    router.push(`/app/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <FrontstageShell title="问公司大脑" className="fs-home-shell">
      <section className="fs-home">
        <div className="fs-home-copy">
          <span>FF CompanyBrain</span>
          <h1>今天想问公司什么？</h1>
          <p>直接提问。公司大脑会在你有权限的知识来源里查找答案，并在适合时建议你创建场景、保存任务或打开相关知识。</p>
        </div>

        <form
          className="fs-askbox"
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask();
              }
            }}
            rows={3}
            placeholder="问制度、问客户、问项目、问自己创建的知识场景..."
          />
          <div className="fs-askbar">
            <span>Enter 发送 · Shift Enter 换行</span>
            <button type="submit">问公司大脑</button>
          </div>
        </form>

        <div className="fs-home-examples" aria-label="示例问题">
          {examples.map((item) => (
            <button key={item} type="button" onClick={() => ask(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>
    </FrontstageShell>
  );
}
```

- [ ] **Step 3: Route `/app` to the new home**

Modify `apps/web/app/app/page.tsx`:

```tsx
import { CompanyBrainHome } from "../../components/app/home";

export default function AppHome() {
  return <CompanyBrainHome />;
}
```

- [ ] **Step 4: Replace homepage and shell CSS**

In `apps/web/app/app/app.css`, add the new `fs-*` rules before old `sp-*` and `cw-*` blocks. During this task, do not delete old rules yet.

```css
.fs-shell {
  min-height: 100vh;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-2) 72%, transparent), var(--bg) 42%),
    var(--bg);
  color: var(--text);
}

.fs-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 clamp(18px, 4vw, 48px);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(18px);
}

.fs-brand {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.fs-nav {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 4px;
}

.fs-nav a {
  height: 36px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  transition: background-color .18s var(--ease), color .18s var(--ease);
}

.fs-nav a:hover,
.fs-nav a.active {
  color: var(--text);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.fs-mobile-menu {
  display: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  place-items: center;
  gap: 3px;
}

.fs-mobile-menu span {
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: var(--text-2);
}

.fs-main {
  min-height: calc(100vh - 64px);
}

.fs-home {
  min-height: calc(100vh - 64px);
  display: grid;
  align-content: center;
  justify-items: center;
  padding: clamp(52px, 9vh, 96px) 22px clamp(40px, 8vh, 80px);
}

.fs-home-copy {
  width: min(760px, 100%);
  text-align: center;
}

.fs-home-copy span {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--accent);
}

.fs-home-copy h1 {
  margin-top: 14px;
  font-family: var(--font-display);
  font-size: clamp(38px, 6vw, 72px);
  font-weight: 600;
  letter-spacing: 0;
}

.fs-home-copy p {
  max-width: 640px;
  margin: 18px auto 0;
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-2);
}

.fs-askbox {
  width: min(820px, 100%);
  margin-top: 34px;
  border: 1px solid var(--border-2);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: 0 24px 80px rgba(28, 24, 19, .10);
  overflow: hidden;
}

.fs-askbox:focus-within {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border-2));
  box-shadow: 0 28px 90px rgba(181, 114, 42, .16);
}

.fs-askbox textarea {
  width: 100%;
  min-height: 116px;
  padding: 22px 24px 10px;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 17px;
  line-height: 1.7;
}

.fs-askbar {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px 12px 24px;
}

.fs-askbar span {
  font-size: 12px;
  color: var(--text-3);
}

.fs-askbar button {
  min-width: 132px;
  height: 42px;
  border: 0;
  border-radius: 14px;
  background: var(--text);
  color: var(--bg);
  font-weight: 700;
}

.fs-home-examples {
  width: min(820px, 100%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}

.fs-home-examples button {
  min-height: 36px;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--text-2);
  padding: 7px 13px;
  font-size: 13px;
}

.fs-home-examples button:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface);
}

.fs-mobile-panel {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.fs-mobile-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(20, 16, 10, .34);
}

.fs-mobile-sheet {
  position: absolute;
  top: 0;
  right: 0;
  width: min(320px, 86vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.fs-mobile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.fs-mobile-head button,
.fs-mobile-sheet a {
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  padding: 0 14px;
  font-weight: 700;
}

.fs-mobile-sheet a {
  display: flex;
  align-items: center;
}

@media (max-width: 780px) {
  .fs-nav {
    display: none;
  }

  .fs-mobile-menu {
    display: grid;
  }

  .fs-topbar {
    justify-content: space-between;
  }

  .fs-home {
    align-content: start;
    padding-top: 58px;
  }

  .fs-home-copy {
    text-align: left;
  }

  .fs-home-copy p {
    margin-inline: 0;
  }

  .fs-askbar {
    align-items: stretch;
    flex-direction: column;
    padding: 8px 12px 12px;
  }

  .fs-askbar span {
    padding-left: 6px;
  }

  .fs-askbar button {
    width: 100%;
  }

  .fs-home-examples {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 5: Verify homepage has no secondary cards**

Start or reuse the dev server:

```bash
bun --cwd apps/web dev --port 3001
```

In another shell, run:

```bash
curl -s http://localhost:3001/app | rg "今天想问公司什么|问公司大脑"
curl -s http://localhost:3001/app | rg "知识空间|任务中心|场景模板|我的场景"
curl -s http://localhost:3001/app | rg "可继续办理|官方推荐|本周运行|待审核" && exit 1 || true
```

Expected:

- First command prints matching homepage text.
- Second command prints navigation labels.
- Third command prints nothing and exits successfully through `|| true`.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add apps/web/components/app/frontstage-shell.tsx apps/web/components/app/home.tsx apps/web/app/app/page.tsx apps/web/app/app/app.css
git commit -m "feat: add ask-only frontstage home"
```

Expected:

- Commit contains only the shell, home route, and CSS changes.

---

### Task 3: Template Library, Detail, And Creation Lifecycle

**Files:**
- Create: `apps/web/components/app/templates.tsx`
- Create: `apps/web/app/app/templates/page.tsx`
- Create: `apps/web/app/app/templates/[id]/page.tsx`
- Modify: `apps/web/app/app/library/page.tsx`
- Modify: `apps/web/app/app/create/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create template page components**

Create `apps/web/components/app/templates.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createScenarioDraft,
  officialTemplates,
  templateById,
  type ScenarioTemplate,
  type Visibility
} from "../../lib/fixtures/frontstage";
import { FrontstageShell } from "./frontstage-shell";

export function TemplateLibraryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const categories = ["全部", "个人", "团队", "制度", "法务", "销售", "风控", "客服", "研究"];
  const visible = officialTemplates.filter((template) => {
    const text = `${template.name}${template.headline}${template.bestFor.join("")}${template.inputExamples.join("")}`;
    const queryOk = !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());
    const categoryOk = category === "全部" || categoryName(template.category) === category;
    return queryOk && categoryOk;
  });

  return (
    <FrontstageShell title="场景模板">
      <section className="fs-page-head">
        <span>Scenario Templates</span>
        <h1>选择一种可以真正落地的知识能力</h1>
        <p>模板会说明适用情况、需要准备的数据、处理完成后的效果和使用方式。你不需要配置技术参数。</p>
      </section>

      <div className="fs-template-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Wiki、合同审阅、客户简报、客服代理..." />
        <div className="fs-segments">
          {categories.map((item) => (
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="fs-template-grid">
        {visible.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </FrontstageShell>
  );
}

export function TemplateDetailPage({ id }: { id: string }) {
  const template = templateById(id);
  if (!template) return <TemplateNotFound />;

  return (
    <FrontstageShell title={template.name}>
      <div className="fs-template-detail">
        <section className="fs-template-hero">
          <span>{categoryName(template.category)}</span>
          <h1>{template.name}</h1>
          <p>{template.headline}</p>
          <div className="fs-template-actions">
            <Link href={`/app/create?template=${template.id}`} className="fs-primary-action">用这个模板创建</Link>
            <Link href="/app/templates" className="fs-secondary-action">返回模板库</Link>
          </div>
        </section>

        <aside className="fs-template-summary">
          <Meta label="创建耗时" value={template.setupTime} />
          <Meta label="确认要求" value={template.reviewRequirement} />
          <Meta label="支持资料" value={template.acceptedFiles.join(" / ")} />
        </aside>

        <section className="fs-template-section">
          <h2>适用于</h2>
          <PillList items={template.bestFor} />
        </section>

        <section className="fs-template-section">
          <h2>你需要准备什么</h2>
          <PillList items={template.inputExamples} />
        </section>

        <section className="fs-template-section">
          <h2>系统会做什么</h2>
          <StepList steps={template.processingExplanation} />
        </section>

        <section className="fs-template-section">
          <h2>创建后能做什么</h2>
          <PillList items={template.outputCapabilities} />
        </section>

        <section className="fs-template-demo" id="template-demo">
          <span>样例演示</span>
          <h2>{template.demoWalkthrough.scenarioName}</h2>
          <div className="fs-demo-layout">
            <div>
              <h3>样例资料</h3>
              {template.demoWalkthrough.sampleInputs.map((asset) => (
                <article key={asset.fileName} className="fs-demo-asset">
                  <b>{asset.title}</b>
                  <small>{asset.fileName}</small>
                  <p>{asset.description}</p>
                </article>
              ))}
            </div>
            <div>
              <h3>处理过程</h3>
              <StepList steps={template.demoWalkthrough.processingPreview} />
            </div>
          </div>
          <div className="fs-demo-answer">
            <small>样例问题</small>
            <h3>{template.demoWalkthrough.sampleQuestion}</h3>
            <p>{template.demoWalkthrough.sampleAnswer}</p>
            <div className="fs-demo-citations">
              {template.demoWalkthrough.citations.map((citation) => (
                <div key={`${citation.source}-${citation.label}`}>
                  <b>{citation.label}</b>
                  <span>{citation.source}</span>
                  <p>{citation.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
          <PillList items={template.demoWalkthrough.resultHighlights} />
        </section>

        <section className="fs-template-sample">
          <span>成品样例</span>
          <h2>{template.sampleArtifact.title}</h2>
          <p>{template.sampleArtifact.summary}</p>
          <PillList items={template.sampleArtifact.sections} />
        </section>

        <section className="fs-template-section full">
          <h2>创建流程</h2>
          <div className="fs-lifecycle">
            {template.creationSteps.map((step, index) => (
              <div key={step.label}>
                <span>{index + 1}</span>
                <b>{step.label}</b>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </FrontstageShell>
  );
}

export function CreateScenarioPage() {
  const searchParams = useSearchParams();
  const initialTemplate = searchParams.get("template") ?? "personal-wiki";
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [name, setName] = useState("张磊的销售笔记 Wiki");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [files, setFiles] = useState("客户复盘.md\n销售打法.md");
  const [result, setResult] = useState<ReturnType<typeof createScenarioDraft> | null>(null);
  const template = templateById(templateId) ?? officialTemplates[0];

  const submit = () => {
    setResult(createScenarioDraft({
      templateId: template.id,
      name,
      visibility,
      fileNames: files.split(/\n+/).map((item) => item.trim()).filter(Boolean)
    }));
  };

  return (
    <FrontstageShell title="创建场景">
      <section className="fs-page-head">
        <span>Create Scenario</span>
        <h1>从模板创建一个可使用的业务场景</h1>
        <p>选择模板、命名场景、上传资料或选择已有来源，然后提交处理。处理完成后会出现在“我的场景”。</p>
      </section>

      <div className="fs-create-layout">
        <section className="fs-create-form">
          <FieldLabel number="1" title="选择模板" />
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {officialTemplates.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <FieldLabel number="2" title="命名场景" />
          <input value={name} onChange={(event) => setName(event.target.value)} />

          <FieldLabel number="3" title="设置可见范围" />
          <div className="fs-segments">
            {[
              ["private", "仅自己"],
              ["team", "团队可见"],
              ["company", "全公司"]
            ].map(([value, label]) => (
              <button key={value} className={visibility === value ? "active" : ""} onClick={() => setVisibility(value as Visibility)}>
                {label}
              </button>
            ))}
          </div>

          <FieldLabel number="4" title="添加资料清单" />
          <textarea value={files} onChange={(event) => setFiles(event.target.value)} rows={5} />

          <button className="fs-primary-action full" type="button" onClick={submit}>提交处理</button>
        </section>

        <aside className="fs-create-preview">
          <span>当前模板</span>
          <h2>{template.name}</h2>
          <p>{template.headline}</p>
          <Meta label="需要准备" value={template.inputExamples.join("、")} />
          <Meta label="输出结果" value={template.outputCapabilities.join("、")} />
          <Meta label="处理时间" value={template.setupTime} />
          {result && (
            <div className="fs-submit-result">
              <b>{result.task.userMessage}</b>
              <span>{result.task.currentStep} · {result.task.progress}%</span>
              <Link href="/app/tasks">去任务中心查看</Link>
            </div>
          )}
        </aside>
      </div>
    </FrontstageShell>
  );
}

function TemplateCard({ template }: { template: ScenarioTemplate }) {
  return (
    <article className="fs-template-card">
      <span>{categoryName(template.category)}</span>
      <h2>{template.name}</h2>
      <p>{template.headline}</p>
      <dl>
        <div><dt>输入数据</dt><dd>{template.inputExamples.slice(0, 3).join("、")}</dd></div>
        <div><dt>输出结果</dt><dd>{template.outputCapabilities.slice(0, 3).join("、")}</dd></div>
        <div><dt>创建耗时</dt><dd>{template.setupTime}</dd></div>
      </dl>
      <div className="fs-card-actions">
        <Link href={`/app/templates/${template.id}`}>查看模板</Link>
        <Link href={`/app/create?template=${template.id}`}>用这个模板创建</Link>
      </div>
    </article>
  );
}

function TemplateNotFound() {
  return (
    <FrontstageShell title="模板不存在">
      <section className="fs-empty">
        <h1>没有找到这个模板</h1>
        <p>它可能已经下架，或者当前账号没有访问权限。</p>
        <Link href="/app/templates" className="fs-primary-action">返回模板库</Link>
      </section>
    </FrontstageShell>
  );
}

function categoryName(category: ScenarioTemplate["category"]) {
  const map: Record<ScenarioTemplate["category"], string> = {
    personal: "个人",
    team: "团队",
    policy: "制度",
    legal: "法务",
    sales: "销售",
    risk: "风控",
    support: "客服",
    research: "研究"
  };
  return map[category];
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="fs-meta">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function PillList({ items }: { items: string[] }) {
  return <div className="fs-pill-list">{items.map((item) => <span key={item}>{item}</span>)}</div>;
}

function StepList({ steps }: { steps: string[] }) {
  return <div className="fs-step-list">{steps.map((step, index) => <div key={step}><span>{index + 1}</span>{step}</div>)}</div>;
}

function FieldLabel({ number, title }: { number: string; title: string }) {
  return (
    <label className="fs-field-label">
      <span>{number}</span>
      <b>{title}</b>
    </label>
  );
}
```

- [ ] **Step 2: Add template routes**

Create `apps/web/app/app/templates/page.tsx`:

```tsx
import { TemplateLibraryPage } from "../../../components/app/templates";

export default function TemplatesRoute() {
  return <TemplateLibraryPage />;
}
```

Create `apps/web/app/app/templates/[id]/page.tsx`:

```tsx
import { TemplateDetailPage } from "../../../../components/app/templates";

export default async function TemplateDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateDetailPage id={id} />;
}
```

- [ ] **Step 3: Keep `/app/library` as a compatibility alias**

Modify `apps/web/app/app/library/page.tsx`:

```tsx
import { TemplateLibraryPage } from "../../../components/app/templates";

export default function LibraryPage() {
  return <TemplateLibraryPage />;
}
```

- [ ] **Step 4: Route create page to the new lifecycle**

Modify `apps/web/app/app/create/page.tsx`:

```tsx
import { CreateScenarioPage } from "../../../components/app/templates";

export default function CreateScenarioRoute() {
  return <CreateScenarioPage />;
}
```

- [ ] **Step 5: Add template CSS**

Add these `fs-template-*`, `fs-page-*`, and `fs-create-*` rules to `apps/web/app/app/app.css`:

```css
.fs-page-head {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding: 48px 0 24px;
}

.fs-page-head span,
.fs-template-hero span,
.fs-template-card > span,
.fs-create-preview > span,
.fs-template-sample > span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--accent);
}

.fs-page-head h1,
.fs-template-hero h1 {
  max-width: 860px;
  margin-top: 10px;
  font-family: var(--font-display);
  font-size: clamp(32px, 4.6vw, 54px);
  letter-spacing: 0;
}

.fs-page-head p,
.fs-template-hero p {
  max-width: 720px;
  margin-top: 14px;
  color: var(--text-2);
  line-height: 1.75;
}

.fs-template-toolbar {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto 20px;
  display: grid;
  grid-template-columns: minmax(260px, 420px) 1fr;
  gap: 16px;
  align-items: center;
}

.fs-template-toolbar input,
.fs-create-form input,
.fs-create-form select,
.fs-create-form textarea {
  width: 100%;
  border: 1px solid var(--border-2);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  padding: 12px 14px;
  font: inherit;
}

.fs-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fs-segments button {
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.fs-segments button.active {
  color: var(--bg);
  background: var(--text);
  border-color: var(--text);
}

.fs-template-grid {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding-bottom: 72px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.fs-template-card {
  min-height: 308px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 22px;
  box-shadow: var(--shadow-sm);
}

.fs-template-card h2 {
  margin-top: 8px;
  font-size: 22px;
}

.fs-template-card p {
  margin-top: 10px;
  color: var(--text-2);
  line-height: 1.65;
}

.fs-template-card dl {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.fs-template-card dl div {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 12px;
}

.fs-template-card dt {
  color: var(--text-3);
  font-size: 12px;
}

.fs-template-card dd {
  color: var(--text);
  font-size: 13px;
}

.fs-card-actions,
.fs-template-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 18px;
}

.fs-card-actions a,
.fs-primary-action,
.fs-secondary-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 800;
}

.fs-card-actions a:first-child,
.fs-secondary-action {
  border: 1px solid var(--border-2);
  background: var(--surface);
  color: var(--text);
}

.fs-card-actions a:last-child,
.fs-primary-action {
  border: 1px solid var(--text);
  background: var(--text);
  color: var(--bg);
}

.fs-primary-action.full {
  width: 100%;
}

.fs-template-detail,
.fs-create-layout {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding: 48px 0 76px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;
}

.fs-template-hero,
.fs-template-section,
.fs-template-sample,
.fs-template-summary,
.fs-create-form,
.fs-create-preview,
.fs-empty {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 24px;
}

.fs-template-hero {
  min-height: 310px;
  display: flex;
  flex-direction: column;
}

.fs-template-summary,
.fs-create-preview {
  position: sticky;
  top: 88px;
  display: grid;
  gap: 12px;
}

.fs-template-section h2,
.fs-template-sample h2,
.fs-create-preview h2 {
  font-size: 20px;
  margin-bottom: 14px;
}

.fs-template-section.full {
  grid-column: 1 / -1;
}

.fs-pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fs-pill-list span {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-2);
  color: var(--text-2);
  padding: 6px 10px;
  font-size: 13px;
}

.fs-step-list {
  display: grid;
  gap: 10px;
}

.fs-step-list div,
.fs-lifecycle div {
  display: grid;
  gap: 5px;
  border-left: 2px solid var(--border-2);
  padding-left: 14px;
  color: var(--text-2);
}

.fs-step-list span,
.fs-lifecycle span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--text);
  color: var(--bg);
  font-size: 12px;
  font-weight: 800;
}

.fs-lifecycle {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.fs-lifecycle b {
  color: var(--text);
  font-size: 14px;
}

.fs-lifecycle p {
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.55;
}

.fs-meta {
  display: grid;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}

.fs-meta span {
  color: var(--text-3);
  font-size: 12px;
}

.fs-meta b {
  color: var(--text);
  font-size: 13px;
  line-height: 1.45;
}

.fs-create-form {
  display: grid;
  gap: 14px;
}

.fs-field-label {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 8px;
}

.fs-field-label span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 800;
}

.fs-submit-result {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--ok) 34%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--ok) 8%, var(--surface));
  padding: 14px;
}

.fs-submit-result span {
  color: var(--text-2);
  font-size: 13px;
}

.fs-submit-result a {
  color: var(--accent-strong);
  font-weight: 800;
}

.fs-empty {
  width: min(680px, calc(100% - 44px));
  margin: 72px auto;
  text-align: center;
}

@media (max-width: 900px) {
  .fs-template-toolbar,
  .fs-template-detail,
  .fs-create-layout {
    grid-template-columns: 1fr;
  }

  .fs-template-grid {
    grid-template-columns: 1fr;
  }

  .fs-template-summary,
  .fs-create-preview {
    position: static;
  }

  .fs-lifecycle {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Verify template routes**

Run:

```bash
for p in /app/templates /app/library /app/templates/personal-wiki /app/create?template=personal-wiki; do curl -I "http://localhost:3001$p"; done
```

Expected:

- Each route returns `HTTP/1.1 200 OK`.

Run:

```bash
curl -s http://localhost:3001/app/templates | rg "个人知识 Wiki|智能客服知识代理|用这个模板创建"
curl -s http://localhost:3001/app/templates/personal-wiki | rg "上传资料|等待就绪|开始使用"
```

Expected:

- Both commands print matches.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add apps/web/components/app/templates.tsx apps/web/app/app/templates apps/web/app/app/library/page.tsx apps/web/app/app/create/page.tsx apps/web/app/app/app.css
git commit -m "feat: build scenario template lifecycle"
```

Expected:

- Commit contains template components, template routes, create route, and CSS changes.

---

### Task 4: My Scenarios, Task Center, And Knowledge Space

**Files:**
- Create: `apps/web/components/app/scenario-pages.tsx`
- Create: `apps/web/components/app/task-pages.tsx`
- Create: `apps/web/components/app/knowledge-pages.tsx`
- Create: `apps/web/app/app/scenarios/[id]/manage/page.tsx`
- Modify: `apps/web/app/app/my-scenarios/page.tsx`
- Modify: `apps/web/app/app/tasks/page.tsx`
- Modify: `apps/web/app/app/knowledge/page.tsx`
- Modify: `apps/web/app/app/scenarios/[id]/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create my scenarios pages**

Create `apps/web/components/app/scenario-pages.tsx`:

```tsx
"use client";

import Link from "next/link";
import {
  scenarioInstances,
  templateById,
  type ScenarioInstance
} from "../../lib/fixtures/frontstage";
import { FrontstageShell } from "./frontstage-shell";

export function MyScenariosPage() {
  return (
    <FrontstageShell title="我的场景">
      <section className="fs-page-head">
        <span>My Scenarios</span>
        <h1>管理已经创建好的知识应用</h1>
        <p>这里展示从模板创建出来的场景实例。它们可以被打开、继续处理、分享或管理权限。</p>
      </section>
      <div className="fs-scenario-list">
        {scenarioInstances.map((scenario) => (
          <ScenarioRow key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </FrontstageShell>
  );
}

export function ScenarioInstancePage({ id }: { id: string }) {
  const scenario = scenarioInstances.find((item) => item.id === id);
  if (!scenario) return <ScenarioNotFound />;
  const template = templateById(scenario.templateId);

  return (
    <FrontstageShell title={scenario.name}>
      <div className="fs-instance-detail">
        <section className="fs-instance-main">
          <span>{template?.name ?? "场景实例"}</span>
          <h1>{scenario.name}</h1>
          <p>{scenario.description}</p>
          <div className="fs-instance-actions">
            <Link className="fs-primary-action" href={`/app/chat?q=${encodeURIComponent(scenario.recommendedQuestions[0] ?? scenario.name)}`}>打开并提问</Link>
            <Link className="fs-secondary-action" href={`/app/scenarios/${scenario.id}/manage`}>管理场景</Link>
            <Link className="fs-secondary-action" href="/app/tasks">查看任务</Link>
          </div>
        </section>
        <aside className="fs-instance-side">
          <Info label="状态" value={statusText(scenario.status)} />
          <Info label="可见范围" value={visibilityText(scenario.visibility)} />
          <Info label="资料数量" value={`${scenario.sourceCount} 份`} />
          <Info label="最近更新" value={scenario.updatedAt} />
        </aside>
        <section className="fs-instance-panel">
          <h2>适合提问</h2>
          <div className="fs-pill-list">
            {scenario.recommendedQuestions.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
        <section className="fs-instance-panel">
          <h2>可用动作</h2>
          <div className="fs-pill-list">
            {scenario.readyActions.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </div>
    </FrontstageShell>
  );
}

export function ManageScenarioPage({ id }: { id: string }) {
  const scenario = scenarioInstances.find((item) => item.id === id);
  if (!scenario) return <ScenarioNotFound />;

  return (
    <FrontstageShell title="管理场景">
      <section className="fs-page-head">
        <span>Manage Scenario</span>
        <h1>{scenario.name}</h1>
        <p>调整说明、权限、资料范围、更新节奏和复核要求，让这个场景持续服务真实业务流程。</p>
      </section>
      <div className="fs-manage-grid">
        <section className="fs-instance-panel">
          <h2>场景说明</h2>
          <input defaultValue={scenario.name} />
          <textarea defaultValue={scenario.description} rows={4} />
        </section>
        <section className="fs-instance-panel">
          <h2>权限范围</h2>
          <div className="fs-segments">
            {["仅自己", "团队可见", "全公司"].map((item) => <button key={item}>{item}</button>)}
          </div>
        </section>
        <section className="fs-instance-panel">
          <h2>资料范围</h2>
          <p>当前已接入 {scenario.sourceCount} 份资料。新增资料会进入任务中心处理。</p>
          <Link href="/app/tasks" className="fs-secondary-action">查看处理任务</Link>
        </section>
      </div>
    </FrontstageShell>
  );
}

function ScenarioRow({ scenario }: { scenario: ScenarioInstance }) {
  const template = templateById(scenario.templateId);
  return (
    <Link className="fs-scenario-row" href={`/app/scenarios/${scenario.id}`}>
      <span className="fs-scenario-mark">{scenario.name.slice(0, 1)}</span>
      <span className="fs-scenario-main">
        <b>{scenario.name}</b>
        <em>{scenario.description}</em>
      </span>
      <span>{template?.name ?? "自定义场景"}</span>
      <span>{statusText(scenario.status)}</span>
      <span>{scenario.updatedAt}</span>
    </Link>
  );
}

function ScenarioNotFound() {
  return (
    <FrontstageShell title="场景不存在">
      <section className="fs-empty">
        <h1>没有找到这个场景</h1>
        <p>它可能还在处理中，或者当前账号没有访问权限。</p>
        <Link className="fs-primary-action" href="/app/my-scenarios">返回我的场景</Link>
      </section>
    </FrontstageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="fs-info"><span>{label}</span><b>{value}</b></div>;
}

function statusText(status: ScenarioInstance["status"]) {
  const map: Record<ScenarioInstance["status"], string> = {
    draft: "草稿",
    submitted: "已提交",
    waiting_review: "等待确认",
    processing: "资料处理中",
    needs_input: "需要补充资料",
    ready: "已可使用",
    failed: "处理失败",
    archived: "已归档"
  };
  return map[status];
}

function visibilityText(visibility: ScenarioInstance["visibility"]) {
  const map = { private: "仅自己", team: "团队可见", company: "全公司" };
  return map[visibility];
}
```

- [ ] **Step 2: Create task center pages**

Create `apps/web/components/app/task-pages.tsx`:

```tsx
"use client";

import Link from "next/link";
import { processingTasks, type ProcessingTask } from "../../lib/fixtures/frontstage";
import { FrontstageShell } from "./frontstage-shell";

export function TaskCenterPage() {
  const groups = [
    { title: "资料处理任务", items: processingTasks.filter((item) => ["submitted", "waiting_review", "processing", "needs_input", "ready"].includes(item.status)) },
    { title: "需要我处理", items: processingTasks.filter((item) => item.status === "needs_input") },
    { title: "已经可用", items: processingTasks.filter((item) => item.status === "ready") }
  ];

  return (
    <FrontstageShell title="任务中心">
      <section className="fs-page-head">
        <span>Task Center</span>
        <h1>查看资料处理、审核和成品生成进度</h1>
        <p>任务中心告诉你当前任务为什么在这里、处理到哪一步，以及你下一步能做什么。</p>
      </section>
      <div className="fs-task-groups">
        {groups.map((group) => (
          <section key={group.title} className="fs-task-group">
            <h2>{group.title}</h2>
            <div className="fs-task-list">
              {group.items.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </section>
        ))}
      </div>
    </FrontstageShell>
  );
}

function TaskCard({ task }: { task: ProcessingTask }) {
  return (
    <article className="fs-task-card">
      <div className="fs-task-top">
        <span>{statusText(task.status)}</span>
        <em>{task.createdAt}</em>
      </div>
      <h3>{task.title}</h3>
      <p>{task.userMessage}</p>
      <div className="fs-progress" aria-label={`${task.progress}%`}>
        <i style={{ width: `${task.progress}%` }} />
      </div>
      <div className="fs-task-meta">
        <span>{task.templateName}</span>
        <span>{task.currentStep}</span>
      </div>
      <div className="fs-card-actions">
        {task.nextActions.map((action) => (
          <Link key={action} href={action.includes("打开") ? `/app/scenarios/${task.scenarioId}` : "/app/tasks"}>
            {action}
          </Link>
        ))}
      </div>
    </article>
  );
}

function statusText(status: ProcessingTask["status"]) {
  const map: Record<ProcessingTask["status"], string> = {
    draft: "草稿",
    submitted: "已提交",
    waiting_review: "等待确认",
    processing: "资料处理中",
    needs_input: "需要补充资料",
    ready: "已可使用",
    failed: "处理失败",
    archived: "已归档"
  };
  return map[status];
}
```

- [ ] **Step 3: Create knowledge space pages**

Create `apps/web/components/app/knowledge-pages.tsx`:

```tsx
"use client";

import Link from "next/link";
import { knowledgeSpaceObjects, type KnowledgeSpaceObject } from "../../lib/fixtures/frontstage";
import { FrontstageShell } from "./frontstage-shell";

export function KnowledgeSpacePage() {
  return (
    <FrontstageShell title="知识空间">
      <section className="fs-page-head">
        <span>Knowledge Space</span>
        <h1>浏览已经整理完成的知识结果</h1>
        <p>知识空间不是后台数据源管理页，而是用户可以消费的 Wiki、证据、关系线索和成品归档。</p>
      </section>
      <div className="fs-knowledge-grid">
        {knowledgeSpaceObjects.map((item) => (
          <KnowledgeCard key={item.id} item={item} />
        ))}
      </div>
    </FrontstageShell>
  );
}

function KnowledgeCard({ item }: { item: KnowledgeSpaceObject }) {
  return (
    <article className={`fs-knowledge-card mode-${item.mode}`}>
      <span>{modeText(item.mode)}</span>
      <h2>{item.title}</h2>
      <p>{item.summary}</p>
      <div className="fs-task-meta">
        <span>{item.sourceLabel}</span>
        <span>{item.updatedAt}</span>
      </div>
      <div className="fs-card-actions">
        {item.actions.map((action) => (
          <Link key={action} href={action.includes("提问") ? `/app/chat?q=${encodeURIComponent(item.title)}` : `/app/scenarios/${item.linkedScenarioId}`}>
            {action}
          </Link>
        ))}
      </div>
    </article>
  );
}

function modeText(mode: KnowledgeSpaceObject["mode"]) {
  const map = {
    wiki: "Wiki 条目",
    document: "文档证据",
    relationship: "关系线索",
    artifact: "成品归档"
  };
  return map[mode];
}
```

- [ ] **Step 4: Wire routes**

Modify `apps/web/app/app/my-scenarios/page.tsx`:

```tsx
import { MyScenariosPage } from "../../../components/app/scenario-pages";

export default function MyScenariosRoute() {
  return <MyScenariosPage />;
}
```

Modify `apps/web/app/app/tasks/page.tsx`:

```tsx
import { TaskCenterPage } from "../../../components/app/task-pages";

export default function TasksRoute() {
  return <TaskCenterPage />;
}
```

Modify `apps/web/app/app/knowledge/page.tsx`:

```tsx
import { KnowledgeSpacePage } from "../../../components/app/knowledge-pages";

export default function KnowledgeRoute() {
  return <KnowledgeSpacePage />;
}
```

Modify `apps/web/app/app/scenarios/[id]/page.tsx`:

```tsx
import { ScenarioInstancePage } from "../../../../components/app/scenario-pages";

export default async function ScenarioDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScenarioInstancePage id={id} />;
}
```

Create `apps/web/app/app/scenarios/[id]/manage/page.tsx`:

```tsx
import { ManageScenarioPage } from "../../../../../components/app/scenario-pages";

export default async function ManageScenarioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageScenarioPage id={id} />;
}
```

- [ ] **Step 5: Add scenarios, tasks, and knowledge CSS**

Append to `apps/web/app/app/app.css`:

```css
.fs-scenario-list,
.fs-task-groups,
.fs-knowledge-grid,
.fs-manage-grid {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding-bottom: 76px;
}

.fs-scenario-list {
  display: grid;
  gap: 10px;
}

.fs-scenario-row {
  min-height: 82px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 190px 120px 120px;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 14px 16px;
}

.fs-scenario-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 900;
}

.fs-scenario-main {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.fs-scenario-main b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-scenario-main em,
.fs-scenario-row > span:not(.fs-scenario-main):not(.fs-scenario-mark) {
  color: var(--text-2);
  font-size: 13px;
  font-style: normal;
}

.fs-instance-detail {
  width: min(1120px, calc(100% - 44px));
  margin: 0 auto;
  padding: 48px 0 76px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
}

.fs-instance-main,
.fs-instance-side,
.fs-instance-panel,
.fs-task-group,
.fs-task-card,
.fs-knowledge-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 22px;
}

.fs-instance-main span {
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.fs-instance-main h1 {
  margin-top: 10px;
  font-family: var(--font-display);
  font-size: clamp(32px, 4.5vw, 52px);
}

.fs-instance-main p,
.fs-instance-panel p,
.fs-task-card p,
.fs-knowledge-card p {
  margin-top: 10px;
  color: var(--text-2);
  line-height: 1.65;
}

.fs-instance-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.fs-instance-side {
  display: grid;
  gap: 12px;
}

.fs-info {
  display: grid;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}

.fs-info span,
.fs-task-top em,
.fs-task-meta span,
.fs-knowledge-card > span {
  color: var(--text-3);
  font-size: 12px;
  font-style: normal;
}

.fs-info b {
  color: var(--text);
}

.fs-task-groups {
  display: grid;
  gap: 18px;
}

.fs-task-group h2 {
  margin-bottom: 14px;
  font-size: 20px;
}

.fs-task-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.fs-task-card {
  display: flex;
  min-height: 270px;
  flex-direction: column;
}

.fs-task-top,
.fs-task-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.fs-task-top span {
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 800;
}

.fs-task-card h3,
.fs-knowledge-card h2 {
  margin-top: 14px;
  font-size: 19px;
}

.fs-progress {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-3);
  margin-top: 18px;
}

.fs-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--c-relation));
}

.fs-knowledge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.fs-knowledge-card {
  min-height: 250px;
  display: flex;
  flex-direction: column;
}

.fs-knowledge-card.mode-document {
  border-top: 3px solid var(--c-document);
}

.fs-knowledge-card.mode-relationship {
  border-top: 3px solid var(--c-relation);
}

.fs-knowledge-card.mode-wiki,
.fs-knowledge-card.mode-artifact {
  border-top: 3px solid var(--accent);
}

.fs-manage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.fs-manage-grid input,
.fs-manage-grid textarea {
  width: 100%;
  margin-top: 12px;
  border: 1px solid var(--border-2);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  padding: 12px;
  font: inherit;
}

@media (max-width: 940px) {
  .fs-scenario-row,
  .fs-instance-detail,
  .fs-task-list,
  .fs-knowledge-grid,
  .fs-manage-grid {
    grid-template-columns: 1fr;
  }

  .fs-scenario-row {
    align-items: start;
  }
}
```

- [ ] **Step 6: Verify routes**

Run:

```bash
for p in /app/my-scenarios /app/scenarios/scene-sales-notes /app/scenarios/scene-sales-notes/manage /app/tasks /app/knowledge; do curl -I "http://localhost:3001$p"; done
```

Expected:

- Each route returns `HTTP/1.1 200 OK`.

Run:

```bash
curl -s http://localhost:3001/app/tasks | rg "资料处理中|需要补充资料|已可使用"
curl -s http://localhost:3001/app/knowledge | rg "Wiki 条目|文档证据|关系线索|成品归档"
```

Expected:

- Both commands print matches.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add apps/web/components/app/scenario-pages.tsx apps/web/components/app/task-pages.tsx apps/web/components/app/knowledge-pages.tsx apps/web/app/app/my-scenarios/page.tsx apps/web/app/app/tasks/page.tsx apps/web/app/app/knowledge/page.tsx 'apps/web/app/app/scenarios/[id]/page.tsx' 'apps/web/app/app/scenarios/[id]/manage/page.tsx' apps/web/app/app/app.css
git commit -m "feat: add scenario task and knowledge surfaces"
```

Expected:

- Commit contains only scenario, task, knowledge page files and CSS.

---

### Task 5: Rebuild Company Brain Chat

**Files:**
- Create: `apps/web/components/app/company-chat.tsx`
- Modify: `apps/web/app/app/chat/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Create the low-noise Chat component**

Create `apps/web/components/app/company-chat.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { answerFor, taskForAction, type Answer, type ChatAction, type Evidence, type TaskCanvas } from "../../lib/fixtures/chat";
import { scenarioInstances } from "../../lib/fixtures/frontstage";
import { FrontstageShell } from "./frontstage-shell";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  answer?: Answer;
};

let idSeed = 1;

export function CompanyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [activeAnswer, setActiveAnswer] = useState<Answer | null>(null);
  const [activeTask, setActiveTask] = useState<TaskCanvas | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scope, setScope] = useState("全部可用知识");
  const scrollRef = useRef<HTMLDivElement>(null);
  const querySent = useRef(false);
  const suggestions = useMemo(() => ["差旅报销标准是多少？", "Northwind Labs 值不值得续约？", "把这些 Markdown 做成个人知识 Wiki"], []);

  const send = (input = draft) => {
    const q = input.trim();
    if (!q) return;
    const answer = answerFor(q);
    setMessages((items) => [
      ...items,
      { id: idSeed++, role: "user", text: q },
      { id: idSeed++, role: "assistant", text: answer.text, answer }
    ]);
    setDraft("");
    setActiveAnswer(answer);
    setActiveTask(null);
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (querySent.current || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    querySent.current = true;
    send(q);
    window.history.replaceState(null, "", "/app/chat");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const openEvidence = (answer: Answer) => {
    setActiveAnswer(answer);
    setActiveTask(null);
    setDrawerOpen(true);
  };

  const openTask = (action: ChatAction, answer: Answer) => {
    setActiveAnswer(answer);
    setActiveTask(taskForAction(action.taskId) ?? null);
    setDrawerOpen(true);
  };

  return (
    <FrontstageShell title="问公司大脑" className="cc-shell">
      <div className={`cc-layout ${drawerOpen ? "drawer-open" : ""}`}>
        <section className="cc-main">
          <header className="cc-top">
            <div>
              <span>当前范围</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option>全部可用知识</option>
                {scenarioInstances.filter((item) => item.status === "ready").map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <Link href="/app/templates">创建场景</Link>
          </header>

          <div className="cc-thread" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="cc-empty">
                <h1>问公司大脑</h1>
                <p>直接提问，或者指定你想使用的场景。答案会先给结论，再收起展示依据和下一步动作。</p>
                <div className="cc-suggestions">
                  {suggestions.map((item) => <button key={item} onClick={() => send(item)}>{item}</button>)}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} onEvidence={openEvidence} onTask={openTask} />
              ))
            )}
          </div>

          <form
            className="cc-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="继续问公司大脑..."
            />
            <button type="submit">发送</button>
          </form>
        </section>

        <aside className="cc-drawer">
          <div className="cc-drawer-head">
            <b>{activeTask ? "任务画布" : "来源与依据"}</b>
            <button type="button" onClick={() => setDrawerOpen(false)}>收起</button>
          </div>
          {!activeAnswer && !activeTask && (
            <div className="cc-drawer-empty">
              <p>点击答案下方的“查看依据”或“下一步动作”，这里会显示来源、任务步骤和成品草稿。</p>
            </div>
          )}
          {activeTask ? <TaskDrawer task={activeTask} /> : activeAnswer ? <EvidenceDrawer answer={activeAnswer} /> : null}
        </aside>
      </div>
    </FrontstageShell>
  );
}

function ChatMessage({
  message,
  onEvidence,
  onTask
}: {
  message: Message;
  onEvidence: (answer: Answer) => void;
  onTask: (action: ChatAction, answer: Answer) => void;
}) {
  if (message.role === "user") return <div className="cc-message user"><p>{message.text}</p></div>;

  return (
    <div className="cc-message assistant">
      <div className="cc-avatar">FF</div>
      <article>
        <p>{renderText(message.text)}</p>
        {message.answer && (
          <div className="cc-answer-actions">
            <button type="button" onClick={() => onEvidence(message.answer!)}>查看依据</button>
            {message.answer.actions?.map((action) => (
              <button key={action.id} type="button" onClick={() => onTask(action, message.answer!)}>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function EvidenceDrawer({ answer }: { answer: Answer }) {
  return (
    <div className="cc-evidence-list">
      {answer.evidence.map((item, index) => (
        <EvidenceCard key={index} item={item} index={index} />
      ))}
    </div>
  );
}

function EvidenceCard({ item, index }: { item: Evidence; index: number }) {
  if (item.kind === "chunk") {
    return (
      <article className="cc-evidence-card">
        <span>来源 {index + 1}</span>
        <h3>{item.title}</h3>
        <p>{item.snippet}</p>
        <em>{item.doc}</em>
      </article>
    );
  }
  if (item.kind === "chain") {
    return (
      <article className="cc-evidence-card">
        <span>关系线索 {index + 1}</span>
        {item.items.map((value) => <p key={value}>{value}</p>)}
      </article>
    );
  }
  if (item.kind === "graph") {
    return (
      <article className="cc-evidence-card">
        <span>关系线索 {index + 1}</span>
        <h3>发现 {item.nodes.length} 个关键对象</h3>
        <p>{item.nodes.map((node) => node.label).join("、")}</p>
      </article>
    );
  }
  return (
    <article className="cc-evidence-card">
      <span>来源 {index + 1}</span>
      <h3>{item.title}</h3>
      <p>{"meta" in item ? item.meta : ""}</p>
    </article>
  );
}

function TaskDrawer({ task }: { task: TaskCanvas }) {
  return (
    <div className="cc-task-drawer">
      <section>
        <span>{task.scenarioName}</span>
        <h2>{task.title}</h2>
        <p>{task.artifact.summary}</p>
      </section>
      <div className="cc-task-steps">
        {task.steps.map((step, index) => (
          <div key={step.id} className={step.status}>
            <span>{index + 1}</span>
            <b>{step.title}</b>
            <p>{step.description}</p>
          </div>
        ))}
      </div>
      <article className="cc-artifact">
        <span>{task.artifact.kind}</span>
        <h3>{task.artifact.title}</h3>
        <p>{task.artifact.summary}</p>
        <div>{task.artifact.sections.map((item) => <em key={item}>{item}</em>)}</div>
      </article>
      <div className="cc-task-actions">
        <button>保存到任务中心</button>
        <button>分享成品</button>
        <Link href="/app/create">沉淀为团队场景</Link>
      </div>
    </div>
  );
}

function renderText(text: string) {
  return text.replace(/\[\d+\]/g, "");
}
```

- [ ] **Step 2: Route `/app/chat` to the new component**

Modify `apps/web/app/app/chat/page.tsx`:

```tsx
import { CompanyChat } from "../../../components/app/company-chat";

export default function ChatRoute() {
  return <CompanyChat />;
}
```

- [ ] **Step 3: Add Chat CSS**

Append to `apps/web/app/app/app.css`:

```css
.cc-shell .fs-main {
  min-height: calc(100vh - 64px);
}

.cc-layout {
  height: calc(100vh - 64px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  overflow: hidden;
}

.cc-layout.drawer-open {
  grid-template-columns: minmax(0, 1fr) min(380px, 34vw);
}

.cc-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cc-top {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 clamp(18px, 4vw, 46px);
  border-bottom: 1px solid var(--border);
}

.cc-top div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cc-top span {
  color: var(--text-3);
  font-size: 12px;
}

.cc-top select {
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
}

.cc-top a {
  height: 34px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
}

.cc-thread {
  flex: 1;
  overflow-y: auto;
  padding: 34px 22px 24px;
}

.cc-thread > * {
  width: min(780px, 100%);
  margin-inline: auto;
}

.cc-empty {
  display: grid;
  justify-items: center;
  gap: 14px;
  padding-top: 12vh;
  text-align: center;
}

.cc-empty h1 {
  font-family: var(--font-display);
  font-size: clamp(34px, 5vw, 58px);
  letter-spacing: 0;
}

.cc-empty p {
  max-width: 560px;
  color: var(--text-2);
  line-height: 1.75;
}

.cc-suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.cc-suggestions button {
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  padding: 0 13px;
  font-weight: 700;
}

.cc-message {
  display: flex;
  gap: 14px;
  margin-bottom: 28px;
}

.cc-message.user {
  justify-content: flex-end;
}

.cc-message.user p {
  max-width: min(620px, 86%);
  border-radius: 18px 18px 6px 18px;
  background: var(--text);
  color: var(--bg);
  padding: 12px 16px;
}

.cc-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 900;
}

.cc-message.assistant article {
  min-width: 0;
  flex: 1;
}

.cc-message.assistant article > p {
  color: var(--text);
  font-size: 15.5px;
  line-height: 1.85;
}

.cc-answer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 14px;
}

.cc-answer-actions button {
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
}

.cc-answer-actions button:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.cc-composer {
  width: min(780px, calc(100% - 44px));
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin: 0 auto;
  padding: 12px 0 20px;
}

.cc-composer textarea {
  flex: 1;
  max-height: 160px;
  resize: none;
  border: 1px solid var(--border-2);
  border-radius: 18px;
  background: var(--surface);
  color: var(--text);
  padding: 14px 16px;
  font: inherit;
  font-size: 15px;
  line-height: 1.55;
  box-shadow: var(--shadow-sm);
}

.cc-composer button {
  width: 74px;
  height: 48px;
  border: 0;
  border-radius: 16px;
  background: var(--text);
  color: var(--bg);
  font-weight: 900;
}

.cc-drawer {
  min-width: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cc-drawer-head {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
}

.cc-drawer-head button {
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-weight: 800;
}

.cc-drawer-empty,
.cc-evidence-list,
.cc-task-drawer {
  overflow-y: auto;
  padding: 16px;
}

.cc-drawer-empty {
  color: var(--text-2);
  line-height: 1.65;
}

.cc-evidence-list,
.cc-task-drawer {
  display: grid;
  gap: 12px;
}

.cc-evidence-card,
.cc-task-drawer section,
.cc-artifact {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 14px;
}

.cc-evidence-card span,
.cc-task-drawer section span,
.cc-artifact span {
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.cc-evidence-card h3,
.cc-artifact h3 {
  margin-top: 6px;
  font-size: 15px;
}

.cc-evidence-card p,
.cc-task-drawer section p,
.cc-artifact p {
  margin-top: 8px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}

.cc-evidence-card em {
  display: block;
  margin-top: 10px;
  color: var(--text-3);
  font-size: 12px;
  font-style: normal;
}

.cc-task-steps {
  display: grid;
  gap: 8px;
}

.cc-task-steps div {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 12px;
}

.cc-task-steps div > span {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--bg-3);
  color: var(--text-2);
  font-weight: 900;
}

.cc-task-steps div.done > span {
  background: color-mix(in srgb, var(--ok) 16%, var(--surface));
  color: var(--ok);
}

.cc-task-steps div.active > span {
  background: var(--accent);
  color: var(--accent-contrast);
}

.cc-task-steps b,
.cc-task-steps p {
  grid-column: 2;
}

.cc-task-steps p {
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
}

.cc-artifact div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.cc-artifact em {
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  padding: 4px 8px;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.cc-task-actions {
  display: grid;
  gap: 8px;
}

.cc-task-actions button,
.cc-task-actions a {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.cc-task-actions button:first-child {
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}

@media (max-width: 980px) {
  .cc-layout,
  .cc-layout.drawer-open {
    grid-template-columns: 1fr;
  }

  .cc-drawer {
    position: fixed;
    inset: 64px 0 0 auto;
    z-index: 80;
    width: min(380px, 92vw);
    transform: translateX(100%);
    transition: transform .22s var(--ease);
    box-shadow: var(--shadow-lg);
  }

  .cc-layout.drawer-open .cc-drawer {
    transform: translateX(0);
  }
}

@media (max-width: 640px) {
  .cc-top {
    align-items: stretch;
    flex-direction: column;
    padding-block: 10px;
  }

  .cc-top div {
    width: 100%;
    justify-content: space-between;
  }

  .cc-top select {
    min-width: 0;
    max-width: 64vw;
  }

  .cc-message.user p {
    max-width: 92%;
  }

  .cc-composer {
    width: calc(100% - 24px);
  }
}
```

- [ ] **Step 4: Verify Chat behavior**

Run:

```bash
curl -s "http://localhost:3001/app/chat?q=%E8%B5%8B%E8%8C%83%E7%A7%91%E6%8A%80%E5%80%BC%E4%B8%8D%E5%80%BC%E5%BE%97%E7%BB%AD%E7%BA%A6%EF%BC%9F" | rg "问公司大脑|当前范围|创建场景"
```

Expected:

- The command prints matching route HTML.

Use browser or Playwright manually:

```bash
node - <<'NODE'
const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await page.goto("http://localhost:3001/app/chat?q=%E8%B5%8B%E8%8C%83%E7%A7%91%E6%8A%80%E5%80%BC%E4%B8%8D%E5%80%BC%E5%BE%97%E7%BB%AD%E7%BA%A6%EF%BC%9F", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "生成续约风险简报" }).click();
  await page.screenshot({ path: "output/playwright/company-chat-task.png", fullPage: true });
  console.log(await page.locator("body").innerText());
  await browser.close();
})();
NODE
```

Expected:

- The output contains `任务画布`, `续约风险简报`, and `保存到任务中心`.
- Screenshot file exists at `output/playwright/company-chat-task.png`.
- The screenshot shows no fixed left sidebar and no debug-console density.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add apps/web/components/app/company-chat.tsx apps/web/app/app/chat/page.tsx apps/web/app/app/app.css
git commit -m "feat: rebuild company brain chat"
```

Expected:

- Commit contains only the new Chat component, Chat route, and CSS.

---

### Task 6: Remove Old Platform Coupling And Route Compatibility

**Files:**
- Modify: `apps/web/components/app/platform.tsx`
- Modify: `apps/web/components/app/workspace.tsx`
- Modify: `apps/web/app/app/outputs/page.tsx`
- Modify: `apps/web/app/app/scenarios/[id]/run/page.tsx`
- Modify: `apps/web/app/app/app.css`

- [ ] **Step 1: Convert old outputs route to task center alias**

Modify `apps/web/app/app/outputs/page.tsx`:

```tsx
import { TaskCenterPage } from "../../../components/app/task-pages";

export default function OutputsRoute() {
  return <TaskCenterPage />;
}
```

- [ ] **Step 2: Convert old scenario run route to scenario detail**

Modify `apps/web/app/app/scenarios/[id]/run/page.tsx`:

```tsx
import { ScenarioInstancePage } from "../../../../../components/app/scenario-pages";

export default async function ScenarioRunRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScenarioInstancePage id={id} />;
}
```

- [ ] **Step 3: Stop importing old platform and workspace modules from active routes**

Run:

```bash
rg -n "components/app/(platform|workspace)|from \"../../../components/app/platform\"|from \"../../../components/app/workspace\"|from \"../../components/app/platform\"" apps/web/app apps/web/components
```

Expected before cleanup:

- The command may print old imports.

After route rewiring, repeat the command. Expected after cleanup:

- No active route imports `platform` or `workspace`.

- [ ] **Step 4: Leave old files in place only if still referenced by non-active code**

If `platform.tsx` or `workspace.tsx` still has active imports, update those imports first. If no active route imports them, do not delete them in this task; deletion can be done in a cleanup commit after build verification. Keeping them temporarily reduces risk while the new surface stabilizes.

- [ ] **Step 5: Remove old homepage secondary CSS only after new pages compile**

In `apps/web/app/app/app.css`, remove old `.ask-secondary`, `.ask-panel`, `.ask-kbs`, `.ask-task-list`, and old `.sp-side-card` rules if no JSX uses those classes. Verify with:

```bash
rg -n "ask-secondary|ask-panel|ask-kbs|ask-task-list|sp-side-card" apps/web
```

Expected:

- If the command prints no JSX usage, removing CSS is safe.
- If JSX usage remains, do not remove the class rules in this task.

- [ ] **Step 6: Run route compatibility checks**

Run:

```bash
for p in /app /app/chat /app/templates /app/library /app/create /app/my-scenarios /app/tasks /app/outputs /app/knowledge /app/templates/personal-wiki /app/scenarios/scene-sales-notes /app/scenarios/scene-sales-notes/run; do curl -I "http://localhost:3001$p"; done
```

Expected:

- Each route returns `HTTP/1.1 200 OK`.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add apps/web/app/app/outputs/page.tsx 'apps/web/app/app/scenarios/[id]/run/page.tsx' apps/web/app/app/app.css
git commit -m "chore: align legacy frontstage routes"
```

Expected:

- Commit includes only route compatibility and safe CSS cleanup.

---

### Task 7: Layout Audit And Visual Verification

**Files:**
- Modify: `scripts/audit-web-layout.ts`
- No source edits after verification unless failures are found.

- [ ] **Step 1: Add new selectors to layout audit**

Modify `scripts/audit-web-layout.ts`.

Add these selectors to `panelSelector`:

```ts
".fs-template-card",
".fs-template-hero",
".fs-template-section",
".fs-template-sample",
".fs-template-summary",
".fs-create-form",
".fs-create-preview",
".fs-scenario-row",
".fs-instance-main",
".fs-instance-side",
".fs-instance-panel",
".fs-task-group",
".fs-task-card",
".fs-knowledge-card",
".cc-evidence-card",
".cc-artifact"
```

Add these selectors to `gridSelector`:

```ts
".fs-template-grid",
".fs-template-detail",
".fs-create-layout",
".fs-scenario-list",
".fs-instance-detail",
".fs-task-list",
".fs-knowledge-grid",
".fs-manage-grid",
".cc-layout"
```

Add these selectors to `listSelector`:

```ts
".cc-thread",
".cc-evidence-list",
".cc-task-drawer",
".fs-task-groups"
```

- [ ] **Step 2: Run type/build verification**

Run:

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts apps/web/lib/fixtures/chat.test.ts
bun --cwd apps/web build
```

Expected:

- Tests pass.
- Build exits 0.
- Build route list includes `/app`, `/app/chat`, `/app/templates`, `/app/templates/[id]`, `/app/my-scenarios`, `/app/tasks`, `/app/knowledge`.

- [ ] **Step 3: Run layout audit**

Run:

```bash
WEB_BASE_URL=http://localhost:3001 bun run scripts/audit-web-layout.ts
```

Expected:

- Exit code 0.
- Output writes `output/playwright/layout-audit.json`.
- No `horizontal-overflow` errors.
- No `list-no-internal-scroll` errors.

- [ ] **Step 4: Capture required screenshots**

Run:

```bash
node - <<'NODE'
const { chromium } = require("@playwright/test");
const routes = [
  ["/app", "home"],
  ["/app/chat?q=%E8%B5%8B%E8%8C%83%E7%A7%91%E6%8A%80%E5%80%BC%E4%B8%8D%E5%80%BC%E5%BE%97%E7%BB%AD%E7%BA%A6%EF%BC%9F", "chat"],
  ["/app/templates", "templates"],
  ["/app/templates/personal-wiki", "template-detail"],
  ["/app/create?template=personal-wiki", "create"],
  ["/app/my-scenarios", "my-scenarios"],
  ["/app/tasks", "tasks"],
  ["/app/knowledge", "knowledge"]
];
const viewports = [
  ["desktop", { width: 1440, height: 920 }],
  ["mobile", { width: 390, height: 844 }]
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [vpName, viewport] of viewports) {
    const page = await browser.newPage({ viewport });
    for (const [route, name] of routes) {
      await page.goto(`http://localhost:3001${route}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: `output/playwright/saas-${name}-${vpName}.png`, fullPage: true });
    }
    await page.close();
  }
  await browser.close();
})();
NODE
```

Expected:

- 16 screenshots are created under `output/playwright/`.
- Desktop screenshots show full-width, calm SaaS layouts with no nested-card clutter.
- Mobile screenshots show no horizontal overflow, no clipped nav, and no text leaking out of buttons.

- [ ] **Step 5: Check banned frontend terms in rendered routes**

Run:

```bash
node - <<'NODE'
const { chromium } = require("@playwright/test");
const banned = [/GraphRAG/i, /NaiveRAG/i, /LightRAG/i, /embedding/i, /chunk/i, /vector/i, /entity extraction/i, /topK/i, /rerank/i, /mock/i, /fixture/i, /synthetic/i, /fake/i, /伪造/i, /虚构/i];
const routes = ["/app", "/app/chat", "/app/templates", "/app/templates/personal-wiki", "/app/create?template=personal-wiki", "/app/my-scenarios", "/app/tasks", "/app/knowledge"];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let failed = false;
  for (const route of routes) {
    await page.goto(`http://localhost:3001${route}`, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    for (const pattern of banned) {
      if (pattern.test(text)) {
        console.error(`${route} leaks ${pattern}`);
        failed = true;
      }
    }
  }
  await browser.close();
  if (failed) process.exit(1);
})();
NODE
```

Expected:

- Exit code 0.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add scripts/audit-web-layout.ts
git commit -m "test: audit saas frontstage layout"
```

Expected:

- Commit contains only audit selector updates.

---

### Task 8: Final Product QA Pass

**Files:**
- No planned source edits. Fix only defects found by these checks.

- [ ] **Step 1: Verify the user journey manually**

Use the browser at `http://localhost:3001/app` and complete this path:

1. Ask `把这些 Markdown 做成个人知识 Wiki`.
2. Confirm Chat opens and answers in a clean single-conversation layout.
3. Open `场景模板`.
4. Open `个人知识 Wiki`.
5. Click `用这个模板创建`.
6. Submit the create form.
7. Open `任务中心`.
8. Open `我的场景`.
9. Open `知识空间`.

Expected:

- Each screen has a clear primary action.
- The user can understand what the screen is for without knowing backend technology.
- The homepage has no secondary task/template panels.
- The Chat page does not feel like a left-sidebar control console.

- [ ] **Step 2: Run complete verification commands**

Run:

```bash
bun test apps/web/lib/fixtures/frontstage.test.ts apps/web/lib/fixtures/chat.test.ts
bun --cwd apps/web build
WEB_BASE_URL=http://localhost:3001 bun run scripts/audit-web-layout.ts
```

Expected:

- Tests pass.
- Build exits 0.
- Layout audit exits 0.

- [ ] **Step 3: Inspect git diff before final report**

Run:

```bash
git status --short
git log --oneline -8
```

Expected:

- Current task changes are either committed or intentionally left unstaged because they are unrelated pre-existing work.
- Recent commits show the task-by-task implementation commits.

## Acceptance Checklist

- [ ] `/app` only contains the company brain input, top navigation, and lightweight examples.
- [ ] Top navigation labels and order are exactly `问公司大脑 / 场景模板 / 我的场景 / 任务中心 / 知识空间`.
- [ ] `/app/templates` shows ten official templates with business-facing input/output descriptions.
- [ ] Every official template has `templateState = official`, `evidenceLevel = validated`, at least two evidence sources, product form metadata, and limitations.
- [ ] Frontstage fixture/API data shows at least 30 scenario instances, 30 processing tasks, 30 knowledge objects, and 120 source assets.
- [ ] Template detail pages explain适用情况、输入数据、处理过程、输出能力、样例演示、成品样例、创建流程.
- [ ] Every official template detail page shows sample inputs, a sample question, answer, citations, and result highlights before the user creates a scenario.
- [ ] Creating a scenario produces a visible processing task and points the user to task center.
- [ ] `/app/my-scenarios` shows created scenario instances, not official templates.
- [ ] `/app/tasks` clearly explains task status, progress, user message, and next action.
- [ ] `/app/knowledge` shows Wiki、文档证据、关系线索、成品归档 four consumption modes.
- [ ] `/app/chat` uses a low-noise conversation layout with drawer-based evidence and task details.
- [ ] No frontstage route leaks banned backend terms.
- [ ] No frontstage route exposes fake-data labels such as `mock`, `fixture`, `synthetic`, `fake`, `伪造`, or `虚构`.
- [ ] Desktop and mobile screenshots show no text overlap, clipped buttons, or horizontal overflow.
