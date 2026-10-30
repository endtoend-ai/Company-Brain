export type Capability = "document-evidence" | "relationship-insight" | "compiled-knowledge";
export type ScenarioRuntime =
  | "evidence-chat"
  | "account-brief"
  | "investigation-brief"
  | "document-review"
  | "questionnaire-grid"
  | "notebook-report"
  | "embedded-widget"
  | "service-desk"
  | "content-workspace"
  | "data-analysis";
export type ScenarioVisibility = "private" | "team" | "company" | "official";
export type ScenarioStatus = "draft" | "testing" | "published" | "needs_review" | "disabled";

export type ScenarioInput =
  | { key: string; label: string; type: "text"; placeholder: string; sample: string }
  | { key: string; label: string; type: "select"; options: string[]; sample: string }
  | { key: string; label: string; type: "file"; sample: string };

export type EvidencePolicy = "source-citations" | "document-highlights" | "relationship-paths" | "approval-trail";

export type KnowledgeBinding = {
  id: string;
  name: string;
  capability: Capability;
  scope: string;
  freshness: "fresh" | "watch" | "stale";
};

export type DeliverableBlock =
  | { type: "lead"; text: string }
  | { type: "section"; heading: string; body: string }
  | { type: "bullets"; heading: string; items: { text: string; cite?: string }[] }
  | { type: "risk"; heading: string; items: { level: "high" | "mid" | "low"; title: string; note: string; cite: string }[] }
  | { type: "sources"; items: { title: string; meta: string }[] };

export type ScenarioApp = {
  id: string;
  templateId?: string;
  name: string;
  description: string;
  department: string;
  owner: string;
  ownerRole: string;
  visibility: ScenarioVisibility;
  status: ScenarioStatus;
  verified: boolean;
  runtime: ScenarioRuntime;
  capabilities: Capability[];
  inputs: ScenarioInput[];
  outputTypes: string[];
  evidencePolicy: EvidencePolicy;
  actions: string[];
  qualitySignals: string[];
  usage: {
    runs: number;
    successRate: number;
    lastRun: string;
  };
  knowledgeBindings: KnowledgeBinding[];
  deliverable: {
    id: string;
    title: string;
    kind: string;
    createdAt: string;
    owner: string;
    status: "approved" | "needs_review" | "draft";
    blocks: DeliverableBlock[];
  };
};

export const capabilityLabel: Record<Capability, string> = {
  "document-evidence": "Document evidence",
  "relationship-insight": "Relationship insight",
  "compiled-knowledge": "Compiled knowledge"
};

export const capabilityTone: Record<Capability, { color: string; soft: string }> = {
  "document-evidence": { color: "var(--c-document)", soft: "var(--c-document-soft)" },
  "relationship-insight": { color: "var(--c-relation)", soft: "var(--c-relation-soft)" },
  "compiled-knowledge": { color: "var(--c-personal)", soft: "var(--c-personal-soft)" }
};

export const runtimeLabel: Record<ScenarioRuntime, string> = {
  "evidence-chat": "Evidence Q&A",
  "account-brief": "Customer brief",
  "investigation-brief": "Relationship investigation",
  "document-review": "Document review",
  "questionnaire-grid": "Questionnaire response",
  "notebook-report": "Knowledge handbook",
  "embedded-widget": "Embedded assistant",
  "service-desk": "Service desk",
  "content-workspace": "Content workspace",
  "data-analysis": "Data analysis"
};

export const visibilityLabel: Record<ScenarioVisibility, string> = {
  private: "Private",
  team: "Team",
  company: "Company-wide",
  official: "Official"
};

export const statusLabel: Record<ScenarioStatus, string> = {
  draft: "Draft",
  testing: "Pilot",
  published: "Published",
  needs_review: "Needs review",
  disabled: "Disabled"
};

export const departments = ["All", "Sales", "Legal", "Solutions Engineering", "Customer Success", "HR & IT", "Industry Research", "Marketing", "Risk & Compliance"];

export const knowledgeSources: KnowledgeBinding[] = [
  { id: "kb-crm", name: "Customer relationship base", capability: "relationship-insight", scope: "Customers, contacts, opportunities, contracts, projects", freshness: "fresh" },
  { id: "kb-sales-docs", name: "Sales document library", capability: "document-evidence", scope: "Proposals, meeting notes, quotes, past email", freshness: "fresh" },
  { id: "kb-contracts", name: "Contracts and clauses", capability: "document-evidence", scope: "Contract templates, past contracts, legal playbook", freshness: "watch" },
  { id: "kb-security", name: "Security and compliance library", capability: "document-evidence", scope: "SOC 2, ISO, DPA, encryption and access policies", freshness: "fresh" },
  { id: "kb-company-wiki", name: "Team knowledge wiki", capability: "compiled-knowledge", scope: "Knowledge entries, research summaries, onboarding guides", freshness: "fresh" },
  { id: "kb-support", name: "Support knowledge base", capability: "document-evidence", scope: "Help center, FAQs, returns and post-sale rules", freshness: "watch" },
  { id: "kb-policy", name: "Policy library", capability: "document-evidence", scope: "Travel, expense, procurement, IT, and HR policies", freshness: "fresh" },
  { id: "kb-risk", name: "Relationship risk base", capability: "relationship-insight", scope: "Companies, vendors, people, contracts, risk events", freshness: "stale" }
];

function kb(...ids: string[]) {
  return ids.map((id) => knowledgeSources.find((item) => item.id === id)!).filter(Boolean);
}

export const scenarioApps: ScenarioApp[] = [
  {
    id: "customer-360",
    templateId: "tpl-account-brief",
    name: "Customer 360 Brief",
    description: "Enter a customer name and meeting goal to generate a pre-meeting brief, relationship path, risk signals, and next steps.",
    department: "Sales",
    owner: "Sales Growth team",
    ownerRole: "Official template",
    visibility: "official",
    status: "published",
    verified: true,
    runtime: "account-brief",
    capabilities: ["relationship-insight", "document-evidence", "compiled-knowledge"],
    inputs: [
      { key: "account", label: "Customer name", type: "select", options: ["Northwind Labs", "Acme Health", "Skyline Networks"], sample: "Northwind Labs" },
      { key: "goal", label: "Meeting goal", type: "text", placeholder: "For example: advance the renewal, Phase 2 expansion, competitive displacement", sample: "Advance the renewal" }
    ],
    outputTypes: ["Customer brief", "Relationship path", "Next-step actions"],
    evidencePolicy: "relationship-paths",
    actions: ["Export the pre-meeting brief", "Draft a follow-up email", "Save to CRM"],
    qualitySignals: ["Relationship path complete", "Engagement from the last 30 days included", "2 risks need human confirmation"],
    usage: { runs: 128, successRate: 92, lastRun: "Today 10:24" },
    knowledgeBindings: kb("kb-crm", "kb-sales-docs", "kb-company-wiki"),
    deliverable: {
      id: "out-customer-360",
      title: "Northwind Labs · renewal pre-meeting brief",
      kind: "Customer brief",
      createdAt: "Today 10:24",
      owner: "Maya Chen",
      status: "approved",
      blocks: [
        { type: "lead", text: "Conclusion: renewal risk at Northwind Labs is elevated, but the Phase 2 expansion opportunity is clear. Maya Chen should book the CTO, David Park, this week and use the POC results and the expansion roadmap to close the $1.2M master agreement renewal." },
        { type: "section", heading: "Customer background", body: "Northwind Labs has about 200 employees, and Maya Chen owns the renewal. Project Atlas is live, the knowledge Q&A POC feedback is positive, and the Phase 2 data module expansion is under evaluation." },
        {
          type: "bullets",
          heading: "Key relationships",
          items: [
            { text: "Maya Chen owns the Northwind Labs renewal; the key decision maker is CTO David Park.", cite: "Customer relationship base" },
            { text: "Procurement lead Priya Shah has confirmed the annual budget but is waiting for the master agreement renewal first.", cite: "Engagement timeline" },
            { text: "The Phase 2 expansion is tied to the renewal contract and is expected to add $450K.", cite: "Contract records" }
          ]
        },
        {
          type: "risk",
          heading: "Risk signals",
          items: [
            { level: "high", title: "Engagement stalled", note: "No substantive engagement in the last 14 days and the renewal window is about 3 weeks out.", cite: "Engagement timeline" },
            { level: "mid", title: "Expansion depends on the renewal", note: "The data module expansion cannot move until the master agreement is confirmed.", cite: "Contract records" }
          ]
        },
        { type: "sources", items: [{ title: "Customer record: Northwind Labs", meta: "Customer relationship base · 7 relationship paths" }, { title: "FY26 master agreement draft", meta: "Sales document library · $1.2M value" }] }
      ]
    }
  },
  {
    id: "risk-investigation",
    templateId: "tpl-investigation",
    name: "Relationship Risk Investigation",
    description: "Start from a company, vendor, or project and trace multi-hop relationships, risk events, and blast radius.",
    department: "Risk & Compliance",
    owner: "Risk Analytics team",
    ownerRole: "Official template",
    visibility: "official",
    status: "published",
    verified: true,
    runtime: "investigation-brief",
    capabilities: ["relationship-insight", "document-evidence"],
    inputs: [
      { key: "entity", label: "Investigation target", type: "text", placeholder: "Company, vendor, customer, or project", sample: "Skyline Networks" },
      { key: "scope", label: "Scope", type: "select", options: ["Ownership and affiliates", "Supply chain dependency", "Contracts and litigation", "Full investigation"], sample: "Full investigation" }
    ],
    outputTypes: ["Risk checklist", "Relationship path", "Items to verify"],
    evidencePolicy: "relationship-paths",
    actions: ["Export the investigation report", "Flag for verification", "Send to Legal"],
    qualitySignals: ["4 relationship paths matched", "1 source is stale", "Business registration changes need manual verification"],
    usage: { runs: 46, successRate: 88, lastRun: "Yesterday 17:40" },
    knowledgeBindings: kb("kb-risk", "kb-contracts", "kb-sales-docs"),
    deliverable: {
      id: "out-risk",
      title: "Skyline Networks · relationship risk investigation",
      kind: "Investigation report",
      createdAt: "Yesterday 17:40",
      owner: "Emily Carter",
      status: "needs_review",
      blocks: [
        { type: "lead", text: "Conclusion: overall risk at Skyline Networks is medium. The main exposure comes from upstream vendor concentration and a historical litigation link, which Legal needs to verify." },
        {
          type: "bullets",
          heading: "Relationship paths",
          items: [
            { text: "Skyline Networks → procurement services → Northstar Cloud → historical SLA breach.", cite: "Relationship risk base" },
            { text: "Skyline Networks → shared executive → Bridgepoint Capital → undisclosed related-party transaction rumor.", cite: "Corporate registry" }
          ]
        },
        {
          type: "risk",
          heading: "Open risks",
          items: [
            { level: "high", title: "Vendor concentration", note: "Core cloud services depend on Northstar Cloud and no replacement plan is defined.", cite: "Procurement contract" },
            { level: "mid", title: "Possible related-party transaction", note: "The Bridgepoint Capital relationship needs legal verification.", cite: "Corporate registry" }
          ]
        },
        { type: "sources", items: [{ title: "Relationship risk base: Skyline Networks", meta: "Multi-hop relationship paths" }, { title: "Procurement contract and SLA appendix", meta: "Document evidence" }] }
      ]
    }
  },
  {
    id: "contract-playbook",
    templateId: "tpl-contract",
    name: "Contract Playbook Review",
    description: "Upload or pick a contract and automatically check risky clauses, missing clauses, and replacement language against the company playbook.",
    department: "Legal",
    owner: "Legal Operations team",
    ownerRole: "Official template",
    visibility: "official",
    status: "published",
    verified: true,
    runtime: "document-review",
    capabilities: ["document-evidence", "relationship-insight"],
    inputs: [
      { key: "contract", label: "Contract file", type: "file", sample: "Northwind Labs master agreement v2.pdf" },
      { key: "type", label: "Contract type", type: "select", options: ["Sales master agreement", "Procurement agreement", "NDA", "SaaS subscription"], sample: "Sales master agreement" }
    ],
    outputTypes: ["Risk checklist", "Clause recommendations", "Review report"],
    evidencePolicy: "document-highlights",
    actions: ["Generate the review report", "Export suggested edits", "Send to Legal for review"],
    qualitySignals: ["3 risks", "2 clauses need replacement", "Legal must confirm the liability cap"],
    usage: { runs: 73, successRate: 91, lastRun: "Today 09:18" },
    knowledgeBindings: kb("kb-contracts", "kb-crm"),
    deliverable: {
      id: "out-contract",
      title: "Northwind Labs master agreement v2 · review result",
      kind: "Contract review",
      createdAt: "Today 09:18",
      owner: "Daniel Kim",
      status: "needs_review",
      blocks: [
        { type: "lead", text: "Overall risk is medium. The auto-renewal, liability cap, and data ownership clauses deviate from the company playbook." },
        {
          type: "risk",
          heading: "Risky clauses",
          items: [
            { level: "high", title: "Auto-renewal has no notice window", note: "Clause 9 has no advance notice period; add a notice requirement 60 days before the term ends.", cite: "Clause 9" },
            { level: "mid", title: "Liability cap is too low", note: "Clause 12 caps damages at 5%, below the company standard of 10%.", cite: "Clause 12" },
            { level: "low", title: "Data ownership wording is weak", note: "Replace it with the company standard data ownership clause.", cite: "Clause 7" }
          ]
        },
        { type: "sources", items: [{ title: "Northwind Labs master agreement v2", meta: "3 highlighted passages" }, { title: "Company sales contract playbook", meta: "Standard clause comparison" }] }
      ]
    }
  },
  {
    id: "rfp-security",
    templateId: "tpl-rfp",
    name: "RFP & Security Questionnaire Desk",
    description: "Ingest an RFP, DDQ, or security questionnaire and generate trustworthy answers at scale with reviewers assigned.",
    department: "Solutions Engineering",
    owner: "Solutions Engineering team",
    ownerRole: "Team scenario",
    visibility: "team",
    status: "published",
    verified: false,
    runtime: "questionnaire-grid",
    capabilities: ["document-evidence", "compiled-knowledge"],
    inputs: [
      { key: "file", label: "Questionnaire file", type: "file", sample: "Pacific Union Bank security questionnaire.xlsx" },
      { key: "tone", label: "Answer tone", type: "select", options: ["Standard", "Conservative", "Sales friendly"], sample: "Standard" }
    ],
    outputTypes: ["Answer sheet", "Approval checklist", "Knowledge gaps"],
    evidencePolicy: "approval-trail",
    actions: ["Export to Excel", "Request SME review", "Add to the answer library"],
    qualitySignals: ["42/48 drafted", "6 need SME review", "2 knowledge gaps"],
    usage: { runs: 58, successRate: 86, lastRun: "Today 14:12" },
    knowledgeBindings: kb("kb-security", "kb-company-wiki"),
    deliverable: {
      id: "out-rfp",
      title: "Pacific Union Bank security questionnaire · answer pack",
      kind: "Questionnaire answer pack",
      createdAt: "Today 14:12",
      owner: "Alex Rivera",
      status: "needs_review",
      blocks: [
        { type: "lead", text: "Suggested answers were drafted for 42 of 48 questions. Six need a security SME review, and two questions expose knowledge base gaps." },
        {
          type: "bullets",
          heading: "Sample answers",
          items: [
            { text: "SSO support: SAML 2.0 and OIDC are supported and can federate with the customer IdP.", cite: "Identity whitepaper" },
            { text: "Encryption: TLS 1.2+ in transit and AES-256 at rest.", cite: "Security whitepaper" },
            { text: "Vendor audit program: an SME must confirm the current audit cycle.", cite: "Pending review" }
          ]
        },
        { type: "sources", items: [{ title: "Security whitepaper v4", meta: "Approved source" }, { title: "SOC 2 control mapping", meta: "Approved source" }] }
      ]
    }
  },
  {
    id: "knowledge-manual",
    templateId: "tpl-notebook",
    name: "Files to Knowledge Handbook",
    description: "Compile reference packs, meeting notes, and project documents into a browsable, cited knowledge handbook.",
    department: "Industry Research",
    owner: "Knowledge Operations team",
    ownerRole: "Official template",
    visibility: "official",
    status: "published",
    verified: true,
    runtime: "notebook-report",
    capabilities: ["compiled-knowledge", "document-evidence"],
    inputs: [
      { key: "topic", label: "Handbook topic", type: "text", placeholder: "For example: sales onboarding, project retrospective, competitor research", sample: "Sales onboarding" },
      { key: "audience", label: "Audience", type: "select", options: ["New hires", "Leadership", "Project team", "Customers"], sample: "New hires" }
    ],
    outputTypes: ["Knowledge handbook", "Outline", "Cited sources"],
    evidencePolicy: "source-citations",
    actions: ["Publish as knowledge entries", "Export to PDF", "Assign an owner"],
    qualitySignals: ["8 documents cited", "3 chapters generated", "1 source should be refreshed"],
    usage: { runs: 91, successRate: 90, lastRun: "Yesterday 11:05" },
    knowledgeBindings: kb("kb-company-wiki", "kb-sales-docs"),
    deliverable: {
      id: "out-manual",
      title: "Sales new hire onboarding handbook",
      kind: "Knowledge handbook",
      createdAt: "Yesterday 11:05",
      owner: "Knowledge Operations team",
      status: "approved",
      blocks: [
        { type: "lead", text: "This handbook walks a new sales hire through the critical path from learning the product to preparing a customer meeting independently in week one." },
        { type: "section", heading: "Day 1-2: Product and customer", body: "Read the three solution tracks, typical customer profiles, and pricing rules; get familiar with open accounts through Customer 360 briefs." },
        { type: "section", heading: "Day 3-5: Follow a real customer", body: "Pick one customer, generate a pre-meeting brief, join one customer conversation with the account owner, and write the retrospective." },
        { type: "sources", items: [{ title: "Sales onboarding material", meta: "Team knowledge wiki" }, { title: "Customer brief template guide", meta: "Sales document library" }] }
      ]
    }
  },
  {
    id: "policy-evidence",
    templateId: "tpl-policy",
    name: "Policy & Evidence Q&A",
    description: "Employees ask about a policy, process, or expense rule and get a direct answer, the original passage, and the approval basis.",
    department: "HR & IT",
    owner: "HR Shared Services",
    ownerRole: "Official template",
    visibility: "official",
    status: "published",
    verified: true,
    runtime: "evidence-chat",
    capabilities: ["document-evidence", "compiled-knowledge"],
    inputs: [
      { key: "question", label: "Policy question", type: "text", placeholder: "For example: what is the hotel cap in San Francisco?", sample: "What is the travel expense limit?" }
    ],
    outputTypes: ["Answer", "Original citations", "Approval hints"],
    evidencePolicy: "document-highlights",
    actions: ["Save the answer", "Open the original text", "Report a policy gap"],
    qualitySignals: ["Source is current", "2 policies matched", "No human review needed"],
    usage: { runs: 264, successRate: 95, lastRun: "Today 15:01" },
    knowledgeBindings: kb("kb-policy", "kb-company-wiki"),
    deliverable: {
      id: "out-policy",
      title: "Travel expense limits · evidence answer",
      kind: "Policy answer",
      createdAt: "Today 15:01",
      owner: "Priya Shah",
      status: "approved",
      blocks: [
        { type: "lead", text: "Hotels in San Francisco are capped at $280 per night and local transport is reimbursed with receipts; anything above the hotel cap or above $75 in a single meal needs manager approval." },
        { type: "sources", items: [{ title: "Travel & Expense Policy v3, section 4", meta: "Policy library · original highlighted" }, { title: "Expense submission guide.pdf", meta: "Approval flow" }] }
      ]
    }
  },
  {
    id: "support-agent",
    templateId: "tpl-support",
    name: "Support Knowledge Agent",
    description: "Package the help center and order data into an embeddable support widget that keeps the evidence for human handoff.",
    department: "Customer Success",
    owner: "Customer Experience team",
    ownerRole: "Team draft",
    visibility: "team",
    status: "testing",
    verified: false,
    runtime: "embedded-widget",
    capabilities: ["document-evidence", "relationship-insight"],
    inputs: [
      { key: "scenario", label: "Business scenario", type: "select", options: ["Pre-sales questions", "Order support", "Returns and exchanges", "Invoicing"], sample: "Order support" }
    ],
    outputTypes: ["Customer reply", "Handoff summary", "Knowledge gaps"],
    evidencePolicy: "source-citations",
    actions: ["Generate the embed code", "Hand off to a human", "Add help documentation"],
    qualitySignals: ["Pilot running", "Return sources need a refresh", "Handoff rules not published yet"],
    usage: { runs: 19, successRate: 78, lastRun: "Today 11:42" },
    knowledgeBindings: kb("kb-support", "kb-crm"),
    deliverable: {
      id: "out-support",
      title: "Order support · support handling record",
      kind: "Support run summary",
      createdAt: "Today 11:42",
      owner: "Sarah Johnson",
      status: "draft",
      blocks: [
        { type: "lead", text: "The customer asked about a delayed order; the system explained it from the order status and shipping rules and prepared a human handoff summary." },
        { type: "bullets", heading: "Handoff summary", items: [{ text: "Order 20240618-8842 is one day late because of a cycle count at the Oakland warehouse.", cite: "Order status" }, { text: "A $15 shipping credit can be offered as compensation.", cite: "Post-sale rules" }] },
        { type: "sources", items: [{ title: "Post-sale policy v2", meta: "Support knowledge base" }, { title: "Order status record", meta: "Customer relationship base" }] }
      ]
    }
  }
];

export const featuredScenarioIds = ["customer-360", "contract-playbook", "rfp-security", "knowledge-manual"];
export const recentScenarioIds = ["customer-360", "policy-evidence", "rfp-security"];

export function scenarioById(id: string) {
  return scenarioApps.find((item) => item.id === id);
}

export function officialScenarios() {
  return scenarioApps.filter((item) => item.visibility === "official");
}

export function teamScenarios() {
  return scenarioApps.filter((item) => item.visibility === "team" || item.visibility === "company");
}

export function myScenarios() {
  return scenarioApps.filter((item) => item.owner === "Maya Chen" || item.visibility === "team" || item.status === "draft" || item.status === "testing");
}

export function scenarioOutputs() {
  return scenarioApps.map((scenario) => ({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    capability: scenario.capabilities[0],
    ...scenario.deliverable
  }));
}
