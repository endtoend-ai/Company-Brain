export const adminNav = [
  { label: "Overview", href: "/admin" },
  { label: "Template Governance", href: "/admin/templates" },
  { label: "Knowledge Assets", href: "/admin/knowledge-bases" },
  { label: "Retrieval Policies", href: "/admin/strategies" },
  { label: "Processing Pipelines", href: "/admin/pipelines" },
  { label: "Monitoring", href: "/admin/monitoring" },
  { label: "Knowledge Graph", href: "/admin/graph" },
  { label: "Quality Evaluation", href: "/admin/evaluations" },
  { label: "Integrations", href: "/admin/settings" },
  { label: "Audit Log", href: "/admin/audit" }
];

export const adminTemplates = [
  { id: "customer-360", name: "Customer 360 Brief", owner: "Sales Ops", state: "已发布", defaultStrategy: "Strict evidence answers", reviewPolicy: "必须复核", inputs: ["Spreadsheet data", "CRM export", "Meeting notes"], evidenceCoverage: 100, evidenceSources: ["Official template research", "Knowledge platform product docs"], demoReadiness: 100, demoScenarioName: "Northwind Labs Renewal Brief", sampleQuestion: "What are the current renewal risks and opportunities for this account?", productForms: ["Report generation", "Knowledge graph"], limitations: ["Depends on the freshness of CRM data and meeting notes"], impact: "Used for renewals, expansion, and customer risk judgment" },
  { id: "support-agent", name: "Support Knowledge Agent", owner: "Customer Success", state: "已发布", defaultStrategy: "Evidence first", reviewPolicy: "抽样复核", inputs: ["FAQs", "Help center", "Ticket export"], evidenceCoverage: 100, evidenceSources: ["Support bot case studies", "Knowledge platform product docs"], demoReadiness: 100, demoScenarioName: "Orders & Invoicing Support Agent", sampleQuestion: "The customer says the order is three days late. How should support reply?", productForms: ["Embedded assistant", "Support Q&A"], limitations: ["Refusals and human handoff must be verified before launch"], impact: "Used for embedded support replies" },
  { id: "personal-wiki", name: "Personal Knowledge Wiki", owner: "Knowledge Ops", state: "已发布", defaultStrategy: "Knowledge page navigation", reviewPolicy: "无需复核", inputs: ["Note documents", "Document files", "Web excerpts"], evidenceCoverage: 86, evidenceSources: ["Knowledge base template research", "Knowledge base product forms"], demoReadiness: 88, demoScenarioName: "Maya's Sales Notes Wiki", sampleQuestion: "What are the most common customer objections in these notes?", productForms: ["Knowledge portal", "Q&A"], limitations: ["Not suitable for producing a formal external document directly"], impact: "Used for personal and small-team knowledge capture" },
  { id: "risk-investigation", name: "Relationship Risk Investigation", owner: "Risk & Compliance", state: "审核中", defaultStrategy: "Graph risk expansion", reviewPolicy: "必须复核", inputs: ["Contracts", "Vendor list", "Incident records"], evidenceCoverage: 72, evidenceSources: ["Graph retrieval research", "Due diligence process"], demoReadiness: 76, demoScenarioName: "Skyline Networks Relationship Risk Investigation", sampleQuestion: "What related risks does this vendor carry?", productForms: ["Knowledge graph", "Investigation report"], limitations: ["Low-confidence relationships cannot be stated as conclusions"], impact: "Used to identify high-risk relationships" },
  { id: "policy-evidence", name: "Policy & Evidence Q&A", owner: "People & Workplace", state: "已发布", defaultStrategy: "Policy answers", reviewPolicy: "抽样复核", inputs: ["Policy documents", "Announcements", "Employee handbook"], evidenceCoverage: 92, evidenceSources: ["Enterprise knowledge base practice", "Policy Q&A case studies"], demoReadiness: 90, demoScenarioName: "Travel & Expense Policy Q&A", sampleQuestion: "What is the hotel reimbursement cap in San Francisco?", productForms: ["Knowledge portal", "Employee Q&A"], limitations: ["The policy version and interpretation basis must be explicit"], impact: "Used for employee policy Q&A" }
];

export const strategyProfiles = [
  { id: "traditional-evidence-first", name: "Evidence-first Retrieval", scope: "Naive RAG", impact: "Official documents first, fuller citations, moderate latency; maps to document evidence in the workspace.", controls: ["Strict citations", "Official documents first", "8 results"] },
  { id: "graph-risk-expansion", name: "Graph Risk Expansion", scope: "GraphRAG", impact: "Suited to multi-hop relationships, risk events, and customer profiles; maps to the relationship graph in the workspace.", controls: ["Max 3 hops", "Flag low confidence", "Evidence required"] },
  { id: "nano-wiki-navigation", name: "Compiled Knowledge Navigation", scope: "Gbrain", impact: "Suited to handbooks, study guides, and personal knowledge bases; maps to the knowledge wiki in the workspace.", controls: ["Page depth 2", "Cross-link navigation", "Facts first"] },
  { id: "company-strict-evidence", name: "Strict Evidence Answers", scope: "公司大脑", impact: "Suited to external sends and high-risk questions", controls: ["High confidence bar", "Refuse without evidence", "Citations first"] }
];

export const adminOperationSummary = [
  { area: "pipelines", label: "Pending requests", status: "watch", count: 4 },
  { area: "templates", label: "Template governance", status: "healthy", count: 10 },
  { area: "knowledge-bases", label: "Knowledge assets", status: "healthy", count: 38 },
  { area: "strategies", label: "Retrieval policies", status: "healthy", count: 12 },
  { area: "graph", label: "Knowledge graph", status: "watch", count: 1 },
  { area: "evaluations", label: "Quality evaluation", status: "healthy", count: 24 },
  { area: "settings", label: "Integrations", status: "watch", count: 5 },
  { area: "audit", label: "Audit log", status: "healthy", count: 96 }
];

export type AdminIntegrationSettings = {
  checked_at: string;
  overall_status: "ready" | "degraded" | "blocked";
  providers: Array<{
    id: string;
    label: string;
    provider: string;
    base_url: string | null;
    model: string | null;
    dimensions?: number | null;
    secrets: Array<{ env_name: string; configured: boolean; fingerprint: string | null }>;
    controls: string[];
  }>;
  parsers: Array<{
    id: string;
    label: string;
    base_url: string | null;
    model_version: string | null;
    language: string | null;
    options: string[];
    secrets: Array<{ env_name: string; configured: boolean; fingerprint: string | null }>;
  }>;
  modules: Array<{
    id: string;
    label: string;
    base_url: string;
    status: "ok" | "error" | "unknown";
    service: string;
    required_env: string[];
    role: string;
  }>;
  databases: Array<{
    id: string;
    label: string;
    env_name: string;
    configured: boolean;
    host: string | null;
    port: string | null;
    database: string | null;
    username: string | null;
  }>;
  runtime_policies: Array<{
    label: string;
    value: string;
    impact: string;
    key?: "rerankTopN" | "rerankMinScore" | "perSourceTimeoutMs" | "sourceFanout" | "candidatePoolSize";
    source?: "db" | "env" | "default";
    numeric?: { value: number; min: number; max: number; step: number; unit?: string };
  }>;
  engine_retrieval: Array<{
    engine: string;
    label: string;
    topK: number | null;
    source: "db" | "default";
    min: number;
    max: number;
    default_hint: string;
    minScore: number | null;
    minScoreSource: "db" | "default";
    minScoreMin: number;
    minScoreMax: number;
    supportsMinScore: boolean;
  }>;
};

export const adminIntegrationSettings: AdminIntegrationSettings = {
  checked_at: "Pending unified API connection",
  overall_status: "degraded",
  providers: [
    {
      id: "agent",
      label: "Answer model",
      provider: "openai-compatible",
      base_url: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash",
      secrets: [{ env_name: "AGENT_API_KEY", configured: true, fingerprint: "...****" }],
      controls: ["Temperature 0", "Do not record streaming usage"]
    },
    {
      id: "embedding",
      label: "Embedding model",
      provider: "openai-compatible",
      base_url: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3-embedding-8b",
      dimensions: 4096,
      secrets: [{ env_name: "EMBEDDING_API_KEY", configured: true, fingerprint: "...****" }],
      controls: ["Used for document chunking, graph retrieval, and company-wide recall"]
    }
  ],
  parsers: [
    {
      id: "mineru",
      label: "PDF parser service",
      base_url: "https://mineru.net",
      model_version: "vlm",
      language: "ch",
      options: ["Extract tables", "Extract formulas", "Prefer embedded document text"],
      secrets: [{ env_name: "MINERU_API_KEY", configured: true, fingerprint: "...****" }]
    }
  ],
  modules: [
    { id: "nano-brain", label: "Gbrain service", base_url: "http://127.0.0.1:8100", status: "unknown", service: "nano-brain", required_env: ["RAG_INTERNAL_TOKEN", "NANO_BRAIN_HTTP_URL"], role: "Compiled knowledge organization, knowledge page navigation, fact capture" },
    { id: "traditional-rag", label: "Naive RAG service", base_url: "http://127.0.0.1:8101", status: "unknown", service: "traditional-rag", required_env: ["RAG_INTERNAL_TOKEN", "TRADITIONAL_RAG_HTTP_URL"], role: "Document chunking, vector retrieval, evidence-based Q&A" },
    { id: "graph-rag", label: "GraphRAG service", base_url: "http://127.0.0.1:8102", status: "unknown", service: "graph-rag", required_env: ["RAG_INTERNAL_TOKEN", "GRAPH_RAG_HTTP_URL"], role: "Entity relationships, risk chains, multi-hop graph retrieval" }
  ],
  databases: [
    { id: "identity", label: "Accounts and permissions", env_name: "IDENTITY_DATABASE_URL", configured: true, host: "localhost", port: "5432", database: "ff_identity", username: "muyu" },
    { id: "traditional-rag", label: "Naive RAG document database", env_name: "TRADITIONAL_RAG_DATABASE_URL", configured: true, host: "localhost", port: "5432", database: "ff_traditional_rag", username: "muyu" },
    { id: "graph-rag", label: "GraphRAG graph database", env_name: "GRAPH_RAG_DATABASE_URL", configured: true, host: "localhost", port: "5432", database: "ff_graph_rag", username: "muyu" }
  ],
  runtime_policies: [
    { label: "Internal call token", value: "Configured", impact: "Required when the unified API calls a knowledge processing module" },
    { label: "Document storage directory", value: ".traditional-rag-storage", impact: "Stores uploaded files, MinerU results, and extracted images" }
  ],
  engine_retrieval: [
    { engine: "Gbrain", label: "Gbrain", topK: null, source: "default", min: 1, max: 30, default_hint: "When unset, each retrieval path uses its own default: company-wide recall 4 / recall verification 3 / scenario Q&A 5", minScore: null, minScoreSource: "default", minScoreMin: 0, minScoreMax: 1, supportsMinScore: false },
    { engine: "Naive RAG", label: "Naive RAG", topK: null, source: "default", min: 1, max: 30, default_hint: "When unset, each retrieval path uses its own default: company-wide recall 4 / recall verification 3 / scenario Q&A 5", minScore: null, minScoreSource: "default", minScoreMin: 0, minScoreMax: 1, supportsMinScore: true },
    { engine: "GraphRAG", label: "GraphRAG", topK: null, source: "default", min: 1, max: 30, default_hint: "When unset, each retrieval path uses its own default: company-wide recall 4 / recall verification 3 / scenario Q&A 5", minScore: null, minScoreSource: "default", minScoreMin: 0, minScoreMax: 1, supportsMinScore: false }
  ]
};

export const adminGraphSnapshot = {
  nodes: [
    { id: "ff", label: "Northwind Labs", type: "Customer", health: "watch" },
    { id: "zl", label: "Maya Chen", type: "Owner", health: "good" },
    { id: "wh", label: "David Park, CTO", type: "Key stakeholder", health: "good" },
    { id: "contract", label: "Annual master agreement", type: "Contract", health: "watch" },
    { id: "expansion", label: "Phase 2 expansion", type: "Opportunity", health: "good" },
    { id: "risk", label: "Engagement stalled", type: "Risk", health: "risk" }
  ],
  edges: [
    { source: "ff", target: "zl", label: "Owner", confidence: 0.86, evidence: "CRM account table" },
    { source: "ff", target: "wh", label: "Key decision maker", confidence: 0.91, evidence: "Meeting notes" },
    { source: "ff", target: "contract", label: "In renewal", confidence: 0.88, evidence: "Contract records" },
    { source: "contract", target: "expansion", label: "Bound to expansion", confidence: 0.81, evidence: "Sales opportunity table" },
    { source: "ff", target: "risk", label: "At risk", confidence: 0.76, evidence: "Engagement timeline" },
    { source: "wh", target: "expansion", label: "Driving", confidence: 0.72, evidence: "Public signals" }
  ]
};

export const adminAuditEvents = [
  { id: "audit-1", actor: "admin@northwindlabs.com", area: "模板治理", summary: "Published the Customer 360 brief template", impact: "The workspace can now create customer analysis scenarios", time: "2026-06-25 10:30" },
  { id: "audit-2", actor: "ops@northwindlabs.com", area: "检索策略", summary: "Enabled strict evidence answers", impact: "High-risk questions must keep citations", time: "2026-06-25 10:10" },
  { id: "audit-3", actor: "qa@northwindlabs.com", area: "质量验证", summary: "Finished the support policy comparison run", impact: "The support template keeps the evidence-first policy", time: "2026-06-25 09:45" },
  { id: "audit-4", actor: "risk@northwindlabs.com", area: "关系图谱", summary: "Adjusted the risk relationship threshold", impact: "Low-confidence relationships go to human review", time: "2026-06-25 09:30" },
  { id: "audit-5", actor: "system@northwindlabs.com", area: "处理管线", summary: "Retried the security questionnaire task", impact: "The questionnaire answer pack was regenerated", time: "2026-06-25 09:10" }
];

export const knowledgeBaseInventory = [
  { name: "Maya Chen's personal knowledge base", module: "Gbrain", status: "正常", volume: "184 pages", owner: "Maya Chen", visibility: "个人", access: "Visible only to the owner and admins", policy: "Maps to the knowledge wiki in the workspace and never enters team or company-wide recall" },
  { name: "Sales team knowledge handbook", module: "Gbrain", status: "正常", volume: "1,340 pages", owner: "Sales Ops", visibility: "团队", access: "Visible to Sales team members", policy: "Cross-team recall requires admin authorization" },
  { name: "Customer relationship base", module: "GraphRAG", status: "正常", volume: "12,480 objects", owner: "Sales Ops", visibility: "团队", access: "Visible to Sales and Customer Success", policy: "Relationship edges carry source and confidence" },
  { name: "Contracts and clauses", module: "Naive RAG", status: "观察", volume: "2,160 documents", owner: "Legal", visibility: "公司", access: "Retrievable by company-level scenarios", policy: "Original citations are mandatory" },
  { name: "Relationship risk base", module: "GraphRAG", status: "需更新", volume: "8,920 relationships", owner: "Risk & Compliance", visibility: "团队", access: "Visible to the Risk & Compliance team", policy: "Low-confidence relationships must be reviewed" }
];

export const adminDashboardHealthCards = [
  {
    id: "postgres",
    label: "Relational databases",
    status: "正常",
    value: `${adminIntegrationSettings.databases.filter((item) => item.configured).length}/${adminIntegrationSettings.databases.length}`,
    detail: "Accounts and permissions, Naive RAG, and GraphRAG storage are connected",
    route: "/admin/settings"
  },
  {
    id: "model",
    label: "Answer model",
    status: "正常",
    value: adminIntegrationSettings.providers.find((item) => item.id === "agent") ? "Primary model" : "Not configured",
    detail: "Shared by answer generation, task explanations, and admin review suggestions",
    route: "/admin/settings"
  },
  {
    id: "embedding",
    label: "Embedding model",
    status: "正常",
    value: `${adminIntegrationSettings.providers.find((item) => item.id === "embedding")?.dimensions ?? 0} dims`,
    detail: "Used for document chunking, graph recall, and CompanyBrain retrieval",
    route: "/admin/settings"
  },
  {
    id: "parser",
    label: "Document parsing",
    status: "观察",
    value: adminIntegrationSettings.parsers[0] ? "Layout recognition" : "Not configured",
    detail: "PDF, table, and formula extraction need task-level review",
    route: "/admin/settings"
  },
  {
    id: "rag-services",
    label: "Knowledge processing chain",
    status: "观察",
    value: "2/3",
    detail: "Gbrain and Naive RAG are running; GraphRAG needs review",
    route: "/admin/pipelines"
  }
];

export const adminDashboardDataOverview = [
  { scope: "个人", total: 184, unit: "pages", module: "Gbrain", owner: "Maya Chen", health: "正常", policy: "Maps to the knowledge wiki in the workspace and never enters team or company-wide recall" },
  { scope: "团队", total: 14720, unit: "objects", module: "Gbrain / GraphRAG", owner: "Sales Ops, Risk & Compliance", health: "观察", policy: "Cross-team recall requires admin authorization" },
  { scope: "公司", total: 2160, unit: "documents", module: "Naive RAG", owner: "Legal", health: "正常", policy: "Original citations and publish review records are mandatory" }
];

export const adminDashboardRiskItems = [
  { label: "Company-level publishing gate", severity: "高", count: 1, detail: "The contracts and clauses library can be recalled company-wide, so original citations are mandatory." },
  { label: "Low-confidence graph edges", severity: "中", count: 1, detail: "The relationship risk base needs its low-confidence relationships reviewed so errors do not spread into customer profiles." },
  { label: "待管理员确认资料包", severity: "中", count: 3, detail: "After a workspace submission, the permission scope, material quality, and RAG engine policy all need confirmation." },
  { label: "Integration watch items", severity: "低", count: 2, detail: "MinerU and the relationship graph service are in a watching or needs-review state." }
];

export const pipelineTimeline = [
  { stage: "Receive files", status: "done", message: "Uploaded files are registered as asset records" },
  { stage: "Extract content", status: "done", message: "Documents, tables, and relationship objects are parsed" },
  { stage: "Build sources", status: "running", message: "Generating citable sources and relationship objects" },
  { stage: "Generate knowledge objects", status: "queued", message: "Waiting for the previous stage to finish" }
];

export const adminPipelineWorkflowSteps = [
  { id: "verify", label: "Verify files", description: "Confirm the files, purpose, and completeness", state: "done" },
  { id: "strategy", label: "Engine policy", description: "Choose the real RAG ingest and retrieval engine", state: "active" },
  { id: "publish", label: "Permissions and publishing", description: "Confirm the personal, team, and company boundaries", state: "pending" },
  { id: "confirm", label: "Confirm ingest", description: "Run the ingest and sync the workspace status", state: "pending" }
];

export const adminActionableRequestStatuses = ["待管理员确认", "等待复核", "处理中"] as const;

export function isActionableAdminRequestStatus(status: string) {
  return adminActionableRequestStatuses.includes(status as (typeof adminActionableRequestStatuses)[number]);
}

export function resolveAdminFilePreview(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return { kind: "PDF", label: "PDF document", previewable: true, extension };
  if (["doc", "docx"].includes(extension)) return { kind: "DOC", label: "Word document", previewable: true, extension };
  if (["md", "markdown"].includes(extension)) return { kind: "MD", label: "Markdown", previewable: true, extension };
  if (["xls", "xlsx", "csv"].includes(extension)) return { kind: extension === "csv" ? "CSV" : "XLS", label: "Spreadsheet data", previewable: true, extension };
  if (extension === "json") return { kind: "JSON", label: "Structured data", previewable: true, extension };
  if (["txt", "text"].includes(extension)) return { kind: "TXT", label: "Text file", previewable: true, extension };
  if (["zip", "rar", "7z"].includes(extension)) return { kind: "ZIP", label: "Reference pack archive", previewable: false, extension };
  return { kind: "FILE", label: "File", previewable: false, extension };
}

export const adminIntakeRequests = [
  {
    id: "request-custom-001",
    scenarioName: "Custom business scenario",
    requester: "Maya Chen",
    visibility: "个人",
    submittedAt: "just now",
    status: "待管理员确认",
    files: ["Business notes.md", "Reference pack.zip"],
    requestedOutcome: "Have the admin console confirm the material structure and choose a suitable RAG ingest and retrieval engine.",
    recommendedModes: ["知识百科", "文档证据", "关系图谱"],
    recommendedEngines: ["Gbrain", "Naive RAG", "GraphRAG"],
    selectedMode: "待选择",
    selectedEngine: "待选择",
    frontstageMapping: "Maps to the workspace as: knowledge wiki / document evidence / relationship graph.",
    permissionImpact: "If it is ingested at personal scope, team and company-wide Q&A will not recall these files.",
    actions: ["查看资料", "配置引擎策略", "确认入库", "退回补充"]
  },
  {
    id: "request-contract-042",
    scenarioName: "SaaS subscription contract review",
    requester: "Daniel Kim",
    visibility: "公司",
    submittedAt: "Today 10:30",
    status: "等待复核",
    files: ["Northwind Labs subscription agreement.pdf", "Legal clause review checklist.md"],
    requestedOutcome: "Generate risky clauses, missing clauses, and replacement suggestions.",
    recommendedModes: ["文档证据"],
    recommendedEngines: ["Naive RAG"],
    selectedMode: "文档证据",
    selectedEngine: "Naive RAG",
    frontstageMapping: "Maps to the workspace as: document evidence.",
    permissionImpact: "The company-level contract library is retrievable, but answers must keep the original citations.",
    actions: ["打开证据切片", "复核引用", "发布场景"]
  },
  {
    id: "request-risk-017",
    scenarioName: "Skyline Networks relationship risk investigation",
    requester: "Priya Shah",
    visibility: "团队",
    submittedAt: "Today 09:20",
    status: "处理中",
    files: ["Skyline Networks vendor list.csv", "Historical risk events.txt", "Skyline Networks relationship records.json"],
    requestedOutcome: "Extract company, person, project, and risk-event relationships and generate the investigation report.",
    recommendedModes: ["关系图谱", "文档证据"],
    recommendedEngines: ["GraphRAG", "Naive RAG"],
    selectedMode: "关系图谱",
    selectedEngine: "GraphRAG",
    frontstageMapping: "Maps to the workspace as: relationship graph / document evidence.",
    permissionImpact: "Visible to the Risk & Compliance team; cross-team access needs admin authorization.",
    actions: ["查看图谱抽取", "调整实体类型", "运行关系构建"]
  }
];

export const ragOperationModes = [
  {
    id: "nano-brain",
    label: "Gbrain",
    frontstageLabel: "知识百科",
    service: "Compiled knowledge organization engine",
    status: "可运行",
    purpose: "Compile personal and team material into structured knowledge pages, outlines, fact cards, and a knowledge space you can question.",
    bestFor: ["Personal knowledge base", "Team knowledge handbook", "Research study guide"],
    controls: ["Page granularity", "Link depth", "Fact extraction", "Outline generation", "Publish mapping"],
    storage: "Knowledge pages / facts / cross-links",
    reviewGate: "Maps to the knowledge wiki in the workspace; personal wikis publish automatically, team handbooks need owner review",
    stages: ["Parse notes and documents", "Extract facts and headings", "Generate knowledge pages", "Build cross-links", "Publish to the knowledge space"],
    inspector: ["Suited to knowledge capture, handbooks, and personal knowledge bases", "Published wikis are used in the workspace as knowledge pages and Q&A", "Team scope requires a confirmed owner and visible members"],
    runtimeFlow: [
      { stage: "Parse material", description: "Read Markdown, notes, and document bodies while keeping heading levels and cited sources.", artifact: "Parsed text" },
      { stage: "Extract facts", description: "Extract reusable facts, definitions, conclusions, and topics worth following up.", artifact: "Fact cards" },
      { stage: "Generate knowledge pages", description: "Generate browsable knowledge pages at outline granularity and merge duplicate passages.", artifact: "Knowledge page drafts" },
      { stage: "Build cross-links", description: "Cross-link topics, people, projects, and terms.", artifact: "Bidirectional links" },
      { stage: "Publish mapping", description: "Sync knowledge pages, fact cards, and sources to the workspace knowledge wiki.", artifact: "Knowledge wiki" }
    ],
    parameters: [
      { key: "page_granularity", label: "Page granularity", type: "select", value: "Topic level", options: ["Paragraph level", "Topic level", "Document level"], description: "Sets how much knowledge one page holds; finer pages suit follow-up questions, coarser pages suit reading." },
      { key: "link_depth", label: "Link depth", type: "number", value: "2", min: 1, max: 4, unit: "levels", description: "Controls how far automatic cross-linking expands so pages are not over-connected." },
      { key: "fact_extraction", label: "Fact extraction", type: "select", value: "Strict", options: ["Loose", "Standard", "Strict"], description: "Strict mode only captures facts that have a supporting source." },
      { key: "outline_strategy", label: "Outline strategy", type: "select", value: "Automatic outline", options: ["Keep the original outline", "Automatic outline", "Regroup by topic"], description: "Decides whether page navigation follows the source document or is rebuilt." },
      { key: "publish_mapping", label: "Publish mapping", type: "select", value: "Knowledge wiki", options: ["Knowledge wiki", "Knowledge wiki + Q&A scenario"], description: "Decides the business form available in the workspace after ingest." }
    ],
    qualityGates: [
      { label: "Source coverage", value: "Every knowledge page cites at least 2 sources", status: "必须通过" },
      { label: "Fact deduplication", value: "Duplicate facts are merged before publishing", status: "建议复核" },
      { label: "Permission boundary", value: "Personal knowledge pages never enter team or company-wide recall", status: "必须通过" }
    ],
    previewOutputs: [
      { label: "Knowledge page preview", description: "Inspect the generated titles, summaries, bodies, and citations." },
      { label: "Fact cards", description: "Check the key facts that Q&A can recall." },
      { label: "Cross-link network", description: "Preview the topic links between knowledge pages." }
    ],
    assetViews: [
      { kind: "wiki", label: "Knowledge pages", metric: "18 pages", description: "Generate a browsable wiki by topic that keeps titles, summaries, bodies, and sources.", action: "View knowledge pages" },
      { kind: "fact", label: "Fact cards", metric: "64 cards", description: "Capture definitions, conclusions, people, and project facts that Q&A can recall.", action: "View facts" },
      { kind: "link", label: "Cross-links", metric: "42 links", description: "Show bidirectional links and citation paths between knowledge pages.", action: "View cross-links" },
      { kind: "source", label: "Source index", metric: "6 sources", description: "Every knowledge page traces back to the original document passages.", action: "View sources" }
    ]
  },
  {
    id: "traditional-rag",
    label: "Naive RAG",
    frontstageLabel: "文档证据",
    service: "Document chunking and vector retrieval engine",
    status: "可运行",
    purpose: "Process PDF, Word, spreadsheet, and policy documents to generate cited answers and review results.",
    bestFor: ["Policy Q&A", "Contract review", "RFP questionnaire response"],
    controls: ["Chunk size", "Overlap window", "TopK", "Citation threshold", "Refuse without evidence"],
    storage: "Documents / chunks / vectors / citations",
    reviewGate: "Maps to document evidence in the workspace; company-level material must pass citation and refusal review",
    stages: ["Parse documents", "Chunk and clean", "Vectorize", "Index citations", "Validate answer boundaries"],
    inspector: ["Suited to policies, contracts, questionnaires, and citable answers", "Original sources and refusal boundaries are mandatory", "Company-level publishing requires a citation spot check"],
    runtimeFlow: [
      { stage: "Parse documents", description: "Parse PDF, Word, and spreadsheet bodies with page numbers to form locatable sources.", artifact: "Parsed text" },
      { stage: "Chunk and clean", description: "Split passages by chunk size and overlap and remove headers, footers, and duplicates.", artifact: "Document chunks" },
      { stage: "Vectorize", description: "Call the embedding model to build the semantic index, keeping file, page, and passage positions.", artifact: "Vector index" },
      { stage: "Index citations", description: "Build the source passages that answers can cite, with original-text highlighting.", artifact: "Cited evidence" },
      { stage: "Validate boundaries", description: "Test TopK, thresholds, and the refusal policy with real business questions.", artifact: "Recall verification report" }
    ],
    parameters: [
      { key: "chunk_size", label: "Chunk Size", type: "number", value: "800", min: 300, max: 1600, unit: "tokens", description: "Size of a single chunk; affects recall granularity and citation accuracy." },
      { key: "chunk_overlap", label: "Overlap", type: "number", value: "120", min: 0, max: 300, unit: "tokens", description: "Overlap between adjacent chunks; reduces answers lost across boundaries." },
      { key: "top_k", label: "TopK", type: "number", value: "8", min: 3, max: 20, unit: "items", description: "Number of candidate evidence items retrieved per query." },
      { key: "citation_threshold", label: "Citation threshold", type: "number", value: "0.78", min: 0.4, max: 0.95, unit: "", description: "Chunks below the threshold are not cited in the answer." },
      { key: "no_answer_policy", label: "Refusal policy", type: "select", value: "Strict refusal", options: ["Answer loosely", "Flag uncertainty", "Strict refusal"], description: "How the workspace responds when there is not enough evidence." },
      { key: "rerank", label: "Rerank", type: "boolean", value: "true", description: "Enable reranking for more stable evidence ordering." }
    ],
    qualityGates: [
      { label: "Citation spot check", value: "Answer citations must open the original passage", status: "必须通过" },
      { label: "Refusal boundary", value: "Questions without evidence must not produce a fixed conclusion", status: "必须通过" },
      { label: "Chunk coverage", value: "Core chapters must all be indexed", status: "建议复核" }
    ],
    previewOutputs: [
      { label: "Chunk passages", description: "Inspect the split passages, page numbers, and sources." },
      { label: "Citation preview", description: "Preview how the answer matches and highlights evidence." },
      { label: "Recall verification report", description: "Compare how TopK, thresholds, and the refusal policy perform." }
    ],
    assetViews: [
      { kind: "chunk", label: "Document chunks", metric: "126 chunks", description: "Inspect each chunk's body, page number, source file, and overlap boundary.", action: "View chunks" },
      { kind: "embedding", label: "Vector index", metric: "126 vectors", description: "Inspect index batches, model dimensions, and vectorization status.", action: "View index" },
      { kind: "citation", label: "Cited evidence", metric: "38 items", description: "Preview the highlighted passages and original locations answers can cite.", action: "View citations" },
      { kind: "eval", label: "Recall hits", metric: "8 questions", description: "Check how TopK, thresholds, and the refusal policy perform on business questions.", action: "View recall tests" }
    ]
  },
  {
    id: "graph-rag",
    label: "GraphRAG",
    frontstageLabel: "关系图谱",
    service: "Entity relationship and multi-hop retrieval engine",
    status: "需复核",
    purpose: "Extract entities, events, and relationships to support multi-hop reasoning, customer profiles, and risk investigations.",
    bestFor: ["Customer 360", "Relationship risk investigation", "Domain relationship base"],
    controls: ["Entity types", "Relationship types", "Max hops", "Low-confidence flag", "Community summary"],
    storage: "Entities / relationships / communities / graph index",
    reviewGate: "Maps to the relationship graph in the workspace; low-confidence relationships need human confirmation before publishing",
    stages: ["Extract entities", "Extract relationships", "Disambiguate and merge", "Summarize communities", "Validate graph retrieval"],
    inspector: ["Suited to customer profiles, relationship risk, and multi-hop analysis", "Low-confidence entities and relationships go to human review", "Cross-team publishing requires confirmed relationship sources and permission boundaries"],
    runtimeFlow: [
      { stage: "Extract entities", description: "Identify companies, people, projects, contracts, events, and risk signals.", artifact: "Entity candidates" },
      { stage: "Extract relationships", description: "Extract ownership, participation, influence, risk, and opportunity relationships with bound source evidence.", artifact: "Relationship candidates" },
      { stage: "Disambiguate and merge", description: "Merge same-name objects and flag low-confidence entities and conflicting relationships.", artifact: "Review checklist" },
      { stage: "Summarize communities", description: "Generate graph community summaries by customer, project, or risk theme.", artifact: "Community reports" },
      { stage: "Validate graph retrieval", description: "Test relationship paths, evidence chains, and permission boundaries with multi-hop questions.", artifact: "Relationship recall tests" }
    ],
    parameters: [
      { key: "entity_schema", label: "Entity scope", type: "select", value: "Customer/Person/Project/Event", options: ["Generic entities", "Customer/Person/Project/Event", "Contract/Clause/Risk", "Custom schema"], description: "Defines which object types this graph extracts." },
      { key: "relation_schema", label: "Relationship scope", type: "select", value: "Owner/Related/Risk/Opportunity", options: ["Generic relationships", "Owner/Related/Risk/Opportunity", "Contract/Obligation/Breach", "Custom relationships"], description: "Defines which relationship types can be created between objects." },
      { key: "max_hops", label: "Max hops", type: "number", value: "3", min: 1, max: 5, unit: "hops", description: "How far multi-hop retrieval can travel; larger values surface indirect leads more easily." },
      { key: "min_confidence", label: "Confidence threshold", type: "number", value: "0.72", min: 0.4, max: 0.95, unit: "", description: "Entities or relationships below the threshold go to human review." },
      { key: "community_summary", label: "Community summary", type: "boolean", value: "true", description: "Generate readable summaries for dense relationship areas to support global questions." },
      { key: "evidence_required", label: "Evidence required", type: "boolean", value: "true", description: "Relationships without a supporting source passage must not be published." }
    ],
    qualityGates: [
      { label: "Low-confidence review", value: "Entities and relationships below the threshold need human confirmation", status: "必须通过" },
      { label: "Evidence binding", value: "Every relationship links to at least one source passage", status: "必须通过" },
      { label: "Permission propagation", value: "Relationship edges must not leak material across the submitted scope", status: "必须通过" }
    ],
    previewOutputs: [
      { label: "Objects and relationships", description: "Inspect the extracted entities, relationships, and evidence." },
      { label: "Relationship paths", description: "Preview multi-hop paths between customers, projects, and risks." },
      { label: "Community summaries", description: "Inspect topic summaries for dense relationship areas." }
    ],
    assetViews: [
      { kind: "entity", label: "Entity table", metric: "76 objects", description: "Inspect customers, people, projects, contracts, events, and risk signals.", action: "View entities" },
      { kind: "relationship", label: "Relationship edges", metric: "132 edges", description: "Inspect each relationship's type, confidence, and cited evidence.", action: "View relationships" },
      { kind: "graph", label: "Knowledge graph", metric: "4 communities", description: "Inspect multi-hop paths, community summaries, and low-confidence nodes on the graph canvas.", action: "Open the graph" },
      { kind: "review", label: "Review checklist", metric: "11 items", description: "Work through low-confidence entities, conflicting relationships, and cross-permission boundaries.", action: "View review items" }
    ]
  }
];

export const evaluationRows = [
  { profile: "Evidence first", score: 82, evidence: 6, latency: "1.4s" },
  { profile: "Strict evidence answers", score: 88, evidence: 9, latency: "1.8s" }
];
