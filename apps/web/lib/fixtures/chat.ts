// Workspace · three-column chat workbench seed content (Northwind Labs).
// Product structure reference (Onyx three-column / kotaemon citation highlight / AnythingLLM workspace / GraphRAG-Local-UI graph evidence).

export type Rag = "doc" | "relation" | "compile";

export type KB = { id: string; name: string; type: Rag; desc: string; count: string };

export const knowledgeBases: KB[] = [
  { id: "kb-doc", name: "Policy & process library", type: "doc", desc: "Policies, contracts, reports, and spreadsheets", count: "128 docs" },
  { id: "kb-rel", name: "Customer & relationship base", type: "relation", desc: "Customers, projects, contracts, and key people linked together", count: "64 objects" },
  { id: "kb-wiki", name: "Team knowledge base", type: "compile", desc: "Captured lessons and topic knowledge entries", count: "36 entries" }
];

export type EvChunk = { kind: "chunk"; title: string; snippet: string; score: number; doc: string };
export type EvChain = { kind: "chain"; items: string[] };
export type EvGraph = {
  kind: "graph";
  nodes: { id: string; label: string; x: number; y: number; core?: boolean }[];
  edges: { a: string; b: string; label: string }[];
};
export type EvNote = { kind: "note"; title: string; meta: string };
export type EvEntry = { kind: "entry"; title: string; meta: string };
export type Evidence = EvChunk | EvChain | EvGraph | EvNote | EvEntry;

export type ChatAction = {
  id: string;
  label: string;
  taskId: string;
  description: string;
};

export type Answer = {
  text: string; // includes inline [n] citations
  rag: Rag;
  kb: string;
  evidence: Evidence[];
  action?: string; // legacy field: next step beyond Q&A (e.g. compile into a summary)
  actions?: ChatAction[];
};

export type TaskStepStatus = "done" | "active" | "pending";
export type TaskStep = {
  id: string;
  title: string;
  description: string;
  status: TaskStepStatus;
};

export type TaskArtifact = {
  title: string;
  kind: string;
  summary: string;
  sections: string[];
};

export type TaskCanvas = {
  id: string;
  title: string;
  scenarioName: string;
  status: "draft" | "running" | "needs_input" | "ready";
  sourceQuestion: string;
  actionLabel: string;
  inputs: { label: string; value: string }[];
  evidence: { label: string; detail: string }[];
  steps: TaskStep[];
  artifact: TaskArtifact;
  followUps: string[];
};

export type Starter = { label: string; q: string };
export const starters: Starter[] = [
  { label: "Policy Q&A", q: "What is the travel expense limit?" },
  { label: "Customer relationships", q: "Is Northwind Labs worth renewing?" },
  { label: "Lessons learned", q: "How do we tune retrieval quality?" },
  { label: "Topic summary", q: "Put together a summary of healthcare renewal drivers" }
];

export type Agent = { id: string; name: string; desc: string; kbs: string[]; starters: Starter[] };
export const agents: Agent[] = [
  {
    id: "all",
    name: "CompanyBrain",
    desc: "All knowledge bases · general Q&A",
    kbs: ["kb-doc", "kb-rel", "kb-wiki"],
    starters
  },
  {
    id: "sales",
    name: "Sales assistant",
    desc: "Customer relationship base · renewals / due diligence / insights",
    kbs: ["kb-rel"],
    starters: [
      { label: "Renewal decision", q: "Is Northwind Labs worth renewing?" },
      { label: "Customer insight", q: "How does the expansion opportunity look at Acme Health?" }
    ]
  },
  {
    id: "policy",
    name: "Policy assistant",
    desc: "Policy & process library · policies / expenses / contracts",
    kbs: ["kb-doc"],
    starters: [
      { label: "Policy Q&A", q: "What is the travel expense limit?" },
      { label: "Contract clauses", q: "What is the payment schedule in the master agreement?" }
    ]
  },
  {
    id: "research",
    name: "Research assistant",
    desc: "Team knowledge base · summaries / lessons learned",
    kbs: ["kb-wiki"],
    starters: [
      { label: "Lessons learned", q: "How do we tune retrieval quality?" },
      { label: "Topic summary", q: "Put together a summary of healthcare renewal drivers" }
    ]
  }
];

export type Session = { id: string; title: string; when: string; q: string };
export const sessions: Session[] = [
  { id: "s1", title: "Northwind Labs renewal risk", when: "Today", q: "Is Northwind Labs worth renewing?" },
  { id: "s2", title: "Travel expense limits", when: "Today", q: "What is the travel expense limit?" },
  { id: "s3", title: "Retrieval tuning lessons", when: "Yesterday", q: "How do we tune retrieval quality?" },
  { id: "s4", title: "Healthcare renewal drivers", when: "06/21", q: "Put together a summary of healthcare renewal drivers" }
];

export const taskCanvases: TaskCanvas[] = [
  {
    id: "renewal-brief",
    title: "Renewal risk brief",
    scenarioName: "Customer 360 / Relationship risk investigation",
    status: "draft",
    sourceQuestion: "Is Northwind Labs worth renewing?",
    actionLabel: "Generate the renewal risk brief",
    inputs: [
      { label: "Customer", value: "Northwind Labs" },
      { label: "Meeting goal", value: "Advance the renewal" },
      { label: "Audience", value: "Account executive + Customer Success" }
    ],
    evidence: [
      { label: "Relationship chain", detail: "Northwind Labs - master agreement $1.2M - Maya Chen - David Park, CTO" },
      { label: "Risk signal", detail: "No engagement in 14 days; about 3 weeks left in the renewal window" },
      { label: "Opportunity signal", detail: "David Park publicly mentioned expanding the data team" }
    ],
    steps: [
      { id: "confirm", title: "Confirm the customer", description: "Lock the customer, target meeting, and audience.", status: "done" },
      { id: "evidence", title: "Collect evidence", description: "Gather contract, engagement, key-person, and project evidence.", status: "done" },
      { id: "draft", title: "Generate the draft", description: "Generate a shareable risk brief with next steps.", status: "active" },
      { id: "save", title: "Save the deliverable", description: "Save it to the task center and capture it as a team scenario.", status: "pending" }
    ],
    artifact: {
      title: "Northwind Labs renewal risk brief",
      kind: "Customer brief",
      summary: "Renewal risk is elevated, but there is an expansion opportunity. Maya Chen should reach the CTO, David Park, this week and use the Phase 2 expansion plan as the renewal lever.",
      sections: ["Conclusion", "Risk signals", "Opportunity signals", "Relationship evidence", "Next steps"]
    },
    followUps: ["Rewrite it for the sales director", "Add engagement records from the last 30 days", "Capture it as a team renewal-risk scenario"]
  },
  {
    id: "policy-answer",
    title: "Policy answer",
    scenarioName: "Policy & Evidence Q&A",
    status: "ready",
    sourceQuestion: "What is the travel expense limit?",
    actionLabel: "Turn it into a policy answer",
    inputs: [
      { label: "Applies to", value: "All employees" },
      { label: "Answer tone", value: "Safe to forward to the employee who asked" }
    ],
    evidence: [
      { label: "Policy source", detail: "Travel & Expense Policy v3, section 4" },
      { label: "Process source", detail: "Expense submission guide.pdf, page 2" }
    ],
    steps: [
      { id: "confirm", title: "Confirm the request", description: "Confirm the employee question and the applicable policy.", status: "done" },
      { id: "evidence", title: "Collect evidence", description: "Cite the policy clauses and the operating guide.", status: "done" },
      { id: "draft", title: "Generate the draft", description: "Turn it into a forwardable answer.", status: "done" },
      { id: "save", title: "Save the deliverable", description: "Save it to the task center.", status: "active" }
    ],
    artifact: {
      title: "Travel expense limit answer",
      kind: "Policy answer",
      summary: "Hotels in San Francisco are capped at $280 per night and local transport is reimbursed with receipts; anything above the cap needs department head approval in the expense system.",
      sections: ["Answer", "Applicable limits", "Approval exceptions", "Policy basis"]
    },
    followUps: ["Rewrite it as an HR announcement", "Add limits for other US cities", "Share it with the Finance channel"]
  },
  {
    id: "research-brief",
    title: "Topic summary",
    scenarioName: "Files to Knowledge Handbook",
    status: "draft",
    sourceQuestion: "Put together a summary of healthcare renewal drivers",
    actionLabel: "Open the full summary",
    inputs: [
      { label: "Topic", value: "Healthcare renewal drivers" },
      { label: "Audience", value: "Sales team" }
    ],
    evidence: [
      { label: "Knowledge entry", detail: "Healthcare renewal drivers" },
      { label: "Customer cases", detail: "Acme Health / Bayview Medical Group account records" }
    ],
    steps: [
      { id: "confirm", title: "Confirm the request", description: "Confirm the topic and the audience.", status: "done" },
      { id: "evidence", title: "Collect evidence", description: "Aggregate account records and team knowledge entries.", status: "done" },
      { id: "draft", title: "Generate the draft", description: "Generate a cited summary draft.", status: "active" },
      { id: "save", title: "Save the deliverable", description: "Save it to the task center and the knowledge space.", status: "pending" }
    ],
    artifact: {
      title: "Healthcare renewal driver summary",
      kind: "Topic summary",
      summary: "Renewals are driven by three signals: first-phase satisfaction, decision-maker initiative, and compliance endorsement.",
      sections: ["Core conclusion", "Drivers", "Benchmark cases", "Reusable talking points"]
    },
    followUps: ["Turn it into a new-hire study guide", "Add a competitor comparison", "Save it as a knowledge entry"]
  }
];

export function taskForAction(taskId: string): TaskCanvas | undefined {
  return taskCanvases.find((task) => task.id === taskId);
}

const ANSWERS: { match: string[]; answer: Answer }[] = [
  {
    match: ["expense", "travel", "hotel", "transport", "limit"],
    answer: {
      rag: "doc",
      kb: "kb-doc",
      text:
        "Hotels in San Francisco are capped at $280 per night and local transport is reimbursed with receipts[1]; a single meal over $75, or any stay above the hotel cap, needs department head approval[2].",
      action: "Turn it into a policy answer",
      actions: [
        {
          id: "act-policy-answer",
          label: "Turn it into a policy answer",
          taskId: "policy-answer",
          description: "Turn the answer into a standard version you can forward to the employee."
        }
      ],
      evidence: [
        { kind: "chunk", title: "Travel & Expense Policy v3, section 4 · paragraph 2", snippet: "Local transport is reimbursed with receipts up to $75 per one-way trip; hotels in San Francisco are capped at $280 per night...", score: 0.92, doc: "Travel & Expense Policy v3" },
        { kind: "chunk", title: "Expense submission guide.pdf · page 2", snippet: "Any amount above the limit must go through the department head approval flow in the expense system before reimbursement...", score: 0.86, doc: "Expense submission guide" }
      ]
    }
  },
  {
    match: ["northwind", "renewal", "customer", "risk", "due diligence", "worth"],
    answer: {
      rag: "relation",
      kb: "kb-rel",
      text:
        "Renewal risk is elevated. The $1.2M FY26 master agreement with Northwind Labs is still being negotiated, but there has been no engagement in 14 days and the decision window is about 3 weeks[1]. The key decision maker, CTO David Park, recently mentioned publicly that he wants to expand the data team, which is a clear expansion opportunity[2]. Maya Chen should reach David Park directly this week and use the Phase 2 expansion plan as the lever[3].",
      action: "Generate the full due diligence brief",
      actions: [
        {
          id: "act-renewal-brief",
          label: "Generate the renewal risk brief",
          taskId: "renewal-brief",
          description: "Expand the current answer into renewal material the account team can share."
        }
      ],
      evidence: [
        {
          kind: "graph",
          nodes: [
            { id: "ff", label: "Northwind Labs", x: 130, y: 90, core: true },
            { id: "zl", label: "Maya Chen", x: 40, y: 34 },
            { id: "wh", label: "David Park · CTO", x: 232, y: 36 },
            { id: "a", label: "Project Atlas", x: 36, y: 150 },
            { id: "ct", label: "$1.2M master agreement", x: 236, y: 148 }
          ],
          edges: [
            { a: "ff", b: "zl", label: "Owner" },
            { a: "ff", b: "wh", label: "Decision maker" },
            { a: "ff", b: "a", label: "Related to" },
            { a: "ff", b: "ct", label: "In negotiation" }
          ]
        },
        { kind: "chain", items: ["Northwind Labs —renewal— master agreement ($1.2M)", "Northwind Labs —owner— Maya Chen", "Northwind Labs —key person— David Park (CTO)"] },
        { kind: "note", title: "Engagement timeline · no activity in 14 days", meta: "Signal · about 3 weeks left in the renewal window" }
      ]
    }
  },
  {
    match: ["tune", "tuning", "chunk", "retrieval quality", "granularity", "lesson"],
    answer: {
      rag: "compile",
      kb: "kb-wiki",
      text:
        "The captured team lessons give three principles: chunk along semantic boundaries first, then keep each chunk at a length that stands on its own[1], and finally test against real business questions and adjust granularity[2]. You can keep asking about this entry, or compile it into a cited summary in one click.",
      action: "Compile into a topic summary",
      actions: [
        {
          id: "act-research-brief",
          label: "Compile into a topic summary",
          taskId: "research-brief",
          description: "Expand the lesson Q&A into a cited team knowledge entry."
        }
      ],
      evidence: [
        { kind: "entry", title: "Knowledge entry: retrieval tuning · team lessons", meta: "Team knowledge base · traces back to 4 source documents" },
        { kind: "entry", title: "Project Atlas retrospective notes", meta: "Practice source · browsable" }
      ]
    }
  },
  {
    match: ["healthcare", "renewal summary", "summary", "compile"],
    answer: {
      rag: "compile",
      kb: "kb-wiki",
      text:
        "The summary of \"healthcare renewal drivers\" is ready: renewals are driven by three factors — first-phase satisfaction, decision-maker initiative, and compliance endorsement[1]. Acme Health scored NPS 9 after phase one and proactively pushed a multi-site renewal, which makes a good benchmark case to reuse with Bayview Medical Group[2]. Open the panel on the right for the full summary and citations.",
      action: "Open the full summary",
      actions: [
        {
          id: "act-research-brief",
          label: "Open the full summary",
          taskId: "research-brief",
          description: "Open the task canvas to rewrite, save, or capture it as a knowledge entry."
        }
      ],
      evidence: [
        { kind: "entry", title: "Summary draft: healthcare renewal drivers", meta: "Team knowledge base · auto compiled · 6 citations" },
        { kind: "note", title: "Acme Health / Bayview Medical Group account records", meta: "Relationship + team knowledge base" }
      ]
    }
  }
];

export function answerFor(q: string): Answer {
  const t = q.trim();
  for (const a of ANSWERS) {
    if (a.match.some((m) => t.toLowerCase().includes(m))) return a.answer;
  }
  // fallback: generic document answer
  return {
    rag: "doc",
    kb: "kb-doc",
    text: `Searched the mounted knowledge bases for "${t}", checked the evidence, and answered from it[1]. If you want a finished deliverable (brief or summary), pick the matching action on the right.`,
    evidence: [{ kind: "chunk", title: "Matched material · most relevant passage", snippet: "The system retrieved the passage most relevant to the question from the mounted knowledge bases and answered from it...", score: 0.78, doc: "Knowledge base" }]
  };
}

export const ragMeta: Record<Rag, { label: string; c: string; soft: string }> = {
  doc: { label: "Document library", c: "var(--c-document)", soft: "var(--c-document-soft)" },
  relation: { label: "Relationship knowledge base", c: "var(--c-relation)", soft: "var(--c-relation-soft)" },
  compile: { label: "Personal knowledge base", c: "var(--c-personal)", soft: "var(--c-personal-soft)" }
};
