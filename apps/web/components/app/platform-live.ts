import type { KnowledgeSpaceObject, ProcessingTask, ScenarioInstance, Visibility } from "../../lib/fixtures/frontstage";

export type AdminEngine = "Gbrain" | "Naive RAG" | "GraphRAG";

export type LiveScenarioRecord = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  visibility: Visibility;
  ownerName: string;
  status: ScenarioInstance["status"];
  sourceCount: number;
  processingGoal: string;
  updatedAt: string;
};

export type LiveKnowledgeRecord = {
  id: string;
  scenarioId: string;
  title: string;
  content: string;
  visibility: Visibility;
  ownerName: string;
  ragEngine: AdminEngine;
  sourceOriginalName: string;
  createdAt: string;
};

export type PlatformSnapshot = {
  scenarios: LiveScenarioRecord[];
  tasks: ProcessingTask[];
  knowledge: LiveKnowledgeRecord[];
};

export type PlatformSnapshotMetrics = {
  scenarioCount: number;
  readyScenarioCount: number;
  pendingTaskCount: number;
  readyKnowledgeCount: number;
};

export function toScenarioInstance(record: LiveScenarioRecord): ScenarioInstance {
  return {
    id: record.id,
    templateId: record.templateId,
    name: record.name,
    description: record.description || record.processingGoal || "This scenario is waiting for admin confirmation of its files and ingest policy.",
    owner: record.ownerName,
    visibility: record.visibility,
    status: record.status,
    sourceCount: record.sourceCount,
    updatedAt: displayTime(record.updatedAt),
    readyActions: actionsForScenarioStatus(record.status),
    recommendedQuestions: recommendedQuestionsForScenario(record)
  };
}

export function toKnowledgeSpaceObject(record: LiveKnowledgeRecord): KnowledgeSpaceObject {
  return {
    id: record.id,
    mode: modeForEngine(record.ragEngine),
    title: record.title,
    summary: record.content.replace(/\\s+/g, " ").trim().slice(0, 180) || "Ingest is complete, but this knowledge object has no summary to show.",
    sourceLabel: record.sourceOriginalName,
    linkedScenarioId: record.scenarioId,
    visibility: record.visibility,
    owner: record.ownerName,
    permissionNote: permissionNote(record.visibility, record.ownerName),
    updatedAt: displayTime(record.createdAt),
    actions: ["Open scenario", "View source", "Request update"]
  };
}

export function computePlatformSnapshotMetrics(snapshot: PlatformSnapshot): PlatformSnapshotMetrics {
  return {
    scenarioCount: snapshot.scenarios.length,
    readyScenarioCount: snapshot.scenarios.filter((scenario) => scenario.status === "ready").length,
    pendingTaskCount: snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed").length,
    readyKnowledgeCount: snapshot.knowledge.length
  };
}

export function sortScenariosByStatusAndTime(records: LiveScenarioRecord[]) {
  const rank: Record<LiveScenarioRecord["status"], number> = {
    ready: 0,
    processing: 1,
    waiting_review: 2,
    submitted: 3,
    failed: 4,
    draft: 5
  };
  return [...records].sort((a, b) => {
    const rankDiff = rank[a.status] - rank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function modeForEngine(engine: AdminEngine): KnowledgeSpaceObject["mode"] {
  if (engine === "Naive RAG") return "document";
  if (engine === "GraphRAG") return "relationship";
  return "wiki";
}

function actionsForScenarioStatus(status: ScenarioInstance["status"]) {
  if (status === "ready") return ["Ask directly", "View files", "Generate deliverable"];
  if (status === "failed") return ["See rejection reason", "Add files", "Resubmit"];
  return ["View processing status", "Add files", "Wait for admin publish"];
}

function recommendedQuestionsForScenario(record: LiveScenarioRecord) {
  const subject = record.name || "this scenario";
  if (record.status === "ready") {
    return [
      `${subject}: what are the key facts?`,
      `${subject}: what are the risks and opportunities?`,
      `Generate a business summary from ${subject}.`
    ];
  }
  return [
    `${subject}: which step is it on?`,
    `${subject}: which files are still missing?`,
    `${subject}: what will it solve once published?`
  ];
}

function permissionNote(visibility: Visibility, ownerName: string) {
  if (visibility === "private") return `Only the creator ${ownerName} can see this; team and company scenarios cannot retrieve it.`;
  if (visibility === "team") return "Visible to team members only; it does not enter the company knowledge space automatically.";
  return "Visible company-wide; retrievable in company-wide Q&A only after an admin publishes it.";
}

function displayTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value || "just now";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
