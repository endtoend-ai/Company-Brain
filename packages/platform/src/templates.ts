import type { ScenarioTemplate, TemplateDemoWalkthrough, TemplateModulePlan, TemplateProductForm } from "./types";

export const OFFICIAL_TEMPLATE_IDS = [
  "personal-wiki",
  "team-handbook",
  "policy-evidence",
  "contract-playbook",
  "rfp-security",
  "customer-360",
  "risk-investigation",
  "domain-relationship",
  "support-agent",
  "research-guide",
  "data-analyst",
  "it-runbook",
  "meeting-media-memory",
  "voice-of-customer"
] as const;

const now = new Date("2026-06-25T00:00:00.000Z");

const evidenceSources = [
  "_research/official-template-best-practice-research.md",
  "https://docs.dify.ai/en/use-dify/knowledge/knowledge-pipeline/create-knowledge-pipeline",
  "https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html"
];

const plans: Record<string, TemplateModulePlan[]> = {
  "personal-wiki": [{ moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/personal-wiki", ingestMode: "nano_page", required: true }],
  "team-handbook": [{ moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/team-handbook", ingestMode: "nano_page", required: true }],
  "policy-evidence": [{ moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/policy-evidence", ingestMode: "traditional_document", required: true }],
  "contract-playbook": [{ moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/contract-playbook", ingestMode: "traditional_document", required: true }],
  "rfp-security": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/rfp-security", ingestMode: "traditional_document", required: true },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/rfp-approved-answers", ingestMode: "nano_page", required: false }
  ],
  "customer-360": [
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/customer-360-relations", ingestMode: "graph_document", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/customer-360-docs", ingestMode: "traditional_document", required: false },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/customer-360-notes", ingestMode: "nano_page", required: false }
  ],
  "risk-investigation": [
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/risk-investigation", ingestMode: "graph_document", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/risk-evidence", ingestMode: "traditional_document", required: false }
  ],
  "domain-relationship": [{ moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/domain-relationship", ingestMode: "graph_document", required: true }],
  "support-agent": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/support-docs", ingestMode: "traditional_document", required: true },
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/support-objects", ingestMode: "graph_document", required: false }
  ],
  "research-guide": [
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/research-guide", ingestMode: "nano_page", required: true },
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/research-sources", ingestMode: "traditional_document", required: false }
  ],
  "data-analyst": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/data-analyst-tables", ingestMode: "traditional_document", required: true },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/data-analyst-metrics", ingestMode: "nano_page", required: false }
  ],
  "it-runbook": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/it-runbook-docs", ingestMode: "traditional_document", required: true },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/it-runbook-playbook", ingestMode: "nano_page", required: false }
  ],
  "meeting-media-memory": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/meeting-media-transcripts", ingestMode: "traditional_document", required: true },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/meeting-decisions", ingestMode: "nano_page", required: false }
  ],
  "voice-of-customer": [
    { moduleId: "traditional-rag", sourcePurpose: "evidence", createSourceName: "scenario/voc-feedback", ingestMode: "traditional_document", required: true },
    { moduleId: "graph-rag", sourcePurpose: "relationship", createSourceName: "scenario/voc-demand-graph", ingestMode: "graph_document", required: false },
    { moduleId: "nano-brain", sourcePurpose: "wiki", createSourceName: "scenario/voc-insights", ingestMode: "nano_page", required: false }
  ]
};

function officialEvidence(productForms: TemplateProductForm[], limitations: string[]) {
  return {
    state: "official" as const,
    evidenceLevel: "validated" as const,
    evidenceSources,
    productForms,
    limitations
  };
}

function demoWalkthroughForTemplate(id: string): TemplateDemoWalkthrough {
  const map: Record<string, TemplateDemoWalkthrough> = {
    "personal-wiki": demo("Maya's Sales Notes Wiki", ["West Coast account retrospectives.md", "Renewal sales playbook.pdf"], "What are the most common customer objections in these notes?", "The most common objections are budget timing, system integration cost, and onboarding timeline. Start by showing a completed case to explain the implementation cadence, then split the budget question into renewal retention, Phase 2 expansion, and services packages."),
    "team-handbook": demo("Sales New Hire Onboarding Handbook", ["Sales new hire week one.md", "Customer meeting prep checklist.pdf"], "What should a new hire read first in week one?", "Start with product positioning and typical customer profiles on day one, complete the customer meeting prep checklist on day two, then read three retrospectives between day three and day five and submit one customer meeting plan."),
    "policy-evidence": demo("Travel & Expense Policy Q&A", ["FY26 travel and expense policy.pdf", "Expense approval flow.csv"], "What is the hotel reimbursement cap in San Francisco, and what approval does it need?", "The hotel cap for individual contributors traveling to San Francisco is $280 per night; anything above the cap needs manager and Finance review. When customer meetings or conferences push the rate higher, the expense report must include a written justification."),
    "contract-playbook": demo("SaaS Subscription Contract Review", ["Northwind Labs subscription agreement.pdf", "Legal clause review checklist.md"], "Which clauses in this contract are high risk, and how should they be revised?", "The main risks are a short auto-renewal notice window, a missing liability cap, and an unclear customer data usage boundary. Add a 60-day renewal reminder, cap liability at the annual service fee, and state that data is used only for delivery and support."),
    "rfp-security": demo("Pacific Union Bank Security Questionnaire Response", ["Pacific Union Bank security questionnaire.csv", "Platform security whitepaper.pdf"], "Draft standard answers for the customer security questionnaire and flag the items that still need confirmation.", "The answer draft is ready for review. Identity, access control, and log retention can cite the security whitepaper; data residency and dedicated deployment depend on the project configuration, so the security lead must confirm them."),
    "customer-360": demo("Northstar Cloud Renewal Brief", ["Northstar Cloud CRM export.csv", "Northstar Cloud relationship map.json", "Renewal meeting notes.md"], "What are the current renewal risks and opportunities for this customer?", "Renewal risk comes from delayed procurement approval and the CTO's concern about integration cost; the opportunity is the Phase 2 expansion already confirmed by the business owner. Customer Success should share rollout results this week and the account executive should book the CTO to confirm the integration schedule."),
    "risk-investigation": demo("Skyline Networks Relationship Risk Investigation", ["Skyline Networks vendor list.csv", "Historical risk events.txt", "Skyline Networks relationship records.json"], "What related risks does this vendor carry?", "The main risk is that critical services concentrate on one vendor whose staff overlap with a previously delayed project. The current evidence is enough to trigger review, but low-confidence relationships need human confirmation before becoming a formal conclusion."),
    "domain-relationship": demo("Healthcare Account Relationship Base", ["Healthcare account project materials.pdf", "Healthcare object relationships.csv"], "Which relationships in this domain most affect the purchasing decision?", "Purchasing decisions are shaped by clinical department demand, biomedical engineering evaluation, and IT integration requirements. A vendor with a comparable deployment can usually shorten the evaluation cycle."),
    "support-agent": demo("Orders & Invoicing Support Agent", ["Order support help center.md", "Support tickets last 30 days.csv"], "The customer says the order is three days late. How should support reply?", "Start by confirming the shipment status by order number and share the expected reship date or the reason for the delay. If the order is past the committed window, offer the compensation policy or hand the conversation to a human agent."),
    "research-guide": demo("Healthcare Renewal Research Guide", ["Healthcare renewal research pack.pdf", "Renewal customer cases.md"], "Turn the material into a study guide for the sales team.", "Renewals are usually driven by rollout results, departmental expansion demand, and the stability of IT integration. Organize the guide by customer stage: live accounts see outcome proof, expanding accounts see cross-department cases, and new accounts see the purchasing path."),
    "data-analyst": demo("West Coast Quarterly Sales Metrics Analysis", ["West Coast quarterly sales.csv", "Metric definitions.md", "Key account list.xlsx"], "What drove the largest revenue swings in the West Coast region over the past three quarters?", "The swings came from delayed enterprise renewals in one quarter and channel orders closing in a single period the next. Use customer stage, channel source, and contract status as drill-down dimensions, and add the finance recognition basis."),
    "it-runbook": demo("Payment Gateway Incident Runbook", ["Payment gateway runbook.md", "Incident tickets last 90 days.csv", "Alert rules reference.txt"], "When payment callbacks time out, what should the on-call engineer check first?", "Confirm the external gateway status, the callback queue backlog, and the latest release records first. If errors concentrate on a single merchant, check the callback signature and retry counts for that merchant, then escalate to the payments platform owner if needed."),
    "meeting-media-memory": demo("Northstar Cloud Renewal Meeting Notes", ["Renewal meeting transcript.md", "Meeting recording.mp3", "Renewal plan.pdf"], "Which risks, decisions, and action items did this meeting confirm?", "The meeting confirmed that the delayed procurement approval is the core risk and that the CTO must re-check the integration schedule. The account executive sends the rollout results material next week, and Customer Success shares the Phase 2 expansion scope."),
    "voice-of-customer": demo("Enterprise Permissions Demand Insights", ["Support tickets last 30 days.csv", "Key account interviews.md", "Request backlog export.xlsx"], "Which permissions-related requests most affect Enterprise renewals?", "High-frequency demand centers on role templates, approval logs, and cross-team data isolation. Affected customers are mostly financial services and manufacturing, so role templates and audit export should ship first.")
  };
  return map[id] ?? demo("Business scenario sample", [`${id}-source.pdf`, `${id}-records.csv`], "What can this template answer once it is created?", "The system answers from ingested materials with a business conclusion, recommended next steps, and cited sources.");
}

function demo(scenarioName: string, fileNames: string[], sampleQuestion: string, sampleAnswer: string): TemplateDemoWalkthrough {
  const sampleInputs = fileNames.slice(0, 3).map((fileName, index) => ({
    title: index === 0 ? "Primary business document" : index === 1 ? "Structured supporting data" : "Meeting and process notes",
    fileName,
    fileType: fileName.endsWith(".json") ? "json" as const : fileName.endsWith(".csv") ? "csv" as const : fileName.endsWith(".md") ? "md" as const : fileName.endsWith(".txt") ? "txt" as const : "pdf" as const,
    description: "Shows how this template reads business material, generates answers, and keeps sources attached."
  }));
  return {
    scenarioName,
    sampleInputs,
    processingPreview: ["Read the sample material and detect usable sources", "Shape it into the knowledge structure this template needs", "Generate a questioning-friendly answer, cited evidence, and a deliverable preview"],
    sampleQuestion,
    sampleAnswer,
    citations: sampleInputs.slice(0, 2).map((input) => ({
      label: input.title,
      source: input.fileName,
      excerpt: `Evidence comes from ${input.fileName} and supports the current conclusion.`
    })),
    resultHighlights: ["Show a sample answer", "Show cited sources", "Show a reusable deliverable"]
  };
}

const rows: Array<Omit<ScenarioTemplate, "state" | "evidenceLevel" | "evidenceSources" | "productForms" | "limitations" | "demoWalkthrough" | "modulePlan" | "createdAt" | "updatedAt"> & {
  productForms: TemplateProductForm[];
  limitations: string[];
}> = [
  row("personal-wiki", "Personal Knowledge Wiki", "compiled_knowledge", "Turn personal notes, Markdown, and reference packs into a browsable knowledge space you can question.", ["Markdown notes", "PDF references", "Web excerpts"], ["md", "txt", "pdf"], ["Wiki entries", "Source Q&A", "Topic summary"], false, "private", ["knowledge_portal", "chat"], ["Not suitable for producing an unreviewed external document directly."]),
  row("team-handbook", "Team Knowledge Handbook", "compiled_knowledge", "Turn team materials, meeting notes, and project retrospectives into a shareable handbook.", ["Meeting notes", "Project retrospectives", "FAQ documents"], ["md", "docx", "pdf"], ["Chaptered handbook", "Ask by chapter", "Team sharing"], true, "team", ["knowledge_portal", "task_workflow"], ["An admin must review it before it becomes the team-wide source of truth."]),
  row("policy-evidence", "Policy & Evidence Q&A", "document_evidence", "Give employees policy, process, and expense answers with the original text attached.", ["Policy PDFs", "Process documents", "Announcements"], ["pdf", "docx", "xlsx"], ["Policy answers", "Original citations", "Approval hints"], true, "company", ["chat", "knowledge_portal"], ["Policy answers must keep citations and do not replace the final HR or Legal interpretation."]),
  row("contract-playbook", "Contract Clause Review", "document_evidence", "Upload a contract and generate risky clauses, missing clauses, and replacement language from the company review rules.", ["Contract text", "Clause library", "Risk checklist"], ["pdf", "docx", "txt"], ["Risky clauses", "Replacement suggestions", "Review report"], true, "team", ["document_review", "task_workflow"], ["Only a first-pass screen and clause suggestion; it does not replace legal review."]),
  row("rfp-security", "RFP & Security Questionnaire Response", "document_evidence", "Ingest customer questionnaires and generate trustworthy answer drafts, open items, and cited evidence.", ["Customer questionnaires", "Past answer library", "Security whitepaper"], ["xlsx", "csv", "pdf", "docx"], ["Answer drafts", "Review checklist", "Answer export"], true, "team", ["document_review", "report_generator"], ["A responsible owner must confirm questionnaire answers before they are sent externally."]),
  row("customer-360", "Customer 360 Brief", "hybrid", "Enter a customer name and generate a pre-meeting brief with risk signals, opportunity signals, and next steps.", ["Customer records", "Meeting notes", "Contracts", "Project records"], ["pdf", "docx", "xlsx", "txt"], ["Customer brief", "Relationship leads", "Recommended actions"], true, "team", ["report_generator", "graph_explorer", "hybrid"], ["Customer judgment depends on data freshness; stale CRM or meeting records reduce reliability."]),
  row("risk-investigation", "Relationship Risk Investigation", "relationship_knowledge", "Trace relationship chains, risk events, and the evidence chain around a company, vendor, or project.", ["Due diligence reports", "Contracts", "Interview notes"], ["pdf", "docx", "xlsx", "txt"], ["Relationship chains", "Risk checklist", "Due diligence report"], true, "team", ["graph_explorer", "report_generator"], ["Relationship leads need evidence; low-confidence relationships cannot be stated as conclusions."]),
  row("domain-relationship", "Domain Relationship Base", "relationship_knowledge", "Build object and relationship Q&A for healthcare, financial services, manufacturing, and supply chain material.", ["Domain PDFs", "Standard documents", "Project material"], ["pdf", "docx", "xlsx", "csv", "txt"], ["Domain objects", "Relationship leads", "Analysis report"], true, "team", ["graph_explorer", "knowledge_portal", "hybrid"], ["Results are steadier once an admin configures the domain entity and relationship types."]),
  row("support-agent", "Support Knowledge Agent", "hybrid", "Package the help center and post-sale processes into an embeddable support knowledge agent.", ["Help documents", "Post-sale processes", "FAQs"], ["pdf", "docx", "txt", "html"], ["Support Q&A widget", "Human handoff guidance", "Knowledge gaps"], true, "team", ["embedded_assistant", "chat", "task_workflow"], ["Before launch, verify refusals, human handoff, and knowledge-gap handling."]),
  row("research-guide", "Research Report & Study Guide", "compiled_knowledge", "Turn a reference pack into a research report, study guide, summary, and cited version.", ["Research packs", "Web excerpts", "Reports"], ["pdf", "docx", "md", "txt", "html"], ["Research report", "Study guide", "Cited sources"], false, "private", ["report_generator", "knowledge_portal"], ["Suited to internal research and learning material, not to an uncited formal report."]),
  row("data-analyst", "Business Metrics Analyst", "hybrid", "Turn spreadsheets, BI exports, and business notes into metric analysis, anomaly explanations, and recommended actions.", ["Metric tables", "Metric definition notes", "Past reviews"], ["csv", "xlsx", "json", "md", "pdf"], ["Metric analysis", "Anomaly explanations", "Recommended actions"], true, "team", ["report_generator", "chat", "hybrid"], ["Confirm metric definitions and data freshness before publishing to avoid cross-team conflicts."]),
  row("it-runbook", "IT Runbook & Incident Triage", "document_evidence", "Turn runbooks, past tickets, and incident records into a questioning-friendly triage assistant with escalation paths.", ["Runbooks", "Past tickets", "Alert notes", "Log summaries"], ["md", "csv", "txt", "docx", "pdf"], ["Troubleshooting steps", "Escalation path", "Past ticket evidence"], true, "team", ["chat", "task_workflow", "knowledge_portal"], ["Incident guidance must be combined with current monitoring state and does not replace the on-call judgment."]),
  row("meeting-media-memory", "Meeting Audio & Video Notes", "hybrid", "Turn meeting recordings, video, transcripts, and attachments into questioning-friendly notes, decisions, and action items.", ["Audio and video", "Transcripts", "Meeting attachments", "Slide decks"], ["mp3", "mp4", "m4a", "wav", "md", "pdf", "pptx"], ["Meeting notes", "Decision record", "Action items"], true, "team", ["report_generator", "knowledge_portal", "task_workflow"], ["Audio and video need a real transcript or human proofreading; unproofed text is not a formal record."]),
  row("voice-of-customer", "Voice of Customer & Demand Insights", "hybrid", "Aggregate support tickets, interviews, surveys, and community feedback to identify high-frequency demand, affected customers, and the evidence chain.", ["Support tickets", "Customer interviews", "Survey data", "Community feedback"], ["csv", "xlsx", "md", "txt", "json"], ["Demand insights", "Customer impact", "Priority recommendations"], true, "team", ["report_generator", "graph_explorer", "hybrid"], ["Demand clusters and customer impact need product lead review before entering the roadmap."])
];

function row(
  id: string,
  name: string,
  kind: ScenarioTemplate["kind"],
  headline: string,
  requiredInputs: string[],
  acceptedFileTypes: string[],
  outputCapabilities: string[],
  needsAdminReview: boolean,
  defaultVisibility: ScenarioTemplate["defaultVisibility"],
  productForms: TemplateProductForm[],
  limitations: string[]
) {
  return {
    id,
    name,
    kind,
    headline,
    description: headline,
    requiredInputs,
    acceptedFileTypes,
    outputCapabilities,
    needsAdminReview,
    defaultVisibility,
    productForms,
    limitations
  };
}

const templates: ScenarioTemplate[] = rows.map((item) => ({
  ...item,
  ...officialEvidence(item.productForms, item.limitations),
  demoWalkthrough: demoWalkthroughForTemplate(item.id),
  modulePlan: plans[item.id] ?? [],
  createdAt: now,
  updatedAt: now
}));

export function listScenarioTemplates(): ScenarioTemplate[] {
  return templates;
}

export function getScenarioTemplate(id: string): ScenarioTemplate | undefined {
  return templates.find((item) => item.id === id);
}

export function modulePlanForTemplate(id: string): TemplateModulePlan[] {
  return getScenarioTemplate(id)?.modulePlan ?? [];
}

export function validateOfficialTemplateEvidence(template: ScenarioTemplate): true {
  if (template.state !== "official") return true;
  if (template.evidenceLevel !== "validated") throw new Error(`${template.id} official template must be validated`);
  if (template.evidenceSources.length < 2) throw new Error(`${template.id} official template needs at least two evidence sources`);
  if (template.productForms.length < 1) throw new Error(`${template.id} official template needs product form metadata`);
  if (template.limitations.length < 1) throw new Error(`${template.id} official template needs limitation metadata`);
  if (template.demoWalkthrough.sampleInputs.length < 2) throw new Error(`${template.id} official template needs demo sample inputs`);
  if (template.demoWalkthrough.citations.length < 2) throw new Error(`${template.id} official template needs demo citations`);
  if (template.modulePlan.length < 1) throw new Error(`${template.id} official template needs a module plan`);
  return true;
}

export function seedScenarioTemplatesSqlRows() {
  return templates.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    state: item.state,
    evidenceLevel: item.evidenceLevel,
    evidenceSourcesJson: JSON.stringify(item.evidenceSources),
    productFormsJson: JSON.stringify(item.productForms),
    limitationsJson: JSON.stringify(item.limitations),
    demoWalkthroughJson: JSON.stringify(item.demoWalkthrough),
    headline: item.headline,
    description: item.description,
    requiredInputsJson: JSON.stringify(item.requiredInputs),
    acceptedFileTypesJson: JSON.stringify(item.acceptedFileTypes),
    outputCapabilitiesJson: JSON.stringify(item.outputCapabilities),
    needsAdminReview: item.needsAdminReview,
    defaultVisibility: item.defaultVisibility,
    modulePlanJson: JSON.stringify(item.modulePlan)
  }));
}
