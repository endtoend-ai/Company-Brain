// Workspace · scenario solution library seed content (Northwind Labs)
// Only business names are exposed; the mechanism stays hidden. The rag field only drives the workspace color family (doc/relation/compile) and never shows an engine name in the UI.

export type Rag = "doc" | "relation" | "compile";

export type SolInput =
  | { key: string; label: string; type: "select"; options: string[] }
  | { key: string; label: string; type: "text"; placeholder: string };

export type Block =
  | { type: "lead"; text: string }
  | { type: "section"; heading: string; body: string }
  | { type: "bullets"; heading: string; items: { text: string; cite?: string }[] }
  | { type: "risk"; heading: string; items: { level: "high" | "mid" | "low"; title: string; note: string; cite: string }[] }
  | { type: "answer"; text: string; highlight?: string }
  | { type: "sources"; items: { title: string; meta: string }[] };

export type Solution = {
  id: string;
  name: string;
  category: string; // department / scenario
  rag: Rag;
  tagline: string; // what it does for you
  outputTag: string; // deliverable type
  icon: string; // key
  inputs: SolInput[];
  cta: string;
  deliverableTitle: string;
  deliverable: Block[];
};

export const categories = ["All", "Sales", "Legal", "HR & Workplace", "Industry Research", "General"];

export const ragColor: Record<Rag, { c: string; soft: string }> = {
  doc: { c: "var(--c-document)", soft: "var(--c-document-soft)" },
  relation: { c: "var(--c-relation)", soft: "var(--c-relation-soft)" },
  compile: { c: "var(--c-personal)", soft: "var(--c-personal-soft)" }
};

export const solutions: Solution[] = [
  /* ---------------- Relationship (graph-backed; workspace only sees the business deliverable) ---------------- */
  {
    id: "due-diligence",
    name: "Customer due diligence brief",
    category: "Sales",
    rag: "relation",
    tagline: "Enter a customer name and get an evidence-backed due diligence brief in one click.",
    outputTag: "Brief",
    icon: "brief",
    cta: "Generate the due diligence brief",
    inputs: [
      { key: "account", label: "Choose a customer", type: "select", options: ["Northwind Labs", "Acme Health", "Skyline Networks"] },
      { key: "focus", label: "Focus", type: "select", options: ["Renewal risk", "New deal assessment", "Full due diligence"] }
    ],
    deliverableTitle: "Northwind Labs · customer due diligence brief",
    deliverable: [
      { type: "lead", text: "Conclusion: renewal risk at Northwind Labs is elevated, but the expansion opportunity is clear. Maya Chen should reach the CTO, David Park, this week and use the Phase 2 expansion plan to unlock the $1.2M master agreement renewal." },
      {
        type: "section",
        heading: "Relationship and background",
        body: "Enterprise software / SaaS, about 200 employees. The FY26 master agreement renewal is in negotiation and Maya Chen owns it; Project Atlas (data platform) is live, the Phase 2 expansion is under evaluation, and the knowledge Q&A POC feedback is positive."
      },
      {
        type: "bullets",
        heading: "Key findings",
        items: [
          { text: "The $1.2M master agreement renewal is in negotiation and is bundled with a $450K data module expansion.", cite: "Contract records" },
          { text: "CTO David Park is the key decision maker and has recently said publicly that he wants to expand the data team.", cite: "Account record · David Park" },
          { text: "Procurement lead Priya Shah has confirmed the annual budget and the decision chain is clear.", cite: "Engagement timeline 05/18" }
        ]
      },
      {
        type: "risk",
        heading: "Risk signals",
        items: [
          { level: "high", title: "Engagement stalled", note: "No engagement in the last 14 days and only about 3 weeks remain in the renewal window.", cite: "Engagement timeline" },
          { level: "mid", title: "Expansion depends on the renewal", note: "The data module expansion cannot move until the master agreement renewal is settled.", cite: "Contract records" }
        ]
      },
      {
        type: "section",
        heading: "Recommended next steps",
        body: "(1) Maya Chen books the CTO, David Park, this week with the Phase 2 expansion plan; (2) align the POC results with his team-expansion goal; (3) run the expansion together with the renewal to shorten the decision cycle."
      },
      {
        type: "sources",
        items: [
          { title: "Account record: Northwind Labs (relationship chain: renewal/owner/key person)", meta: "Relationship knowledge base · aggregated from 3 documents" },
          { title: "Engagement timeline · no activity in 14 days", meta: "Signal · 3 weeks left in the renewal window" },
          { title: "FY26 master agreement draft", meta: "$1.2M · in negotiation" }
        ]
      }
    ]
  },
  {
    id: "account-insight",
    name: "Customer insights",
    category: "Sales",
    rag: "relation",
    tagline: "See a customer's key people, open deals, and risk points at a glance.",
    outputTag: "Key points",
    icon: "insight",
    cta: "Generate customer insights",
    inputs: [{ key: "account", label: "Choose a customer", type: "select", options: ["Northwind Labs", "Acme Health", "Skyline Networks"] }],
    deliverableTitle: "Acme Health · customer insights",
    deliverable: [
      { type: "lead", text: "Acme Health is a rare positive healthcare account: first-phase satisfaction is high and the decision maker is proactively driving a multi-site renewal, so it is worth asking to use it as an industry benchmark." },
      {
        type: "bullets",
        heading: "Key points",
        items: [
          { text: "The $2.2M multi-site phase-two renewal is in negotiation and intent to renew is strong.", cite: "Contract records" },
          { text: "Decision maker Hannah Lee (CIO) proactively asked about the multi-site plan.", cite: "Engagement 06/18" },
          { text: "First-phase NPS was 9, so ask for case authorization to reuse with Bayview Medical Group.", cite: "Project sign-off" }
        ]
      },
      { type: "sources", items: [{ title: "Account record: Acme Health", meta: "Relationship knowledge base" }, { title: "In-hospital knowledge base phase-one sign-off", meta: "NPS 9" }] }
    ]
  },

  /* ---------------- Document (retrieval + evidence) ---------------- */
  {
    id: "contract-review",
    name: "Contract review",
    category: "Legal",
    rag: "doc",
    tagline: "Pick a contract and list the risk points and key clauses with the original text.",
    outputTag: "Risk checklist",
    icon: "contract",
    cta: "Review the contract",
    inputs: [
      { key: "file", label: "Choose a contract", type: "select", options: ["Northwind Labs · master agreement v2", "Vendor procurement agreement", "Skyline Networks subscription agreement"] }
    ],
    deliverableTitle: "Northwind Labs · master agreement v2 · review result",
    deliverable: [
      { type: "lead", text: "Overall risk is medium. Three items need attention: the auto-renewal clause, the liability cap, and the data clause, which deviates from the company template." },
      {
        type: "risk",
        heading: "Risk points",
        items: [
          { level: "high", title: "Auto-renewal has no notice window", note: "Clause 9 auto-renews at term end but sets no advance notice period, creating passive renewal risk.", cite: "Clause 9" },
          { level: "mid", title: "Liability cap is too low", note: "Clause 12 caps liability at 5% of the contract value, below the company standard of 10%.", cite: "Clause 12" },
          { level: "low", title: "Data clause wording is weak", note: "The data ownership wording in clause 7 does not match the company template and should be replaced.", cite: "Clause 7" }
        ]
      },
      {
        type: "bullets",
        heading: "Key clause summary",
        items: [
          { text: "Term of 12 months, value $1.2M.", cite: "Clause 2" },
          { text: "Payment schedule: 30% on signing / 40% on go-live / 30% on acceptance.", cite: "Clause 5" }
        ]
      },
      { type: "sources", items: [{ title: "Northwind Labs master agreement v2", meta: "Document library · original passages highlighted" }, { title: "Company contract template · standard clauses", meta: "Comparison baseline" }] }
    ]
  },
  {
    id: "policy-qa",
    name: "Policy Q&A",
    category: "HR & Workplace",
    rag: "doc",
    tagline: "Ask a company policy question and get the answer with its original source.",
    outputTag: "Answer",
    icon: "policy",
    cta: "Ask",
    inputs: [{ key: "q", label: "Your question", type: "text", placeholder: "For example: what is the travel expense limit?" }],
    deliverableTitle: "Travel expense limits",
    deliverable: [
      {
        type: "answer",
        text: "Hotels in San Francisco are capped at $280 per night and local transport is reimbursed with receipts; a single meal over $75 or any stay above the hotel cap needs department head approval.",
        highlight: "$280 per night"
      },
      { type: "sources", items: [{ title: "Travel & Expense Policy v3, section 4 · paragraph 2", meta: "Document library · original highlighted" }, { title: "Expense submission guide.pdf · page 2", meta: "Approval flow" }] }
    ]
  },
  {
    id: "meeting-minutes",
    name: "Meeting notes",
    category: "General",
    rag: "doc",
    tagline: "Turn raw meeting notes into structured minutes and action items.",
    outputTag: "Minutes",
    icon: "minutes",
    cta: "Generate minutes",
    inputs: [{ key: "raw", label: "Paste the meeting notes", type: "text", placeholder: "Paste the raw notes, or pick an uploaded recording transcript..." }],
    deliverableTitle: "Northwind Labs Phase 2 plan review · meeting notes",
    deliverable: [
      { type: "section", heading: "Conclusion", body: "The Phase 2 expansion plan was approved for review and goes to the customer this week; the expansion runs together with the renewal." },
      {
        type: "bullets",
        heading: "Action items",
        items: [
          { text: "Maya Chen: book the CTO, David Park, this week with the Phase 2 plan.", cite: "Owner: Maya Chen" },
          { text: "Solutions team: add the expansion pricing breakdown.", cite: "—" },
          { text: "Legal: check the expansion contract clauses.", cite: "—" }
        ]
      }
    ]
  },

  /* ---------------- Compiled (topic to finished article / wiki) ---------------- */
  {
    id: "topic-review",
    name: "Topic summary",
    category: "Industry Research",
    rag: "compile",
    tagline: "Give it a topic and it generates a cited summary with sections, for the audience you choose.",
    outputTag: "Summary",
    icon: "review",
    cta: "Generate the summary",
    inputs: [
      { key: "topic", label: "Topic", type: "text", placeholder: "For example: tuning enterprise retrieval quality" },
      { key: "audience", label: "Audience", type: "select", options: ["Team members", "Company leadership", "New hires"] }
    ],
    deliverableTitle: "Enterprise retrieval tuning · topic summary",
    deliverable: [
      { type: "lead", text: "This summary collects the team's practice on tuning enterprise retrieval quality, written for team members, with three principles you can apply directly and an implementation checklist." },
      { type: "section", heading: "Why it matters", body: "Retrieval quality decides how trustworthy the answers are. Projects over the past six months repeatedly showed that granularity and back-testing strategy affect the final experience more than model choice does." },
      {
        type: "bullets",
        heading: "Three core principles",
        items: [
          { text: "Chunk along semantic boundaries first; do not hard-cut at a fixed character count.", cite: "Knowledge entry · tuning lessons" },
          { text: "Keep each chunk at a length that still stands on its own.", cite: "Knowledge entry · tuning lessons" },
          { text: "Back-test with real business questions, then adjust granularity.", cite: "Project Atlas retrospective" }
        ]
      },
      { type: "section", heading: "Implementation checklist", body: "(1) Collect 20 real questions as a baseline before building; (2) sample the chunks for manual review after splitting; (3) keep tuning from Q&A quality after launch." },
      { type: "sources", items: [{ title: "Knowledge entry: retrieval tuning · team lessons", meta: "Personal knowledge base · traces back to 4 documents" }, { title: "Project Atlas retrospective notes", meta: "Practice source" }] }
    ]
  },
  {
    id: "onboarding",
    name: "New hire handbook",
    category: "HR & Workplace",
    rag: "compile",
    tagline: "Generate a new hire onboarding handbook for a role in one click.",
    outputTag: "Handbook",
    icon: "onboard",
    cta: "Generate the handbook",
    inputs: [{ key: "role", label: "Role", type: "select", options: ["Sales", "Solutions Engineer", "Engineering"] }],
    deliverableTitle: "Sales · new hire onboarding handbook",
    deliverable: [
      { type: "lead", text: "This handbook walks a new sales hire through the critical path from learning the product to owning a customer independently in week one." },
      { type: "section", heading: "Day 1-2 · Product and customers", body: "Read the three solution tracks and typical customer profiles; get familiar with open accounts in Customer insights." },
      { type: "section", heading: "Day 3-5 · Follow a real customer", body: "Pick a customer and prepare with the customer due diligence brief, then join one customer conversation with the account owner." },
      { type: "sources", items: [{ title: "Sales team · new hire onboarding material", meta: "Personal knowledge base · auto compiled" }] }
    ]
  },
  {
    id: "research-report",
    name: "Research report",
    category: "Industry Research",
    rag: "compile",
    tagline: "Pick a question and generate a cited research report with data.",
    outputTag: "Report",
    icon: "report",
    cta: "Generate the report",
    inputs: [{ key: "q", label: "Research question", type: "text", placeholder: "For example: what drives renewals for healthcare customers" }],
    deliverableTitle: "Healthcare renewal drivers · research report",
    deliverable: [
      { type: "lead", text: "Based on the available healthcare account material, renewals are driven by three factors: first-phase satisfaction, decision-maker initiative, and compliance endorsement." },
      { type: "section", heading: "Findings", body: "Acme Health scored NPS 9 in phase one and proactively asked about a multi-site renewal; Bayview Medical Group is slower because of compliance concerns and needs peer endorsement to accelerate." },
      { type: "sources", items: [{ title: "Acme Health / Bayview Medical Group account records", meta: "Relationship + personal knowledge base" }] }
    ]
  }
];

export const solutionById = (id: string) => solutions.find((s) => s.id === id);
