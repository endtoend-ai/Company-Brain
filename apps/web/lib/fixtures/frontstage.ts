export type TemplateState = "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
export type TemplateProductForm = "chat" | "embedded_assistant" | "knowledge_portal" | "document_review" | "report_generator" | "graph_explorer" | "task_workflow" | "hybrid";
export type Visibility = "private" | "team" | "company";
export type ProcessingStatus = "draft" | "submitted" | "waiting_review" | "processing" | "ready" | "failed";
export type TaskKind = "File intake" | "Admin review" | "Knowledge ingest" | "Publish review";
export type RagEngine = "知识百科" | "文档证据" | "关系图谱" | "混合处理";

export type FrontstageNavItem = {
  label: "Company Q&A" | "Templates" | "Scenarios" | "Tasks" | "Knowledge";
  href: string;
};

export type TemplateDemoWalkthrough = {
  scenarioName: string;
  sampleInputs: Array<{ title: string; fileName: string; fileType: "md" | "pdf" | "csv" | "txt" | "json"; description: string }>;
  processingPreview: string[];
  sampleQuestion: string;
  sampleAnswer: string;
  citations: Array<{ label: string; source: string; excerpt: string }>;
  resultHighlights: string[];
};

export type ScenarioTemplate = {
  id: string;
  name: string;
  category: string;
  templateState: TemplateState;
  evidenceLevel: "validated" | "partial" | "internal_only";
  evidenceSources: string[];
  productForm: TemplateProductForm[];
  limitations: string[];
  headline: string;
  bestFor: string[];
  inputExamples: string[];
  acceptedFiles: string[];
  setupTime: string;
  reviewRequirement: "No admin confirmation needed" | "Requires admin confirmation" | "Admin confirmation recommended";
  processingExplanation: string[];
  outputCapabilities: string[];
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
  status: ProcessingStatus;
  sourceCount: number;
  updatedAt: string;
  readyActions: string[];
  recommendedQuestions: string[];
};

export type ProcessingTask = {
  id: string;
  scenarioId: string;
  title: string;
  status: ProcessingStatus;
  kind: TaskKind;
  ragMode: RagEngine;
  visibility: Visibility;
  owner: string;
  submittedAt: string;
  updatedAt: string;
  files: string[];
  waitingFor: "You" | "Admin" | "Processing pipeline" | "Scenario owner";
  progress: number;
  currentStep: string;
  userMessage: string;
  nextActions: string[];
  adminEntry: string;
};

export type KnowledgeSpaceObject = {
  id: string;
  mode: "wiki" | "document" | "relationship" | "artifact";
  title: string;
  summary: string;
  sourceLabel: string;
  linkedScenarioId: string;
  visibility: Visibility;
  owner: string;
  permissionNote: string;
  updatedAt: string;
  actions: string[];
};

export type WorkspaceProfile = {
  organizationName: string;
  workspaceName: string;
  currentUser: string;
  role: string;
  plan: string;
};

export type WorkspaceNavItem = {
  label: "Overview" | "Company Q&A" | "Templates" | "Scenarios" | "Tasks" | "Knowledge" | "Space Settings";
  href: string;
  description: string;
};

export type WorkspaceDashboard = {
  recentScenarioIds: string[];
  pendingTaskIds: string[];
  quickActions: Array<{ label: string; href: string; description: string }>;
  knowledgeHealth: {
    readyObjects: number;
    processingObjects: number;
    reviewRequired: number;
  };
};

export type ScenarioLifecycleStage = {
  key: "template" | "sources" | "processing" | "validation" | "published";
  label: string;
  description: string;
};

export type ScenarioWorkbenchTab = {
  key: "overview" | "data" | "tasks" | "ask" | "outputs" | "settings";
  label: string;
  href: string;
};

export type ScenarioAvailability = {
  label: "Awaiting files" | "Pending ingest" | "Processing" | "Pending review" | "Ready" | "Failed";
  description: string;
  nextAction: string;
};

export type ScenarioDataSource = {
  id: string;
  scenarioId: string;
  title: string;
  sourceType: string;
  fileName: string;
  status: "Ingested" | "Processing" | "Pending review";
  owner: string;
  updatedAt: string;
  evidencePolicy: string;
};

export type ScenarioOutput = {
  id: string;
  scenarioId: string;
  type: string;
  title: string;
  summary: string;
  status: "Ready" | "Pending review";
  updatedAt: string;
};

export type ScenarioSettings = {
  scenarioId: string;
  publicationMode: "Private" | "Team" | "Company-wide";
  retrievalPolicy: string;
  answerPolicy: string;
  reviewPolicy: string;
  connectedSources: string[];
};

export type ScenarioWorkbench = {
  scenario: ScenarioInstance;
  template: ScenarioTemplate;
  tabs: ScenarioWorkbenchTab[];
  lifecycle: ScenarioLifecycleStage[];
  dataSources: ScenarioDataSource[];
  tasks: ProcessingTask[];
  knowledgeObjects: KnowledgeSpaceObject[];
  outputs: ScenarioOutput[];
  settings: ScenarioSettings;
};

export const frontstageNav: FrontstageNavItem[] = [
  { label: "Company Q&A", href: "/app" },
  { label: "Templates", href: "/app/templates" },
  { label: "Scenarios", href: "/app/my-scenarios" },
  { label: "Tasks", href: "/app/tasks" },
  { label: "Knowledge", href: "/app/knowledge" }
];

export const workspaceProfile: WorkspaceProfile = {
  organizationName: "Northwind Labs",
  workspaceName: "Enterprise Knowledge Workspace",
  currentUser: "Maya Chen",
  role: "Head of Product",
  plan: "Enterprise"
};

export const workspaceNav: WorkspaceNavItem[] = [
  { label: "Overview", href: "/app", description: "Review ready scenarios, pending materials, and frequent entry points." },
  { label: "Company Q&A", href: "/app/ask", description: "Ask one place across existing knowledge assets and business scenarios." },
  { label: "Templates", href: "/app/templates", description: "Start from a best-practice template and build a knowledge app you can operate." },
  { label: "Scenarios", href: "/app/scenarios", description: "Manage personal, team, and company-level knowledge apps." },
  { label: "Tasks", href: "/app/tasks", description: "Track intake, admin ingest, review, and publishing progress." },
  { label: "Knowledge", href: "/app/knowledge", description: "Browse knowledge entries, evidence, graphs, and business deliverables." },
  { label: "Space Settings", href: "/app/settings", description: "Manage member permissions, data scope, connectors, and publishing policy." }
];

export const scenarioLifecycle: ScenarioLifecycleStage[] = [
  { key: "template", label: "Pick a template", description: "Confirm the business goal, input materials, and output shape." },
  { key: "sources", label: "Add files", description: "Upload files or pick an existing data source to form a processable pack." },
  { key: "processing", label: "Process and ingest", description: "Parse, chunk, index, build relationships, and run quality checks." },
  { key: "validation", label: "Validate", description: "Test answers, citations, refusals, and boundaries with real business questions." },
  { key: "published", label: "Publish", description: "Open it to a person, a team, or the company, and keep watching results." }
];

export const scenarioWorkbenchTabs: ScenarioWorkbenchTab[] = [
  { key: "overview", label: "Overview", href: "" },
  { key: "data", label: "Data sources", href: "/data" },
  { key: "tasks", label: "Processing tasks", href: "/tasks" },
  { key: "ask", label: "Q&A validation", href: "/ask" },
  { key: "outputs", label: "Outputs", href: "/outputs" },
  { key: "settings", label: "Settings", href: "/settings" }
];

export const readyScenarioWorkbenchTabs: ScenarioWorkbenchTab[] = [
  { key: "overview", label: "Use", href: "" },
  { key: "data", label: "Files", href: "/data" },
  { key: "tasks", label: "Business tasks", href: "/tasks" },
  { key: "ask", label: "Q&A", href: "/ask" },
  { key: "outputs", label: "Deliverables", href: "/outputs" },
  { key: "settings", label: "Manage", href: "/settings" }
];

export const productDataForbiddenWords = [
  "mock",
  "fake",
  "fixture",
  "synthetic",
  "伪造",
  "虚构",
  "样例答案",
  "样例资料",
  "样例问题",
  "演示数据",
  "演示入口",
  "演示卡片",
  "模拟数据",
  "模拟场景",
  "模拟记录"
];

const evidenceSources = [
  "_research/official-template-best-practice-research.md",
  "https://docs.dify.ai/en/use-dify/knowledge/readme",
  "https://docs.dify.ai/en/use-dify/knowledge/knowledge-pipeline/create-knowledge-pipeline",
  "https://aws.amazon.com/bedrock/knowledge-bases/",
  "https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview",
  "https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator",
  "https://ragflow.io/",
  "https://www.glean.com/",
  "https://support.atlassian.com/rovo/docs/agents/",
  "https://www.servicenow.com/community/knowledge-management-articles/best-practices-to-use-your-knowledge-articles-with-now-assist/ta-p/2824219"
];

const processingPreview = ["Read the sample material and detect usable sources", "Shape it into the knowledge structure this template needs", "Generate a questioning-friendly answer, cited evidence, and a deliverable preview"];

export const officialTemplates: ScenarioTemplate[] = [
  template("personal-wiki", "Personal Knowledge Wiki", "Personal", ["knowledge_portal", "chat"], "Turn personal notes and reference packs into a browsable knowledge space you can question.", ["Capture personal notes", "Organize study material", "Reuse project records"], ["Note documents", "Reference files", "Web excerpts"], ["Note documents", "Plain text", "Document files"], "No admin confirmation needed", "Maya's Sales Notes Wiki", ["West Coast account retrospectives.md", "Renewal sales playbook.pdf"], "What are the most common customer objections in these notes?", "The most common objections are budget timing, system integration cost, and onboarding timeline. Start with a completed case to explain the implementation cadence, then split the budget question into renewal retention, Phase 2 expansion, and services packages."),
  template("team-handbook", "Team Knowledge Handbook", "Team", ["knowledge_portal", "task_workflow"], "Turn team materials, meeting notes, and project retrospectives into a shareable handbook.", ["New hire onboarding", "Project retrospectives", "Sales process"], ["Meeting notes", "Project retrospectives", "FAQ documents"], ["Note documents", "Document files", "Office documents"], "Admin confirmation recommended", "Sales New Hire Onboarding Handbook", ["Sales new hire week one.md", "Customer meeting prep checklist.pdf"], "What should a new hire read first in week one?", "Start with product positioning and typical customer profiles on day one, complete the customer meeting prep checklist on day two, then read three retrospectives between day three and day five and submit one customer meeting plan."),
  template("policy-evidence", "Policy & Evidence Q&A", "Policy", ["chat", "knowledge_portal"], "Give employees policy, process, and expense answers with the original text attached.", ["HR policy lookup", "Expense questions", "Workplace process questions"], ["Policy documents", "Process documents", "Announcements"], ["Policy documents", "Office documents", "Spreadsheet data"], "Admin confirmation recommended", "Travel & Expense Policy Q&A", ["FY26 travel and expense policy.pdf", "Expense approval flow.csv"], "What is the hotel reimbursement cap in San Francisco, and what approval does it need?", "The hotel cap for individual contributors traveling to San Francisco is $280 per night; anything above the cap needs manager and Finance review."),
  template("contract-playbook", "Contract Clause Review", "Legal", ["document_review", "task_workflow"], "Upload a contract and generate risky clauses, missing clauses, and replacement language from the company review rules.", ["Sales contract review", "Procurement agreement review", "Master agreement review"], ["Contract text", "Clause library", "Risk checklist"], ["Contract documents", "Office documents", "Plain text"], "Requires admin confirmation", "SaaS Subscription Contract Review", ["Northwind Labs subscription agreement.pdf", "Legal clause review checklist.md"], "Which clauses in this contract are high risk, and how should they be revised?", "The main risks are a short auto-renewal notice window, a missing liability cap, and an unclear customer data usage boundary. Add a 60-day renewal reminder, cap liability at the annual service fee, and define the data usage boundary."),
  template("rfp-security", "RFP & Security Questionnaire Response", "Pre-Sales", ["document_review", "report_generator"], "Ingest customer questionnaires and generate trustworthy answer drafts, open items, and cited evidence.", ["Pre-sales bids", "Security questionnaires", "Compliance questionnaires"], ["Customer questionnaires", "Past answer library", "Security whitepaper"], ["Spreadsheet data", "Office spreadsheets", "Document files"], "Requires admin confirmation", "Pacific Union Bank Security Questionnaire Response", ["Pacific Union Bank security questionnaire.csv", "Platform security whitepaper.pdf"], "Draft standard answers for the customer security questionnaire and flag the items that still need confirmation.", "The answer draft is ready for review. Identity, access control, and log retention can cite the security whitepaper; data residency and dedicated deployment need the security lead to confirm."),
  template("customer-360", "Customer 360 Brief", "Sales", ["report_generator", "graph_explorer", "hybrid"], "Enter a customer name and generate a pre-meeting brief with risk signals, opportunity signals, and next steps.", ["Pre-meeting prep", "Customer Success renewals", "Customer profiles", "Expansion decisions"], ["Customer records", "Meeting notes", "Contracts", "Project records"], ["Spreadsheet data", "Relationship data", "Document files", "Note documents"], "Admin confirmation recommended", "Northstar Cloud Renewal Brief", ["Northstar Cloud CRM export.csv", "Northstar Cloud relationship map.json", "Renewal meeting notes.md"], "What are the current renewal risks and opportunities for Northstar Cloud?", "Renewal risk comes from delayed procurement approval and the CTO's concern about integration cost; the opportunity is the Phase 2 expansion already confirmed by the business owner. Customer Success should share rollout results this week and the account executive should book the CTO to confirm the integration schedule."),
  template("risk-investigation", "Relationship Risk Investigation", "Risk", ["graph_explorer", "report_generator"], "Trace relationship chains, risk events, and the evidence chain around a company, vendor, or project.", ["Investment due diligence", "Vendor risk", "Customer risk"], ["Due diligence reports", "Contracts", "Interview notes"], ["Relationship data", "Document files", "Spreadsheet data"], "Requires admin confirmation", "Skyline Networks Relationship Risk Investigation", ["Skyline Networks vendor list.csv", "Historical risk events.txt", "Skyline Networks relationship records.json"], "What related risks does this vendor carry?", "The main risk is that critical services concentrate on one vendor whose staff overlap with a previously delayed project. Low-confidence relationships need human confirmation before they become a formal conclusion."),
  template("domain-relationship", "Domain Relationship Base", "Industry", ["graph_explorer", "knowledge_portal", "hybrid"], "Build object and relationship Q&A for healthcare, financial services, manufacturing, and supply chain material.", ["Healthcare domain knowledge", "Financial risk analysis", "Manufacturing supply chain"], ["Domain documents", "Standard documents", "Project material"], ["Relationship data", "Document files", "Spreadsheet data"], "Requires admin confirmation", "Healthcare Account Relationship Base", ["Healthcare account project materials.pdf", "Healthcare object relationships.csv"], "Which relationships in this domain most affect the purchasing decision?", "Purchasing decisions are shaped by clinical department demand, biomedical engineering evaluation, and IT integration requirements. A comparable deployment usually shortens the evaluation cycle."),
  template("support-agent", "Support Knowledge Agent", "Support", ["embedded_assistant", "chat", "task_workflow"], "Package the help center and post-sale processes into an embeddable support knowledge agent.", ["Help center", "Order support", "Product questions", "Human handoff"], ["Help documents", "Post-sale processes", "FAQs"], ["Help documents", "Spreadsheet data", "Document files"], "Admin confirmation recommended", "Orders & Invoicing Support Agent", ["Order support help center.md", "Support tickets last 30 days.csv"], "The customer says the order is three days late. How should support reply?", "Start by confirming the shipment status by order number and share the expected reship date or the reason for the delay; if the order is past the committed window, offer the compensation policy or hand it to a human agent."),
  template("research-guide", "Research Report & Study Guide", "Research", ["report_generator", "knowledge_portal"], "Turn a reference pack into a research report, study guide, summary, and cited version.", ["Market research", "Industry analysis", "Internal learning"], ["Research packs", "Web excerpts", "Reports"], ["Note documents", "Document files", "Spreadsheet data"], "No admin confirmation needed", "Healthcare Renewal Research Guide", ["Healthcare renewal research pack.pdf", "Renewal customer cases.md"], "Turn the material into a study guide for the sales team.", "Renewals are usually driven by rollout results, departmental expansion demand, and the stability of IT integration. Organize the study guide by customer stage."),
  template("data-analyst", "Business Metrics Analyst", "Analytics", ["report_generator", "chat", "hybrid"], "Turn spreadsheets, BI exports, and business notes into metric analysis, anomaly explanations, and recommended actions.", ["Business reviews", "Sales metric analysis", "Finance cost analysis", "Anomaly triage"], ["Metric tables", "Metric definition notes", "Past reviews"], ["CSV", "Excel", "JSON", "Business notes"], "Admin confirmation recommended", "West Coast Quarterly Sales Metrics Analysis", ["West Coast quarterly sales.csv", "Metric definitions.md", "Key account list.xlsx"], "What drove the largest revenue swings in the West Coast region over the past three quarters?", "The swings came from delayed enterprise renewals in one quarter and channel orders closing in a single period the next. Use customer stage, channel source, and contract status as drill-down dimensions, and add the finance recognition basis."),
  template("it-runbook", "IT Runbook & Incident Triage", "IT Ops", ["chat", "task_workflow", "knowledge_portal"], "Turn runbooks, past tickets, and incident records into a questioning-friendly triage assistant with escalation paths.", ["IT service desk", "On-call triage", "Application operations", "Reusing past tickets"], ["Runbooks", "Past tickets", "Alert notes", "Log summaries"], ["Markdown", "Ticket exports", "Log text", "Runbook"], "Admin confirmation recommended", "Payment Gateway Incident Runbook", ["Payment gateway runbook.md", "Incident tickets last 90 days.csv", "Alert rules reference.txt"], "When payment callbacks time out, what should the on-call engineer check first?", "Confirm the external gateway status, the callback queue backlog, and the latest release records first; if errors concentrate on a single merchant, check the callback signature and retry counts for that merchant, then escalate to the payments platform owner."),
  template("meeting-media-memory", "Meeting Audio & Video Notes", "Collaboration", ["report_generator", "knowledge_portal", "task_workflow"], "Turn meeting recordings, video, transcripts, and attachments into questioning-friendly notes, decisions, and action items.", ["Project standups", "Customer interviews", "Training reviews", "Management meetings"], ["Recordings", "Transcripts", "Meeting attachments", "Slide decks"], ["Audio", "Video", "Transcript text", "PPT", "PDF"], "Admin confirmation recommended", "Northstar Cloud Renewal Meeting Notes", ["Renewal meeting transcript.md", "Meeting recording.mp3", "Renewal plan.pdf"], "Which risks, decisions, and action items did this meeting confirm?", "The meeting confirmed that the delayed procurement approval is the core risk and that the CTO must re-check the integration schedule. The account executive sends the rollout results material next week, and Customer Success shares the Phase 2 expansion scope."),
  template("voice-of-customer", "Voice of Customer & Demand Insights", "Product", ["report_generator", "graph_explorer", "hybrid"], "Aggregate support tickets, interviews, surveys, and community feedback to identify high-frequency demand, affected customers, and the evidence chain.", ["Demand backlog curation", "Customer feedback analysis", "Product roadmap", "Churn retrospectives"], ["Support tickets", "Customer interviews", "Survey data", "Community feedback"], ["CSV", "Interview text", "Markdown", "Spreadsheet data"], "Admin confirmation recommended", "Enterprise Permissions Demand Insights", ["Support tickets last 30 days.csv", "Key account interviews.md", "Request backlog export.xlsx"], "Which permissions-related requests most affect Enterprise renewals?", "High-frequency demand centers on role templates, approval logs, and cross-team data isolation. Affected customers are mostly financial services and manufacturing, so role templates and audit export should ship first.")
];

export const customScenarioTemplate: ScenarioTemplate = template(
  "custom-scenario",
  "Custom Business Scenario",
  "Custom",
  ["hybrid", "task_workflow"],
  "Start from a business goal and a reference pack; the admin console picks a suitable knowledge processing approach based on the material.",
  ["No official template fits", "Business material needs validation first", "An admin needs to choose the processing approach"],
  ["Business notes", "Document files", "Spreadsheet data", "Relationship data"],
  ["PDF", "Word", "Markdown", "Spreadsheets", "JSON"],
  "Requires admin confirmation",
  "Custom Business Scenario",
  ["Business notes.md", "Reference pack.zip"],
  "What kind of knowledge app would this material suit?",
  "The admin console first confirms the material type, business goal, and publishing scope, then chooses document evidence, relationship graph, compiled knowledge, or a combined approach."
);

function template(
  id: string,
  name: string,
  category: string,
  productForm: TemplateProductForm[],
  headline: string,
  bestFor: string[],
  inputExamples: string[],
  acceptedFiles: string[],
  reviewRequirement: ScenarioTemplate["reviewRequirement"],
  scenarioName: string,
  fileNames: string[],
  sampleQuestion: string,
  sampleAnswer: string
): ScenarioTemplate {
  const sampleInputs = fileNames.map((fileName, index) => ({
    title: index === 0 ? "Primary business document" : index === 1 ? "Structured supporting data" : "Process notes",
    fileName,
    fileType: fileName.endsWith(".json") ? "json" as const : fileName.endsWith(".csv") ? "csv" as const : fileName.endsWith(".md") ? "md" as const : fileName.endsWith(".txt") ? "txt" as const : "pdf" as const,
    description: "Shows how this template reads business material, builds answers, and keeps evidence attached."
  }));
  return {
    id,
    name,
    category,
    templateState: "official",
    evidenceLevel: "validated",
    evidenceSources,
    productForm,
    limitations: ["Whether the output can be shared externally depends on material quality and the review requirement."],
    headline,
    bestFor,
    inputExamples,
    acceptedFiles,
    setupTime: reviewRequirement === "Requires admin confirmation" ? "~15-40 min" : "~5-20 min",
    reviewRequirement,
    processingExplanation: processingPreview,
    outputCapabilities: capabilityFor(productForm),
    demoWalkthrough: {
      scenarioName,
      sampleInputs,
      processingPreview,
      sampleQuestion,
      sampleAnswer,
      citations: sampleInputs.slice(0, 2).map((input) => ({
        label: input.title,
        source: input.fileName,
        excerpt: `Evidence comes from ${displaySourceName(input.fileName)} and supports the current conclusion.`
      })),
      resultHighlights: ["Sample answer", "Cited sources", "Reusable deliverable"]
    },
    suggestedQuestions: [sampleQuestion, "Turn the result into a shareable version."]
  };
}

function capabilityFor(forms: TemplateProductForm[]): string[] {
  if (forms.includes("graph_explorer")) return ["Relationship graph", "Risk signals", "Recommended actions"];
  if (forms.includes("document_review")) return ["Answer draft", "Items pending approval", "Cited evidence"];
  if (forms.includes("embedded_assistant")) return ["Support Q&A widget", "Human handoff guidance", "Knowledge gaps"];
  if (forms.includes("report_generator")) return ["Structured report", "Summarized insights", "Cited evidence"];
  if (forms.includes("task_workflow")) return ["Processing guidance", "Action checklist", "Escalation path"];
  return ["Knowledge entries", "Source Q&A", "Deliverable summary"];
}

function ragModeForTemplate(template: ScenarioTemplate): RagEngine {
  if (template.productForm.includes("hybrid")) return "混合处理";
  if (template.productForm.includes("graph_explorer")) return "关系图谱";
  if (template.productForm.includes("document_review")) return "文档证据";
  return "知识百科";
}

function taskKindForScenario(scenario: ScenarioInstance): TaskKind {
  if (scenario.status === "submitted") return "Admin review";
  if (scenario.status === "waiting_review") return "Publish review";
  if (scenario.status === "ready") return "Publish review";
  return "Knowledge ingest";
}

function permissionNoteForVisibility(visibility: Visibility) {
  if (visibility === "private") return "Only the creator can read it; teammates and company-wide Q&A cannot retrieve it.";
  if (visibility === "team") return "Visible in the team space; company-wide Q&A needs an admin to widen access first.";
  return "Visible company-wide, retrievable by Ask CompanyBrain and authorized business scenarios.";
}

function displaySourceName(value: string) {
  return value.replace(/\.(json|csv|md|txt|pdf|docx|xlsx)$/i, "");
}

export const scenarioInstances: ScenarioInstance[] = officialTemplates.map((template, index) => ({
  id: `scenario-${template.id}`,
  templateId: template.id,
  name: template.demoWalkthrough.scenarioName,
  description: template.headline,
  owner: ["Maya Chen", "Jordan Lee", "Priya Shah", "Daniel Kim"][index % 4],
  visibility: template.id === "customer-360" ? "team" : index % 3 === 0 ? "private" : index % 3 === 1 ? "team" : "company",
  status: template.id === "customer-360" ? "ready" : index % 5 === 0 ? "processing" : "ready",
  sourceCount: template.demoWalkthrough.sampleInputs.length + 2,
  updatedAt: index < 3 ? "Today" : "Yesterday",
  readyActions: template.outputCapabilities,
  recommendedQuestions: template.suggestedQuestions
}));

export const processingTasks: ProcessingTask[] = scenarioInstances.map((scenario, index) => ({
  id: `task-${scenario.id}`,
  scenarioId: scenario.id,
  title: `Process ${scenario.name}`,
  status: scenario.status === "ready" ? "ready" : "processing",
  kind: taskKindForScenario(scenario),
  ragMode: ragModeForTemplate(templateById(scenario.templateId)!),
  visibility: scenario.visibility,
  owner: scenario.owner,
  submittedAt: index < 2 ? "Today 10:40" : index < 5 ? "Today 09:20" : "Yesterday 18:10",
  updatedAt: scenario.status === "ready" ? "Today 11:20" : "just now",
  files: (templateById(scenario.templateId)?.demoWalkthrough.sampleInputs ?? []).map((item) => item.fileName),
  waitingFor: scenario.status === "ready" ? "Scenario owner" : "Processing pipeline",
  progress: scenario.status === "ready" ? 100 : 68,
  currentStep: scenario.status === "ready" ? "Knowledge objects generated" : "Organizing files and building sources",
  userMessage: scenario.status === "ready" ? "Ingest, knowledge construction, and publishing are complete, so this account can use the scenario now." : "The system is organizing files, building sources, and generating knowledge objects.",
  nextActions: scenario.status === "ready" ? ["Open scenario", "View knowledge space"] : ["View task center", "Add more files"],
  adminEntry: scenario.status === "ready" ? "Published; the processing record is available in the admin console" : "The admin console is parsing, indexing, and running quality checks"
}));

export const knowledgeSpaceObjects: KnowledgeSpaceObject[] = scenarioInstances.map((scenario) => {
  const template = templateById(scenario.templateId)!;
  return {
    id: `knowledge-${scenario.id}`,
    mode: template.productForm.includes("graph_explorer") ? "relationship" : template.productForm.includes("document_review") ? "artifact" : "wiki",
    title: scenario.name,
    summary: `${template.name} is ready for Q&A, traceability, and deliverable reuse.`,
    sourceLabel: template.name,
    linkedScenarioId: scenario.id,
    visibility: scenario.visibility,
    owner: scenario.owner,
    permissionNote: permissionNoteForVisibility(scenario.visibility),
    updatedAt: scenario.updatedAt,
    actions: template.outputCapabilities
  };
});

export const scenarioDataSources: ScenarioDataSource[] = scenarioInstances.flatMap((scenario) => {
  const template = templateById(scenario.templateId)!;
  return template.demoWalkthrough.sampleInputs.map((asset, index) => ({
    id: `source-${scenario.id}-${index + 1}`,
    scenarioId: scenario.id,
    title: asset.title,
    sourceType: asset.fileType.toUpperCase(),
    fileName: asset.fileName,
    status: scenario.status === "ready" ? "Ingested" : index === 0 ? "Processing" : "Pending review",
    owner: scenario.owner,
    updatedAt: scenario.updatedAt,
    evidencePolicy: template.productForm.includes("graph_explorer") ? "Keep entities, relationships, and source evidence" : "Keep cited excerpts and original positions"
  }));
});

export const scenarioOutputs: ScenarioOutput[] = scenarioInstances.flatMap((scenario) => {
  const template = templateById(scenario.templateId)!;
  const preferredOutputs =
    template.id === "customer-360"
      ? ["Customer brief", "Relationship graph", "Next-step actions"]
      : template.outputCapabilities;

  return preferredOutputs.slice(0, 3).map((capability, index) => ({
    id: `output-${scenario.id}-${index + 1}`,
    scenarioId: scenario.id,
    type: capability,
    title: `${scenario.name} · ${capability}`,
    summary: `Generated from ${template.name}; keep asking, reviewing, and sharing inside the scenario.`,
    status: scenario.status === "ready" ? "Ready" : "Pending review",
    updatedAt: scenario.updatedAt
  }));
});

export const scenarioSettings: ScenarioSettings[] = scenarioInstances.map((scenario, index) => {
  const template = templateById(scenario.templateId)!;
  const isHybrid = template.productForm.includes("hybrid") || template.productForm.includes("graph_explorer");
  return {
    scenarioId: scenario.id,
    publicationMode: scenario.visibility === "private" ? "Private" : scenario.visibility === "company" ? "Company-wide" : "Team",
    retrievalPolicy: isHybrid ? "Hybrid retrieval: keyword, vector, and relationship paths ranked together" : "Evidence first: retrieved chunks ranked by citation confidence",
    answerPolicy: template.productForm.includes("document_review") ? "Always return citations and items pending confirmation" : "Answer the business question first and show the supporting sources",
    reviewPolicy: template.reviewRequirement,
    connectedSources: scenarioDataSources
      .filter((source) => source.scenarioId === scenario.id)
      .map((source) => source.fileName)
      .concat(index % 2 === 0 ? ["CRM connector"] : [])
  };
});

export const workspaceDashboard: WorkspaceDashboard = {
  recentScenarioIds: ["scenario-customer-360", ...scenarioInstances.filter((scenario) => scenario.id !== "scenario-customer-360").slice(0, 4).map((scenario) => scenario.id)],
  pendingTaskIds: processingTasks.filter((task) => task.status !== "ready").map((task) => task.id),
  quickActions: [
    { label: "Create a scenario", href: "/app/templates", description: "Start from an official template and build a reusable knowledge app." },
    { label: "Ask a question", href: "/app/ask", description: "Use Ask CompanyBrain to locate the answer and related scenarios first." },
    { label: "View processing tasks", href: "/app/tasks", description: "Check ingest, review, and publishing progress." }
  ],
  knowledgeHealth: {
    readyObjects: knowledgeSpaceObjects.filter((object) => scenarioById(object.linkedScenarioId)?.status === "ready").length,
    processingObjects: knowledgeSpaceObjects.filter((object) => scenarioById(object.linkedScenarioId)?.status !== "ready").length,
    reviewRequired: scenarioInstances.filter((scenario) => templateById(scenario.templateId)?.reviewRequirement !== "No admin confirmation needed").length
  }
};

export function templateById(id: string): ScenarioTemplate | undefined {
  return officialTemplates.find((template) => template.id === id);
}

export function scenarioById(id: string): ScenarioInstance | undefined {
  return scenarioInstances.find((scenario) => scenario.id === id);
}

export function scenarioAvailability(scenario: ScenarioInstance): ScenarioAvailability {
  if (scenario.status === "ready") {
    return {
      label: "Ready",
      description: "Ingest, knowledge construction, and publishing are complete, so this account can use the scenario now.",
      nextAction: "Use the scenario"
    };
  }
  if (scenario.status === "processing") {
    return {
      label: "Processing",
      description: "Files are submitted; the admin console is parsing, ingesting, indexing, and building knowledge objects.",
      nextAction: "View processing progress"
    };
  }
  if (scenario.status === "waiting_review") {
    return {
      label: "Pending review",
      description: "Knowledge construction is done; an admin reviews it before it is published to the current scope.",
      nextAction: "View review requirements"
    };
  }
  if (scenario.status === "submitted") {
    return {
      label: "Pending ingest",
      description: "Files are submitted; waiting for the admin console to start processing or confirm the entry configuration.",
      nextAction: "View submission record"
    };
  }
  if (scenario.status === "failed") {
    return {
      label: "Failed",
      description: "Processing did not finish; add more material or start processing again.",
      nextAction: "View the failure reason"
    };
  }
  return {
    label: "Awaiting files",
    description: "The scenario exists but there is no processable file pack yet.",
    nextAction: "Add files"
  };
}

export function scenarioWorkbenchById(id: string): ScenarioWorkbench | undefined {
  const scenario = scenarioById(id);
  if (!scenario) return undefined;
  const template = templateById(scenario.templateId) ?? officialTemplates[0];
  const baseHref = `/app/scenarios/${scenario.id}`;
  const tabs = scenario.status === "ready" ? readyScenarioWorkbenchTabs : scenarioWorkbenchTabs;
  return {
    scenario,
    template,
    tabs: tabs.map((tab) => ({ ...tab, href: `${baseHref}${tab.href}` })),
    lifecycle: scenarioLifecycle,
    dataSources: scenarioDataSources.filter((source) => source.scenarioId === scenario.id),
    tasks: processingTasks.filter((task) => task.scenarioId === scenario.id),
    knowledgeObjects: knowledgeSpaceObjects.filter((object) => object.linkedScenarioId === scenario.id),
    outputs: scenarioOutputs.filter((output) => output.scenarioId === scenario.id),
    settings: scenarioSettings.find((setting) => setting.scenarioId === scenario.id) ?? scenarioSettings[0]
  };
}

export function createScenarioDraft(input: { templateId: string; name: string; visibility: Visibility; fileNames: string[]; description?: string; processingGoal?: string }) {
  const template = templateById(input.templateId) ?? customScenarioTemplate;
  const instance: ScenarioInstance = {
    id: `draft-${input.templateId}`,
    templateId: template.id,
    name: input.name,
    description: input.description?.trim() || template.headline,
    owner: "Current user",
    visibility: input.visibility,
    status: "submitted",
    sourceCount: input.fileNames.length,
    updatedAt: "just now",
    readyActions: template.outputCapabilities,
    recommendedQuestions: template.suggestedQuestions
  };
  const task: ProcessingTask = {
    id: `task-${instance.id}`,
    scenarioId: instance.id,
    title: `Create ${template.name}`,
    status: "submitted",
    kind: "Admin review",
    ragMode: ragModeForTemplate(template),
    visibility: input.visibility,
    owner: "Current user",
    submittedAt: "just now",
    updatedAt: "just now",
    files: input.fileNames,
    waitingFor: input.fileNames.length > 0 ? "Admin" : "You",
    progress: 18,
    currentStep: "Waiting for the admin console to confirm the processing approach",
    userMessage: input.fileNames.length > 0
      ? `The file pack is submitted; the admin console will confirm material quality and choose the processing approach. Requested outcome: ${input.processingGoal?.trim() || "answers you can question, cited evidence, and a business deliverable."}`
      : "The scenario exists but needs a file pack before the admin console can start processing.",
    nextActions: ["View task center", "Keep uploading files", "Wait for admin confirmation"],
    adminEntry: input.fileNames.length > 0 ? "Waiting for an admin to choose the RAG processing mode and confirm ingest" : "Waiting for the user to add files"
  };
  const knowledge: KnowledgeSpaceObject = {
    id: `knowledge-${instance.id}`,
    mode: "wiki",
    title: instance.name,
    summary: "It appears in the knowledge space once processing finishes.",
    sourceLabel: template.name,
    linkedScenarioId: instance.id,
    visibility: instance.visibility,
    owner: instance.owner,
    permissionNote: permissionNoteForVisibility(instance.visibility),
    updatedAt: "just now",
    actions: template.outputCapabilities
  };
  return { instance, task, knowledge };
}

export function visibleFrontendText(): string {
  return [
    ...frontstageNav.map((item) => item.label),
    ...workspaceNav.flatMap((item) => [item.label, item.description]),
    workspaceProfile.organizationName,
    workspaceProfile.workspaceName,
    ...officialTemplates.flatMap((template) => [
      template.name,
      template.headline,
      ...template.bestFor,
      ...template.inputExamples,
      template.demoWalkthrough.scenarioName,
      template.demoWalkthrough.sampleQuestion,
      template.demoWalkthrough.sampleAnswer
    ]),
    ...scenarioInstances.flatMap((scenario) => [scenario.name, scenario.description]),
    ...scenarioOutputs.flatMap((output) => [output.type, output.title, output.summary])
  ].join("\n");
}
