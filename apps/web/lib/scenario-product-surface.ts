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
    headline: "platform.surface.embedded_assistant.headline",
    description: "platform.surface.embedded_assistant.description",
    workspaceTitle: "platform.surface.embedded_assistant.workspaceTitle",
    contextPanelTitle: "platform.surface.embedded_assistant.contextPanelTitle",
    rightRailMode: "widget",
    primaryAction: { label: "platform.surface.embedded_assistant.primaryActionLabel", prompt: "Take a real customer question and return the answer, the citations, and whether it needs a human." },
    secondaryActions: [
      { label: "platform.surface.embedded_assistant.secondaryAction1Label", prompt: "Show which high-frequency questions still lack answerable evidence in the current files." },
      { label: "platform.surface.embedded_assistant.secondaryAction2Label", prompt: "Draft the handoff boundaries and wording this knowledge base needs." }
    ],
    quickPrompts: ["A customer says the order is three days late. How should we reply?", "Which questions should be handed off to a human?", "What is the help center still missing?"],
    emptyState: "platform.surface.embedded_assistant.emptyState"
  },
  document_review: {
    headline: "platform.surface.document_review.headline",
    description: "platform.surface.document_review.description",
    workspaceTitle: "platform.surface.document_review.workspaceTitle",
    contextPanelTitle: "platform.surface.document_review.contextPanelTitle",
    rightRailMode: "document",
    primaryAction: { label: "platform.surface.document_review.primaryActionLabel", prompt: "List the high-risk clauses and suggest edits." },
    secondaryActions: [
      { label: "platform.surface.document_review.secondaryAction1Label", prompt: "Build a review checklist by risk level and mark the evidence for each item." },
      { label: "platform.surface.document_review.secondaryAction2Label", prompt: "Check which key clauses and compliance notes this document is missing." }
    ],
    quickPrompts: ["List the high-risk clauses and suggest edits.", "Which clauses need legal review?", "Turn the review findings into a summary I can send to the business."],
    emptyState: "platform.surface.document_review.emptyState"
  },
  graph_explorer: {
    headline: "platform.surface.graph_explorer.headline",
    description: "platform.surface.graph_explorer.description",
    workspaceTitle: "platform.surface.graph_explorer.workspaceTitle",
    contextPanelTitle: "platform.surface.graph_explorer.contextPanelTitle",
    rightRailMode: "graph",
    primaryAction: { label: "platform.surface.graph_explorer.primaryActionLabel", prompt: "Map the key relationships, risk paths, and evidence sources around the current object." },
    secondaryActions: [
      { label: "platform.surface.graph_explorer.secondaryAction1Label", prompt: "Find the relationship chains and risk events that matter most in the current files." },
      { label: "platform.surface.graph_explorer.secondaryAction2Label", prompt: "Turn the relationship analysis into a due diligence summary and open questions." }
    ],
    quickPrompts: ["What are this account's key relationships and risks right now?", "Which relationships need human confirmation?", "Generate a relationship risk summary."],
    emptyState: "platform.surface.graph_explorer.emptyState"
  },
  report_generator: {
    headline: "platform.surface.report_generator.headline",
    description: "platform.surface.report_generator.description",
    workspaceTitle: "platform.surface.report_generator.workspaceTitle",
    contextPanelTitle: "platform.surface.report_generator.contextPanelTitle",
    rightRailMode: "report",
    primaryAction: { label: "platform.surface.report_generator.primaryActionLabel", prompt: "Produce a structured business brief with conclusions, risks, opportunities, evidence, and next-step recommendations." },
    secondaryActions: [
      { label: "platform.surface.report_generator.secondaryAction1Label", prompt: "Extract only the risk signals, opportunity signals, and next actions from the current files." },
      { label: "platform.surface.report_generator.secondaryAction2Label", prompt: "Condense the conclusions into a concise version the team can share." }
    ],
    quickPrompts: ["Generate a business brief.", "What are the biggest risks and opportunities right now?", "Give me next-step recommendations."],
    emptyState: "platform.surface.report_generator.emptyState"
  },
  task_workflow: {
    headline: "platform.surface.task_workflow.headline",
    description: "platform.surface.task_workflow.description",
    workspaceTitle: "platform.surface.task_workflow.workspaceTitle",
    contextPanelTitle: "platform.surface.task_workflow.contextPanelTitle",
    rightRailMode: "tasks",
    primaryAction: { label: "platform.surface.task_workflow.primaryActionLabel", prompt: "Turn the current files into executable steps, owner suggestions, and escalation paths." },
    secondaryActions: [
      { label: "platform.surface.task_workflow.secondaryAction1Label", prompt: "How should this process escalate when something goes wrong?" },
      { label: "platform.surface.task_workflow.secondaryAction2Label", prompt: "Extract action items, owners, and due dates from the current files." }
    ],
    quickPrompts: ["Generate an executable task list.", "How should we escalate when something fails?", "Extract owners and due dates."],
    emptyState: "platform.surface.task_workflow.emptyState"
  },
  knowledge_portal: {
    headline: "platform.surface.knowledge_portal.headline",
    description: "platform.surface.knowledge_portal.description",
    workspaceTitle: "platform.surface.knowledge_portal.workspaceTitle",
    contextPanelTitle: "platform.surface.knowledge_portal.contextPanelTitle",
    rightRailMode: "sources",
    primaryAction: { label: "platform.surface.knowledge_portal.primaryActionLabel", prompt: "Turn the current knowledge base into a topic outline with a summary for each topic." },
    secondaryActions: [
      { label: "platform.surface.knowledge_portal.secondaryAction1Label", prompt: "Answer one traceable question by topic from the current files." },
      { label: "platform.surface.knowledge_portal.secondaryAction2Label", prompt: "Condense the current knowledge space into a one-page summary." }
    ],
    quickPrompts: ["Turn the current knowledge base into a topic outline.", "What matters most in this knowledge space?", "Generate a learning summary."],
    emptyState: "platform.surface.knowledge_portal.emptyState"
  },
  chat: {
    headline: "platform.surface.chat.headline",
    description: "platform.surface.chat.description",
    workspaceTitle: "platform.surface.chat.workspaceTitle",
    contextPanelTitle: "platform.surface.chat.contextPanelTitle",
    rightRailMode: "sources",
    primaryAction: { label: "platform.surface.chat.primaryActionLabel", prompt: "Answer this from the current scenario files and cite the sources." },
    secondaryActions: [
      { label: "platform.surface.chat.secondaryAction1Label", prompt: "Explain which files each part of this answer came from." },
      { label: "platform.surface.chat.secondaryAction2Label", prompt: "Turn this answer into a reusable knowledge entry." }
    ],
    quickPrompts: ["Answer this from the current scenario files.", "Give me the source citations.", "Turn the answer into a reusable entry."],
    emptyState: "platform.surface.chat.emptyState"
  },
  hybrid: {
    headline: "platform.surface.hybrid.headline",
    description: "platform.surface.hybrid.description",
    workspaceTitle: "platform.surface.hybrid.workspaceTitle",
    contextPanelTitle: "platform.surface.hybrid.contextPanelTitle",
    rightRailMode: "report",
    primaryAction: { label: "platform.surface.hybrid.primaryActionLabel", prompt: "Retrieve across document evidence, knowledge graph, and knowledge wiki in parallel, then produce a combined conclusion with citations." },
    secondaryActions: [
      { label: "platform.surface.hybrid.secondaryAction1Label", prompt: "Split this answer's evidence into document evidence, knowledge graph, and knowledge wiki." },
      { label: "platform.surface.hybrid.secondaryAction2Label", prompt: "Decide which scenario this question should become." }
    ],
    quickPrompts: ["Generate a combined conclusion with evidence.", "Split the sources by evidence type.", "Recommend a scenario to capture this."],
    emptyState: "platform.surface.hybrid.emptyState"
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
    embedded_assistant: "platform.surface.embedded_assistant.label",
    document_review: "platform.surface.document_review.label",
    graph_explorer: "platform.surface.graph_explorer.label",
    report_generator: "platform.surface.report_generator.label",
    task_workflow: "platform.surface.task_workflow.label",
    knowledge_portal: "platform.surface.knowledge_portal.label",
    chat: "platform.surface.chat.label",
    hybrid: "platform.surface.hybrid.label"
  };
  return labels[kind];
}
