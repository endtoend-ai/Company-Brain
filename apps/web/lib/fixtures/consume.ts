// Advanced consumption surfaces: source reader (doc) / graph explorer (relation) / compiled pages (compile)

/* ---------------- Source reader (kotaemon/RAGFlow style) ---------------- */
export type DocPara = { t: string; hi?: boolean };
export type DocBody = { title: string; meta: string; paras: DocPara[] };

export const docBodies: Record<string, DocBody> = {
  "Travel & Expense Policy v3": {
    title: "Travel & Expense Policy v3",
    meta: "Policy & process library · section 4 · paragraph 2",
    paras: [
      { t: "Section 4 Travel expense limits" },
      { t: "4.1 Flights and rail: book economy class or standard rail for business travel; flights are allowed when the one-way distance exceeds 500 miles." },
      { t: "4.2 Local transport is reimbursed with receipts up to $75 per one-way trip; hotels are capped at $280 per night in San Francisco and $200 per night in other US cities.", hi: true },
      { t: "4.3 Meals are reimbursed at $75 per day per traveler; individual meal receipts are not submitted separately." },
      { t: "Section 5 Approval flow" },
      { t: "5.1 Any expense above the section 4 limits needs department head approval in the expense system before reimbursement." }
    ]
  },
  "Expense submission guide": {
    title: "Expense submission guide.pdf",
    meta: "Policy & process library · page 2",
    paras: [
      { t: "2. Submission flow" },
      { t: "1) Create a new report in the expense system, enter each expense by category, and upload the receipt images." },
      { t: "2) Any amount above the limit must go through the department head approval flow in the expense system before reimbursement.", hi: true },
      { t: "3) Once Finance review passes, the payment lands in the payroll account by the 15th of the following month." }
    ]
  }
};

/* ---------------- Graph explorer (GraphRAG-Local-UI style: 2D graph + global/local/direct) ---------------- */
export type GNode = { id: string; label: string; cluster: string; x: number; y: number; core?: boolean };
export type GEdge = { a: string; b: string; label: string };

export const explorer: { nodes: GNode[]; edges: GEdge[]; clusters: { id: string; name: string; color: string }[] } = {
  clusters: [
    { id: "east", name: "West Coast high-potential accounts", color: "#b5722a" },
    { id: "people", name: "Team members", color: "#2e7d6b" },
    { id: "asset", name: "Projects and contracts", color: "#3e5c86" }
  ],
  nodes: [
    { id: "ff", label: "Northwind Labs", cluster: "east", x: 300, y: 220, core: true },
    { id: "yq", label: "Skyline Networks", cluster: "east", x: 150, y: 120 },
    { id: "zd", label: "Atlas Industrial", cluster: "east", x: 130, y: 320 },
    { id: "zl", label: "Maya Chen", cluster: "people", x: 360, y: 90 },
    { id: "ln", label: "Olivia Grant", cluster: "people", x: 470, y: 180 },
    { id: "wh", label: "David Park · CTO", cluster: "people", x: 470, y: 300 },
    { id: "a", label: "Project Atlas", cluster: "asset", x: 230, y: 360 },
    { id: "ct1", label: "$1.2M master agreement", cluster: "asset", x: 440, y: 400 },
    { id: "ct2", label: "$450K expansion", cluster: "asset", x: 300, y: 420 }
  ],
  edges: [
    { a: "ff", b: "zl", label: "Owner" },
    { a: "ff", b: "wh", label: "Key person" },
    { a: "ff", b: "a", label: "Related to" },
    { a: "ff", b: "ct1", label: "In negotiation" },
    { a: "ff", b: "ct2", label: "In negotiation" },
    { a: "yq", b: "zl", label: "Owner" },
    { a: "zd", b: "zl", label: "Owner" },
    { a: "ln", b: "ff", label: "Collaborates" },
    { a: "yq", b: "ff", label: "Same cluster" }
  ]
};

export const explorerModes = [
  { id: "global", name: "Global", desc: "Whole-corpus view of themes and clusters: West Coast high-potential accounts are this quarter's focus, and Maya Chen is the relationship hub (owns 3 accounts), with the densest connections." },
  { id: "local", name: "Local", desc: "Northwind Labs' direct neighborhood: owner Maya Chen, decision maker David Park, related Project Atlas, and two contracts in negotiation ($1.2M + $450K)." },
  { id: "direct", name: "Direct", desc: "Direct facts: the Northwind Labs master agreement renewal is worth $1.2M, currently in negotiation, owned by Maya Chen." }
];

/* ---------------- Pages / auto summary (STORM/Co-STORM style) ---------------- */
export type PageSection = { id: string; heading: string; paras: { t: string; cites?: number[] }[] };
export type PageDoc = {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  outline: PageSection[];
  sources: { n: number; title: string; meta: string }[];
  mind: { root: string; branches: { label: string; children: string[] }[] };
};

export const pages: Record<string, PageDoc> = {
  medical: {
    id: "medical",
    kicker: "Topic summary · auto compiled",
    title: "Healthcare renewal drivers",
    lead: "Compiled from the team knowledge base and account records, this summary lays out what drives renewals for healthcare customers, for the sales and Customer Success teams.",
    outline: [
      {
        id: "s1",
        heading: "1. The three renewal drivers",
        paras: [
          { t: "Healthcare renewals are driven by three factors together — first-phase delivery satisfaction, decision-maker initiative, and compliance endorsement — and if any one is missing the renewal cycle lengthens noticeably.", cites: [1] },
          { t: "First-phase satisfaction is the precondition: satisfied customers are more willing to open the next-phase conversation themselves instead of waiting for the seller to push.", cites: [2] }
        ]
      },
      {
        id: "s2",
        heading: "2. Benchmark case: Acme Health",
        paras: [
          { t: "Acme Health scored NPS 9 after phase one, and decision maker Hannah Lee proactively asked about a multi-site plan; the $2.2M phase-two renewal is now in negotiation, which makes it a positive healthcare benchmark.", cites: [2] },
          { t: "Ask for permission to cite the case as compliance endorsement for same-cluster accounts (such as Bayview Medical Group) to reduce their decision risk.", cites: [3] }
        ]
      },
      {
        id: "s3",
        heading: "3. Recommended sales actions",
        paras: [
          { t: "For customers with heavy compliance requirements and long decision chains (such as Bayview Medical Group), use a peer benchmark case plus compliance delivery experience to speed things up, and have the account owner arrange a reference visit.", cites: [3] }
        ]
      }
    ],
    sources: [
      { n: 1, title: "Knowledge entry: healthcare customer success playbook", meta: "Team knowledge base · traces back to 4 documents" },
      { n: 2, title: "Acme Health · account record and phase-one sign-off", meta: "Relationship + document library · NPS 9" },
      { n: 3, title: "Bayview Medical Group · account record", meta: "Relationship knowledge base" }
    ],
    mind: {
      root: "Renewal drivers",
      branches: [
        { label: "Phase-one satisfaction", children: ["NPS", "Proactive negotiation"] },
        { label: "Decision-maker initiative", children: ["Hannah Lee", "Multi-site"] },
        { label: "Compliance endorsement", children: ["Benchmark case", "Reference visit"] }
      ]
    }
  },
  dd: {
    id: "dd",
    kicker: "Due diligence brief · auto compiled",
    title: "Northwind Labs · customer due diligence brief",
    lead: "Compiled from the customer and relationship base, this brief focuses on the Northwind Labs renewal risk and expansion opportunity for this week's follow-up decision.",
    outline: [
      {
        id: "s1",
        heading: "1. Conclusion",
        paras: [{ t: "Renewal risk is elevated and the expansion opportunity is clear. Maya Chen should reach the CTO, David Park, this week and use the Phase 2 expansion plan to unlock the $1.2M master agreement renewal.", cites: [1] }]
      },
      {
        id: "s2",
        heading: "2. Key findings",
        paras: [
          { t: "The $1.2M renewal is in negotiation and is bundled with a $450K data module expansion; however there has been no engagement in 14 days and about 3 weeks remain in the window.", cites: [1, 2] },
          { t: "CTO David Park has publicly mentioned expanding the data team, so the timing for expansion is right.", cites: [3] }
        ]
      },
      {
        id: "s3",
        heading: "3. Next steps",
        paras: [{ t: "(1) Book David Park this week with the Phase 2 plan; (2) align the POC results with his team-expansion goal; (3) run the expansion together with the renewal.", cites: [] }]
      }
    ],
    sources: [
      { n: 1, title: "Northwind Labs · master agreement and relationship chain", meta: "Relationship knowledge base" },
      { n: 2, title: "Engagement timeline · no activity in 14 days", meta: "Signal · 3 weeks left in the window" },
      { n: 3, title: "Account record: David Park (CTO)", meta: "Relationship knowledge base · public signal" }
    ],
    mind: {
      root: "Northwind Labs",
      branches: [
        { label: "Renewal", children: ["$1.2M", "3-week window"] },
        { label: "Expansion", children: ["Phase 2 plan", "David Park's goal"] },
        { label: "Next steps", children: ["Maya Chen", "This week"] }
      ]
    }
  }
};
