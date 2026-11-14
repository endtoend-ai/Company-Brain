"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";
import { LanguageSwitcher } from "../language-switcher";
import { useI18n } from "../../lib/i18n/language-context";
import { workspaceNavKeys } from "../../lib/i18n/nav-keys";
import { useAuth } from "../../lib/auth-context";
import {
  buildScenarioProductSurface,
  type ScenarioProductSurface,
  type ScenarioProductSurfaceKind
} from "../../lib/scenario-product-surface";
import {
  getTemplateViewOption,
  templateViewOptions,
  type TemplateLibraryView
} from "../../lib/template-library-view";
import {
  buildKnowledgeAssetStats,
  filterKnowledgeAssets,
  knowledgeAssetKinds,
  knowledgeAssetRiskNote,
  knowledgeAssetScopes,
  knowledgeGovernanceActions,
  knowledgeModeLabel,
  knowledgeVisibilityLabel,
  type KnowledgeAssetKindFilter,
  type KnowledgeAssetScope
} from "../../lib/knowledge-space-view";
import { buildWorkspaceSettingsModel, roleDisplayName, workspaceSettingStatusLabel } from "../../lib/workspace-settings-view";
import {
  createScenarioDraft,
  customScenarioTemplate,
  officialTemplates,
  processingTasks,
  scenarioAvailability,
  scenarioById,
  scenarioDataSources,
  scenarioLifecycle,
  scenarioOutputs,
  scenarioSettings,
  scenarioWorkbenchById,
  templateById,
  workspaceNav,
  workspaceProfile,
  type KnowledgeSpaceObject,
  type ProcessingTask,
  type ScenarioDataSource,
  type ScenarioInstance,
  type ScenarioOutput,
  type ScenarioSettings,
  type ScenarioTemplate,
  type TemplateDemoWalkthrough,
  type ScenarioWorkbench,
  type Visibility
} from "../../lib/fixtures/frontstage";
import {
  computePlatformSnapshotMetrics,
  sortScenariosByStatusAndTime,
  toKnowledgeSpaceObject,
  toScenarioInstance,
  type LiveKnowledgeRecord,
  type LiveScenarioRecord,
  type PlatformSnapshot
} from "./platform-live";

type ShellProps = {
  active: string;
  title: string;
  eyebrow?: string;
  initialSnapshot?: PlatformSnapshot;
  children: React.ReactNode;
};

type ScenarioTab = "overview" | "data" | "tasks" | "ask" | "outputs" | "settings";
type WorkspaceSettingRow = ReturnType<typeof buildWorkspaceSettingsModel>["identityRows"][number];

type LiveScenarioAnswer = {
  text: string;
  engine: "Gbrain" | "Naive RAG" | "GraphRAG";
  citations: Array<{
    knowledgeObjectId: string;
    sourceOriginalName: string;
    scenarioName: string;
    engine: "Gbrain" | "Naive RAG" | "GraphRAG";
    excerpt: string;
  }>;
  nextActions: string[];
};

type LiveWorkbenchTemplate = {
  id: string;
  name: string;
  category: string;
  headline: string;
  productForm: ScenarioProductSurfaceKind[];
  outputCapabilities: string[];
};

type ScenarioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engine?: LiveScenarioAnswer["engine"];
  citations?: LiveScenarioAnswer["citations"];
  nextActions?: string[];
  traceId?: string;
};

type ScenarioChatSession = {
  id: string;
  scenarioId: string;
  title: string;
  ownerName: string;
  updatedAt: string;
  updatedAtText?: string;
  messageCount?: number;
  latestMessage?: string;
  messages: ScenarioChatMessage[];
};

type ScenarioChatSessionSummary = Omit<ScenarioChatSession, "messages"> & {
  messageCount: number;
  latestMessage: string;
};
type ScenarioCitation = LiveScenarioAnswer["citations"][number];

type GlobalChatScope = "company" | "team" | "private";
type GlobalChatOutputMode = "direct" | "report" | "table";
type GlobalChatCitation = {
  knowledgeObjectId: string;
  sourceOriginalName: string;
  scenarioId: string;
  scenarioName: string;
  engine: LiveScenarioAnswer["engine"];
  knowledgeType: "Knowledge wiki" | "Document evidence" | "Knowledge graph";
  excerpt: string;
};
type GlobalChatContextTrace = {
  layers: string[];
  scopeLabel: string;
  route: "direct" | "retrieve";
  routeReason: string;
  shortTermTurns: number;
  compressedContext: string;
  longTermMemoryHits: string[];
  retrievalTracks: Array<{ label: "Document evidence" | "Knowledge graph" | "Knowledge wiki"; count: number; description: string }>;
};
type GlobalChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: GlobalChatCitation[];
  contextTrace?: GlobalChatContextTrace;
  traceId?: string;
};

// End-user up/down vote on an answer -> writes a real backend trace (downvotes enter the admin improvement queue).
function AnswerFeedback({ traceId }: { traceId?: string }) {
  const { t } = useI18n();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [tip, setTip] = useState("");
  if (!traceId) return null;
  const send = async (v: "up" | "down") => {
    setVote(v);
    try {
      const r = await fetch(`/api/platform/traces/${traceId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vote: v })
      });
      const d = await r.json().catch(() => ({}));
      setTip(d.message ?? (v === "up" ? t("platform.feedback.thanks") : t("platform.feedback.recorded")));
    } catch {
      setTip(t("platform.feedback.error"));
    }
  };
  return (
    <div className="answer-feedback" aria-label={t("platform.feedback.rateAnswer")}>
      <button type="button" className={vote === "up" ? "active" : ""} onClick={() => send("up")} aria-label={t("platform.feedback.helpful")}>👍</button>
      <button type="button" className={vote === "down" ? "active" : ""} onClick={() => send("down")} aria-label={t("platform.feedback.notHelpful")}>👎</button>
      {tip ? <span className="answer-feedback-tip">{tip}</span> : null}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let k = 0;
  while (pos < text.length) {
    const bi = text.indexOf("**", pos);
    const ci = text.indexOf("`", pos);
    let ni = -1;
    let type: "b" | "c" | null = null;
    if (bi !== -1 && (ci === -1 || bi <= ci)) { ni = bi; type = "b"; }
    else if (ci !== -1) { ni = ci; type = "c"; }
    if (ni === -1) { parts.push(text.slice(pos)); break; }
    if (ni > pos) parts.push(text.slice(pos, ni));
    if (type === "b") {
      const ei = text.indexOf("**", ni + 2);
      if (ei === -1) { parts.push("**"); pos = ni + 2; }
      else { parts.push(<strong key={k++}>{text.slice(ni + 2, ei)}</strong>); pos = ei + 2; }
    } else {
      const ei = text.indexOf("`", ni + 1);
      if (ei === -1) { parts.push("`"); pos = ni + 1; }
      else { parts.push(<code key={k++}>{text.slice(ni + 1, ei)}</code>); pos = ei + 1; }
    }
  }
  if (!parts.length) return text;
  return <>{parts}</>;
}

function renderMarkdown(text: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  let bk = 0;
  let listBuf: string[] = [];
  const flushList = () => {
    if (!listBuf.length) return;
    blocks.push(<ul key={bk++}>{listBuf.map((s, i) => <li key={i}>{renderInline(s)}</li>)}</ul>);
    listBuf = [];
  };
  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSeparator = (l: string) =>
    /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(l);
  const splitRow = (row: string) =>
    row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const lines = text.split(/\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flushList(); continue; }
    const hm = /^#{1,6}\s+(.+)$/.exec(line);
    if (hm) { flushList(); blocks.push(<h4 className="md-h" key={bk++}>{renderInline(hm[1])}</h4>); continue; }
    const lm = /^[-*]\s+(.+)$/.exec(line);
    if (lm) { listBuf.push(lm[1]); continue; }
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isSeparator(lines[i + 1]) &&
      splitRow(line).length === splitRow(lines[i + 1]).length
    ) {
      flushList();
      const headerCells = splitRow(line);
      i += 2;
      const dataRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitRow(lines[i]);
        dataRows.push(headerCells.map((_, ci) => cells[ci] ?? ""));
        i++;
      }
      i--;
      blocks.push(
        <table className="md-table" key={bk++}>
          <thead>
            <tr>{headerCells.map((c, ci) => <th key={ci}>{renderInline(c)}</th>)}</tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }
    flushList();
    blocks.push(<p key={bk++}>{renderInline(line)}</p>);
  }
  flushList();
  return <>{blocks}</>;
}

function AssistantText({ content, animate }: { content: string; animate: boolean }) {
  const [revealed, setRevealed] = useState(animate ? "" : content);
  useEffect(() => {
    if (!animate) { setRevealed(content); return; }
    setRevealed("");
    let i = 0;
    const step = Math.max(1, Math.ceil(content.length / 120));
    const timer = setInterval(() => {
      i += step;
      if (i >= content.length) { setRevealed(content); clearInterval(timer); }
      else setRevealed(content.slice(0, i));
    }, 24);
    return () => clearInterval(timer);
  }, [content, animate]);
  return <div className="md-answer">{renderMarkdown(revealed)}</div>;
}

type GlobalChatSession = {
  id: string;
  title: string;
  scope: GlobalChatScope;
  outputMode: GlobalChatOutputMode;
  updatedAt: string;
  compressedContext: string;
  memory: {
    provider: "local";
    shortTermCount: number;
    longTermFacts: string[];
  };
  messages: GlobalChatMessage[];
};
type GlobalChatSessionSummary = {
  id: string;
  title: string;
  scope: GlobalChatScope;
  outputMode: GlobalChatOutputMode;
  updatedAt: string;
  updatedAtText: string;
  messageCount: number;
  latestMessage: string;
};

const navGlyphs: Record<string, string> = {
  "/app": "⌂",
  "/app/ask": "⌕",
  "/app/templates": "◇",
  "/app/scenarios": "▦",
  "/app/tasks": "✓",
  "/app/knowledge": "◌",
  "/app/settings": "⚙"
};

const visibilityOptions: Array<{ value: Visibility; label: string; description: string }> = [
  { value: "private", label: "visibility.private", description: "platform.visibility.privateDescription" },
  { value: "team", label: "visibility.team", description: "platform.visibility.teamDescription" },
  { value: "company", label: "visibility.company", description: "platform.visibility.companyDescription" }
];

const scenarioStatusFilters = [
  { value: "all", label: "platform.status.all" },
  { value: "available", label: "platform.status.available" },
  { value: "processing", label: "platform.status.processing" },
  { value: "pending_review", label: "platform.status.pendingReview" },
  { value: "failed", label: "platform.status.failed" }
] as const;

function scenarioStatusMatchesFilter(status: ScenarioInstance["status"] | ProcessingTask["status"], value: string) {
  if (value === "all") return true;
  if (value === "available") return status === "ready";
  if (value === "pending_review") return status === "waiting_review";
  if (value === "failed") return status === "failed";
  if (value === "processing") return status !== "ready" && status !== "failed";
  return false;
}

const taskStatusFilters = [
  { value: "All statuses", label: "platform.task.allStatuses" },
  { value: "Pending admin review", label: "platform.task.pendingAdminReview" },
  { value: "Processing", label: "platform.task.processing" },
  { value: "Available", label: "platform.task.available" }
] as const;

const taskKindFilters = [
  { value: "All types", label: "platform.task.allTypes" },
  { value: "File intake", label: "platform.task.fileIntake" },
  { value: "Admin review", label: "platform.task.adminReview" },
  { value: "Publish review", label: "platform.task.publishReview" }
] as const;

const taskSortOptions = [
  { value: "Recently updated", label: "platform.task.recentlyUpdated" },
  { value: "Submitted", label: "platform.task.submitted" },
  { value: "Progress", label: "platform.task.progress" }
] as const;

function taskStatusLabelKey(task: ProcessingTask) {
  if (task.waitingFor === "Admin" || task.status === "submitted") return "platform.task.pendingAdminReview";
  if (task.status === "ready") return "platform.task.available";
  if (task.status === "failed") return "platform.status.failed";
  return "platform.task.processing";
}

const TASK_KIND_KEYS: Record<string, string> = {
  "File intake": "platform.task.kind.fileIntake",
  "Admin review": "platform.task.kind.adminReview",
  "Knowledge ingest": "platform.task.kind.knowledgeIngest",
  "Publish review": "platform.task.kind.publishReview"
};

const TASK_WAITING_KEYS: Record<string, string> = {
  You: "platform.task.waiting.you",
  Admin: "platform.task.waiting.admin",
  "Processing pipeline": "platform.task.waiting.processingPipeline",
  "Scenario owner": "platform.task.waiting.scenarioOwner"
};

const TASK_MESSAGE_KEYS: Record<string, string> = {
  "The admin console confirmed ingest and created a usable business scenario.": "platform.task.message.ingestConfirmed"
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function taskKindText(kind: string, t: Translate) {
  const key = TASK_KIND_KEYS[kind];
  return key ? t(key) : kind;
}

function taskWaitingForText(waitingFor: string, t: Translate) {
  const key = TASK_WAITING_KEYS[waitingFor];
  return key ? t(key) : waitingFor;
}

function taskTitleText(title: string, t: Translate) {
  const match = title.match(/^Create (.+)$/);
  return match ? t("platform.task.title.create", { name: match[1] }) : title;
}

function taskMessageText(message: string, t: Translate) {
  const key = TASK_MESSAGE_KEYS[message];
  return key ? t(key) : message;
}

export function AskHome({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  return <WorkspaceHomePage initialSnapshot={initialSnapshot} />;
}

function emptyPlatformSnapshot(): PlatformSnapshot {
  return { scenarios: [], tasks: [], knowledge: [] };
}

function usePlatformSnapshot(initialSnapshot?: PlatformSnapshot) {
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(() => initialSnapshot ?? emptyPlatformSnapshot());
  const [state, setState] = useState<"loading" | "ready" | "error">(initialSnapshot ? "ready" : "loading");

  useEffect(() => {
    if (auth.state === "loading") return;
    let cancelled = false;
    async function load() {
      setState("loading");
      const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined;
      try {
        const [scenarioResponse, taskResponse, knowledgeResponse] = await Promise.all([
          fetch("/api/platform/scenarios", { headers, cache: "no-store" }),
          fetch("/api/platform/tasks", { headers, cache: "no-store" }),
          fetch("/api/platform/knowledge-objects", { headers, cache: "no-store" })
        ]);
        if (!scenarioResponse.ok || !taskResponse.ok || !knowledgeResponse.ok) {
          if (initialSnapshot) {
            setState("ready");
            return;
          }
          throw new Error("platform unavailable");
        }
        const [scenarioBody, taskBody, knowledgeBody] = await Promise.all([
          scenarioResponse.json(),
          taskResponse.json(),
          knowledgeResponse.json()
        ]);
        if (cancelled) return;
        setSnapshot({
          scenarios: Array.isArray(scenarioBody.scenarios) ? scenarioBody.scenarios : [],
          tasks: Array.isArray(taskBody.tasks) ? taskBody.tasks : [],
          knowledge: Array.isArray(knowledgeBody.knowledge_objects) ? knowledgeBody.knowledge_objects : []
        });
        setState("ready");
      } catch {
        if (!cancelled) {
          setSnapshot(initialSnapshot ?? emptyPlatformSnapshot());
          setState("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [auth.state, auth.token, initialSnapshot]);

  return { snapshot, state };
}

export function WorkspaceHomePage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [homeAttachments, setHomeAttachments] = useState<File[]>([]);
  const [homeKnowledgeScope, setHomeKnowledgeScope] = useState<"company" | "team" | "private">("company");
  const [homeOutputMode, setHomeOutputMode] = useState<"answer" | "report" | "table">("answer");
  const { snapshot, state } = usePlatformSnapshot(initialSnapshot);
  const metrics = computePlatformSnapshotMetrics(snapshot);
  const liveScenarios = useMemo(() => sortScenariosByStatusAndTime(snapshot.scenarios).map(toScenarioInstance), [snapshot.scenarios]);
  const readyScenarios = liveScenarios.filter((scenario) => scenario.status === "ready");
  const pendingTasks = snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed");
  const primaryScenario = readyScenarios[0] ?? liveScenarios[0];
  const readyPreview = (primaryScenario ? [primaryScenario, ...readyScenarios.filter((scenario) => scenario.id !== primaryScenario.id)] : readyScenarios).slice(0, 4);
  const pendingPreview = pendingTasks.slice(0, 2);

  function ask(value = question) {
    const q = value.trim() || (homeAttachments.length ? "Review the files I uploaded and answer using company knowledge." : "");
    if (!q) return;
    try {
      if (homeAttachments.length) {
        sessionStorage.setItem("ff_companybrain_pending_attachments", JSON.stringify(homeAttachments.map(formatAttachmentMeta)));
      } else {
        sessionStorage.removeItem("ff_companybrain_pending_attachments");
      }
      sessionStorage.setItem("ff_companybrain_query_context", JSON.stringify({
        knowledgeScope: homeKnowledgeScope,
        outputMode: homeOutputMode
      }));
    } catch {
      // Attachment metadata is only a front-end handoff; routing should not depend on storage availability.
    }
    router.push(`/app/ask?q=${encodeURIComponent(q)}`);
  }

  return (
    <FrontstageShell active="/app" title={t("shell.navOverview")} eyebrow={workspaceProfile.workspaceName} initialSnapshot={snapshot}>
      <div className="home-workspace-page">
        <section className="brain-ops-strip home-metric-strip" aria-label={t("shell.entryPointsLabel")}>
          <KpiCard href="/app/scenarios" label={t("shell.navScenarios")} value={String(metrics.scenarioCount)} helper={t("shell.kpiScenariosHelper")} />
          <KpiCard href="/app/knowledge" label={t("shell.kpiKnowledge")} value={String(metrics.readyKnowledgeCount)} helper={t("shell.kpiKnowledgeHelper")} />
          <KpiCard href="/app/tasks" label={t("shell.kpiPendingTasks")} value={String(metrics.pendingTaskCount)} helper={t("shell.kpiPendingTasksHelper")} />
          <KpiCard href="/app/templates" label={t("shell.navTemplates")} value={String(officialTemplates.length)} helper={t("shell.kpiTemplatesHelper")} />
        </section>

        <section className="brain-command-center home-start-center" aria-label={t("shell.askRegionLabel")}>
          <div className="brain-command-main">
            <div className="brain-command-title">
              <span>CompanyBrain</span>
              <h1>{t("shell.greeting")}</h1>
              <p>{t("shell.greetingBody")}</p>
            </div>

            <form
              className="brain-ask-console"
              onSubmit={(event) => {
                event.preventDefault();
                ask();
              }}
            >
              <div className="home-ask-head">
                <label htmlFor="brain-home-question">{t("shell.askLabel")}</label>
                <span>{t("shell.askFileHint")}</span>
              </div>
              <textarea
                id="brain-home-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t("shell.askPlaceholder")}
                rows={3}
              />
              {homeAttachments.length ? (
                <div className="home-attachment-list">
                  {homeAttachments.map((file) => <span key={`${file.name}-${file.size}`}>{formatAttachmentMeta(file)}</span>)}
                </div>
              ) : null}
              <div className="brain-ask-actions home-context-tools" aria-label={t("shell.questionContext")}>
                <label htmlFor="home-ask-attachments" className="home-context-upload">
                  <b>{t("shell.uploadFiles")}</b>
                  <span>{t("shell.uploadHint")}</span>
                  <input
                    id="home-ask-attachments"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"
                    onChange={(event) => setHomeAttachments(Array.from(event.currentTarget.files ?? []))}
                  />
                </label>
                <label className="home-context-field">
                  <span>{t("shell.knowledgeScope")}</span>
                  <select
                    value={homeKnowledgeScope}
                    onChange={(event) => setHomeKnowledgeScope(event.currentTarget.value as "company" | "team" | "private")}
                  >
                    <option value="company">{t("shell.scopeCompany")}</option>
                    <option value="team">{t("shell.scopeTeam")}</option>
                    <option value="private">{t("shell.scopePrivate")}</option>
                  </select>
                </label>
                <label className="home-context-field">
                  <span>{t("shell.outputFormat")}</span>
                  <select
                    value={homeOutputMode}
                    onChange={(event) => setHomeOutputMode(event.currentTarget.value as "answer" | "report" | "table")}
                  >
                    <option value="answer">{t("shell.outputDirect")}</option>
                    <option value="report">{t("shell.outputReport")}</option>
                    <option value="table">{t("shell.outputTable")}</option>
                  </select>
                </label>
                <button type="submit" className="home-context-send" aria-label={t("shell.sendQuestion")}><span aria-hidden>➤</span></button>
              </div>
            </form>
          </div>

          <div className="home-template-entry">
            <div>
              <b>{t("shell.firstTime")}</b>
              <span>{t("shell.firstTimeBody")}</span>
            </div>
            <Link href="/app/templates">{t("shell.chooseTemplate")}</Link>
          </div>

          <aside className="brain-command-side home-next-side" aria-label={t("shell.continueLabel")}>
            <section>
              <div className="brain-side-title">
                <span>{t("shell.readyToUse")}</span>
                <Link href="/app/scenarios">{t("shell.viewAll")}</Link>
              </div>
              <div className="brain-ready-list">
                {readyPreview.map((scenario) => <ScenarioCompactCard key={scenario.id} scenario={scenario} />)}
                {state !== "loading" && !primaryScenario ? (
                  <Link className="ux-task-mini-row" href="/app/templates"><b>{t("shell.noScenariosYet")}</b><span>{t("shell.noScenariosHint")}</span></Link>
                ) : null}
                {readyScenarios.length > readyPreview.length ? (
                  <Link className="home-more-row" href="/app/scenarios">{t("shell.moreScenarios", { count: readyScenarios.length - readyPreview.length })}</Link>
                ) : null}
              </div>
            </section>
            <section>
              <div className="brain-side-title">
                <span>{t("shell.needsAttention")}</span>
                <Link href="/app/tasks">{t("shell.viewAll")}</Link>
              </div>
              <div className="brain-task-list">
                {pendingTasks.length > 0
                  ? pendingPreview.map((task) => <TaskMini key={task.id} task={task} />)
                  : <Link className="ux-task-mini-row" href="/app/templates"><b>{t("shell.noPendingTasks")}</b><span>{t("shell.noPendingTasksHint")}</span></Link>}
                {pendingTasks.length > pendingPreview.length ? (
                  <Link className="home-more-row" href="/app/tasks">{t("shell.moreTasks", { count: pendingTasks.length - pendingPreview.length })}</Link>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </FrontstageShell>
  );
}

export function CompanyChatPage({ initialQuery, initialSnapshot }: { initialQuery?: string; initialSnapshot?: PlatformSnapshot } = {}) {
  const { t, formatDisplayTime } = useI18n();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<GlobalChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<GlobalChatSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [pendingAttachmentLabels, setPendingAttachmentLabels] = useState<string[]>([]);
  const [scope, setScope] = useState<GlobalChatScope>("company");
  const [outputMode, setOutputMode] = useState<GlobalChatOutputMode>("direct");
  const startedInitialQueryRef = useRef(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const auth = useAuth();
  const { snapshot } = usePlatformSnapshot(initialSnapshot);
  const liveScenarios = useMemo(() => sortScenariosByStatusAndTime(snapshot.scenarios).map(toScenarioInstance), [snapshot.scenarios]);
  const readyScenarios = liveScenarios.filter((scenario) => scenario.status === "ready");
  const recentGlobalEntries = sessions.length > 0
    ? sessions.slice(0, 3).map((session) => ({
        id: session.id,
        title: session.title,
        description: session.latestMessage,
        meta: `${t(scopeLabel(session.scope))} · ${formatDisplayTime(session.updatedAtText)}`,
        action: () => void openSession(session.id)
      }))
    : readyScenarios.slice(0, 3).map((scenario) => ({
        id: scenario.id,
        title: scenario.name,
        description: scenario.description,
        meta: `${t(visibilityText(scenario.visibility))} · ${t("platform.chat.sourcesCount", { count: scenario.sourceCount })}`,
        action: () => setInput(`${scenario.name} — what are the key facts?`)
      }));
  const latestAssistant = [...(activeSession?.messages ?? [])].reverse().find((item) => item.role === "assistant");
  const latestUserQuestion = [...(activeSession?.messages ?? [])].reverse().find((item) => item.role === "user")?.content ?? "";
  const activeCitations = latestAssistant?.citations ?? [];
  const activeTrace = latestAssistant?.contextTrace;
  const citationGroups = groupGlobalCitations(activeCitations);
  const relatedScenario = activeCitations[0]
    ? readyScenarios.find((scenario) => scenario.id === activeCitations[0].scenarioId)
    : null;
  const isDirectAnswer = activeTrace?.route === "direct";
  const recommendedTemplates = recommendTemplatesForGlobalAnswer(latestUserQuestion, activeCitations);
  const suggestedQuestions = [
    "Which customer renewals are most at risk?",
    "Turn the latest evidence into a shareable summary.",
    "Which scenario should this question turn into?"
  ];

  function requestHeaders(json = false) {
    return {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
    };
  }

  async function loadSessions(selectSessionId?: string) {
    setLoadingSessions(true);
    try {
      const response = await fetch("/api/platform/chat-sessions", { headers: requestHeaders(), cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.loadError"));
      const nextSessions = Array.isArray(body.sessions) ? body.sessions as GlobalChatSessionSummary[] : [];
      setSessions(nextSessions);
      if (selectSessionId) {
        await openSession(selectSessionId, false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.loadError"));
    } finally {
      setLoadingSessions(false);
    }
  }

  async function openSession(sessionId: string, refreshHistory = false) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/platform/chat-sessions/${sessionId}`, { headers: requestHeaders(), cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.openError"));
      setActiveSession(body.session as GlobalChatSession);
      setAnimatingId(null);
      setScope((body.session as GlobalChatSession).scope);
      setOutputMode((body.session as GlobalChatSession).outputMode);
      if (refreshHistory) await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.openError"));
    } finally {
      setPending(false);
    }
  }

  async function createSessionFromQuestion(nextQuery: string) {
    const q = nextQuery.trim();
    if (!q || pending) return;
    setPending(true);
    setMessage("");

    // Optimistic render: show the user message immediately before Send and clear the input.
    const optimisticUserMsg: GlobalChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString()
    };
    setActiveSession({
      id: "",
      title: q.slice(0, 60),
      scope,
      outputMode,
      updatedAt: new Date().toISOString(),
      compressedContext: "",
      memory: { provider: "local", shortTermCount: 0, longTermFacts: [] },
      messages: [optimisticUserMsg]
    });
    setInput("");

    try {
      const response = await fetch("/api/platform/chat-sessions", {
        method: "POST",
        headers: requestHeaders(true),
        body: JSON.stringify({ query: q, scope, output_mode: outputMode })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.startError"));
      const createdSession = body.session as GlobalChatSession;
      setActiveSession(createdSession);
      const lastCreatedMsg = createdSession.messages[createdSession.messages.length - 1];
      if (lastCreatedMsg?.role === "assistant") setAnimatingId(lastCreatedMsg.id);
      // 只刷新左侧历史列表，不再二次 openSession（会清空 animatingId 取消首轮打字机）；
      // createdSession 已是完整 POST 响应，activeSession.id 仍可高亮该会话。
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.startError"));
      setInput(q);       // Restore the input on failure so the user message is not lost.
      setActiveSession(null);
      setAnimatingId(null);
    } finally {
      setPending(false);
    }
  }

  async function appendQuestion(nextQuery: string) {
    const q = nextQuery.trim();
    if (!q || !activeSession || pending) return;
    setPending(true);
    setMessage("");

    // Optimistic render: append the user message immediately before Send and clear the input.
    const optimisticUserMsg: GlobalChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString()
    };
    const sessionBeforeUpdate = activeSession;
    setActiveSession({
      ...activeSession,
      messages: [...activeSession.messages, optimisticUserMsg]
    });
    setInput("");

    try {
      const response = await fetch(`/api/platform/chat-sessions/${activeSession.id}/messages`, {
        method: "POST",
        headers: requestHeaders(true),
        body: JSON.stringify({ query: q })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.sendError"));
      const appendedSession = body.session as GlobalChatSession;
      setActiveSession(appendedSession);
      const lastAppendedMsg = appendedSession.messages[appendedSession.messages.length - 1];
      if (lastAppendedMsg?.role === "assistant") setAnimatingId(lastAppendedMsg.id);
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.sendError"));
      setActiveSession(sessionBeforeUpdate);  // Roll back the optimistic update.
      setAnimatingId(null);
      setInput(q);                            // Restore the input.
    } finally {
      setPending(false);
    }
  }

  function submitQuestion(value = input) {
    if (activeSession) void appendQuestion(value);
    else void createSessionFromQuestion(value);
  }

  useEffect(() => {
    if (auth.state === "loading") return;
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.state, auth.token]);

  useEffect(() => {
    if (auth.state === "loading" || startedInitialQueryRef.current) return;
    const q = initialQuery?.trim();
    if (!q) return;
    startedInitialQueryRef.current = true;
    void createSessionFromQuestion(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.state, auth.token, initialQuery, scope, outputMode]);

  useEffect(() => {
    try {
      const contextRaw = sessionStorage.getItem("ff_companybrain_query_context");
      if (contextRaw) {
        const context = JSON.parse(contextRaw);
        if (context.knowledgeScope === "company" || context.knowledgeScope === "team" || context.knowledgeScope === "private") {
          setScope(context.knowledgeScope);
        }
        if (context.outputMode === "report" || context.outputMode === "table") {
          setOutputMode(context.outputMode);
        } else if (context.outputMode === "answer") {
          setOutputMode("direct");
        }
        sessionStorage.removeItem("ff_companybrain_query_context");
      }
      const raw = sessionStorage.getItem("ff_companybrain_pending_attachments");
      if (!raw) return;
      const labels = JSON.parse(raw);
      if (Array.isArray(labels)) setPendingAttachmentLabels(labels.filter((item): item is string => typeof item === "string"));
      sessionStorage.removeItem("ff_companybrain_pending_attachments");
    } catch {
      setPendingAttachmentLabels([]);
    }
  }, []);

  return (
    <FrontstageShell active="/app/ask" title={t("shell.navAsk")} eyebrow={t("shell.askEyebrow")} initialSnapshot={snapshot}>
      <div className="global-ask-workspace">
        <aside className="global-chat-history" aria-label={t("shell.chatHistory")}>
          <header>
            <span>{t("shell.chatHistory")}</span>
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setInput("");
                setMessage("");
              }}
            >
              {t("shell.newChat")}
            </button>
          </header>
          <div className="global-history-list">
            {loadingSessions ? <p>{t("shell.loadingChats")}</p> : null}
            {!loadingSessions && sessions.length === 0 ? <p>{t("shell.noChatsYet")}</p> : null}
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSession?.id === item.id ? "active" : ""}
                onClick={() => void openSession(item.id)}
              >
                <b>{item.title}</b>
                <span>{t(scopeLabel(item.scope))} · {formatDisplayTime(item.updatedAtText)}</span>
                <small>{item.latestMessage}</small>
              </button>
            ))}
          </div>
            <section className="global-scope-card">
            <span>{t("shell.currentScope")}</span>
              <p>{t(scopeDescription(scope))}</p>
          </section>
        </aside>

        <main className="global-chat-thread" aria-label={t("shell.companyQaLabel")}>
          {!activeSession ? (
            <section className="global-empty-state">
              <span>{t("shell.askLabel")}</span>
              <h1>{t("shell.askEmptyTitle")}</h1>
              <p>{t("shell.askEmptyBody")}</p>
              <div className="global-empty-suggestions" aria-label={t("shell.recentlyUsed")}>
                <span>{sessions.length > 0 ? t("shell.recentlyUsed") : t("shell.continueWith")}</span>
                <div className="global-empty-grid">
                  {recentGlobalEntries.map((entry) => (
                  <button key={entry.id} type="button" onClick={entry.action}>
                    <small>{entry.meta}</small>
                    <b>{entry.title}</b>
                    <span>{entry.description}</span>
                  </button>
                  ))}
                  {recentGlobalEntries.length === 0 ? (
                    <Link href="/app/templates">{t("shell.pickTemplateFirst")}</Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <div className="global-chat-messages">
              {activeSession.messages.map((item) => (
                <article key={item.id} className={`global-message ${item.role === "user" ? "user" : "assistant"}`}>
                  <span>{item.role === "user" ? t("shell.you") : "CompanyBrain"}</span>
                  {item.role === "user" ? <p>{item.content}</p> : <AssistantText content={item.content} animate={item.id === animatingId} />}
                  {item.role === "assistant" && item.contextTrace ? (
                    <div className="global-answer-tags global-inline-references">
                      {item.contextTrace.route === "direct" ? <em>{t("shell.outputDirect")}</em> : null}
                      {item.contextTrace.route === "retrieve"
                        ? item.contextTrace.retrievalTracks.filter((track) => track.count > 0).map((track) => <em key={track.label}>{t(knowledgeTypeKey(track.label))} {track.count}</em>)
                        : null}
                    </div>
                  ) : null}
                  {item.role === "assistant" ? <AnswerFeedback traceId={item.traceId} /> : null}
                  {item.role === "assistant" && item.id === latestAssistant?.id && recommendedTemplates.length > 0 ? (
                    <div className="global-followup-templates" aria-label={t("platform.chat.templatesSuggested")}>
                      <span>{t("shell.scenariosCouldCapture")}</span>
                      <div>
                        {recommendedTemplates.map((template) => (
                          <Link key={template.id} href={`/app/create?template=${template.id}`}>
                            <b>{template.name}</b>
                            <small>{template.headline}</small>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
              {pending ? (
                <article className="global-message assistant loading">
                  <span>CompanyBrain</span>
                  <p>{t("shell.searchingKnowledge")}</p>
                </article>
              ) : null}
            </div>
          )}
          {message ? <p className="global-error">{message}</p> : null}

          <form
            className="global-composer"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const nextQuery = String(form.get("q") ?? "");
              submitQuestion(nextQuery);
              event.currentTarget.reset();
            }}
          >
            <label htmlFor="global-ask-input">{t("shell.askLabel")}</label>
            <textarea
              id="global-ask-input"
              name="q"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={activeSession ? t("platform.chat.askFollowupPlaceholder") : t("shell.askPlaceholder")}
              rows={4}
            />
            <div className="global-composer-actions">
              <label htmlFor="global-ask-attachments">
                {t("shell.uploadFiles")}
                <input
                  id="global-ask-attachments"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"
                  onChange={(event) => setAttachments(Array.from(event.currentTarget.files ?? []))}
                />
              </label>
              <select value={scope} onChange={(event) => setScope(event.target.value as GlobalChatScope)} aria-label={t("shell.knowledgeScope")}>
                <option value="company">{t("shell.scopeCompany")}</option>
                <option value="team">{t("shell.scopeTeam")}</option>
                <option value="private">{t("shell.scopePrivate")}</option>
              </select>
              <select value={outputMode} onChange={(event) => setOutputMode(event.target.value as GlobalChatOutputMode)} aria-label={t("shell.outputFormat")}>
                <option value="direct">{t("shell.outputDirect")}</option>
                <option value="report">{t("shell.outputReport")}</option>
                <option value="table">{t("shell.outputTable")}</option>
              </select>
              <button type="submit" disabled={pending}>{pending ? t("platform.chat.generating") : t("platform.chat.send")}</button>
            </div>
            {attachments.length || pendingAttachmentLabels.length ? (
              <div className="global-attachment-list">
                {attachments.map((file) => <span key={`${file.name}-${file.size}`}>{formatAttachmentMeta(file)}</span>)}
                {pendingAttachmentLabels.map((label) => <span key={label}>{label}</span>)}
              </div>
            ) : null}
          </form>
        </main>

        <aside className="global-source-rail" aria-label={t("platform.chat.sourceRailLabel")}>
          <section className="global-source-panel">
            <header>
              <span>{t("shell.sourcesInAnswer")}</span>
              <b>{isDirectAnswer ? t("platform.chat.notRetrieved") : t("platform.chat.citationsCount", { count: activeCitations.length })}</b>
            </header>
            {activeCitations.length === 0 ? (
              <p>{isDirectAnswer ? t("platform.chat.directAnswerHint") : t("platform.chat.sourceRailEmpty")}</p>
            ) : null}
            {citationGroups.map((group) => (
              <section key={group.type} className="global-source-section">
                <header>
                  <h3>{t(knowledgeTypeKey(group.type))}</h3>
                  <span>{t("platform.chat.citationsCount", { count: group.items.length })}</span>
                </header>
                <p>{t(knowledgeSourceHint(group.type))}</p>
                {group.items.map((citation) => (
                  <article key={`${citation.knowledgeObjectId}-${citation.sourceOriginalName}`}>
                    <em>{t(sourceBadgeForCitation(citation))}</em>
                    <b>{citation.scenarioName}</b>
                    <small>{displaySourceName(citation.sourceOriginalName)}</small>
                    <p>{citation.excerpt}</p>
                  </article>
                ))}
              </section>
            ))}
          </section>

          <section className="global-source-panel">
            <header>
              <span>{t("shell.answerScope")}</span>
              <b>{activeTrace?.scopeLabel ?? t(scopeLabel(scope))}</b>
            </header>
            <ul className="global-answer-scope-list">
              <li><b>{t("shell.knowledgeScope")}</b><span>{t(scopeDescription(activeSession?.scope ?? scope))}</span></li>
              <li><b>{t("shell.followUps")}</b><span>{activeSession ? t("shell.followUpsThread") : t("shell.followUpsNew")}</span></li>
              <li><b>{t("shell.routing")}</b><span>{activeTrace?.routeReason ?? t("shell.routingPending")}</span></li>
              <li><b>{t("shell.sourceStatus")}</b><span>{isDirectAnswer ? t("shell.sourceStatusDirect") : activeCitations.length ? t("shell.sourceStatusTraceable") : t("shell.sourceStatusPending")}</span></li>
            </ul>
          </section>

          <section className="global-source-panel">
            <header>
              <span>{t("shell.suggestedCapture")}</span>
              <b>{relatedScenario ? t("shell.openScenario") : t("shell.createScenario")}</b>
            </header>
            {relatedScenario ? (
              <>
                <h2>{relatedScenario.name}</h2>
                <p>{relatedScenario.description}</p>
                <div className="global-source-actions">
                  <Link href={`/app/scenarios/${relatedScenario.id}`}>{t("shell.openScenario")}</Link>
                  <Link href="/app/templates">{t("shell.browseTemplates")}</Link>
                </div>
              </>
            ) : (
              <div className="global-source-actions">
                <Link href="/app/templates">{t("shell.chooseTemplate")}</Link>
                <Link href="/app/create?mode=blank">{t("shell.buildOwnScenario")}</Link>
              </div>
            )}
            {suggestedQuestions.map((question) => (
              <button key={question} type="button" onClick={() => setInput(question)}>{question}</button>
            ))}
          </section>
        </aside>
      </div>
    </FrontstageShell>
  );
}

export function TemplateLibraryPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedTemplateId, setSelectedTemplateId] = useState("customer-360");
  const [view, setView] = useState<TemplateLibraryView>("featured");
  const categories = ["All", ...Array.from(new Set(officialTemplates.map((item) => item.category)))];
  const visible = officialTemplates.filter((template) => {
    const q = query.trim().toLowerCase();
    const categoryOk = category === "All" || template.category === category;
    const queryOk = !q || `${template.name} ${template.headline} ${template.bestFor.join(" ")}`.toLowerCase().includes(q);
    return categoryOk && queryOk;
  });
  const selectedTemplate = visible.find((template) => template.id === selectedTemplateId) ?? visible[0] ?? officialTemplates[0];
  const activeView = getTemplateViewOption(view);

  return (
    <FrontstageShell active="/app/templates" title={t("shell.navTemplates")} eyebrow={t("shell.templatesEyebrow")}>
      <section className="ux-page-head template-library-head">
        <div>
          <span>{t("shell.navTemplates")}</span>
          <h1>{t("templates.chooseByGoal")}</h1>
          <p>{t("templates.libraryBody")}</p>
        </div>
        <div className="template-library-actions">
          <Link className="primary" href="/app/create?mode=blank">{t("shell.createScenario")}</Link>
          <Link href={`/app/create?template=${selectedTemplate.id}`}>{t("templates.createSelected")}</Link>
        </div>
      </section>
      <div className="template-market-toolbar">
        <label>
          <span>{t("templates.searchTemplates")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("templates.searchPlaceholder")} />
        </label>
        <TemplateViewToggle view={view} onChange={setView} />
      </div>
      <section className="template-market-layout" aria-label={t("templates.catalogLabel")}>
        <aside className="template-filter-panel">
          <div>
            <span>{t("templates.businessCategory")}</span>
            <b>{t("templates.narrowByGoal")}</b>
          </div>
          <div className="template-category-list">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={item === category ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <span>{item === "All" ? t("common.all") : item}</span>
                <small>{item === "All" ? officialTemplates.length : officialTemplates.filter((template) => template.category === item).length}</small>
              </button>
            ))}
          </div>
          <div className="template-filter-note">
            <b>{t("templates.noGoodFit")}</b>
            <p>{t("templates.noGoodFitBody")}</p>
            <Link href="/app/create?mode=blank">{t("shell.createScenario")}</Link>
          </div>
        </aside>

        <div className="template-market-main">
          <header>
            <div>
              <span>{t("templates.viewAriaLabel", { view: t(activeView.label) })}</span>
              <b>{t("templates.templatesAvailable", { count: visible.length })}</b>
            </div>
            <small>{t(activeView.description)}</small>
          </header>
          <TemplateMarketCanvas
            view={view}
            templates={visible}
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplateId}
          />
        </div>

        {selectedTemplate ? <TemplateCatalogPreview template={selectedTemplate} /> : null}
      </section>
    </FrontstageShell>
  );
}

export const ScenarioLibraryPage = TemplateLibraryPage;

export function TemplateDetailPage({ id }: { id: string }) {
  const { t } = useI18n();
  const template = templateById(id);
  if (!template) return <TemplateNotFound />;

  return (
    <FrontstageShell active="/app/templates" title={template.name} eyebrow={t("shell.templateDetailEyebrow")}>
      <div className="ux-template-detail">
        <section className="ux-hero-panel">
          <span>{template.category}</span>
          <h1>{template.name}</h1>
          <p>{template.headline}</p>
          <div className="ux-actions">
            <Link className="ux-primary-link" href={`/app/create?template=${template.id}`}>{t("templates.createWithTemplate")}</Link>
            <Link href="#preview">{t("templates.seePreview")}</Link>
          </div>
        </section>
        <aside className="ux-side-panel">
          <Meta label={t("templates.setupTime")} value={template.setupTime} />
          <Meta label={t("templates.approvalNeeded")} value={template.reviewRequirement} />
          <Meta label={t("templates.acceptedFiles")} value={template.acceptedFiles.join(" / ")} />
        </aside>
        <InfoSection title={t("templates.bestFor")} items={template.bestFor} />
        <InfoSection title={t("templates.whatToPrepare")} items={template.inputExamples} />
        <InfoSection title={t("templates.whatSystemDoes")} items={template.processingExplanation} ordered />
        <InfoSection title={t("templates.whatAfterwards")} items={template.outputCapabilities} />
        <section id="preview" className="ux-demo-panel">
          <span>{t("templates.preview")}</span>
          <h2>{template.demoWalkthrough.scenarioName}</h2>
          <div className="ux-demo-grid">
            <div>
              <h3>{t("templates.sampleFiles")}</h3>
              {template.demoWalkthrough.sampleInputs.map((asset) => (
                <article key={asset.fileName} className="ux-source-card">
                  <b>{asset.title}</b>
                  <small>{displaySourceName(asset.fileName)}</small>
                  <p>{asset.description}</p>
                </article>
              ))}
            </div>
            <div>
              <h3>{t("templates.processingSteps")}</h3>
              <ol>{template.demoWalkthrough.processingPreview.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
          </div>
          <div className="ux-answer-preview">
            <small>{t("platform.sample.sampleQuestion")}</small>
            <h3>{template.demoWalkthrough.sampleQuestion}</h3>
            <p>{template.demoWalkthrough.sampleAnswer}</p>
            <div className="ux-citation-grid">
              {template.demoWalkthrough.citations.map((citation) => (
                <article key={`${citation.source}-${citation.label}`}>
                  <b>{citation.label}</b>
                  <small>{displaySourceName(citation.source)}</small>
                  <p>{citation.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
          <Pills items={template.demoWalkthrough.resultHighlights} />
        </section>
      </div>
    </FrontstageShell>
  );
}

export function CreateScenarioPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBlankMode = searchParams.get("mode") === "blank";
  const initialTemplate = isBlankMode ? customScenarioTemplate.id : searchParams.get("template") ?? "customer-360";
  const [templateId, setTemplateId] = useState(initialTemplate);
  const initialTemplateObject = templateById(initialTemplate) ?? customScenarioTemplate;
  const [name, setName] = useState(isBlankMode ? "" : initialTemplateObject.demoWalkthrough.scenarioName);
  const [description, setDescription] = useState(isBlankMode ? "" : initialTemplateObject.headline);
  const [visibility, setVisibility] = useState<Visibility>(isBlankMode ? "private" : "team");
  const [processingGoal, setProcessingGoal] = useState(isBlankMode ? "Let the admin decide which knowledge app fits these files." : initialTemplateObject.demoWalkthrough.sampleQuestion);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const template = templateById(templateId) ?? customScenarioTemplate;
  const creationTemplates = [customScenarioTemplate, ...officialTemplates];
  const isCustomTemplate = template.id === customScenarioTemplate.id;
  const uploadedFileNames = uploadedFiles.map((file) => file.name);
  const draft = useMemo(
    () => createScenarioDraft({
      templateId: template.id,
      name: name.trim() || template.demoWalkthrough.scenarioName,
      visibility,
      fileNames: uploadedFileNames,
      description,
      processingGoal
    }),
    [description, name, processingGoal, template.demoWalkthrough.scenarioName, template.id, uploadedFileNames, visibility]
  );
  const hasFiles = uploadedFiles.length > 0;
  function selectTemplate(next: string) {
    setTemplateId(next);
    const nextTemplate = templateById(next) ?? customScenarioTemplate;
    const isCustom = nextTemplate.id === customScenarioTemplate.id;
    setName(isCustom ? "" : nextTemplate.demoWalkthrough.scenarioName);
    setDescription(isCustom ? "" : nextTemplate.headline);
    setProcessingGoal(isCustom ? "Let the admin decide which knowledge app fits these files." : nextTemplate.demoWalkthrough.sampleQuestion);
    setUploadedFiles([]);
    setSubmitError("");
  }

  async function submitScenario() {
    if (!name.trim() || !hasFiles || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const form = new FormData();
      form.set("template_id", template.id);
      form.set("name", name.trim());
      form.set("description", description.trim());
      form.set("visibility", visibility);
      form.set("processing_goal", processingGoal.trim());
      uploadedFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/platform/scenarios", { method: "POST", body: form });
      if (!response.ok) throw new Error("Could not submit the scenario");
      const body = await response.json();
      router.push(`/app/tasks?created=${encodeURIComponent(body.task.id)}`);
    } catch {
      setSubmitError(t("platform.create.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FrontstageShell active="/app/templates" title={t("shell.createScenario")} eyebrow={t("shell.createScenario")}>
      <section className="ux-page-head">
        <h1>{t("platform.create.headline")}</h1>
        <p>{t("platform.create.lead")}</p>
      </section>
      <div className="ux-create-layout">
        <section className="ux-form-panel create-scenario-form">
          <div className="create-mode-switch">
            <button type="button" className={!isCustomTemplate ? "active" : ""} onClick={() => selectTemplate("customer-360")}>{t("platform.create.fromTemplate")}</button>
            <button type="button" className={isCustomTemplate ? "active" : ""} onClick={() => selectTemplate(customScenarioTemplate.id)}>{t("shell.createScenario")}</button>
          </div>
          <div className="create-picker-block">
            <div className="create-section-title">
              <span>{t("platform.create.chooseStart")}</span>
              <small>{t("platform.create.chooseStartHint")}</small>
            </div>
            <div className="create-template-options" role="radiogroup" aria-label={t("platform.create.chooseStart")}>
              {creationTemplates.map((item) => {
                const active = item.id === template.id;
                const custom = item.id === customScenarioTemplate.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={active ? "active" : ""}
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectTemplate(item.id)}
                  >
                    <span>{custom ? t("platform.create.custom") : item.category}</span>
                    <b>{item.name}</b>
                    <small>{custom ? t("platform.create.customHint") : item.demoWalkthrough.scenarioName}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <label>{t("platform.create.scenarioName")}</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("platform.create.scenarioNamePlaceholder")} />
          <label>{t("platform.create.scenarioDescription")}</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={t("platform.create.scenarioDescriptionPlaceholder")} />
          <label>{t("platform.create.expectedResult")}</label>
          <textarea value={processingGoal} onChange={(event) => setProcessingGoal(event.target.value)} rows={3} placeholder={t("platform.create.expectedResultPlaceholder")} />

          <div className="create-intake-panel">
            <div className="create-section-title">
              <span>{t("platform.create.accessFiles")}</span>
              <small>{t("platform.create.accessFilesHint")}</small>
            </div>

            <div className="create-intake-grid">
              <section className="create-intake-section">
                <div className="create-mini-head">
                  <b>{t("platform.create.publishScope")}</b>
                  <span>{t("platform.create.publishScopeHint")}</span>
                </div>
                <div className="create-visibility-options" role="radiogroup" aria-label={t("platform.create.publishScope")}>
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={visibility === option.value ? "active" : ""}
                      role="radio"
                      aria-checked={visibility === option.value}
                      onClick={() => setVisibility(option.value)}
                    >
                      <b>{t(option.label)}</b>
                      <small>{t(option.description)}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="create-intake-section create-source-advice">
                <div className="create-mini-head">
                  <b>{t("platform.create.suggestedFileTypes")}</b>
                  <span>{t("platform.create.suggestedFileTypesHint")}</span>
                </div>
                <div className="create-file-type-list">
                  {template.acceptedFiles.map((fileType) => <span key={fileType}>{fileType}</span>)}
                </div>
              </section>
            </div>

            <section className="create-intake-section create-upload-section">
              <div className="create-mini-head">
                <b>{t("shell.uploadFiles")}</b>
                <span>{hasFiles ? t("platform.create.filesReady") : t("platform.create.filesEmptyHint")}</span>
              </div>
              <div className="create-upload-box">
                <input
                  id="scenario-file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.md,.txt,.csv,.xlsx,.json,.html"
                  onChange={(event) => setUploadedFiles(Array.from(event.currentTarget.files ?? []))}
                />
                <label htmlFor="scenario-file-upload">{t("platform.create.chooseFiles")}</label>
                <button type="button" onClick={() => setUploadedFiles(template.demoWalkthrough.sampleInputs.map(makeTemplateSampleFile))}>{t("platform.create.useSampleFiles")}</button>
                <span>{hasFiles ? t("platform.create.attachedFilesCount", { count: uploadedFiles.length }) : t("platform.create.fileTypesHint")}</span>
              </div>

              <div className={`create-file-state ${hasFiles ? "ready" : ""}`}>
                <b>{hasFiles ? t("platform.create.filesAttached") : t("platform.create.waitingForFiles")}</b>
                {hasFiles ? (
                  <div className="ux-file-list create-file-list">
                    {uploadedFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`}>{displaySourceName(file.name)}</span>
                    ))}
                  </div>
                ) : (
                  <p>{t("platform.create.filesEmptyBody")}</p>
                )}
              </div>
            </section>
          </div>

          {submitError && <p className="create-submit-error">{submitError}</p>}
          <button className="ux-button" disabled={!name.trim() || !hasFiles || isSubmitting} onClick={submitScenario}>
            {isSubmitting ? t("platform.create.submittingFiles") : t("platform.create.submitForProcessing")}
          </button>
        </section>
        <aside className="ux-path-panel create-processing-panel">
          <h2>{t("platform.create.whatsNext")}</h2>
          <div className="create-admin-note">
            <b>{draft.task.currentStep}</b>
            <span>{taskMessageText(draft.task.userMessage, t)}</span>
          </div>
          {scenarioLifecycle.map((stage, index) => (
            <div className="ux-stage-row" key={stage.key}>
              <i>{index + 1}</i>
              <div>
                <b>{t(stage.label)}</b>
                <span>{t(stage.description)}</span>
              </div>
            </div>
          ))}
          <div className="create-admin-note">
            <b>{t("platform.create.adminDecides")}</b>
            <span>{t("platform.create.adminDecidesBody")}</span>
          </div>
        </aside>
      </div>
    </FrontstageShell>
  );
}

export function MyScenariosPage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { t } = useI18n();
  const { snapshot, state } = usePlatformSnapshot(initialSnapshot);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scenarios = useMemo(() => sortScenariosByStatusAndTime(snapshot.scenarios).map(toScenarioInstance), [snapshot.scenarios]);
  const visible = scenarios.filter((scenario) => {
    const statusOk = scenarioStatusMatchesFilter(scenario.status, status);
    const q = query.trim().toLowerCase();
    const template = templateById(scenario.templateId);
    const queryOk = !q || `${scenario.name} ${scenario.description} ${template?.name ?? ""} ${template?.category ?? ""}`.toLowerCase().includes(q);
    return statusOk && queryOk;
  });
  const selectedScenario = visible.find((scenario) => scenario.id === selectedId) ?? visible[0] ?? scenarios[0];
  const readyCount = scenarios.filter((scenario) => scenario.status === "ready").length;
  const processingCount = scenarios.filter((scenario) => scenario.status !== "ready" && scenario.status !== "failed").length;
  const companyCount = scenarios.filter((scenario) => scenario.visibility === "company").length;

  return (
    <FrontstageShell active="/app/scenarios" title={t("shell.navScenarios")} eyebrow={t("shell.scenariosEyebrow")} initialSnapshot={snapshot}>
      <section className="scenario-asset-head">
        <div>
          <span>{t("platform.scenario.assetsEyebrow")}</span>
          <h1>{t("platform.scenario.assetsTitle")}</h1>
          <p>{t("platform.scenario.assetsBody")}</p>
        </div>
        <div className="scenario-asset-metrics" aria-label={t("platform.scenario.statsLabel")}>
          <span><b>{scenarios.length}</b>{t("platform.scenario.totalScenarios")}</span>
          <span><b>{readyCount}</b>{t("platform.scenario.available")}</span>
          <span><b>{processingCount}</b>{t("platform.scenario.processing")}</span>
          <span><b>{companyCount}</b>{t("platform.scenario.companyWide")}</span>
        </div>
      </section>

      <div className="scenario-asset-layout">
        <aside className="scenario-asset-filter" aria-label={t("platform.scenario.filtersLabel")}>
          <Link className="scenario-create-primary" href="/app/templates">{t("platform.scenario.createScenario")}</Link>
          <section>
            <b>{t("platform.scenario.status")}</b>
            {scenarioStatusFilters.map((item) => (
              <button key={item.value} type="button" className={item.value === status ? "active" : ""} onClick={() => setStatus(item.value)}>
                <span>{t(item.label)}</span>
                <em>{countScenariosByStatus(scenarios, item.value)}</em>
              </button>
            ))}
          </section>
          <section>
            <b>{t("platform.scenario.accessScope")}</b>
            {(["private", "team", "company"] as Visibility[]).map((item) => (
              <Link key={item} href={`/app/scenarios?scope=${item}`}>
                <span>{t(visibilityText(item))}</span>
                <em>{scenarios.filter((scenario) => scenario.visibility === item).length}</em>
              </Link>
            ))}
          </section>
        </aside>

        <section className="scenario-asset-table" aria-label={t("platform.scenario.listLabel")}>
          <header>
            <div>
              <span>{t("platform.scenario.scenarios")}</span>
              <b>{t("platform.scenario.scenariosCount", { count: visible.length })}</b>
            </div>
            <label>
              <span>{t("platform.scenario.search")}</span>
              <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={t("platform.scenario.searchPlaceholder")} />
            </label>
          </header>
          <div className="scenario-list-head" aria-hidden="true">
            <span>{t("common.scenario")}</span>
            <span>{t("platform.scenario.form")}</span>
            <span>{t("platform.scenario.scope")}</span>
            <span>{t("platform.scenario.status")}</span>
            <span>{t("platform.scenario.actions")}</span>
          </div>
          <div className="scenario-asset-rows">
            {visible.map((scenario) => (
              <ScenarioAssetRow
                key={scenario.id}
                scenario={scenario}
                active={selectedScenario?.id === scenario.id}
                onFocus={() => setSelectedId(scenario.id)}
              />
            ))}
            {state !== "loading" && visible.length === 0 ? (
              <div className="scenario-empty-row">
                <b>{t("platform.scenario.noMatching")}</b>
                <span>{t("platform.scenario.noMatchingHint")}</span>
                <Link href="/app/templates">{t("platform.scenario.chooseTemplate")}</Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="scenario-asset-inspector" aria-label={t("platform.scenario.detailsLabel")}>
          {selectedScenario ? (
            <ScenarioAssetInspector scenario={selectedScenario} />
          ) : (
            <section>
              <span>{t("platform.scenario.noScenarioYet")}</span>
              <h2>{t("platform.scenario.createFirst")}</h2>
              <p>{t("platform.scenario.createFirstBody")}</p>
              <Link href="/app/templates">{t("platform.scenario.chooseTemplate")}</Link>
            </section>
          )}
        </aside>
      </div>
    </FrontstageShell>
  );
}

export function TaskCenterPage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const createdTask = searchParams.get("created");
  const [liveTasks, setLiveTasks] = useState<ProcessingTask[]>(initialSnapshot?.tasks ?? []);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [kindFilter, setKindFilter] = useState("All types");
  const [sortBy, setSortBy] = useState("Recently updated");

  useEffect(() => {
    let alive = true;
    fetch("/api/platform/tasks", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("tasks unavailable");
        return response.json();
      })
      .then((body) => {
        if (!alive) return;
        setLiveTasks(Array.isArray(body.tasks) ? body.tasks : []);
      })
      .catch(() => {
        if (!alive) return;
        setLiveTasks([]);
      });
    return () => {
      alive = false;
    };
  }, [createdTask]);

  const allTasks = useMemo(() => {
    // 按 id 去重：后端/脏数据可能返回重复 task，重复 key 会让 React 列表 reconciliation 错乱
    // (Filtering/sorting would reuse the wrong DOM nodes and content would not refresh), so make ids unique before rendering.
    const seenIds = new Set<string>();
    const base = liveTasks.filter((task) => {
      if (seenIds.has(task.id)) return false;
      seenIds.add(task.id);
      return true;
    });
    const filtered = base.filter((task) => {
      const statusOk = statusFilter === "All statuses" || taskStatusGroup(task) === statusFilter;
      const kindOk = kindFilter === "All types" || task.kind === kindFilter;
      return statusOk && kindOk;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "Progress") return b.progress - a.progress;
      if (sortBy === "Submitted") return compareTaskTime(a.submittedAt, b.submittedAt);
      return compareTaskTime(a.updatedAt, b.updatedAt);
    });
  }, [kindFilter, liveTasks, sortBy, statusFilter]);
  const pendingAdminCount = allTasks.filter((task) => task.waitingFor === "Admin").length;
  const runningCount = allTasks.filter((task) => task.status === "processing").length;
  const readyCount = allTasks.filter((task) => task.status === "ready").length;

  return (
    <FrontstageShell active="/app/tasks" title={t("shell.navTasks")} eyebrow={t("shell.tasksEyebrow")} initialSnapshot={initialSnapshot}>
      <section className="ux-page-head task-center-head">
        <div>
          <span>{t("platform.task.centerEyebrow")}</span>
          <h1>{t("platform.task.centerTitle")}</h1>
          <p>{t("platform.task.centerBody")}</p>
        </div>
        <div className="task-head-metrics">
          <span><b>{pendingAdminCount}</b>{t("platform.task.pendingAdminReview")}</span>
          <span><b>{runningCount}</b>{t("platform.task.processing")}</span>
          <span><b>{readyCount}</b>{t("platform.task.available")}</span>
        </div>
      </section>
      {createdTask && (
        <section className="task-submit-banner">
          <b>{t("platform.task.newSubmitted")}</b>
          <span>{t("platform.task.newSubmittedBody")}</span>
        </section>
      )}
      <section className="task-control-bar" aria-label={t("platform.task.filtersLabel")}>
        <div>
          {taskStatusFilters.map((item) => (
            <button key={item.value} type="button" className={statusFilter === item.value ? "active" : ""} onClick={() => setStatusFilter(item.value)}>{t(item.label)}</button>
          ))}
        </div>
        <div>
          {taskKindFilters.map((item) => (
            <button key={item.value} type="button" className={kindFilter === item.value ? "active" : ""} onClick={() => setKindFilter(item.value)}>{t(item.label)}</button>
          ))}
        </div>
        <div>
          {taskSortOptions.map((item) => (
            <button key={item.value} type="button" className={sortBy === item.value ? "active" : ""} onClick={() => setSortBy(item.value)}>{t(item.label)}</button>
          ))}
        </div>
      </section>
      <div className="task-board-layout">
        <aside className="task-board-side">
          <b>{t("platform.task.processingRules")}</b>
          <p>{t("platform.task.processingRulesBody")}</p>
          <div className="task-board-side-note">
            <span>{t("platform.task.workspaceOnly")}</span>
            <strong>{t("platform.task.adminHandles")}</strong>
          </div>
        </aside>
        <div className="task-list">
          {allTasks.map((task) => <TaskCard key={task.id} task={task} />)}
          {allTasks.length === 0 ? (
            <article className="ux-task-card">
              <header className="task-card-head"><span>{t("platform.task.noTasks")}</span><small>{t("platform.task.fileIntake")}</small></header>
              <h2>{t("platform.task.noTasksYet")}</h2>
              <p>{t("platform.task.noTasksBody")}</p>
              <footer className="task-card-actions"><Link href="/app/templates">{t("platform.scenario.chooseTemplate")}</Link><Link href="/app/create?mode=blank">{t("platform.scenario.createScenario")}</Link></footer>
            </article>
          ) : null}
        </div>
      </div>
    </FrontstageShell>
  );
}

export function KnowledgeSpacePage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { t } = useI18n();
  const { snapshot, state } = usePlatformSnapshot(initialSnapshot);
  const knowledgeObjects = useMemo(() => snapshot.knowledge.map(toKnowledgeSpaceObject), [snapshot.knowledge]);
  const [scopeFilter, setScopeFilter] = useState<KnowledgeAssetScope>("all");
  const [kindFilter, setKindFilter] = useState<KnowledgeAssetKindFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stats = useMemo(() => buildKnowledgeAssetStats(knowledgeObjects), [knowledgeObjects]);
  const filteredObjects = useMemo(
    () => filterKnowledgeAssets(knowledgeObjects, { scope: scopeFilter, kind: kindFilter, query }, t),
    [knowledgeObjects, scopeFilter, kindFilter, query, t]
  );
  const selectedObject = filteredObjects.find((object) => object.id === selectedId) ?? filteredObjects[0] ?? knowledgeObjects[0] ?? null;
  return (
    <FrontstageShell active="/app/knowledge" title={t("knowledge.pageTitle")} eyebrow={t("knowledge.pageEyebrow")} initialSnapshot={snapshot}>
      <section className="knowledge-asset-head">
        <div>
          <span>{t("knowledge.centerEyebrow")}</span>
          <h1>{t("knowledge.centerTitle")}</h1>
          <p>{t("knowledge.centerBody")}</p>
        </div>
        <div className="knowledge-asset-metrics">
          <span><b>{stats.total}</b>{t("knowledge.totalAssets")}</span>
          <span><b>{stats.private}</b>{t("visibility.private")}</span>
          <span><b>{stats.team}</b>{t("visibility.team")}</span>
          <span><b>{stats.company}</b>{t("visibility.company")}</span>
        </div>
      </section>
      <div className="knowledge-asset-layout">
        <aside className="knowledge-asset-filter">
          <div className="knowledge-filter-block">
            <strong>{t("knowledge.permissionScope")}</strong>
            {knowledgeAssetScopes.map((scope) => (
              <button key={scope.id} type="button" className={scopeFilter === scope.id ? "active" : ""} onClick={() => setScopeFilter(scope.id)}>
                <b>{t(scope.label)}</b>
                <span>{t(scope.description)}</span>
              </button>
            ))}
          </div>
          <div className="knowledge-filter-block">
            <strong>{t("knowledge.assetType")}</strong>
            {knowledgeAssetKinds.map((kind) => (
              <button key={kind.id} type="button" className={kindFilter === kind.id ? "active" : ""} onClick={() => setKindFilter(kind.id)}>
                <b>{t(kind.label)}</b>
                <span>{t(kind.description)}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="knowledge-asset-main">
          <div className="knowledge-asset-toolbar">
            <div>
              <span>{t("knowledge.assetList")}</span>
              <b>{filteredObjects.length} / {stats.total}</b>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("platform.knowledge.searchPlaceholder")} aria-label={t("platform.knowledge.searchAria")} />
          </div>
          <div className="knowledge-asset-table" role="list">
            {filteredObjects.map((object) => (
              <KnowledgeAssetRow
                key={object.id}
                object={object}
                active={selectedObject?.id === object.id}
                onSelect={() => setSelectedId(object.id)}
              />
            ))}
            {state !== "loading" && filteredObjects.length === 0 ? (
              <div className="knowledge-empty-state">
                <b>{t("platform.knowledge.noMatch")}</b>
                <p>{t("platform.knowledge.noMatchHint")}</p>
                <Link href="/app/templates">{t("platform.scenario.chooseTemplate")}</Link>
              </div>
            ) : null}
          </div>
        </section>
        <KnowledgeAssetInspector object={selectedObject} />
      </div>
    </FrontstageShell>
  );
}

export function OutputsPage() {
  return <KnowledgeSpacePage />;
}

export function SettingsPage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const auth = useAuth();
  const { t, locale } = useI18n();
  const { snapshot } = usePlatformSnapshot(initialSnapshot);
  const role = auth.user?.is_admin ? "admin" : "member";
  const model = useMemo(() => buildWorkspaceSettingsModel({ profile: workspaceProfile, role, snapshot, t }), [role, snapshot, t]);
  const recentTasks = snapshot.tasks.slice(0, 4);
  const readyScenarios = snapshot.scenarios.filter((scenario) => scenario.status === "ready").slice(0, 4);
  return (
    <FrontstageShell active="/app/settings" title={t("settings.pageTitle")} eyebrow={t("settings.pageEyebrow")} initialSnapshot={snapshot}>
      <section className="settings-console-head">
        <div>
          <span>{t("settings.governanceEyebrow")}</span>
          <h1>{t("settings.governanceTitle")}</h1>
          <p>{t("settings.governanceBody")}</p>
        </div>
        <div className="settings-user-card">
          <small>{t("settings.currentAccount")}</small>
          <b>{auth.user?.display_name || auth.user?.username || workspaceProfile.currentUser}</b>
          <span>{t(roleDisplayName(role))} · {workspaceProfile.plan}</span>
        </div>
      </section>
      <div className="settings-console-grid">
        <section className="settings-console-panel settings-language-panel">
          <PanelHeading eyebrow={t("settings.languageEyebrow")} title={t("settings.languageTitle")} />
          <p className="settings-language-note">
            {t("language.currentMode", { language: t(locale === "zh-CN" ? "language.chinese" : "language.english") })}
          </p>
          <p className="settings-language-note">{t("language.description")}</p>
          <LanguageSwitcher variant="section" />
        </section>
        <section className="settings-console-panel settings-identity-panel">
          <PanelHeading eyebrow={t("settings.identityEyebrow")} title={t("settings.identityTitle")} />
          <SettingsRows rows={model.identityRows} />
        </section>
        <section className="settings-console-panel settings-permission-panel">
          <PanelHeading eyebrow={t("settings.permissionEyebrow")} title={t("settings.permissionTitle")} />
          <SettingsRows rows={model.permissionRows} />
          <div className="settings-policy-note">
            <b>{t("settings.defaultRules")}</b>
            <span>{t("settings.defaultRulesBody")}</span>
          </div>
        </section>
        <section className="settings-console-panel settings-connector-panel">
          <PanelHeading eyebrow={t("settings.connectorEyebrow")} title={t("settings.connectorTitle")} />
          <SettingsRows rows={model.connectorRows} />
        </section>
        <section className="settings-console-panel settings-policy-panel">
          <PanelHeading eyebrow={t("settings.publishEyebrow")} title={t("settings.publishTitle")} />
          <div className="settings-policy-flow">
            {[1, 2, 3, 4].map((step, index) => (
              <div key={step}>
                <i>{index + 1}</i>
                <b>{t(`settings.publishStep${step}`)}</b>
                <span>{t(`settings.publishStep${step}Body`)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="settings-console-panel settings-audit-panel">
          <PanelHeading eyebrow={t("settings.auditEyebrow")} title={t("settings.auditTitle")} />
          <SettingsRows rows={model.auditRows} />
          <div className="settings-audit-list">
            {recentTasks.length > 0 ? recentTasks.map((task) => (
              <Link key={task.id} href={`/app/scenarios/${task.scenarioId}/tasks`}>
                <b>{taskTitleText(task.title, t)}</b>
                <span>{task.currentStep} · {task.progress}%</span>
              </Link>
            )) : <span>{t("settings.noPendingTasks")}</span>}
          </div>
        </section>
        <section className="settings-console-panel settings-scenario-panel">
          <PanelHeading eyebrow={t("settings.scenarioEyebrow")} title={t("settings.scenarioTitle")} />
          <div className="settings-scenario-list">
            {readyScenarios.length > 0 ? readyScenarios.map((scenario) => (
              <Link key={scenario.id} href={`/app/scenarios/${scenario.id}`}>
                <b>{scenario.name}</b>
                <span>{scenario.ownerName} · {t(knowledgeVisibilityLabel(scenario.visibility))}</span>
              </Link>
            )) : <span>{t("settings.noPublishedScenarios")}</span>}
          </div>
        </section>
      </div>
    </FrontstageShell>
  );
}

export function ScenarioDetailByIdPage({
  id,
  tab = "overview",
  initialQuery,
  initialSessionId
}: {
  id: string;
  tab?: ScenarioTab;
  initialQuery?: string;
  initialSessionId?: string;
}) {
  const workbench = scenarioWorkbenchById(id);
  if (!workbench) return <LiveScenarioDetailPage id={id} tab={tab} initialQuery={initialQuery} initialSessionId={initialSessionId} />;
  return <ScenarioDetailPage workbench={workbench} tab={tab} initialQuery={initialQuery} />;
}

function LiveScenarioDetailPage({ id, tab = "overview", initialQuery, initialSessionId }: { id: string; tab?: ScenarioTab; initialQuery?: string; initialSessionId?: string }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [scenario, setScenario] = useState<LiveScenarioRecord | null>(null);
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [knowledge, setKnowledge] = useState<LiveKnowledgeRecord[]>([]);
  const [template, setTemplate] = useState<LiveWorkbenchTemplate>(() => ({
    id: customScenarioTemplate.id,
    name: customScenarioTemplate.name,
    category: customScenarioTemplate.category,
    headline: customScenarioTemplate.headline,
    productForm: customScenarioTemplate.productForm,
    outputCapabilities: customScenarioTemplate.outputCapabilities
  }));
  const [surface, setSurface] = useState<ScenarioProductSurface>(() => buildScenarioProductSurface(customScenarioTemplate.id, { productForm: customScenarioTemplate.productForm }));
  const [sessions, setSessions] = useState<ScenarioChatSessionSummary[]>([]);

  useEffect(() => {
    if (auth.state === "loading") return;
    if (!auth.token) {
      setState("error");
      return;
    }
    let cancelled = false;
    async function loadLiveScenario() {
      setState("loading");
      try {
        const headers = { Authorization: `Bearer ${auth.token}` };
        const [workbenchResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/platform/scenarios/${id}/workbench`, { headers, cache: "no-store" }),
          fetch(`/api/platform/scenarios/${id}/sessions`, { headers, cache: "no-store" })
        ]);
        if (workbenchResponse.status === 404) {
          if (!cancelled) setState("not-found");
          return;
        }
        if (!workbenchResponse.ok) throw new Error("live scenario unavailable");
        const workbenchBody = await workbenchResponse.json();
        const sessionsBody = sessionsResponse.ok ? await sessionsResponse.json() : { sessions: [] };
        const liveScenario = workbenchBody.scenario as LiveScenarioRecord | null;
        if (cancelled) return;
        if (!liveScenario) {
          setState("not-found");
          return;
        }
        setScenario(liveScenario);
        setTasks(Array.isArray(workbenchBody.tasks) ? workbenchBody.tasks : []);
        setKnowledge(Array.isArray(workbenchBody.knowledge_objects) ? workbenchBody.knowledge_objects : []);
        setTemplate(workbenchBody.template ?? template);
        setSurface(workbenchBody.surface ?? buildScenarioProductSurface(liveScenario.templateId));
        setSessions(Array.isArray(sessionsBody.sessions) ? sessionsBody.sessions : []);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void loadLiveScenario();
    return () => {
      cancelled = true;
    };
  }, [auth.state, auth.token, id]);

  if (state === "not-found") return <NotFoundScenarioPage />;

  const tabs = ["overview", "data", "tasks", "ask", "outputs", "settings"] as const;
  return (
    <FrontstageShell active="/app/scenarios" title={scenario?.name ?? t("shell.loadingScenario")} eyebrow={template.name}>
      {state === "loading" ? (
        <section className="ux-page-head"><h1>{t("platform.live.loadingTitle")}</h1><p>{t("platform.live.loadingBody")}</p></section>
      ) : state === "error" || !scenario ? (
        <section className="ux-page-head"><h1>{t("platform.live.unavailableTitle")}</h1><p>{t("platform.live.unavailableBody")}</p></section>
      ) : (
        <>
          <section className={`scenario-workbench-hero ${scenario.status === "ready" ? "ready" : ""}`}>
            <div className="scenario-workbench-title">
              <span>{template.category} · {t(surface.label)} · {t(statusLabel(scenario.status))}</span>
              <h1>{scenario.name}</h1>
              <p>{scenario.description || scenario.processingGoal}</p>
            </div>
            <div className="scenario-workbench-primary">
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{t(surface.primaryAction.label)}</Link>
              <Link href={`/app/scenarios/${scenario.id}/data`}>{t("platform.live.manageFiles")}</Link>
            </div>
            <div className="ux-workbench-meta scenario-workbench-meta">
              <Meta label={t("platform.live.owner")} value={scenario.ownerName} />
              <Meta label={t("platform.live.sources")} value={`${scenario.sourceCount} `} />
              <Meta label={t("platform.live.publishScope")} value={t(visibilityText(scenario.visibility))} />
            </div>
            <nav className="ux-tabs" aria-label={t("platform.live.workbenchAria")}>
              {tabs.map((item) => (
                <Link key={item} href={`/app/scenarios/${scenario.id}${item === "overview" ? "" : `/${item}`}`} className={item === tab ? "active" : ""}>
                  {t(scenarioTabLabel(item))}
                </Link>
              ))}
            </nav>
          </section>
          {tab === "overview" && <LiveScenarioOverview scenario={scenario} template={template} surface={surface} tasks={tasks} knowledge={knowledge} sessions={sessions} />}
          {tab === "data" && <LiveScenarioDataPanel knowledge={knowledge} />}
          {tab === "tasks" && <div className="ux-task-grid">{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div>}
          {tab === "ask" && <LiveScenarioAskPanel scenario={scenario} surface={surface} sessions={sessions} tasks={tasks} knowledge={knowledge} initialQuery={initialQuery} initialSessionId={initialSessionId} token={auth.token} onSessionsChange={setSessions} />}
          {tab === "outputs" && <LiveScenarioOutputsPanel scenario={scenario} template={template} surface={surface} knowledge={knowledge} />}
          {tab === "settings" && <LiveScenarioSettingsPanel scenario={scenario} surface={surface} knowledge={knowledge} />}
        </>
      )}
    </FrontstageShell>
  );
}

export function ScenarioRunPage({ id }: { id: string }) {
  return <ScenarioDetailByIdPage id={id} tab="ask" />;
}

export function ScenarioDetailPage({
  workbench,
  tab = "overview",
  initialQuery
}: {
  workbench: ScenarioWorkbench;
  tab?: ScenarioTab;
  initialQuery?: string;
}) {
  return (
    <FrontstageShell active="/app/scenarios" title={workbench.scenario.name} eyebrow={workbench.template.name}>
      <ScenarioWorkbenchHeader workbench={workbench} activeTab={tab} />
      {tab === "overview" && (workbench.scenario.status === "ready" ? <ReadyScenarioUsePage workbench={workbench} /> : <ScenarioOverview workbench={workbench} />)}
      {tab === "data" && <ScenarioDataTab dataSources={workbench.dataSources} />}
      {tab === "tasks" && <ScenarioTasksTab workbench={workbench} />}
      {tab === "ask" && <ScenarioAskTab workbench={workbench} initialQuery={initialQuery} />}
      {tab === "outputs" && <ScenarioOutputsTab outputs={workbench.outputs} />}
      {tab === "settings" && <ScenarioSettingsTab settings={workbench.settings} />}
    </FrontstageShell>
  );
}

export function NotFoundScenarioPage() {
  const { t } = useI18n();
  return (
    <FrontstageShell active="/app/scenarios" title={t("shell.scenarioNotFound")}>
      <section className="ux-page-head">
        <h1>{t("platform.notFound.scenarioTitle")}</h1>
        <p>{t("platform.notFound.scenarioBody")}</p>
        <Link className="ux-primary-link" href="/app/scenarios">{t("platform.notFound.backToScenarios")}</Link>
      </section>
    </FrontstageShell>
  );
}

function LiveScenarioOverview({
  scenario,
  template,
  surface,
  tasks,
  knowledge,
  sessions
}: {
  scenario: LiveScenarioRecord;
  template: LiveWorkbenchTemplate;
  surface: ScenarioProductSurface;
  tasks: ProcessingTask[];
  knowledge: LiveKnowledgeRecord[];
  sessions: ScenarioChatSessionSummary[];
}) {
  const { t, formatDisplayTime } = useI18n();
  const latestTask = tasks[0];
  const ready = scenario.status === "ready";
  return (
    <div className="scenario-live-console">
      <section className="scenario-use-panel">
        <div className="scenario-use-copy">
          <span>{ready ? t("platform.live.availableNow") : t(statusLabel(scenario.status))}</span>
          <h2>{t(surface.workspaceTitle)}</h2>
          <p>{ready ? t(surface.description) : latestTask ? taskMessageText(latestTask.userMessage, t) : t("platform.live.publishPending")}</p>
        </div>
        <div className="scenario-use-actions">
          <Link className="primary" href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{t(surface.primaryAction.label)}</Link>
          {surface.secondaryActions.slice(0, 2).map((action) => (
            <Link key={action.label} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(action.prompt)}`}>{t(action.label)}</Link>
          ))}
        </div>
      </section>

      <section className="scenario-live-section scenario-history-section">
        <header>
          <div><span>{t("platform.live.history")}</span><h3>{t("platform.live.recentActivity")}</h3></div>
          <Link href={`/app/scenarios/${scenario.id}/ask`}>{t("platform.live.newChat")}</Link>
        </header>
        <div className="scenario-history-list">
          {sessions.slice(0, 4).map((session) => (
            <Link key={session.id} href={`/app/scenarios/${scenario.id}/ask?session=${session.id}`}>
              <b>{session.title}</b>
              <span>{session.latestMessage}</span>
              <small>{formatDisplayTime(session.updatedAtText ?? session.updatedAt)} · {t("platform.live.messagesCount", { count: session.messageCount })}</small>
            </Link>
          ))}
          {sessions.length === 0 ? (
            <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>
              <b>{t("platform.live.noConversations")}</b>
              <span>{t("platform.live.firstQuestionSaved")}</span>
              <small>{t(surface.primaryAction.label)}</small>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="scenario-live-section scenario-material-section">
        <header>
          <div><span>{t("platform.live.fileManagement")}</span><h3>{t("platform.live.ingestedObjects", { count: knowledge.length })}</h3></div>
          <Link href={`/app/scenarios/${scenario.id}/data`}>{t("platform.live.viewFiles")}</Link>
        </header>
        <div className="scenario-material-list">
          {knowledge.slice(0, 5).map((item) => (
            <Link key={item.id} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(item.title)}`}>
              <b>{displaySourceName(item.sourceOriginalName)}</b>
              <span>{item.ragEngine}</span>
              <small>{truncateText(item.content, 72)}</small>
            </Link>
          ))}
          {knowledge.length === 0 ? <p>{t("platform.live.ingestPending")}</p> : null}
        </div>
      </section>

      <aside className="scenario-live-rail">
        <section>
          <span>{t("platform.live.deliverables")}</span>
          <div className="scenario-output-actions">
            {(template.outputCapabilities.length ? template.outputCapabilities : [t("platform.live.businessSummary"), t("platform.live.citations"), t("platform.live.nextActions")]).slice(0, 5).map((item) => (
              <Link key={item} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item}`)}`}>{item}</Link>
            ))}
          </div>
        </section>
        <section>
          <span>{t("platform.live.backendStatus")}</span>
          <div className="scenario-state-stack">
            <div><b>{t(statusLabel(scenario.status))}</b><small>{latestTask?.currentStep ?? scenario.processingGoal}</small></div>
            <div><b>{t(visibilityText(scenario.visibility))}</b><small>{t("platform.live.permissionFilters")}</small></div>
            <div><b>{t(surface.label)}</b><small>{t(surface.headline)}</small></div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function ScenarioSessionList({
  sessions,
  activeSessionId,
  scenarioId,
  onOpen,
  onNew
}: {
  sessions: ScenarioChatSessionSummary[];
  activeSessionId: string | null;
  scenarioId: string;
  onOpen: (sessionId: string) => void;
  onNew: () => void;
}) {
  const { t, formatDisplayTime } = useI18n();
  return (
    <aside className="scenario-chat-history">
      <header>
        <span>{t("platform.live.history")}</span>
        <button type="button" onClick={onNew}>{t("platform.live.newChat")}</button>
      </header>
      <div>
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={activeSessionId === session.id ? "active" : ""}
            onClick={() => onOpen(session.id)}
          >
            <b>{session.title}</b>
            <span>{session.latestMessage}</span>
            <small>{formatDisplayTime(session.updatedAtText ?? session.updatedAt)} · {t("platform.live.messagesCount", { count: session.messageCount })}</small>
          </button>
        ))}
        {sessions.length === 0 ? (
          <Link href={`/app/scenarios/${scenarioId}/ask`}>
            <b>{t("platform.live.noHistory")}</b>
            <span>{t("platform.live.firstMessageSaved")}</span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function LiveScenarioDataPanel({ knowledge }: { knowledge: LiveKnowledgeRecord[] }) {
  const { t } = useI18n();
  return (
    <section className="ux-panel">
      <PanelTitle title={t("platform.live.ingestedFiles")} actionHref="/app/templates" actionLabel={t("platform.live.createAnother")} />
      <div className="ux-table">
        {knowledge.map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.title}</b>
              <span>{displaySourceName(item.sourceOriginalName)}</span>
            </div>
            <em>{item.ragEngine}</em>
            <strong>{t(visibilityText(item.visibility))}</strong>
            <small>{item.content}</small>
          </article>
        ))}
        {knowledge.length === 0 ? <p>{t("platform.live.noKnowledgeYet")}</p> : null}
      </div>
    </section>
  );
}

function LiveScenarioAskPanel({
  scenario,
  surface,
  sessions,
  tasks,
  knowledge,
  initialQuery,
  initialSessionId,
  token,
  onSessionsChange
}: {
  scenario: LiveScenarioRecord;
  surface: ScenarioProductSurface;
  sessions: ScenarioChatSessionSummary[];
  tasks: ProcessingTask[];
  knowledge: LiveKnowledgeRecord[];
  initialQuery?: string;
  initialSessionId?: string;
  token: string | null;
  onSessionsChange: (sessions: ScenarioChatSessionSummary[]) => void;
}) {
  const { t } = useI18n();
  const [sessionSummaries, setSessionSummaries] = useState<ScenarioChatSessionSummary[]>(sessions);
  const [activeSession, setActiveSession] = useState<ScenarioChatSession | null>(null);
  const [input, setInput] = useState(initialQuery ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const startedInitialQueryRef = useRef(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const latestAssistant = [...(activeSession?.messages ?? [])].reverse().find((item) => item.role === "assistant");
  const latestCitations = latestAssistant?.citations ?? [];

  function requestHeaders(json = false) {
    return {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  async function refreshSessions() {
    if (!token) return;
    const response = await fetch(`/api/platform/scenarios/${scenario.id}/sessions`, { headers: requestHeaders(), cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const nextSessions = Array.isArray(body.sessions) ? body.sessions as ScenarioChatSessionSummary[] : [];
    setSessionSummaries(nextSessions);
    onSessionsChange(nextSessions);
  }

  async function openSession(sessionId: string) {
    if (!token) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/platform/scenarios/${scenario.id}/sessions/${sessionId}`, {
        headers: requestHeaders(),
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.live.openConversationError"));
      setActiveSession(body.session as ScenarioChatSession);
      setAnimatingId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.live.openConversationError"));
    } finally {
      setPending(false);
    }
  }

  async function createSession(nextQuery: string) {
    const q = nextQuery.trim();
    if (!q || pending) return;
    setPending(true);
    setMessage("");

    // Optimistic render: show the user message immediately before Send and clear the input.
    const optimisticUserMsg: ScenarioChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString()
    };
    setActiveSession({
      id: "",
      scenarioId: scenario.id,
      title: q.slice(0, 60),
      ownerName: "",
      updatedAt: new Date().toISOString(),
      messages: [optimisticUserMsg]
    });
    setInput("");

    try {
      const response = await fetch(`/api/platform/scenarios/${scenario.id}/sessions`, {
        method: "POST",
        headers: requestHeaders(true),
        body: JSON.stringify({ query: q })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.startError"));
      const createdScenarioSession = body.session as ScenarioChatSession;
      setActiveSession(createdScenarioSession);
      const lastCreatedScenarioMsg = createdScenarioSession.messages[createdScenarioSession.messages.length - 1];
      if (lastCreatedScenarioMsg?.role === "assistant") setAnimatingId(lastCreatedScenarioMsg.id);
      await refreshSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.startError"));
      setInput(q);       // Restore the input on failure so the user message is not lost.
      setActiveSession(null);
      setAnimatingId(null);
    } finally {
      setPending(false);
    }
  }

  async function appendQuestion(nextQuery: string) {
    const q = nextQuery.trim();
    if (!q || !activeSession || pending) return;
    setPending(true);
    setMessage("");

    // Optimistic render: append the user message immediately before Send and clear the input.
    const optimisticUserMsg: ScenarioChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString()
    };
    const sessionBeforeUpdate = activeSession;
    setActiveSession({
      ...activeSession,
      messages: [...activeSession.messages, optimisticUserMsg]
    });
    setInput("");

    try {
      const response = await fetch(`/api/platform/scenarios/${scenario.id}/sessions/${activeSession.id}/messages`, {
        method: "POST",
        headers: requestHeaders(true),
        body: JSON.stringify({ query: q })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? t("platform.chat.sendError"));
      const appendedScenarioSession = body.session as ScenarioChatSession;
      setActiveSession(appendedScenarioSession);
      const lastAppendedScenarioMsg = appendedScenarioSession.messages[appendedScenarioSession.messages.length - 1];
      if (lastAppendedScenarioMsg?.role === "assistant") setAnimatingId(lastAppendedScenarioMsg.id);
      await refreshSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("platform.chat.sendError"));
      setActiveSession(sessionBeforeUpdate);  // Roll back the optimistic update.
      setAnimatingId(null);
      setInput(q);                            // Restore the input.
    } finally {
      setPending(false);
    }
  }

  function submitQuestion(nextQuery = input) {
    if (scenario.status !== "ready") return;
    if (activeSession) void appendQuestion(nextQuery);
    else void createSession(nextQuery);
  }

  useEffect(() => {
    setSessionSummaries(sessions);
  }, [sessions]);

  useEffect(() => {
    if (!token || startedInitialQueryRef.current) return;
    if (initialSessionId) {
      startedInitialQueryRef.current = true;
      void openSession(initialSessionId);
      return;
    }
    if (scenario.status === "ready" && initialQuery?.trim()) {
      startedInitialQueryRef.current = true;
      void createSession(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, scenario.status, token, initialQuery, initialSessionId]);

  const fallbackText = scenario.status === "ready"
    ? t(surface.emptyState)
    : tasks[0] ? taskMessageText(tasks[0].userMessage, t) : t("platform.live.processingInAdmin");

  return (
    <div className="scenario-chat-workspace">
      <ScenarioSessionList
        sessions={sessionSummaries}
        activeSessionId={activeSession?.id ?? null}
        scenarioId={scenario.id}
        onOpen={(sessionId) => void openSession(sessionId)}
        onNew={() => {
          setActiveSession(null);
          setInput("");
          setMessage("");
        }}
      />
      <section className="scenario-chat-main">
        {!activeSession ? (
          <div className="scenario-chat-empty">
            <span>{t(surface.label)}</span>
            <h2>{t(surface.workspaceTitle)}</h2>
            <p>{fallbackText}</p>
            <div className="scenario-prompt-grid">
              {surface.quickPrompts.slice(0, 4).map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="scenario-message-list">
            {activeSession.messages.map((item) => (
              <article key={item.id} className={`scenario-message ${item.role}`}>
                <span>{item.role === "user" ? t("shell.you") : scenario.name}</span>
                {item.role === "user" ? <p>{item.content}</p> : <AssistantText content={item.content} animate={item.id === animatingId} />}
                {item.role === "assistant" && item.citations?.length ? (
                  <ScenarioInlineCitations citations={item.citations} />
                ) : null}
                {item.role === "assistant" ? <AnswerFeedback traceId={item.traceId} /> : null}
              </article>
            ))}
            {pending ? (
              <article className="scenario-message assistant">
                <span>{scenario.name}</span>
                <p>{t("platform.live.answering")}</p>
              </article>
            ) : null}
          </div>
        )}
        {message ? <p className="global-error">{message}</p> : null}
        <form
          className="scenario-composer"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextQuery = String(form.get("q") ?? "");
            submitQuestion(nextQuery);
            event.currentTarget.reset();
          }}
        >
          <input
            name="q"
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder={scenario.status === "ready" ? surface.primaryAction.prompt : t("platform.live.availableAfterIngest")}
          />
          <button type="submit" disabled={pending || scenario.status !== "ready"}>{pending ? t("platform.chat.generating") : t("platform.chat.send")}</button>
        </form>
      </section>
      <aside className={`scenario-evidence-rail mode-${surface.rightRailMode}`}>
        <section>
          <span>{t(surface.contextPanelTitle)}</span>
          <h2>{latestCitations.length ? t("platform.live.citationsInAnswer", { count: latestCitations.length }) : t("platform.live.waitingForAnswer")}</h2>
          <div className="scenario-evidence-list">
            {(latestCitations.length ? latestCitations : knowledge.slice(0, 5).map((item) => ({
              knowledgeObjectId: item.id,
              sourceOriginalName: item.sourceOriginalName,
              scenarioName: scenario.name,
              engine: item.ragEngine,
              excerpt: item.content
            }))).map((citation) => <ScenarioEvidenceCard key={`${citation.knowledgeObjectId}-${citation.sourceOriginalName}`} citation={citation} />)}
          </div>
        </section>
        <section>
          <span>{t("platform.live.deliverables")}</span>
          <div className="scenario-output-actions">
            {surface.secondaryActions.map((action) => (
              <button key={action.label} type="button" onClick={() => setInput(action.prompt)}>{t(action.label)}</button>
            ))}
          </div>
        </section>
        <section>
          <span>{t("platform.live.fileStatus")}</span>
          <div className="scenario-state-stack">
            <div><b>{t(statusLabel(scenario.status))}</b><small>{tasks[0]?.currentStep ?? scenario.processingGoal}</small></div>
            <div><b>{t("platform.live.knowledgeObjectsCount", { count: knowledge.length })}</b><small>{t("platform.live.answersFiltered")}</small></div>
          </div>
          <Link className="scenario-rail-link" href={`/app/scenarios/${scenario.id}/data`}>{t("platform.live.manageFiles")}</Link>
        </section>
      </aside>
    </div>
  );
}

function ScenarioInlineCitations({ citations }: { citations: ScenarioCitation[] }) {
  const { t } = useI18n();
  const groups = groupScenarioCitations(citations);
  return (
    <div className="scenario-inline-citations" aria-label={t("platform.live.evidenceTypesLabel")}>
      {groups.map((group) => (
        <em key={group.engine} className={`citation-${scenarioEngineClass(group.engine)}`}>
          <span>{t(group.label)}</span>
          <b>{t("platform.chat.citationsCount", { count: group.count })}</b>
        </em>
      ))}
    </div>
  );
}

function ScenarioEvidenceCard({ citation }: { citation: ScenarioCitation }) {
  const { t } = useI18n();
  const label = knowledgeTypeLabel(citation.engine);
  const facts = scenarioEvidenceFacts(citation.excerpt);
  return (
    <article className={`scenario-evidence-card evidence-${scenarioEngineClass(citation.engine)}`}>
      <header>
        <span>{t(label)}</span>
        <small>{t(scenarioEvidenceBadge(citation.engine))}</small>
      </header>
      <b>{displaySourceName(citation.sourceOriginalName)}</b>
      <p>{t(scenarioEvidenceHint(citation.engine))}</p>
      {facts.length > 1 ? (
        <ul>
          {facts.slice(0, 3).map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      ) : (
        <strong>{facts[0] ?? t("platform.evidence.noSummary")}</strong>
      )}
    </article>
  );
}

function LiveScenarioOutputsPanel({ scenario, template, surface, knowledge }: { scenario: LiveScenarioRecord; template: LiveWorkbenchTemplate; surface: ScenarioProductSurface; knowledge: LiveKnowledgeRecord[] }) {
  const { t } = useI18n();
  return (
    <div className="scenario-output-workspace">
      <section className="scenario-output-head">
        <div>
          <span>{t(surface.label)}</span>
          <h2>{t("platform.live.outputsHeadline")}</h2>
          <p>{t("platform.live.outputsBody")}</p>
        </div>
        <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{t(surface.primaryAction.label)}</Link>
      </section>
      <div className="scenario-output-list">
        {(template.outputCapabilities.length ? template.outputCapabilities : [t("platform.live.businessSummary"), t("platform.live.citations"), t("platform.live.nextActions")]).map((item) => (
          <article key={item}>
            <div>
              <span>{t("platform.live.generates")}</span>
              <h3>{item}</h3>
              <p>{t(surface.description)}</p>
            </div>
            <div className="scenario-output-row-actions">
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item}`)}`}>{t("platform.live.generate")}</Link>
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item} (downloadable)`)}`}>{t("platform.live.generateDownload")}</Link>
            </div>
          </article>
        ))}
      </div>
      <section className="scenario-output-sources">
        <span>{t("platform.live.filesForGeneration")}</span>
        {knowledge.slice(0, 6).map((item) => (
          <Link key={item.id} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(item.title)}`}>
            <b>{displaySourceName(item.sourceOriginalName)}</b>
            <small>{item.ragEngine} · {truncateText(item.content, 90)}</small>
          </Link>
        ))}
        {knowledge.length === 0 ? <p>{t("platform.live.objectsAfterIngest")}</p> : null}
      </section>
    </div>
  );
}

function LiveScenarioSettingsPanel({ scenario, surface, knowledge }: { scenario: LiveScenarioRecord; surface: ScenarioProductSurface; knowledge: LiveKnowledgeRecord[] }) {
  const { t } = useI18n();
  const engines = Array.from(new Set(knowledge.map((item) => item.ragEngine)));
  return (
    <div className="ux-settings-grid">
      <SettingsBlock title={t("platform.live.scenarioAccess")} items={[t(visibilityText(scenario.visibility)), t("platform.live.ownerValue", { name: scenario.ownerName }), t("platform.live.sourcesValue", { count: scenario.sourceCount })]} />
      <SettingsBlock title={t("platform.live.processing")} items={[scenario.processingGoal || t("platform.live.waitingForAdminReview"), engines.length ? t("platform.live.ingestedValue", { engines: engines.join(", ") }) : t("platform.live.ingestNotFinished")]} />
      <SettingsBlock title={t("platform.live.workbench")} items={[t(surface.label), t(surface.workspaceTitle), scenario.status === "ready" ? t(surface.primaryAction.label) : t("platform.live.waitingForPublish")]} />
    </div>
  );
}

function FrontstageShell({ active, title, eyebrow, initialSnapshot, children }: ShellProps) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { snapshot } = usePlatformSnapshot(initialSnapshot);
  const pendingCount = snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed").length;
  const currentUser = auth.user?.display_name || auth.user?.username || workspaceProfile.currentUser;
  const userInitial = currentUser.trim().slice(0, 1) || "U";
  const roleLabel = auth.user?.is_admin ? t("shell.roleAdmin") : t("shell.roleMember");
  const scopeLabel = formatUserScope(auth.user, t);

  async function handleLogout() {
    await auth.logout();
    router.replace(`/login?next=${encodeURIComponent(pathname || active || "/app")}`);
  }

  return (
    <div className="ux-shell">
      <aside className="ux-sidebar">
        <Link href="/" className="ux-brand" aria-label={t("nav.backToSite")}><Logo size={30} /></Link>
        <Link className="ux-sidebar-action" href="/app/templates">{t("shell.newScenario")}</Link>
        <nav className="ux-nav" aria-label={t("shell.navLabel")}>
          {workspaceNav.map((item) => {
            const isActive = active === item.href || (item.href !== "/app" && active.startsWith(item.href));
            const keys = workspaceNavKeys[item.href];
            return (
              <Link key={item.href} href={item.href} className={isActive ? "active" : ""}>
                <i aria-hidden>{navGlyphs[item.href] ?? "•"}</i>
                <b>{keys ? t(keys.label) : item.label}</b>
                <span>{keys ? t(keys.description) : item.description}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="ux-content">
        <header className="ux-header">
          <div className="ux-header-title">
            <small>{eyebrow ?? "CompanyBrain"}</small>
            <b>{title}</b>
          </div>
          <label className="ux-search">
            <span>⌘K</span>
            <input placeholder={t("shell.searchPlaceholder")} />
          </label>
          <div className="ux-header-actions">
            <Link className="ux-header-link" href="/app/tasks">
              <span>{t("shell.pending")}</span>
              <strong>{pendingCount}</strong>
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <details className="ux-account-menu">
              <summary aria-label={t("shell.accountMenuLabel")}>
                <i>{userInitial}</i>
                <span>
                  <b>{currentUser}</b>
                  <small>{roleLabel}</small>
                </span>
              </summary>
              <div className="ux-account-popover">
                <div className="ux-account-card">
                  <i>{userInitial}</i>
                  <div>
                    <b>{currentUser}</b>
                    <span>{auth.user?.username ?? t("shell.currentAccount")} · {roleLabel}</span>
                  </div>
                </div>
                <dl className="ux-account-meta">
                  <div>
                    <dt>{t("shell.permissionScope")}</dt>
                    <dd>{scopeLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("shell.dataBoundary")}</dt>
                    <dd>{t("shell.dataBoundaryValue")}</dd>
                  </div>
                </dl>
                <div className="ux-account-actions">
                  <Link href="/app/settings">{t("shell.accountSettings")}</Link>
                  {auth.user?.is_admin ? <Link href="/admin">{t("shell.openAdminConsole")}</Link> : null}
                  <button type="button" onClick={handleLogout}>{t("common.signOut")}</button>
                </div>
              </div>
            </details>
          </div>
        </header>
        <main className="ux-main">{children}</main>
      </div>
    </div>
  );
}

function formatUserScope(
  user: { organization_id?: string; team_ids?: string[] } | null,
  t: (key: string) => string
) {
  if (!user) return t("shell.notSignedIn");
  const organizationName = formatOrganizationName(user.organization_id, t);
  const teamNames = (user.team_ids ?? []).map(formatTeamName).filter(Boolean);
  if (teamNames.length > 0) return `${organizationName} / ${teamNames.join(", ")}`;
  return `${organizationName} / ${t("shell.personalSpace")}`;
}

function formatOrganizationName(id: string | undefined, t: (key: string) => string) {
  if (!id) return t("shell.organization");
  const map: Record<string, string> = {
    "org-main": "Northwind Labs",
    "org_companybrain": "Northwind Labs"
  };
  return map[id] ?? id;
}

function formatTeamName(id: string) {
  const map: Record<string, string> = {
    sales: "Sales",
    legal: "Legal",
    ops: "Operations",
    "platform-admin": "Platform admin"
  };
  return map[id] ?? id;
}

function ScenarioWorkbenchHeader({ workbench, activeTab }: { workbench: ScenarioWorkbench; activeTab: ScenarioTab }) {
  const { t } = useI18n();
  const availability = scenarioAvailability(workbench.scenario);
  const isReady = workbench.scenario.status === "ready";
  return (
    <section className={`ux-workbench-head ${isReady ? "ready" : ""}`}>
      <div className="ux-workbench-title">
        <span>{workbench.template.category} · {t(availability.label)}</span>
        <h1>{workbench.scenario.name}</h1>
        <p>{isReady ? t(availability.description) : workbench.scenario.description}</p>
      </div>
      <div className="ux-workbench-meta">
        <Meta label={t("platform.live.owner")} value={workbench.scenario.owner} />
        <Meta label={t("platform.live.sources")} value={`${workbench.dataSources.length} `} />
        <Meta label={t("platform.live.publishScope")} value={t(publicationModeKey(workbench.settings.publicationMode))} />
      </div>
      {!isReady && (
        <div className="ux-lifecycle">
          {workbench.lifecycle.map((stage, index) => (
            <div key={stage.key} className={index < 4 ? "done" : ""}>
              <i>{index + 1}</i>
              <b>{t(stage.label)}</b>
              <span>{t(stage.description)}</span>
            </div>
          ))}
        </div>
      )}
      <nav className="ux-tabs" aria-label={t("platform.live.workbenchAria")}>
        {workbench.tabs.map((item) => (
          <Link key={item.key} href={item.href} className={item.key === activeTab ? "active" : ""}>{t(item.label)}</Link>
        ))}
      </nav>
    </section>
  );
}

function ReadyScenarioUsePage({ workbench }: { workbench: ScenarioWorkbench }) {
  const { t, formatDisplayTime } = useI18n();
  const availability = scenarioAvailability(workbench.scenario);
  const primaryQuestion = workbench.scenario.recommendedQuestions[0] ?? workbench.template.demoWalkthrough.sampleQuestion;
  const primaryOutputs = workbench.outputs.slice(0, 3);
  const primarySources = workbench.dataSources.slice(0, 4);
  return (
    <div className="scenario-workspace">
      <section className="scenario-use-console">
        <div className="scenario-use-head">
          <div>
            <span>{t(availability.label)}</span>
            <h2>{t("platform.ready.readyForWork")}</h2>
            <p>{workbench.scenario.description}</p>
          </div>
          <div className="scenario-use-status">
            <b>{t("platform.ready.filesPublished")}</b>
            <span>{t("platform.ready.sourcesDeliverables", { sources: workbench.dataSources.length, deliverables: workbench.outputs.length })}</span>
          </div>
        </div>

        <form className="scenario-question-bar" action={`/app/scenarios/${workbench.scenario.id}/ask`}>
          <label htmlFor="ready-scenario-question">{t("platform.ready.askOrGenerate")}</label>
          <div>
            <input id="ready-scenario-question" name="q" defaultValue={primaryQuestion} aria-label={t("platform.ready.scenarioQuestion")} />
            <button type="submit">{t("platform.chat.send")}</button>
          </div>
        </form>

        <div className="scenario-business-actions" aria-label={t("platform.ready.businessTasks")}>
          {primaryOutputs.map((output) => (
            <Link key={output.id} href={`/app/scenarios/${workbench.scenario.id}/outputs`}>
              <small>{output.status}</small>
              <b>{output.type}</b>
              <span>{output.summary}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="scenario-data-console">
        <div className="scenario-section-title">
          <div>
            <span>{t("platform.ready.scenarioFiles")}</span>
            <h3>{t("platform.ready.filesUsed")}</h3>
          </div>
          <Link href={`/app/scenarios/${workbench.scenario.id}/data`}>{t("platform.ready.viewAllFiles")}</Link>
        </div>
        <div className="scenario-source-table">
          {primarySources.map((source) => (
            <article key={source.id}>
              <div>
                <b>{source.title}</b>
                <span>{displaySourceName(source.fileName)}</span>
              </div>
              <em>{t(displaySourceType(source.sourceType))}</em>
              <strong>{source.status}</strong>
            </article>
          ))}
        </div>
        <div className="scenario-data-actions">
          <button type="button" onClick={async () => { const r = await fetch(`/api/platform/scenarios/${workbench.scenario.id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? t("platform.ready.fileUpdateSubmitted")); }}>{t("platform.ready.requestFileUpdate")}</button>
          <button type="button" onClick={() => { window.location.href = "/app/create"; }}>{t("platform.ready.uploadAgain")}</button>
          <button type="button" onClick={async () => { const r = await fetch(`/api/platform/scenarios/${workbench.scenario.id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? t("platform.ready.fileDeletionSubmitted")); }}>{t("platform.ready.requestFileDeletion")}</button>
        </div>
      </section>

      <section className="scenario-evidence-console">
        <div className="scenario-section-title">
          <div>
            <span>{t("platform.ready.evidenceDeliverables")}</span>
            <h3>{t("platform.ready.whichFilesProduced")}</h3>
          </div>
          <Link href={`/app/scenarios/${workbench.scenario.id}/outputs`}>{t("platform.ready.viewDeliverables")}</Link>
        </div>
        <div className="scenario-evidence-grid">
          {workbench.template.demoWalkthrough.citations.map((citation) => (
            <article key={`${citation.source}-${citation.label}`}>
              <b>{citation.label}</b>
              <span>{displaySourceName(citation.source)}</span>
              <p>{citation.excerpt}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="scenario-side-rail">
        <section>
          <span>{t("platform.ready.suggestedFollowUps")}</span>
          <div className="scenario-suggestion-list">
            {workbench.scenario.recommendedQuestions.slice(0, 4).map((question) => (
              <Link key={question} href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(question)}`}>{question}</Link>
            ))}
          </div>
        </section>

        <section>
          <span>{t("platform.ready.scenarioGovernance")}</span>
          <div className="scenario-governance-list">
            <div><b>{t("platform.ready.accessScope")}</b><em>{t(publicationModeKey(workbench.settings.publicationMode))}</em></div>
            <div><b>{t("platform.ready.answerPolicy")}</b><em>{workbench.settings.answerPolicy}</em></div>
            <div><b>{t("platform.ready.filePolicy")}</b><em>{workbench.settings.reviewPolicy}</em></div>
          </div>
        </section>

        <section>
          <span>{t("platform.ready.recentDeliverables")}</span>
          <div className="scenario-output-list">
            {primaryOutputs.map((output) => (
              <Link key={output.id} href={`/app/scenarios/${workbench.scenario.id}/outputs`}>
                <b>{output.title.replace(`${workbench.scenario.name} · `, "")}</b>
                <em>{formatDisplayTime(output.updatedAt)}</em>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ScenarioOverview({ workbench }: { workbench: ScenarioWorkbench }) {
  const { t } = useI18n();
  return (
    <div className="ux-workbench-grid">
      <section className="ux-panel">
        <PanelTitle title={t("platform.workbench.suggestedQuestions")} actionHref={`/app/scenarios/${workbench.scenario.id}/ask`} actionLabel={t("platform.workbench.askFollowup")} />
        <div className="ux-action-list">
          {workbench.scenario.recommendedQuestions.map((question) => (
            <Link key={question} href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(question)}`} className="ux-action-row">
              <b>{question}</b>
              <span>{t("platform.workbench.answerWithCitations")}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="ux-panel">
        <PanelTitle title={t("platform.workbench.scenarioCapabilities")} actionHref={`/app/scenarios/${workbench.scenario.id}/outputs`} actionLabel={t("platform.ready.viewDeliverables")} />
        <Pills items={workbench.scenario.readyActions} />
        <div className="ux-meta-stack">
          <Meta label={t("platform.workbench.retrievalPolicy")} value={workbench.settings.retrievalPolicy} />
          <Meta label={t("platform.ready.answerPolicy")} value={workbench.settings.answerPolicy} />
        </div>
      </section>
    </div>
  );
}

function ScenarioDataTab({ dataSources }: { dataSources: ScenarioDataSource[] }) {
  const { t } = useI18n();
  return (
    <section className="ux-panel">
      <PanelTitle title={t("platform.workbench.fileManagement")} actionHref="/app/create" actionLabel={t("platform.ready.uploadAgain")} />
      <div className="ux-data-request-bar">
        <button type="button" onClick={async () => { const id = window.location.pathname.split("/")[3]; const r = await fetch(`/api/platform/scenarios/${id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? t("platform.ready.fileUpdateSubmitted")); }}>{t("platform.ready.requestFileUpdate")}</button>
        <button type="button" onClick={async () => { const id = window.location.pathname.split("/")[3]; const r = await fetch(`/api/platform/scenarios/${id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? t("platform.ready.fileDeletionSubmitted")); }}>{t("platform.ready.requestFileDeletion")}</button>
        <button type="button" onClick={() => { window.location.href = "/admin/pipelines"; }}>{t("platform.workbench.viewAdminIngest")}</button>
      </div>
      <div className="ux-table">
        {dataSources.map((source) => (
          <article key={source.id}>
            <div>
              <b>{source.title}</b>
              <span>{displaySourceName(source.fileName)}</span>
            </div>
            <em>{t(displaySourceType(source.sourceType))}</em>
            <strong>{source.status}</strong>
            <small>{source.evidencePolicy}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenarioTasksTab({ workbench }: { workbench: ScenarioWorkbench }) {
  const { t } = useI18n();
  if (workbench.scenario.status === "ready") {
    return (
      <div className="ux-task-grid">
        {workbench.outputs.map((output) => (
          <article key={output.id} className="ux-task-card ready-task">
            <span>{output.status}</span>
            <h2>{output.type}</h2>
            <p>{output.summary}</p>
            <div className="ux-actions">
              <Link href={`/app/scenarios/${workbench.scenario.id}/outputs`}>{t("platform.workbench.openDeliverable")}</Link>
              <Link href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(output.type)}`}>{t("platform.workbench.generateMore")}</Link>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="ux-task-grid">
      {workbench.tasks.map((task) => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}

function ScenarioAskTab({ workbench, initialQuery }: { workbench: ScenarioWorkbench; initialQuery?: string }) {
  const { t } = useI18n();
  const initial = initialQuery ?? workbench.template.demoWalkthrough.sampleQuestion;
  const [query, setQuery] = useState(initial);
  const isReady = workbench.scenario.status === "ready";

  return (
    <>
    <div className="ux-chat-layout ux-chat-workbench">
      <section className="ux-chat-main">
        <div className="ux-chat-thread">
          <div className="ux-message user">{query}</div>
          <div className="ux-message assistant">
            <span>{workbench.scenario.name}</span>
            <p>{workbench.template.demoWalkthrough.sampleAnswer}</p>
            <div className="ux-citation-grid">
              {workbench.template.demoWalkthrough.citations.map((citation) => (
                <article key={`${citation.source}-${citation.label}`}>
                  <b>{citation.label}</b>
                  <small>{displaySourceName(citation.source)}</small>
                  <p>{citation.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <section className="ux-chat-action-board">
          <div>
            <h2>{isReady ? t("platform.workbench.continueWork") : t("platform.workbench.nextSteps")}</h2>
            <p>{isReady ? t("platform.workbench.keepAsking") : t("platform.workbench.finishValidation")}</p>
          </div>
          <div className="ux-chat-action-grid">
            {workbench.outputs.slice(0, 3).map((output) => (
              <article key={output.id}>
                <b>{output.type}</b>
                <span>{output.summary}</span>
              </article>
            ))}
          </div>
        </section>
        <form
          className="ux-composer"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setQuery(String(form.get("q") ?? ""));
            event.currentTarget.reset();
          }}
        >
          <input name="q" placeholder={isReady ? t("platform.workbench.askPlaceholder") : t("platform.workbench.validatePlaceholder")} />
          <button type="submit">{isReady ? t("platform.chat.send") : t("platform.workbench.validate")}</button>
        </form>
      </section>
      <aside className="ux-context-panel">
        <span>{isReady ? t("platform.workbench.usagePolicy") : t("platform.workbench.validationPolicy")}</span>
        <h2>{t("platform.workbench.currentPolicy")}</h2>
        <p>{workbench.settings.retrievalPolicy}</p>
        <p>{workbench.settings.answerPolicy}</p>
        <div className="ux-context-section">
          <h3>{t("platform.workbench.scenarioFiles")}</h3>
          {workbench.dataSources.map((source) => (
            <div key={source.id} className="ux-context-row">
              <b>{displaySourceName(source.fileName)}</b>
              <span>{source.status}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
    <section className="ux-chat-follow-grid" aria-label={isReady ? t("platform.workbench.nextWithScenario") : t("platform.workbench.afterValidating")}>
      <article className="ux-follow-card">
        <span>{t("platform.workbench.tasksLabel")}</span>
        <h2>{workbench.tasks[0] ? taskTitleText(workbench.tasks[0].title, t) : t("platform.workbench.processingScenario", { name: workbench.scenario.name })}</h2>
        <p>{workbench.tasks[0] ? taskMessageText(workbench.tasks[0].userMessage, t) : t("platform.workbench.keepValidating")}</p>
        <Link href={`/app/scenarios/${workbench.scenario.id}/tasks`}>{t("platform.workbench.viewProcessingTasks")}</Link>
      </article>
      <article className="ux-follow-card">
        <span>{t("platform.workbench.fileSources")}</span>
        <h2>{t("platform.workbench.filesLinked", { count: workbench.dataSources.length })}</h2>
        <p>{workbench.settings.retrievalPolicy}</p>
        <Link href={`/app/scenarios/${workbench.scenario.id}/data`}>{t("platform.workbench.manageFileSources")}</Link>
      </article>
      <article className="ux-follow-card">
        <span>{t("platform.live.deliverables")}</span>
        <h2>{workbench.outputs[0]?.title ?? workbench.scenario.name}</h2>
        <p>{workbench.outputs[0]?.summary ?? t("platform.workbench.keepGenerating")}</p>
        <div className="ux-follow-pills">
          {workbench.outputs.slice(0, 3).map((output) => <small key={output.id}>{output.type}</small>)}
        </div>
      </article>
    </section>
    <section className="ux-chat-ops-board" aria-label={isReady ? t("platform.workbench.usageRules") : t("platform.workbench.publishChecks")}>
      <article>
        <span>{t("platform.workbench.scenarioPipeline")}</span>
        <h2>{t("platform.workbench.fromFilesToAnswers")}</h2>
        <div className="ux-ops-list">
          {workbench.template.processingExplanation.map((step) => <p key={step}>{step}</p>)}
        </div>
      </article>
      <article>
        <span>{isReady ? t("platform.workbench.usageRules") : t("platform.workbench.publishChecks")}</span>
        <h2>{isReady ? t("platform.workbench.staysReliable") : t("platform.workbench.confirmBeforeLaunch")}</h2>
        <div className="ux-ops-list">
          <p>{workbench.settings.reviewPolicy}</p>
          <p>{workbench.settings.answerPolicy}</p>
          <p>{workbench.outputs.map((output) => output.type).join(", ")}</p>
        </div>
      </article>
    </section>
    </>
  );
}

function ScenarioOutputsTab({ outputs }: { outputs: ScenarioOutput[] }) {
  const { formatDisplayTime } = useI18n();
  return (
    <div className="ux-output-grid">
      {outputs.map((output) => (
        <article key={output.id} className="ux-card">
          <span>{output.type}</span>
          <h2>{output.title}</h2>
          <p>{output.summary}</p>
          <small>{output.status} · {formatDisplayTime(output.updatedAt)}</small>
        </article>
      ))}
    </div>
  );
}

function ScenarioSettingsTab({ settings }: { settings: ScenarioSettings }) {
  const { t } = useI18n();
  return (
    <div className="ux-settings-grid">
      <SettingsBlock title={t("platform.workbench.publishScope")} items={[t(publicationModeKey(settings.publicationMode)), settings.reviewPolicy]} />
      <SettingsBlock title={t("platform.workbench.retrievalAnswers")} items={[settings.retrievalPolicy, settings.answerPolicy]} />
      <SettingsBlock title={t("platform.workbench.connectedSources")} items={settings.connectedSources} />
    </div>
  );
}

function TemplateViewToggle({ view, onChange }: { view: TemplateLibraryView; onChange: (view: TemplateLibraryView) => void }) {
  const { t } = useI18n();
  return (
    <div className="template-view-switch" aria-label={t("templates.switchView")}>
      {templateViewOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === view ? "active" : ""}
          aria-label={t("templates.viewAriaLabel", { view: t(option.label) })}
          aria-pressed={option.id === view}
          title={t("templates.viewAriaLabel", { view: t(option.label) })}
          onClick={() => onChange(option.id)}
        >
          <span className={`template-view-icon ${option.id}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      ))}
    </div>
  );
}

function TemplateMarketCanvas({
  view,
  templates,
  selectedTemplate,
  onSelect
}: {
  view: TemplateLibraryView;
  templates: ScenarioTemplate[];
  selectedTemplate: ScenarioTemplate;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  if (templates.length === 0) {
    return (
      <div className="template-empty-state">
        <b>{t("platform.template.noMatchingTemplates")}</b>
        <p>{t("platform.template.tryAnotherKeyword")}</p>
        <Link href="/app/create?mode=blank">{t("platform.template.createScenario")}</Link>
      </div>
    );
  }

  if (view === "grid") return <TemplateGridView templates={templates} selectedTemplate={selectedTemplate} onSelect={onSelect} />;
  if (view === "list") return <TemplateListView templates={templates} selectedTemplate={selectedTemplate} onSelect={onSelect} />;
  if (view === "compare") return <TemplateCompareView templates={templates} selectedTemplate={selectedTemplate} onSelect={onSelect} />;
  return <TemplateFeaturedView templates={templates} selectedTemplate={selectedTemplate} onSelect={onSelect} />;
}

function TemplateFeaturedView({
  templates,
  selectedTemplate,
  onSelect
}: {
  templates: ScenarioTemplate[];
  selectedTemplate: ScenarioTemplate;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const preferredIds = ["customer-360", "support-agent", "contract-playbook", "risk-investigation"];
  const featured = [
    selectedTemplate,
    ...preferredIds
      .map((id) => templates.find((template) => template.id === id))
      .filter((template): template is ScenarioTemplate => Boolean(template)),
    ...templates
  ].filter((template, index, list) => list.findIndex((item) => item.id === template.id) === index).slice(0, 4);
  const lead = featured[0] ?? selectedTemplate;
  const side = featured.slice(1);

  return (
    <div className="template-featured-view">
      <button type="button" className="template-featured-lead" onClick={() => onSelect(lead.id)}>
        <span>{lead.category} · {t(templateSurfaceLabel(lead))}</span>
        <h2>{lead.name}</h2>
        <p>{lead.headline}</p>
        <div>
          {lead.bestFor.slice(0, 3).map((item) => <em key={item}>{item}</em>)}
        </div>
        <footer>
          <b>{lead.setupTime}</b>
          <small>{lead.reviewRequirement}</small>
        </footer>
      </button>
      <div className="template-featured-stack">
        {side.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-featured-mini ${template.id === selectedTemplate.id ? "active" : ""}`}
            onClick={() => onSelect(template.id)}
          >
            <span>{template.category}</span>
            <b>{template.name}</b>
            <p>{template.outputCapabilities.slice(0, 3).join(" / ")}</p>
          </button>
        ))}
      </div>
      <div className="template-featured-strip">
        {templates.slice(0, 6).map((template) => (
          <button
            key={template.id}
            type="button"
            className={template.id === selectedTemplate.id ? "active" : ""}
            onClick={() => onSelect(template.id)}
          >
            <b>{template.name}</b>
            <span>{t(templateSurfaceLabel(template))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateGridView({
  templates,
  selectedTemplate,
  onSelect
}: {
  templates: ScenarioTemplate[];
  selectedTemplate: ScenarioTemplate;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="template-card-gallery">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} active={template.id === selectedTemplate.id} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TemplateListView({
  templates,
  selectedTemplate,
  onSelect
}: {
  templates: ScenarioTemplate[];
  selectedTemplate: ScenarioTemplate;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="template-compact-list">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`template-compact-row ${template.id === selectedTemplate.id ? "active" : ""}`}
          onClick={() => onSelect(template.id)}
        >
          <span>{template.category}</span>
          <div>
            <b>{template.name}</b>
            <p>{template.headline}</p>
          </div>
          <small>{t(templateSurfaceLabel(template))}</small>
          <small>{template.acceptedFiles.slice(0, 2).join(" / ")}</small>
          <small>{template.setupTime}</small>
        </button>
      ))}
    </div>
  );
}

function TemplateCompareView({
  templates,
  selectedTemplate,
  onSelect
}: {
  templates: ScenarioTemplate[];
  selectedTemplate: ScenarioTemplate;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="template-compare-wrap">
      <table className="template-compare-table">
        <thead>
          <tr>
            <th>{t("platform.template.template")}</th>
            <th>{t("platform.template.bestFor")}</th>
            <th>{t("platform.template.filesToPrepare")}</th>
            <th>{t("platform.template.output")}</th>
            <th>{t("platform.template.review")}</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className={template.id === selectedTemplate.id ? "active" : ""} onClick={() => onSelect(template.id)}>
              <td>
                <button type="button" onClick={() => onSelect(template.id)}>
                  <b>{template.name}</b>
                  <span>{template.category} · {t(templateSurfaceLabel(template))}</span>
                </button>
              </td>
              <td>{template.bestFor.slice(0, 3).join(", ")}</td>
              <td>{template.acceptedFiles.slice(0, 3).join(", ")}</td>
              <td>{template.outputCapabilities.slice(0, 3).join(", ")}</td>
              <td>{template.reviewRequirement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateCard({ template, active = false, onSelect }: { template: ScenarioTemplate; active?: boolean; onSelect?: (id: string) => void }) {
  const { t } = useI18n();
  const surface = buildScenarioProductSurface(template.id, { productForm: template.productForm });
  return (
    <article className={`template-card ${active ? "active" : ""}`}>
      <div className="template-card-main">
        <span>{template.category} · {t(surface.label)}</span>
        <h2>{template.name}</h2>
        <p>{template.headline}</p>
        <Pills items={template.inputExamples.slice(0, 3)} />
      </div>
      <dl>
        <div><dt>{t("platform.template.outputs")}</dt><dd>{template.outputCapabilities.slice(0, 2).join(", ")}</dd></div>
        <div><dt>{t("platform.template.setup")}</dt><dd>{template.setupTime}</dd></div>
      </dl>
      <footer>
        {onSelect ? <button type="button" onClick={() => onSelect(template.id)}>{t("platform.template.select")}</button> : null}
        <Link href={`/app/templates/${template.id}`}>{t("platform.template.viewTemplate")}</Link>
        <Link className="primary" href={`/app/create?template=${template.id}`}>{t("platform.template.create")}</Link>
      </footer>
    </article>
  );
}

function templateSurfaceLabel(template: ScenarioTemplate) {
  return buildScenarioProductSurface(template.id, { productForm: template.productForm }).label;
}

function TemplateCatalogPreview({ template }: { template: ScenarioTemplate }) {
  const { t } = useI18n();
  return (
    <aside className="template-preview-panel" aria-label={t("platform.template.templateDetailsAria")}>
      <div className="template-preview-head">
        <span>{template.category}Template</span>
        <h2>{template.name}</h2>
        <p>{template.headline}</p>
      </div>
      <div className="template-preview-meta">
        <div><span>{t("platform.template.setupTime")}</span><b>{template.setupTime}</b></div>
        <div><span>{t("platform.template.reviewRequirement")}</span><b>{template.reviewRequirement}</b></div>
      </div>
      <section>
        <span>{t("platform.template.businessQuestions")}</span>
        <div className="template-preview-pills">
          {template.bestFor.slice(0, 4).map((item) => <em key={item}>{item}</em>)}
        </div>
      </section>
      <section>
        <span>{t("platform.template.suggestedFiles")}</span>
        <div className="template-preview-pills">
          {template.inputExamples.slice(0, 4).map((item) => <em key={item}>{item}</em>)}
        </div>
      </section>
      <section>
        <span>{t("platform.template.whatYouGet")}</span>
        <ul className="template-output-list">
          {template.outputCapabilities.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section className="template-preview-demo">
        <span>{t("platform.template.sampleScenario")}</span>
        <b>{template.demoWalkthrough.scenarioName}</b>
        <p>{template.demoWalkthrough.sampleQuestion}</p>
      </section>
      <footer>
        <Link href={`/app/templates/${template.id}`}>{t("platform.template.viewFullDetails")}</Link>
        <Link className="primary" href={`/app/create?template=${template.id}`}>{t("platform.template.createWithTemplate")}</Link>
      </footer>
    </aside>
  );
}

function TemplateNotFound() {
  const { t } = useI18n();
  return (
    <FrontstageShell active="/app/templates" title={t("shell.templateNotFound")}>
      <section className="ux-page-head">
        <h1>{t("platform.notFound.templateTitle")}</h1>
        <p>{t("platform.notFound.templateBody")}</p>
        <Link className="ux-primary-link" href="/app/templates">{t("platform.notFound.backToTemplates")}</Link>
      </section>
    </FrontstageShell>
  );
}

function ScenarioAssetRow({
  scenario,
  active,
  onFocus
}: {
  scenario: ScenarioInstance;
  active: boolean;
  onFocus: () => void;
}) {
  const { t, formatDisplayTime } = useI18n();
  const template = templateById(scenario.templateId) ?? customScenarioTemplate;
  const surface = buildScenarioProductSurface(template.id, { productForm: template.productForm });
  const availability = scenarioAvailability(scenario);
  return (
    <article className={`scenario-asset-row ${active ? "active" : ""}`} onMouseEnter={onFocus} onFocus={onFocus}>
      <Link href={`/app/scenarios/${scenario.id}`} className="scenario-row-main">
        <span className={`scenario-row-icon surface-${surface.kind}`} aria-hidden="true" />
        <div>
          <b>{scenario.name}</b>
          <p>{truncateText(scenario.description, 92)}</p>
          <small>{scenario.owner} · {t("platform.chat.sourcesCount", { count: scenario.sourceCount })} ·  {formatDisplayTime(scenario.updatedAt)}</small>
        </div>
      </Link>
      <span className="scenario-row-surface">{t(surface.label)}</span>
      <span className={`home-scope-badge scope-${scenario.visibility}`}>{t(visibilityText(scenario.visibility))}</span>
      <span className={`scenario-row-status status-${scenario.status}`}>{t(availability.label)}</span>
      <div className="scenario-row-actions">
        <Link href={`/app/scenarios/${scenario.id}`}>{t(scenario.status === "ready" ? surface.primaryAction.label : availability.nextAction)}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>{t("platform.scenarioRow.data")}</Link>
      </div>
    </article>
  );
}

function ScenarioAssetInspector({ scenario }: { scenario: ScenarioInstance }) {
  const { t } = useI18n();
  const template = templateById(scenario.templateId) ?? customScenarioTemplate;
  const surface = buildScenarioProductSurface(template.id, { productForm: template.productForm });
  const availability = scenarioAvailability(scenario);
  const prompts = scenario.status === "ready" ? surface.quickPrompts : scenario.recommendedQuestions;
  return (
    <section>
      <span>{template.name} · {t(availability.label)}</span>
      <h2>{scenario.name}</h2>
      <p>{scenario.description}</p>
      <div className="scenario-inspector-meta">
        <div><small>{t("platform.scenarioRow.workbenchForm")}</small><b>{t(surface.label)}</b></div>
        <div><small>{t("platform.scenarioRow.publishScope")}</small><b>{t(visibilityText(scenario.visibility))}</b></div>
        <div><small>{t("platform.scenarioRow.fileSources")}</small><b>{scenario.sourceCount} </b></div>
      </div>
      <div className="scenario-inspector-actions">
        <Link className="primary" href={`/app/scenarios/${scenario.id}`}>{t(scenario.status === "ready" ? surface.primaryAction.label : availability.nextAction)}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>{t("platform.scenarioRow.manageFiles")}</Link>
      </div>
      <div className="scenario-inspector-prompts">
        <b>{scenario.status === "ready" ? t("platform.scenarioRow.commonActions") : t("platform.scenarioRow.availableAfterProcessing")}</b>
        {prompts.slice(0, 4).map((prompt) => (
          <Link key={prompt} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(prompt)}`}>{prompt}</Link>
        ))}
      </div>
    </section>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioInstance }) {
  const { t, formatDisplayTime } = useI18n();
  const template = templateById(scenario.templateId) ?? officialTemplates[0];
  const availability = scenarioAvailability(scenario);
  return (
    <article className="ux-card scenario">
      <span>{template.name} · {t(availability.label)}</span>
      <h2>{scenario.name}</h2>
      <p>{t(availability.description)}</p>
      <div className="ux-card-meta">
        <small>{scenario.owner}</small>
        <small>{t("platform.chat.sourcesCount", { count: scenario.sourceCount })}</small>
        <small>{formatDisplayTime(scenario.updatedAt)}</small>
      </div>
      <footer>
        <Link href={`/app/scenarios/${scenario.id}`}>{scenario.status === "ready" ? t("platform.scenarioRow.openScenario") : t(availability.nextAction)}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>{t("platform.scenarioRow.viewFiles")}</Link>
      </footer>
    </article>
  );
}

function ScenarioCompactCard({ scenario }: { scenario: ScenarioInstance }) {
  const { t } = useI18n();
  const availability = scenarioAvailability(scenario);
  return (
    <Link className="ux-compact-row home-scenario-row" href={`/app/scenarios/${scenario.id}`} aria-label={t("platform.scenarioRow.openScenarioAria", { name: scenario.name })}>
      <div className="home-row-copy">
        <div className="home-row-head">
          <b>{scenario.name}</b>
          <span className={`home-scope-badge scope-${scenario.visibility}`}>{t(visibilityText(scenario.visibility))}</span>
        </div>
        <p>{scenario.description}</p>
      </div>
      <em className="home-row-status">{t(availability.label)}</em>
    </Link>
  );
}

function TaskCard({ task }: { task: ProcessingTask }) {
  const { t, formatDisplayTime } = useI18n();
  return (
    <article className="ux-task-card">
      <header className="task-card-head">
        <span>{t(taskStatusLabelKey(task))}</span>
        <small>{taskKindText(task.kind, t)} · {t(ragModeLabel(task.ragMode))}</small>
      </header>
      <h2>{taskTitleText(task.title, t)}</h2>
      <p>{taskMessageText(task.userMessage, t)}</p>
      <div className="task-meta-grid">
        <div><span>{t("platform.task.waitingOn")}</span><b>{taskWaitingForText(task.waitingFor, t)}</b></div>
        <div><span>{t("platform.task.publishScope")}</span><b>{t(visibilityText(task.visibility))}</b></div>
        <div><span>{t("platform.task.submittedBy")}</span><b>{task.owner}</b></div>
        <div><span>{t("platform.task.updated")}</span><b>{formatDisplayTime(task.updatedAt)}</b></div>
      </div>
      <div className="task-file-row">
        {task.files.slice(0, 3).map((fileName) => <span key={fileName}>{displaySourceName(fileName)}</span>)}
        {task.files.length > 3 && <span>+{task.files.length - 3}</span>}
      </div>
      <div className="ux-progress"><i style={{ width: `${task.progress}%` }} /></div>
      <footer className="task-card-actions">
        <Link href={`/app/scenarios/${task.scenarioId}/tasks`}>{t("platform.task.viewTask")}</Link>
        <Link href={`/app/scenarios/${task.scenarioId}/data`}>{task.status === "ready" ? t("platform.task.manageFiles") : t("platform.task.addFiles")}</Link>
      </footer>
    </article>
  );
}

function TaskMini({ task }: { task: ProcessingTask }) {
  const { t } = useI18n();
  return (
    <Link className="ux-task-mini-row home-task-row" href={`/app/scenarios/${task.scenarioId}/tasks`} aria-label={t("platform.scenarioRow.viewTaskAria", { title: taskTitleText(task.title, t) })}>
      <div className="home-row-copy">
        <div className="home-row-head">
          <b>{taskTitleText(task.title, t)}</b>
          <span className={`home-scope-badge scope-${task.visibility}`}>{t(visibilityText(task.visibility))}</span>
        </div>
        <p>{task.currentStep} · {task.progress}%</p>
        <span className="home-task-progress" aria-hidden="true"><i style={{ width: `${task.progress}%` }} /></span>
      </div>
    </Link>
  );
}

function KnowledgeAssetRow({ object, active, onSelect }: { object: KnowledgeSpaceObject; active: boolean; onSelect: () => void }) {
  const { t, formatDisplayTime } = useI18n();
  return (
    <button type="button" className={`knowledge-asset-row ${active ? "active" : ""}`} onClick={onSelect} role="listitem">
      <span className={`knowledge-type-dot type-${object.mode}`} />
      <div className="knowledge-row-title">
        <b>{object.title}</b>
        <span>{truncateText(object.summary, 74)}</span>
      </div>
      <div className="knowledge-row-meta">
        <strong>{t(knowledgeModeLabel(object.mode))}</strong>
        <span>{object.sourceLabel}</span>
      </div>
      <div className="knowledge-row-scope">
        <strong>{t(knowledgeVisibilityLabel(object.visibility))}</strong>
        <span>{object.owner}</span>
      </div>
      <small>{formatDisplayTime(object.updatedAt)}</small>
    </button>
  );
}

function KnowledgeAssetInspector({ object }: { object: KnowledgeSpaceObject | null }) {
  const { t, formatDisplayTime } = useI18n();
  if (!object) {
    return (
      <aside className="knowledge-asset-inspector">
        <PanelHeading eyebrow={t("knowledge.detailsEyebrow")} title={t("knowledge.detailsEmptyTitle")} />
        <p>{t("knowledge.detailsEmptyBody")}</p>
        <Link href="/app/templates">{t("knowledge.fromTemplate")}</Link>
      </aside>
    );
  }

  return (
    <aside className="knowledge-asset-inspector">
      <PanelHeading eyebrow={t(knowledgeModeLabel(object.mode))} title={object.title} />
      <p>{object.summary}</p>
      <dl className="knowledge-inspector-meta">
        <div><dt>{t("knowledge.source")}</dt><dd>{object.sourceLabel}</dd></div>
        <div><dt>{t("common.owner")}</dt><dd>{object.owner}</dd></div>
        <div><dt>{t("knowledge.access")}</dt><dd>{t(knowledgeVisibilityLabel(object.visibility))}</dd></div>
        <div><dt>{t("common.updated")}</dt><dd>{formatDisplayTime(object.updatedAt)}</dd></div>
      </dl>
      <div className="knowledge-inspector-note">
        <b>{t("knowledge.permissionImpact")}</b>
        <span>{t(knowledgeAssetRiskNote(object))}</span>
      </div>
      <div className="knowledge-inspector-actions">
        {knowledgeGovernanceActions(object).map((action) => (
          action === "knowledge.actionOpenScenario"
            ? <Link key={action} href={`/app/scenarios/${object.linkedScenarioId}`}>{t(action)}</Link>
            : <button key={action} type="button">{t(action)}</button>
        ))}
      </div>
    </aside>
  );
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="panel-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </header>
  );
}

function SettingsRows({ rows }: { rows: WorkspaceSettingRow[] }) {
  const { t } = useI18n();
  return (
    <div className="settings-row-list">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="settings-row">
          <div>
            <b>{row.label}</b>
            <span>{row.value}</span>
          </div>
          <em className={`setting-status status-${row.status}`}>{t(workspaceSettingStatusLabel(row.status))}</em>
        </div>
      ))}
    </div>
  );
}

function SettingsBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="ux-panel">
      <h2>{title}</h2>
      <div className="ux-action-list">
        {items.map((item, idx) => <div key={`${item}-${idx}`} className="ux-action-row static"><b>{item}</b></div>)}
      </div>
    </section>
  );
}

function InfoSection({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  return (
    <section className="ux-info-section">
      <h2>{title}</h2>
      {ordered ? <ol>{items.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ol> : <Pills items={items} />}
    </section>
  );
}

function PanelTitle({ title, actionHref, actionLabel }: { title: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="ux-panel-title">
      <h2>{title}</h2>
      <Link href={actionHref}>{actionLabel}</Link>
    </div>
  );
}

function KpiCard({ label, value, helper, href }: { label: string; value: string; helper: string; href?: string }) {
  const content = (
    <>
      <span>{label}</span>
      <b>{value}</b>
      <small>{helper}</small>
    </>
  );
  if (href) {
    return (
      <Link className="ux-kpi home-metric-card" href={href} aria-label={`${label}: ${value}, ${helper}`}>
        {content}
      </Link>
    );
  }
  return <article className="ux-kpi">{content}</article>;
}

function Pills({ items }: { items: string[] }) {
  return <div className="ux-pills">{items.map((item) => <span key={item}>{item}</span>)}</div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="ux-meta"><span>{label}</span><b>{value}</b></div>;
}

function statusLabel(status: ScenarioInstance["status"] | ProcessingTask["status"]) {
  if (status === "ready") return "platform.status.available";
  if (status === "processing") return "platform.status.processing";
  if (status === "waiting_review") return "platform.status.pendingReview";
  if (status === "submitted") return "platform.status.submitted";
  if (status === "failed") return "platform.status.failed";
  return "platform.status.draft";
}

function countScenariosByStatus(scenarios: ScenarioInstance[], value: string) {
  return scenarios.filter((scenario) => scenarioStatusMatchesFilter(scenario.status, value)).length;
}

function truncateText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function scenarioTabLabel(tab: ScenarioTab) {
  const labels: Record<ScenarioTab, string> = {
    overview: "platform.liveTab.overview",
    data: "platform.liveTab.data",
    tasks: "platform.liveTab.tasks",
    ask: "platform.liveTab.ask",
    outputs: "platform.liveTab.outputs",
    settings: "platform.liveTab.settings"
  };
  return labels[tab];
}

function taskStatusGroup(task: ProcessingTask) {
  if (task.waitingFor === "Admin" || task.status === "submitted") return "Pending admin review";
  if (task.status === "ready") return "Available";
  if (task.status === "failed") return "Failed";
  return "Processing";
}

function visibilityText(value: Visibility) {
  if (value === "private") return "visibility.private";
  if (value === "team") return "visibility.team";
  return "visibility.company";
}

function compareTaskTime(a: string, b: string) {
  return taskTimeRank(b) - taskTimeRank(a);
}

function taskTimeRank(value: string) {
  // Mirrors the real displayRelativeTime output: just now / N min ago / N hr ago / N days ago.
  // A larger rank means newer (ranked first): offset by minutes-ago, so min > hr > day.
  if (value.includes("just now")) return Number.MAX_SAFE_INTEGER;
  const minute = value.match(/(\d+)\s*min ago/);
  if (minute) return 1_000_000_000 - Number(minute[1]);
  const hour = value.match(/(\d+)\s*hr ago/);
  if (hour) return 1_000_000_000 - Number(hour[1]) * 60;
  const day = value.match(/(\d+)\s*days? ago/);
  if (day) return 1_000_000_000 - Number(day[1]) * 1440;
  // 兼容可能的历史绝对文案
  if (value.includes("Today")) return 900_000_000;
  if (value.includes("Yesterday")) return 800_000_000;
  return 0;
}

function displaySourceName(value: string) {
  return value.replace(/\.(json|csv|md|txt|pdf|docx|xlsx)$/i, "");
}

function knowledgeTypeLabel(engine: LiveScenarioAnswer["engine"]) {
  if (engine === "Naive RAG") return "knowledge.modeDocument";
  if (engine === "GraphRAG") return "knowledge.modeRelationship";
  return "knowledge.modeWiki";
}

// RagEngine values stay as stored fixture literals (the admin console dispatches on them); render English labels here.
function ragModeLabel(mode: ProcessingTask["ragMode"]) {
  if (mode === "知识百科") return "knowledge.modeWiki";
  if (mode === "文档证据") return "knowledge.modeDocument";
  if (mode === "关系图谱") return "knowledge.modeRelationship";
  return "platform.evidence.mixedProcessing";
}

function groupScenarioCitations(citations: ScenarioCitation[]) {
  const order: Array<ScenarioCitation["engine"]> = ["Naive RAG", "GraphRAG", "Gbrain"];
  return order
    .map((engine) => ({
      engine,
      label: knowledgeTypeLabel(engine),
      count: citations.filter((citation) => citation.engine === engine).length
    }))
    .filter((group) => group.count > 0);
}

function scenarioEngineClass(engine: LiveScenarioAnswer["engine"]) {
  if (engine === "Naive RAG") return "document";
  if (engine === "GraphRAG") return "graph";
  return "wiki";
}

function scenarioEvidenceBadge(engine: LiveScenarioAnswer["engine"]) {
  if (engine === "Naive RAG") return "platform.evidence.sourceExcerpt";
  if (engine === "GraphRAG") return "platform.evidence.relationshipTrail";
  return "platform.evidence.knowledgeEntry";
}

function scenarioEvidenceHint(engine: LiveScenarioAnswer["engine"]) {
  if (engine === "Naive RAG") return "platform.evidence.documentHint";
  if (engine === "GraphRAG") return "platform.evidence.graphHint";
  return "platform.evidence.wikiHint";
}

function scenarioEvidenceFacts(excerpt: string) {
  const normalized = excerpt.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const semicolonFacts = normalized
    .split(/[；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (semicolonFacts.length > 1) return semicolonFacts.map((item) => truncateText(item, 92));
  const sentenceFacts = normalized
    .split(/(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentenceFacts.length > 1) return sentenceFacts.slice(0, 3).map((item) => truncateText(item, 92));
  return [truncateText(normalized, 150)];
}

function groupGlobalCitations(citations: GlobalChatCitation[]) {
  const order: Array<GlobalChatCitation["knowledgeType"]> = ["Document evidence", "Knowledge graph", "Knowledge wiki"];
  return order
    .map((type) => ({ type, items: citations.filter((citation) => citation.knowledgeType === type) }))
    .filter((group) => group.items.length > 0);
}

function knowledgeSourceHint(type: GlobalChatCitation["knowledgeType"]) {
  if (type === "Document evidence") return "platform.evidence.documentSourceHint";
  if (type === "Knowledge graph") return "platform.evidence.graphSourceHint";
  return "platform.evidence.wikiSourceHint";
}

function sourceBadgeForCitation(citation: GlobalChatCitation) {
  if (citation.knowledgeType === "Document evidence") return "platform.evidence.sourceExcerpt";
  if (citation.knowledgeType === "Knowledge graph") return "platform.evidence.relationshipTrail";
  return "platform.evidence.knowledgeEntry";
}

function recommendTemplatesForGlobalAnswer(query: string, citations: GlobalChatCitation[]) {
  if (citations.length === 0) return [];
  const text = `${query} ${citations.map((citation) => `${citation.scenarioName} ${citation.sourceOriginalName} ${citation.knowledgeType} ${citation.excerpt}`).join(" ")}`.toLowerCase();
  const types = new Set(citations.map((citation) => citation.knowledgeType));
  const scored = officialTemplates.map((template) => {
    const searchable = [
      template.name,
      template.category,
      template.headline,
      ...template.bestFor,
      ...template.inputExamples,
      ...template.outputCapabilities
    ].join(" ").toLowerCase();
    let score = 0;
    for (const token of searchTokens(text)) {
      if (searchable.includes(token)) score += Math.min(6, token.length);
    }
    if (types.has("Knowledge graph") && template.productForm.includes("graph_explorer")) score += 12;
    if (types.has("Document evidence") && template.productForm.includes("document_review")) score += 10;
    if (types.has("Document evidence") && template.productForm.includes("chat")) score += 4;
    if (types.has("Knowledge wiki") && template.productForm.includes("knowledge_portal")) score += 8;
    if (text.includes("customer") && template.id === "customer-360") score += 10;
    if ((text.includes("policy") || text.includes("policy") || text.includes("expense")) && template.id === "policy-evidence") score += 10;
    if ((text.includes("contract") || text.includes("terms")) && template.id === "contract-playbook") score += 10;
    if ((text.includes("risk") || text.includes("relationship")) && template.id === "risk-investigation") score += 8;
    return { template, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.template);
}

function searchTokens(value: string) {
  return Array.from(new Set(value
    .replace(/[？?，,。；;：:、（）()【】\[\]{}"'“”‘’·/\\_-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 32)));
}

function scopeLabel(scope: GlobalChatScope) {
  if (scope === "private") return "platform.scope.privateLabel";
  if (scope === "team") return "platform.scope.teamLabel";
  return "platform.scope.companyLabel";
}

function scopeDescription(scope: GlobalChatScope) {
  if (scope === "private") return "platform.scope.privateDescription";
  if (scope === "team") return "platform.scope.teamDescription";
  return "platform.scope.companyDescription";
}

function knowledgeTypeKey(type: GlobalChatCitation["knowledgeType"]) {
  if (type === "Document evidence") return "knowledge.modeDocument";
  if (type === "Knowledge graph") return "knowledge.modeRelationship";
  return "knowledge.modeWiki";
}

function publicationModeKey(value: string) {
  if (value === "Private") return "visibility.private";
  if (value === "Team") return "visibility.team";
  return "platform.scenario.companyWide";
}

function formatAttachmentMeta(file: File) {
  const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1024))}KB`;
  return `${file.name} · ${size}`;
}

function makeTemplateSampleFile(sample: TemplateDemoWalkthrough["sampleInputs"][number]) {
  const typeMap: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    pdf: "application/pdf"
  };
  const content = [
    `# ${sample.title}`,
    sample.description,
    "This sample file exercises the real submission path and travels with the scenario into the admin ingest request."
  ].join("\n\n");
  return new File([content], sample.fileName, { type: typeMap[sample.fileType] ?? "text/plain" });
}

function displaySourceType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("csv") || normalized.includes("xlsx")) return "platform.fileType.spreadsheet";
  if (normalized.includes("json")) return "platform.fileType.relationship";
  if (normalized.includes("md") || normalized.includes("txt")) return "platform.fileType.text";
  return "platform.fileType.document";
}
