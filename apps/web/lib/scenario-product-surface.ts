import { officialTemplates, type ScenarioTemplate, type TemplateProductForm } from "./fixtures/frontstage";

export type ScenarioProductSurfaceKind = Exclude<TemplateProductForm, "chat" | "hybrid"> | "chat" | "hybrid";

export type ScenarioProductSurface = {
  kind: ScenarioProductSurfaceKind;
  label: string;
  headline: string;
  description: string;
  workspaceTitle: string;
  contextPanelTitle: string;
  rightRailMode: "sources" | "document" | "graph" | "widget" | "tasks" | "report";
  primaryAction: {
    label: string;
    prompt: string;
  };
  secondaryActions: Array<{
    label: string;
    prompt: string;
  }>;
  quickPrompts: string[];
  emptyState: string;
};

const surfaceCopy: Record<ScenarioProductSurfaceKind, Omit<ScenarioProductSurface, "kind" | "label">> = {
  embedded_assistant: {
    headline: "Publish knowledge as an assistant embedded in a business entry point.",
    description: "Fits support, after-sales, and help-center single-entry use cases. The job is not endless chat but answering, spotting knowledge gaps, and handing off to a human.",
    workspaceTitle: "Support assistant workbench",
    contextPanelTitle: "Matches and handoffs",
    rightRailMode: "widget",
    primaryAction: { label: "Open support assistant", prompt: "Take a real customer question and return the answer, the citations, and whether it needs a human." },
    secondaryActions: [
      { label: "Check knowledge gaps", prompt: "Show which high-frequency questions still lack answerable evidence in the current files." },
      { label: "Generate handoff rules", prompt: "Draft the handoff boundaries and wording this knowledge base needs." }
    ],
    quickPrompts: ["A customer says the order is three days late. How should we reply?", "Which questions should be handed off to a human?", "What is the help center still missing?"],
    emptyState: "After publishing you can validate the web assistant, refusal boundaries, citations, and handoff rules here."
  },
  document_review: {
    headline: "Review documents in place: risks, clauses, and suggested edits.",
    description: "Fits contract, policy, RFP, and security questionnaire work. The interface centers on files, clauses, evidence, and open items.",
    workspaceTitle: "Document review workbench",
    contextPanelTitle: "Clauses and source text",
    rightRailMode: "document",
    primaryAction: { label: "Start document review", prompt: "List the high-risk clauses and suggest edits." },
    secondaryActions: [
      { label: "Generate review checklist", prompt: "Build a review checklist by risk level and mark the evidence for each item." },
      { label: "Find missing clauses", prompt: "Check which key clauses and compliance notes this document is missing." }
    ],
    quickPrompts: ["List the high-risk clauses and suggest edits.", "Which clauses need legal review?", "Turn the review findings into a summary I can send to the business."],
    emptyState: "After publishing you can review source text, add comments, build a risk list, and draft reports."
  },
  graph_explorer: {
    headline: "Analyze objects, relationships, events, and evidence chains.",
    description: "Fits account relationships, supplier risk, due diligence, and domain entity graphs. The interface highlights relationship paths, evidence strength, and risk explanation.",
    workspaceTitle: "Relationship analysis workbench",
    contextPanelTitle: "Relationships and evidence",
    rightRailMode: "graph",
    primaryAction: { label: "Open relationship analysis", prompt: "Map the key relationships, risk paths, and evidence sources around the current object." },
    secondaryActions: [
      { label: "Generate risk paths", prompt: "Find the relationship chains and risk events that matter most in the current files." },
      { label: "Draft due diligence summary", prompt: "Turn the relationship analysis into a due diligence summary and open questions." }
    ],
    quickPrompts: ["What are this account's key relationships and risks right now?", "Which relationships need human confirmation?", "Generate a relationship risk summary."],
    emptyState: "After publishing you can inspect relationship trails, risk paths, evidence chains, and follow-up explanations here."
  },
  report_generator: {
    headline: "Turn multi-source files into business briefs, reports, and next actions.",
    description: "Fits account 360, business reviews, research reports, and meeting notes. The core output is structured conclusions, citations, and executable actions.",
    workspaceTitle: "Business brief workbench",
    contextPanelTitle: "Brief evidence",
    rightRailMode: "report",
    primaryAction: { label: "Generate business brief", prompt: "Produce a structured business brief with conclusions, risks, opportunities, evidence, and next-step recommendations." },
    secondaryActions: [
      { label: "Extract risks and opportunities", prompt: "Extract only the risk signals, opportunity signals, and next actions from the current files." },
      { label: "Generate shareable version", prompt: "Condense the conclusions into a concise version the team can share." }
    ],
    quickPrompts: ["Generate a business brief.", "What are the biggest risks and opportunities right now?", "Give me next-step recommendations."],
    emptyState: "After publishing you can generate briefs, report drafts, business reviews, and next actions here."
  },
  task_workflow: {
    headline: "Turn knowledge into trackable processes, action items, and tasks.",
    description: "Fits operations troubleshooting, meeting action items, team handbooks, and service processes. The interface highlights steps, owners, status, and escalation paths.",
    workspaceTitle: "Process task workbench",
    contextPanelTitle: "Steps and action items",
    rightRailMode: "tasks",
    primaryAction: { label: "Generate task list", prompt: "Turn the current files into executable steps, owner suggestions, and escalation paths." },
    secondaryActions: [
      { label: "View escalation path", prompt: "How should this process escalate when something goes wrong?" },
      { label: "Capture action items", prompt: "Extract action items, owners, and due dates from the current files." }
    ],
    quickPrompts: ["Generate an executable task list.", "How should we escalate when something fails?", "Extract owners and due dates."],
    emptyState: "After publishing you can generate steps, action items, escalation paths, and task retrospectives here."
  },
  knowledge_portal: {
    headline: "Turn files into a browsable, searchable knowledge portal.",
    description: "Fits personal wikis, team handbooks, research guides, and knowledge bases. The interface highlights outlines, topics, sources, and reuse entry points.",
    workspaceTitle: "Knowledge portal workbench",
    contextPanelTitle: "Outline and sources",
    rightRailMode: "sources",
    primaryAction: { label: "Browse knowledge outline", prompt: "Turn the current knowledge base into a topic outline with a summary for each topic." },
    secondaryActions: [
      { label: "Ask by topic", prompt: "Answer one traceable question by topic from the current files." },
      { label: "Generate knowledge summary", prompt: "Condense the current knowledge space into a one-page summary." }
    ],
    quickPrompts: ["Turn the current knowledge base into a topic outline.", "What matters most in this knowledge space?", "Generate a learning summary."],
    emptyState: "After publishing you can browse the outline, search by topic, trace sources, and generate knowledge summaries here."
  },
  chat: {
    headline: "Traceable multi-turn Q&A over a defined knowledge scope.",
    description: "Fits policy, process, and FAQ work that is genuinely Q&A-first, while still showing sources, permissions, and capturable deliverables.",
    workspaceTitle: "Scenario Q&A workbench",
    contextPanelTitle: "Answer evidence",
    rightRailMode: "sources",
    primaryAction: { label: "Start asking", prompt: "Answer this from the current scenario files and cite the sources." },
    secondaryActions: [
      { label: "Trace the evidence", prompt: "Explain which files each part of this answer came from." },
      { label: "Save the answer", prompt: "Turn this answer into a reusable knowledge entry." }
    ],
    quickPrompts: ["Answer this from the current scenario files.", "Give me the source citations.", "Turn the answer into a reusable entry."],
    emptyState: "After publishing you can run multi-turn Q&A, trace sources, and save answers here."
  },
  hybrid: {
    headline: "A combined workbench for document evidence, knowledge graph, and knowledge portal.",
    description: "Fits complex work that needs retrieval, graph, reports, and process at once. The interface follows the template's primary business goal.",
    workspaceTitle: "Combined workbench",
    contextPanelTitle: "Mixed evidence",
    rightRailMode: "report",
    primaryAction: { label: "Generate combined conclusion", prompt: "Retrieve across document evidence, knowledge graph, and knowledge wiki in parallel, then produce a combined conclusion with citations." },
    secondaryActions: [
      { label: "Split by evidence type", prompt: "Split this answer's evidence into document evidence, knowledge graph, and knowledge wiki." },
      { label: "Capture as a scenario", prompt: "Decide which scenario this question should become." }
    ],
    quickPrompts: ["Generate a combined conclusion with evidence.", "Split the sources by evidence type.", "Recommend a scenario to capture this."],
    emptyState: "After publishing you can combine knowledge types into conclusions, reports, and business actions."
  }
};

export function buildScenarioProductSurface(templateId: string, templateOverride?: Pick<ScenarioTemplate, "productForm">): ScenarioProductSurface {
  const template = templateOverride ?? officialTemplates.find((item) => item.id === templateId);
  const kind = choosePrimarySurface(template?.productForm ?? []);
  return {
    kind,
    label: scenarioProductFormLabel(kind),
    ...surfaceCopy[kind]
  };
}

export function choosePrimarySurface(productForms: TemplateProductForm[]): ScenarioProductSurfaceKind {
  for (const item of productForms) {
    if (item in surfaceCopy) return item;
  }
  return "hybrid";
}

export function scenarioProductFormLabel(kind: ScenarioProductSurfaceKind): string {
  const labels: Record<ScenarioProductSurfaceKind, string> = {
    embedded_assistant: "Embedded assistant",
    document_review: "Document review",
    graph_explorer: "Relationship analysis",
    report_generator: "Business brief",
    task_workflow: "Process tasks",
    knowledge_portal: "Knowledge portal",
    chat: "Scenario Q&A",
    hybrid: "Combined workbench"
  };
  return labels[kind];
}
