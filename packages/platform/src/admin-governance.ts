import { listScenarioTemplates } from "./templates";

export type AdminTemplateGovernance = {
  id: string;
  name: string;
  owner: string;
  templateState: "official" | "candidate" | "experimental" | "custom" | "paused" | "archived";
  evidenceCoverage: number;
  evidenceSources: string[];
  productForms: string[];
  limitations: string[];
  demoReadiness: number;
  demoScenarioName: string;
  sampleQuestion: string;
  defaultStrategyProfileId: string;
  reviewPolicy: "none" | "sample" | "required";
  acceptedInputs: string[];
  publishState: "published" | "reviewing" | "paused";
  impact: string;
};

export type StrategyProfile = {
  id: string;
  name: string;
  scope: "traditional-rag" | "graph-rag" | "nano-brain" | "company-brain";
  description: string;
  controls: string[];
  status: "active" | "draft" | "archived";
};

export type AdminSummary = {
  area: "templates" | "knowledge_bases" | "strategies" | "pipelines" | "graph" | "evaluations" | "settings" | "audit";
  label: string;
  status: "healthy" | "watch" | "blocked";
  count: number;
};

export type AdminGraphSnapshot = {
  nodes: Array<{ id: string; label: string; type: string; health: "good" | "watch" | "risk" }>;
  edges: Array<{ id: string; source: string; target: string; label: string; confidence: number; evidence: string }>;
  filters: {
    entityTypes: string[];
    relationTypes: string[];
    confidenceThreshold: number;
  };
};

export type AdminAuditEvent = {
  id: string;
  actor: string;
  area: string;
  summary: string;
  impact: string;
  time: string;
};

export function buildAdminTemplateGovernance(): AdminTemplateGovernance[] {
  return listScenarioTemplates().map((template, index) => ({
    id: template.id,
    name: template.name,
    owner: ownerFor(template.id),
    templateState: template.state,
    evidenceCoverage: template.evidenceSources.length >= 2 ? 100 : 60,
    evidenceSources: template.evidenceSources,
    productForms: template.productForms,
    limitations: template.limitations,
    demoReadiness: template.demoWalkthrough.sampleInputs.length >= 2 && template.demoWalkthrough.citations.length >= 2 ? 100 : 55,
    demoScenarioName: template.demoWalkthrough.scenarioName,
    sampleQuestion: template.demoWalkthrough.sampleQuestion,
    defaultStrategyProfileId: defaultStrategyFor(template.id),
    reviewPolicy: template.needsAdminReview ? "required" : index % 3 === 0 ? "none" : "sample",
    acceptedInputs: template.requiredInputs,
    publishState: "published",
    impact: template.outputCapabilities.join(" / ")
  }));
}

export function buildStrategyProfiles(): StrategyProfile[] {
  return [
    profile("traditional-evidence-first", "Evidence first", "traditional-rag", "Official documents first; every answer must carry its source.", ["Strict citations", "Official documents first", "8 results"], "active"),
    profile("graph-risk-expansion", "Graph risk expansion", "graph-rag", "Expand from the target object to contracts, vendors, people, and risk events.", ["Max 3 hops", "Flag low confidence", "Evidence required"], "active"),
    profile("nano-wiki-navigation", "Knowledge page navigation", "nano-brain", "Browse compiled pages and trusted facts first.", ["Page depth 2", "Cross-link navigation", "Facts first"], "active"),
    profile("company-strict-evidence", "Strict evidence answers", "company-brain", "Refuse or flag missing material when there is no evidence.", ["High confidence bar", "Refuse without evidence", "Citations first"], "active")
  ];
}

export function buildAdminOperationSummary(): AdminSummary[] {
  return [
    { area: "templates", label: "Template governance", status: "healthy", count: listScenarioTemplates().length },
    { area: "knowledge_bases", label: "Knowledge assets", status: "healthy", count: 38 },
    { area: "strategies", label: "Retrieval policies", status: "healthy", count: 12 },
    { area: "pipelines", label: "Processing pipelines", status: "watch", count: 7 },
    { area: "graph", label: "Knowledge graph", status: "watch", count: 1 },
    { area: "evaluations", label: "Quality evaluation", status: "healthy", count: 24 },
    { area: "settings", label: "Integrations", status: "watch", count: 5 },
    { area: "audit", label: "Audit log", status: "healthy", count: 96 }
  ];
}

export function buildAdminGraphSnapshot(): AdminGraphSnapshot {
  return {
    nodes: [
      { id: "ff", label: "Northwind Labs", type: "Customer", health: "watch" },
      { id: "zl", label: "Maya Chen", type: "Owner", health: "good" },
      { id: "wh", label: "David Park, CTO", type: "Key stakeholder", health: "good" },
      { id: "contract-main", label: "Annual master agreement", type: "Contract", health: "watch" },
      { id: "expansion", label: "Phase 2 expansion", type: "Opportunity", health: "good" },
      { id: "risk-gap", label: "Engagement stalled", type: "Risk", health: "risk" }
    ],
    edges: [
      edge("ff", "zl", "Owner", 0.86, "CRM account table"),
      edge("ff", "wh", "Key decision maker", 0.91, "Meeting notes"),
      edge("ff", "contract-main", "In renewal", 0.88, "Contract records"),
      edge("contract-main", "expansion", "Bound to expansion", 0.81, "Sales opportunity table"),
      edge("ff", "risk-gap", "At risk", 0.76, "Engagement timeline"),
      edge("wh", "expansion", "Driving", 0.72, "Public signals")
    ],
    filters: {
      entityTypes: ["Customer", "Person", "Contract", "Opportunity", "Risk"],
      relationTypes: ["Owner", "Key decision maker", "In renewal", "Bound to expansion", "At risk"],
      confidenceThreshold: 0.7
    }
  };
}

export function buildAdminAuditEvents(): AdminAuditEvent[] {
  return [
    audit("admin@northwindlabs.com", "Template governance", "Published the Customer 360 template", "The workspace can now create customer analysis scenarios"),
    audit("ops@northwindlabs.com", "Retrieval policies", "Enabled strict evidence answers", "High-risk questions must keep citations"),
    audit("qa@northwindlabs.com", "Quality evaluation", "Finished the support policy comparison run", "The support template keeps the evidence-first policy"),
    audit("risk@northwindlabs.com", "Knowledge graph", "Adjusted the risk relationship threshold", "Low-confidence relationships go to human review"),
    audit("system@northwindlabs.com", "Processing pipelines", "Retried the security questionnaire task", "The questionnaire answer pack was regenerated")
  ];
}

function profile(id: StrategyProfile["id"], name: string, scope: StrategyProfile["scope"], description: string, controls: string[], status: StrategyProfile["status"]): StrategyProfile {
  return { id, name, scope, description, controls, status };
}

function edge(source: string, target: string, label: string, confidence: number, evidence: string) {
  return { id: `${source}-${target}-${label}`, source, target, label, confidence, evidence };
}

function audit(actor: string, area: string, summary: string, impact: string): AdminAuditEvent {
  return { id: `${area}-${summary}`, actor, area, summary, impact, time: "2026-06-25 10:30" };
}

function ownerFor(id: string): string {
  if (id.includes("customer") || id.includes("rfp")) return "Sales Ops";
  if (id.includes("support")) return "Customer Success";
  if (id.includes("risk") || id.includes("domain")) return "Risk & Compliance";
  if (id.includes("contract")) return "Legal";
  return "Knowledge Ops";
}

function defaultStrategyFor(id: string): string {
  if (id.includes("risk") || id.includes("domain") || id.includes("customer")) return "graph-risk-expansion";
  if (id.includes("wiki") || id.includes("handbook") || id.includes("research")) return "nano-wiki-navigation";
  if (id.includes("support")) return "company-strict-evidence";
  return "traditional-evidence-first";
}
