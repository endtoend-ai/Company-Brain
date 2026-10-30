import type { Visibility } from "./types";
import type { TemplateDemoWalkthrough } from "./types";

export const PRODUCT_FACING_FORBIDDEN_WORDS = ["mock", "fake", "fixture", "synthetic", "伪造", "虚构"];

export type DemoAssetFormat = "md" | "pdf" | "csv" | "txt" | "json";

export type DemoAsset = {
  id: string;
  scenarioId: string;
  templateId: string;
  title: string;
  fileName: string;
  format: DemoAssetFormat;
  mimeType: string;
  text: string;
};

export type DemoScenario = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  visibility: Visibility;
  department: string;
  ownerUsername: string;
  question: string;
};

export type DeliveryDemoDataPlan = {
  generatedAt: string;
  scenarios: DemoScenario[];
  assets: DemoAsset[];
};

export type TemplateDemoWalkthroughRecord = TemplateDemoWalkthrough & {
  templateId: string;
};

export type IngestFile = {
  name: string;
  text: string;
  mimeType?: string;
};

type TemplateSeed = {
  templateId: string;
  department: string;
  visibility: Visibility;
  ownerUsername: string;
  scenarioNames: string[];
  question: string;
  assetFormats: DemoAssetFormat[];
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  seed("personal-wiki", "Sales", "private", "Maya Chen", ["Maya's Sales Notes Wiki", "West Coast Account Retrospective Library", "Objection Handling Playbook"], "What are the most common customer objections across these Markdown notes?", ["md", "md", "csv", "pdf"]),
  seed("team-handbook", "Sales Ops", "team", "Jordan Lee", ["Sales New Hire Onboarding Handbook", "Customer Success Handoff Handbook", "Pre-Sales Delivery Collaboration Handbook"], "Turn the team's materials into a handbook new hires can learn chapter by chapter.", ["md", "pdf", "csv", "txt"]),
  seed("policy-evidence", "HR & Finance", "company", "Priya Shah", ["Travel & Expense Policy Q&A", "Procurement Approval Policy Q&A", "IT Access Request Policy Q&A"], "What is the hotel reimbursement cap in San Francisco, and what approval does it need?", ["pdf", "pdf", "csv", "md"]),
  seed("contract-playbook", "Legal", "team", "Daniel Kim", ["SaaS Subscription Contract Review", "Channel Partner Agreement Review", "Data Processing Agreement Review"], "Which clauses in this contract are high risk, and how should they be revised?", ["pdf", "txt", "csv", "md"]),
  seed("rfp-security", "Solutions Engineering", "team", "Alex Rivera", ["Pacific Union Bank Security Questionnaire Response", "Summit Manufacturing RFP Response", "Acme Health Compliance Questionnaire Response"], "Draft standard answers for the customer security questionnaire and flag the items that still need confirmation.", ["csv", "pdf", "md", "txt"]),
  seed("customer-360", "Sales", "team", "Maya Chen", ["Northstar Cloud Renewal Brief", "Acme Health Expansion Brief", "Summit Manufacturing Risk Brief"], "Produce a pre-meeting customer brief, the relationship path, and recommended next steps.", ["csv", "json", "pdf", "md"]),
  seed("risk-investigation", "Risk & Compliance", "team", "Emily Carter", ["Skyline Networks Relationship Risk Investigation", "Northstar Cloud Supply Chain Due Diligence", "Bridgepoint Capital Affiliation Verification"], "Trace multi-hop relationships, risk events, and the evidence chain.", ["json", "pdf", "csv", "txt"]),
  seed("domain-relationship", "Industry Research", "team", "Michael Torres", ["Healthcare Account Relationship Base", "Manufacturing Supply Chain Object Base", "Financial Risk Relationship Base"], "Model domain objects and relationships, then answer how one object affects another.", ["json", "pdf", "csv", "md"]),
  seed("support-agent", "Customer Success", "team", "Sarah Johnson", ["Post-Sale Support Knowledge Agent", "Orders & Invoicing Support Agent", "Returns & Exchanges Support Agent"], "Turn the help center and post-sale processes into an embeddable support knowledge agent.", ["csv", "txt", "pdf", "md"]),
  seed("research-guide", "Industry Research", "private", "Research team", ["Healthcare Renewal Research Guide", "Enterprise Knowledge Platform Research", "AI Support Rollout Case Review"], "Turn the research pack into a research report and a study guide.", ["md", "pdf", "csv", "txt"]),
  seed("data-analyst", "Business Analytics", "team", "Olivia Grant", ["West Coast Quarterly Sales Metrics Analysis", "Channel Conversion Anomaly Diagnosis", "Renewal Revenue Variance Analysis"], "What drove the largest revenue swings in the West Coast region over the past three quarters?", ["csv", "md", "json", "pdf"]),
  seed("it-runbook", "IT Operations", "team", "Ethan Brooks", ["Payment Gateway Incident Runbook", "Data Sync Alert Response Runbook", "Customer Portal Login Troubleshooting Guide"], "When payment callbacks time out, what should the on-call engineer check first?", ["md", "csv", "txt", "pdf"]),
  seed("meeting-media-memory", "Customer Success", "team", "Rachel Nguyen", ["Northstar Cloud Renewal Meeting Notes", "Southwest Manufacturing Account Review Notes", "Product Review Decision Record"], "Which risks, decisions, and action items did this meeting confirm?", ["md", "txt", "pdf", "csv"]),
  seed("voice-of-customer", "Product Ops", "team", "Hannah Lee", ["Enterprise Permissions Demand Insights", "Support Ticket Demand Clustering", "Key Account Feedback Analysis"], "Which permissions-related requests most affect Enterprise renewals?", ["csv", "md", "json", "txt"])
];

function seed(templateId: string, department: string, visibility: Visibility, ownerUsername: string, scenarioNames: string[], question: string, assetFormats: DemoAssetFormat[]): TemplateSeed {
  return { templateId, department, visibility, ownerUsername, scenarioNames, question, assetFormats };
}

let cachedPlan: DeliveryDemoDataPlan | null = null;

export function buildDeliveryDemoDataPlan(): DeliveryDemoDataPlan {
  if (cachedPlan) return cachedPlan;
  const scenarios = TEMPLATE_SEEDS.flatMap((templateSeed) =>
    templateSeed.scenarioNames.map((name, index) => ({
      id: `${templateSeed.templateId}-${index + 1}`,
      templateId: templateSeed.templateId,
      name,
      description: descriptionFor(templateSeed.templateId, name),
      visibility: templateSeed.visibility,
      department: templateSeed.department,
      ownerUsername: templateSeed.ownerUsername,
      question: templateSeed.question
    }))
  );
  const assets = scenarios.flatMap((scenario) => {
    const templateSeed = TEMPLATE_SEEDS.find((item) => item.templateId === scenario.templateId)!;
    return templateSeed.assetFormats.flatMap((format, assetIndex) =>
      [0, 1].map((copyIndex) => buildAsset(scenario, format, assetIndex * 2 + copyIndex + 1))
    );
  });
  cachedPlan = { generatedAt: "2026-06-25T00:00:00.000Z", scenarios, assets };
  return cachedPlan;
}

export function buildTemplateDemoWalkthroughs(): TemplateDemoWalkthroughRecord[] {
  const plan = buildDeliveryDemoDataPlan();
  return TEMPLATE_SEEDS.map((templateSeed) => {
    const scenario = plan.scenarios.find((item) => item.templateId === templateSeed.templateId)!;
    const assets = plan.assets.filter((item) => item.scenarioId === scenario.id).slice(0, 3);
    return {
      templateId: templateSeed.templateId,
      scenarioName: scenario.name,
      sampleInputs: assets.slice(0, 2).map((asset) => ({
        title: asset.title,
        fileName: asset.fileName,
        fileType: asset.format,
        description: `${scenario.department} material used to answer "${scenario.question}".`
      })),
      processingPreview: ["Read the business materials", "Organize the knowledge structure", "Generate answers, citations, and a deliverable preview"],
      sampleQuestion: scenario.question,
      sampleAnswer: `${scenario.name} is ready. The system returns a business conclusion, recommended next steps, and verifiable sources, and the user can keep asking follow-up questions or create a formal scenario.`,
      citations: assets.slice(0, 2).map((asset) => ({
        label: asset.title,
        source: asset.fileName,
        excerpt: asset.text.slice(0, 100)
      })),
      resultHighlights: ["Sample answer", "Cited sources", "Deliverable preview"]
    };
  });
}

export function buildDemoScenarioSeedRequests() {
  const plan = buildDeliveryDemoDataPlan();
  return plan.scenarios.map((scenario) => {
    const assets = plan.assets.filter((asset) => asset.scenarioId === scenario.id);
    return {
      template_id: scenario.templateId,
      name: scenario.name,
      description: scenario.description,
      visibility: scenario.visibility,
      uploaded_files: assets.map((asset) => ({
        name: asset.fileName,
        type: asset.mimeType,
        size: asset.text.length
      })),
      business_options: {
        department: scenario.department,
        owner_username: scenario.ownerUsername,
        seed_question: scenario.question,
        seed_asset_ids: assets.map((asset) => asset.id)
      }
    };
  });
}

export function buildScenarioIngestFiles(input: {
  scenarioName: string;
  scenarioDescription: string;
  businessOptions?: Record<string, unknown>;
}): IngestFile[] {
  const candidateIds = input.businessOptions?.seed_asset_ids;
  const ids = Array.isArray(candidateIds)
    ? candidateIds.map(String)
    : [];
  const assetsById = new Map(buildDeliveryDemoDataPlan().assets.map((asset) => [asset.id, asset]));
  const files = ids.map((id) => assetsById.get(id)).filter((asset): asset is DemoAsset => Boolean(asset));
  if (files.length > 0) {
    return files.map((asset) => ({ name: asset.fileName, text: asset.text, mimeType: asset.mimeType }));
  }
  return [{
    name: `${input.scenarioName}.md`,
    text: `# ${input.scenarioName}\n\n${input.scenarioDescription}\n\nThis material was submitted through the scenario creation flow and is used to establish the initial knowledge source.\n\n## Business question\n\nThe answer needs a conclusion, supporting evidence, risks, and next actions.`,
    mimeType: "text/markdown"
  }];
}

function buildAsset(scenario: DemoScenario, format: DemoAssetFormat, index: number): DemoAsset {
  const title = assetTitle(scenario, format, index);
  return {
    id: `${scenario.id}-${format}-${index}`,
    scenarioId: scenario.id,
    templateId: scenario.templateId,
    title,
    fileName: `${title}.${format}`,
    format,
    mimeType: mimeType(format),
    text: assetText(scenario, title, format, index)
  };
}

function descriptionFor(templateId: string, name: string): string {
  const map: Record<string, string> = {
    "personal-wiki": "Turn personal notes, Markdown, and reference packs into a browsable personal knowledge space you can question.",
    "team-handbook": "Turn team materials, meeting notes, and project retrospectives into a shareable team handbook.",
    "policy-evidence": "Answer frequent employee questions from official policies, approval flows, and operating guides, keeping the source attached.",
    "contract-playbook": "Turn contract templates, review rules, and past risk clauses into a review playbook.",
    "rfp-security": "Ingest customer questionnaires and generate trustworthy answer drafts, open items, and cited evidence.",
    "customer-360": "Generate a pre-meeting customer brief with risk signals, opportunity signals, and next steps.",
    "risk-investigation": "Trace relationships, risk events, and the evidence chain around a company, vendor, or project.",
    "domain-relationship": "Give domain-specific material object and relationship Q&A capabilities.",
    "support-agent": "Package the help center and post-sale processes into an embeddable support knowledge agent.",
    "research-guide": "Turn a reference pack into a research report, study guide, summary, and cited version.",
    "data-analyst": "Turn business spreadsheets, metric definitions, and past reviews into an analyst you can question.",
    "it-runbook": "Turn runbooks, past tickets, and alert notes into an executable troubleshooting path.",
    "meeting-media-memory": "Turn meeting transcripts, attachments, and action items into a questioning-friendly meeting knowledge asset.",
    "voice-of-customer": "Aggregate tickets, interviews, and feedback to identify high-frequency demand, affected customers, and the evidence chain."
  };
  return `${name}: ${map[templateId]}`;
}

function assetTitle(scenario: DemoScenario, format: DemoAssetFormat, index: number): string {
  const suffix: Record<DemoAssetFormat, string> = {
    md: "Business Notes",
    pdf: "Official Document",
    csv: "Structured Records",
    txt: "Interview Notes",
    json: "Relationship Objects"
  };
  return `${scenario.name} - ${suffix[format]} - ${index}`;
}

function assetText(scenario: DemoScenario, title: string, format: DemoAssetFormat, index: number): string {
  if (format === "csv") return csvText(scenario);
  if (format === "json") return JSON.stringify(graphText(scenario), null, 2);
  const paragraphs = [
    `# ${title}`,
    "",
    `Scenario: ${scenario.name}`,
    `Department: ${scenario.department}`,
    `Owner: ${scenario.ownerUsername}`,
    `Target question: ${scenario.question}`,
    "",
    scenario.description,
    "",
    "## Key materials",
    "- This material covers the business background, object status, risk signals, and citable evidence.",
    "- Sources must be preserved after processing; generic advice alone is not acceptable.",
    "- The output needs to cover the conclusion, evidence, next actions, and items pending review.",
    "",
    "## Business facts",
    ...businessFactsFor(scenario),
    `1. ${scenario.ownerUsername} owns follow-up on the main object of ${scenario.name}.`,
    `2. Record batch ${index} includes the most recent meeting, structured fields, and business notes.`,
    "3. When evidence is insufficient, the system must flag it for confirmation instead of stating a fixed conclusion.",
    "",
    "## Open questions",
    `1. ${scenario.question}`,
    "2. Which evidence can be cited directly to the business owner?",
    "3. Which items need human review or admin confirmation?",
    "",
    "## Processing requirements",
    "The output must include the conclusion, evidence, risks, next actions, and knowledge entries worth retaining."
  ];
  return paragraphs.join("\n");
}

function csvText(scenario: DemoScenario): string {
  const rows = structuredRowsFor(scenario);
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function graphText(scenario: DemoScenario) {
  const base = {
    nodes: [
      { id: "company", label: scenario.name, type: "company" },
      { id: "owner", label: scenario.ownerUsername, type: "person" },
      { id: "contract", label: "Master agreement", type: "contract" },
      { id: "risk", label: "Risk pending confirmation", type: "risk" }
    ],
    edges: [
      { from: "owner", to: "company", label: "owns" },
      { from: "company", to: "contract", label: "relates to" },
      { from: "contract", to: "risk", label: "includes" }
    ]
  };
  if (scenario.templateId === "customer-360") {
    return {
      nodes: [
        ...base.nodes,
        { id: "cto", label: "CTO David Park", type: "person" },
        { id: "expansion", label: "Phase 2 data governance expansion", type: "opportunity" }
      ],
      edges: [
        ...base.edges,
        { from: "cto", to: "risk", label: "worried about integration cost" },
        { from: "company", to: "expansion", label: "expansion opportunity" },
        { from: "owner", to: "cto", label: "needs schedule confirmation" }
      ]
    };
  }
  if (scenario.templateId === "voice-of-customer") {
    return {
      nodes: [
        ...base.nodes,
        { id: "role-template", label: "Role templates", type: "feature" },
        { id: "audit-export", label: "Audit export", type: "feature" }
      ],
      edges: [
        ...base.edges,
        { from: "company", to: "role-template", label: "high-frequency demand" },
        { from: "company", to: "audit-export", label: "renewal impact" }
      ]
    };
  }
  return base;
}

function businessFactsFor(scenario: DemoScenario): string[] {
  const map: Record<string, string[]> = {
    "personal-wiki": [
      "- Customer objections cluster around frozen budgets, system integration timelines, and onboarding and training cost.",
      "- Closed-won cases show that a small pilot plus a Phase 2 expansion path is easier to get through budget approval.",
      "- Sales needs to turn each objection into a Q&A card and link it to the matching account retrospective."
    ],
    "team-handbook": [
      "- In the first week, new hires complete four chapters: product positioning, customer profiles, pricing rules, and meeting preparation.",
      "- The recurring mistake in team retrospectives is not confirming the customer decision chain and the owner of the next step.",
      "- Once published, Sales Ops maintains the handbook versions and opens it for team-wide retrieval."
    ],
    "policy-evidence": [
      "- The hotel cap for individual contributors traveling to San Francisco is $280 per night; anything above needs manager and Finance review.",
      "- When customer meetings or conferences push costs higher, the expense report must include a written justification.",
      "- Policy answers must cite the policy version, the clause location, and the approval flow."
    ],
    "contract-playbook": [
      "- Auto-renewal requires written notice 60 days before the term ends; otherwise customers often dispute the renewal.",
      "- Liability should be capped at the annual service fee to avoid unlimited exposure.",
      "- Customer data may only be used for delivery, support, and the scope defined in the agreement, never for model training."
    ],
    "rfp-security": [
      "- Identity supports SAML 2.0 and OIDC and can federate with the customer's IdP.",
      "- Log retention defaults to 180 days; regulated customers can request an extension to 365 days.",
      "- Data residency and dedicated deployment require the security lead to confirm the project configuration."
    ],
    "customer-360": [
      "- Renewal risk comes from delayed procurement approval and the CTO's concern about integration cost.",
      "- The opportunity comes from Phase 2 expansion, already confirmed by the business owner, which should affect H2 data governance budget.",
      "- Next step: Customer Success shares rollout results, and the account executive books the CTO to confirm the integration schedule."
    ],
    "risk-investigation": [
      "- Critical services concentrate on a single vendor whose staff overlap with a previously delayed project.",
      "- Low-confidence relationships need Risk & Compliance review before they enter a formal due diligence conclusion.",
      "- The relationship chain should show contracts, projects, people, and risk-event sources together."
    ],
    "domain-relationship": [
      "- Healthcare purchasing decisions are shaped by clinical department demand, biomedical engineering evaluation, and IT integration requirements.",
      "- Comparable deployments shorten evaluation, but in-hospital process evidence is still required.",
      "- Domain entities need to separate departments, equipment, vendors, projects, and regulatory requirements."
    ],
    "support-agent": [
      "- When an order is three days late, support should check the shipment status first, then explain the reship or the delay reason.",
      "- Past the committed service window, support can offer the compensation policy and escalate to a human when sentiment is poor.",
      "- Before launch, verify refusal behavior, knowledge gaps, and the human handoff rules."
    ],
    "research-guide": [
      "- Healthcare renewals are usually driven by rollout results, departmental expansion demand, and the stability of IT integration.",
      "- The study guide should follow the customer stage: live accounts look at outcome proof, expanding accounts look at cross-department cases.",
      "- Research material must keep its citations and never present internal judgment as a public conclusion."
    ],
    "data-analyst": [
      "- The Q3 FY26 revenue swing came from delayed enterprise renewals; the following quarter came from channel orders closing in one period.",
      "- Analysis dimensions should include customer stage, channel source, contract status, and the finance recognition basis.",
      "- The output should explain the anomaly, name the drill-down dimensions, and suggest the data still to be collected."
    ],
    "it-runbook": [
      "- On a payment callback timeout, check the external gateway status, the callback queue backlog, and the latest release records first.",
      "- If errors concentrate on a single merchant, check the callback signature, retry counts, and merchant configuration.",
      "- On-call guidance must retain the alert rules, past tickets, and the escalation path."
    ],
    "meeting-media-memory": [
      "- The meeting confirmed that the delayed procurement approval is the core risk and that the CTO must re-check the integration schedule.",
      "- The account executive sends the rollout results material; Customer Success shares the Phase 2 expansion scope.",
      "- Action items must be recorded with owner, due date, and dependent materials."
    ],
    "voice-of-customer": [
      "- High-frequency demand centers on role templates, approval logs, and cross-team data isolation.",
      "- Affected customers are mostly financial services and manufacturing; the renewal impact outweighs ordinary feature polish.",
      "- Product leads must review customer impact, evidence sources, and roadmap recommendations together."
    ]
  };
  return map[scenario.templateId] ?? [
    "- The material covers the business background, object status, risk signals, and citable evidence.",
    "- The result must cover the conclusion, evidence, next actions, and items pending review.",
    "- The visibility scope decides whether the material reaches personal, team, or company-wide retrieval."
  ];
}

function structuredRowsFor(scenario: DemoScenario): string[][] {
  if (scenario.templateId === "data-analyst") {
    return [
      ["Quarter", "Region", "Revenue (USD)", "Customer stage", "Channel", "Contract status", "Notes"],
      ["Q4 FY25", "West Coast", "3,180,000", "Renewal", "Direct", "Confirmed", "Stable revenue"],
      ["Q1 FY26", "West Coast", "2,760,000", "Renewal", "Channel", "Pending", "Enterprise approval delayed"],
      ["Q2 FY26", "West Coast", "3,920,000", "Expansion", "Direct", "Confirmed", "Channel orders closed together"]
    ];
  }
  if (scenario.templateId === "support-agent") {
    return [
      ["Ticket ID", "Issue type", "Customer sentiment", "Order status", "Recommended action", "Knowledge gap"],
      ["CS-1842", "Order delay", "Anxious", "Oakland warehouse cycle count delay", "Explain the cause and offer compensation", "None"],
      ["CS-1917", "Invoice reissue", "Neutral", "Already issued", "Guide the customer through a billing entity change", "E-invoicing rules need an update"],
      ["CS-2033", "Return / exchange", "Unsatisfied", "Past committed window", "Escalate to a human and mark high priority", "Compensation policy needs confirmation"]
    ];
  }
  if (scenario.templateId === "voice-of-customer") {
    return [
      ["Request", "Affected customers", "Industry", "Renewal impact", "Evidence source", "Recommended priority"],
      ["Role templates", "18", "Financial services / Manufacturing", "High", "Tickets and interviews", "P0"],
      ["Approval logs", "12", "Financial services", "High", "Security questionnaire", "P0"],
      ["Cross-team isolation", "9", "Manufacturing", "Medium", "Customer interviews", "P1"]
    ];
  }
  return [
    ["Record ID", "Object", "Type", "Owner", "Amount (USD)", "Status", "Last updated", "Notes"],
    ["R-001", scenario.name, "Primary object", scenario.ownerUsername, "1,200,000", "In progress", "06/12/2026", "Follow up with the key stakeholder"],
    ["R-002", "Phase 2 expansion", "Opportunity", scenario.ownerUsername, "450,000", "Evaluating", "06/14/2026", "Tied to the master agreement"],
    ["R-003", "Approval confirmation", "Process", "Operations team", "0", "Pending", "06/15/2026", "Attachments still needed"]
  ];
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function mimeType(format: DemoAssetFormat): string {
  const map: Record<DemoAssetFormat, string> = {
    md: "text/markdown",
    pdf: "application/pdf",
    csv: "text/csv",
    txt: "text/plain",
    json: "application/json"
  };
  return map[format];
}
