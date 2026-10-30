"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";
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
      setTip(d.message ?? (v === "up" ? "Thanks for the feedback" : "Feedback recorded"));
    } catch {
      setTip("Could not submit feedback");
    }
  };
  return (
    <div className="answer-feedback" aria-label="Rate this answer">
      <button type="button" className={vote === "up" ? "active" : ""} onClick={() => send("up")} aria-label="Helpful">👍</button>
      <button type="button" className={vote === "down" ? "active" : ""} onClick={() => send("down")} aria-label="Not helpful">👎</button>
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
  { value: "private", label: "Private", description: "Only you can see these files and answers; nothing enters a team space." },
  { value: "team", label: "Team", description: "Shared with Sales, Solutions Engineering, Legal, and other teams." },
  { value: "company", label: "Company", description: "Requires a stricter source and answer review before publishing." }
];

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
    <FrontstageShell active="/app" title="Overview" eyebrow={workspaceProfile.workspaceName} initialSnapshot={snapshot}>
      <div className="home-workspace-page">
        <section className="brain-ops-strip home-metric-strip" aria-label="Workspace entry points">
          <KpiCard href="/app/scenarios" label="Scenarios" value={String(metrics.scenarioCount)} helper="Review available and in-flight scenarios" />
          <KpiCard href="/app/knowledge" label="Available knowledge" value={String(metrics.readyKnowledgeCount)} helper="See files your scenarios can use today" />
          <KpiCard href="/app/tasks" label="Pending tasks" value={String(metrics.pendingTaskCount)} helper="Track ingest and review progress" />
          <KpiCard href="/app/templates" label="Templates" value={String(officialTemplates.length)} helper="Pick a template to create a new scenario" />
        </section>

        <section className="brain-command-center home-start-center" aria-label="Ask CompanyBrain">
          <div className="brain-command-main">
            <div className="brain-command-title">
              <span>CompanyBrain</span>
              <h1>Good morning. What do you need to know?</h1>
              <p>Connected to company-wide data for deep insight and compliant guidance.</p>
            </div>

            <form
              className="brain-ask-console"
              onSubmit={(event) => {
                event.preventDefault();
                ask();
              }}
            >
              <div className="home-ask-head">
                <label htmlFor="brain-home-question">Ask CompanyBrain</label>
                <span>Supports PDF, Word, Markdown, spreadsheets, images, audio, and video</span>
              </div>
              <textarea
                id="brain-home-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a complex business question, e.g. compare West Coast pipeline across the last three quarters..."
                rows={3}
              />
              {homeAttachments.length ? (
                <div className="home-attachment-list">
                  {homeAttachments.map((file) => <span key={`${file.name}-${file.size}`}>{formatAttachmentMeta(file)}</span>)}
                </div>
              ) : null}
              <div className="brain-ask-actions home-context-tools" aria-label="Question context">
                <label htmlFor="home-ask-attachments" className="home-context-upload">
                  <b>Upload files</b>
                  <span>Docs / spreadsheets / images / audio & video</span>
                  <input
                    id="home-ask-attachments"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"
                    onChange={(event) => setHomeAttachments(Array.from(event.currentTarget.files ?? []))}
                  />
                </label>
                <label className="home-context-field">
                  <span>Knowledge scope</span>
                  <select
                    value={homeKnowledgeScope}
                    onChange={(event) => setHomeKnowledgeScope(event.currentTarget.value as "company" | "team" | "private")}
                  >
                    <option value="company">Company-wide</option>
                    <option value="team">Team knowledge</option>
                    <option value="private">Personal files</option>
                  </select>
                </label>
                <label className="home-context-field">
                  <span>Output format</span>
                  <select
                    value={homeOutputMode}
                    onChange={(event) => setHomeOutputMode(event.currentTarget.value as "answer" | "report" | "table")}
                  >
                    <option value="answer">Direct answer</option>
                    <option value="report">Report draft</option>
                    <option value="table">Table summary</option>
                  </select>
                </label>
                <button type="submit" className="home-context-send" aria-label="Send question"><span aria-hidden>➤</span></button>
              </div>
            </form>
          </div>

          <div className="home-template-entry">
            <div>
              <b>First time here</b>
              <span>Start from a template to create a reusable scenario, then add files and let the admin process them.</span>
            </div>
            <Link href="/app/templates">Choose a template</Link>
          </div>

          <aside className="brain-command-side home-next-side" aria-label="What you can continue">
            <section>
              <div className="brain-side-title">
                <span>Ready to use</span>
                <Link href="/app/scenarios">View all</Link>
              </div>
              <div className="brain-ready-list">
                {readyPreview.map((scenario) => <ScenarioCompactCard key={scenario.id} scenario={scenario} />)}
                {state !== "loading" && !primaryScenario ? (
                  <Link className="ux-task-mini-row" href="/app/templates"><b>No scenarios yet</b><span>Start from a template or create a scenario and upload files</span></Link>
                ) : null}
                {readyScenarios.length > readyPreview.length ? (
                  <Link className="home-more-row" href="/app/scenarios"> {readyScenarios.length - readyPreview.length} more available scenarios</Link>
                ) : null}
              </div>
            </section>
            <section>
              <div className="brain-side-title">
                <span>Needs attention</span>
                <Link href="/app/tasks">View all</Link>
              </div>
              <div className="brain-task-list">
                {pendingTasks.length > 0
                  ? pendingPreview.map((task) => <TaskMini key={task.id} task={task} />)
                  : <Link className="ux-task-mini-row" href="/app/templates"><b>No pending tasks</b><span>Create a new scenario from a template</span></Link>}
                {pendingTasks.length > pendingPreview.length ? (
                  <Link className="home-more-row" href="/app/tasks"> {pendingTasks.length - pendingPreview.length} more tasks</Link>
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
        meta: `${scopeLabel(session.scope)} · ${session.updatedAtText}`,
        action: () => void openSession(session.id)
      }))
    : readyScenarios.slice(0, 3).map((scenario) => ({
        id: scenario.id,
        title: scenario.name,
        description: scenario.description,
        meta: `${visibilityText(scenario.visibility)} · ${scenario.sourceCount} sources`,
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
      if (!response.ok) throw new Error(body.message ?? "Could not load chat history.");
      const nextSessions = Array.isArray(body.sessions) ? body.sessions as GlobalChatSessionSummary[] : [];
      setSessions(nextSessions);
      if (selectSessionId) {
        await openSession(selectSessionId, false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load chat history.");
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
      if (!response.ok) throw new Error(body.message ?? "Could not open this chat.");
      setActiveSession(body.session as GlobalChatSession);
      setAnimatingId(null);
      setScope((body.session as GlobalChatSession).scope);
      setOutputMode((body.session as GlobalChatSession).outputMode);
      if (refreshHistory) await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open this chat.");
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
      if (!response.ok) throw new Error(body.message ?? "Could not start a chat.");
      const createdSession = body.session as GlobalChatSession;
      setActiveSession(createdSession);
      const lastCreatedMsg = createdSession.messages[createdSession.messages.length - 1];
      if (lastCreatedMsg?.role === "assistant") setAnimatingId(lastCreatedMsg.id);
      // 只刷新左侧历史列表，不再二次 openSession（会清空 animatingId 取消首轮打字机）；
      // createdSession 已是完整 POST 响应，activeSession.id 仍可高亮该会话。
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start a chat.");
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
      if (!response.ok) throw new Error(body.message ?? "Could not send the follow-up.");
      const appendedSession = body.session as GlobalChatSession;
      setActiveSession(appendedSession);
      const lastAppendedMsg = appendedSession.messages[appendedSession.messages.length - 1];
      if (lastAppendedMsg?.role === "assistant") setAnimatingId(lastAppendedMsg.id);
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the follow-up.");
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
    <FrontstageShell active="/app/ask" title="Company Q&A" eyebrow="CompanyBrain" initialSnapshot={snapshot}>
      <div className="global-ask-workspace">
        <aside className="global-chat-history" aria-label="Chat history">
          <header>
            <span>Chat history</span>
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setInput("");
                setMessage("");
              }}
            >
              New
            </button>
          </header>
          <div className="global-history-list">
            {loadingSessions ? <p>Loading chats...</p> : null}
            {!loadingSessions && sessions.length === 0 ? <p>No chats yet. Ask your first question and it appears here, newest first.</p> : null}
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSession?.id === item.id ? "active" : ""}
                onClick={() => void openSession(item.id)}
              >
                <b>{item.title}</b>
                <span>{scopeLabel(item.scope)} · {item.updatedAtText}</span>
                <small>{item.latestMessage}</small>
              </button>
            ))}
          </div>
          <section className="global-scope-card">
            <span>Current knowledge scope</span>
            <p>{scopeDescription(scope)}</p>
          </section>
        </aside>

        <main className="global-chat-thread" aria-label="Company-wide Q&A">
          {!activeSession ? (
            <section className="global-empty-state">
              <span>Ask CompanyBrain</span>
              <h1>Ask a business question and let CompanyBrain assemble the evidence.</h1>
              <p>It runs hybrid retrieval across the document evidence, knowledge graph, and knowledge wiki your account can access, then shows sources, permissions, and reusable scenarios.</p>
              <div className="global-empty-suggestions" aria-label="Recently used">
                <span>{sessions.length > 0 ? "Recently used" : "Continue with"}</span>
                <div className="global-empty-grid">
                  {recentGlobalEntries.map((entry) => (
                  <button key={entry.id} type="button" onClick={entry.action}>
                    <small>{entry.meta}</small>
                    <b>{entry.title}</b>
                    <span>{entry.description}</span>
                  </button>
                  ))}
                  {recentGlobalEntries.length === 0 ? (
                    <Link href="/app/templates">Pick a template to create your first reusable scenario</Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <div className="global-chat-messages">
              {activeSession.messages.map((item) => (
                <article key={item.id} className={`global-message ${item.role === "user" ? "user" : "assistant"}`}>
                  <span>{item.role === "user" ? "You" : "CompanyBrain"}</span>
                  {item.role === "user" ? <p>{item.content}</p> : <AssistantText content={item.content} animate={item.id === animatingId} />}
                  {item.role === "assistant" && item.contextTrace ? (
                    <div className="global-answer-tags global-inline-references">
                      {item.contextTrace.route === "direct" ? <em>Direct answer</em> : null}
                      {item.contextTrace.route === "retrieve"
                        ? item.contextTrace.retrievalTracks.filter((track) => track.count > 0).map((track) => <em key={track.label}>{track.label} {track.count}</em>)
                        : null}
                    </div>
                  ) : null}
                  {item.role === "assistant" ? <AnswerFeedback traceId={item.traceId} /> : null}
                  {item.role === "assistant" && item.id === latestAssistant?.id && recommendedTemplates.length > 0 ? (
                    <div className="global-followup-templates" aria-label="Templates suggested for this answer">
                      <span>These scenarios could capture this</span>
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
                  <p>Searching accessible knowledge, assembling context, and drafting an answer...</p>
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
            <label htmlFor="global-ask-input">Ask CompanyBrain</label>
            <textarea
              id="global-ask-input"
              name="q"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={activeSession ? "Ask a follow-up; this conversation's context is kept..." : "Ask a complex business question, e.g. compare West Coast pipeline across the last three quarters..."}
              rows={4}
            />
            <div className="global-composer-actions">
              <label htmlFor="global-ask-attachments">
                Upload files
                <input
                  id="global-ask-attachments"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.md,.csv,.xlsx,.json,image/*,audio/*,video/*"
                  onChange={(event) => setAttachments(Array.from(event.currentTarget.files ?? []))}
                />
              </label>
              <select value={scope} onChange={(event) => setScope(event.target.value as GlobalChatScope)} aria-label="Knowledge scope">
                <option value="company">Company-wide</option>
                <option value="team">Team knowledge</option>
                <option value="private">Personal files</option>
              </select>
              <select value={outputMode} onChange={(event) => setOutputMode(event.target.value as GlobalChatOutputMode)} aria-label="Output format">
                <option value="direct">Direct answer</option>
                <option value="report">Report draft</option>
                <option value="table">Table summary</option>
              </select>
              <button type="submit" disabled={pending}>{pending ? "Generating" : "Send"}</button>
            </div>
            {attachments.length || pendingAttachmentLabels.length ? (
              <div className="global-attachment-list">
                {attachments.map((file) => <span key={`${file.name}-${file.size}`}>{formatAttachmentMeta(file)}</span>)}
                {pendingAttachmentLabels.map((label) => <span key={label}>{label}</span>)}
              </div>
            ) : null}
          </form>
        </main>

        <aside className="global-source-rail" aria-label="Sources and scenario suggestions">
          <section className="global-source-panel">
            <header>
              <span>Sources in this answer</span>
              <b>{isDirectAnswer ? "Not retrieved" : `${activeCitations.length} citations`}</b>
            </header>
            {activeCitations.length === 0 ? (
              <p>{isDirectAnswer ? "This turn was handled as general chat; the model answered directly without querying the enterprise knowledge base." : "Once you ask, the matched files, knowledge types, and source scenarios appear here."}</p>
            ) : null}
            {citationGroups.map((group) => (
              <section key={group.type} className="global-source-section">
                <header>
                  <h3>{group.type}</h3>
                  <span>{group.items.length} citations</span>
                </header>
                <p>{knowledgeSourceHint(group.type)}</p>
                {group.items.map((citation) => (
                  <article key={`${citation.knowledgeObjectId}-${citation.sourceOriginalName}`}>
                    <em>{sourceBadgeForCitation(citation)}</em>
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
              <span>Answer scope</span>
              <b>{activeTrace?.scopeLabel ?? scopeLabel(scope)}</b>
            </header>
            <ul className="global-answer-scope-list">
              <li><b>Knowledge scope</b><span>{scopeDescription(activeSession?.scope ?? scope)}</span></li>
              <li><b>Follow-ups</b><span>{activeSession ? "Keeps the current conversation thread" : "A new chat starts once you submit"}</span></li>
              <li><b>Routing</b><span>{activeTrace?.routeReason ?? "Decided after you submit the question"}</span></li>
              <li><b>Source status</b><span>{isDirectAnswer ? "No enterprise knowledge retrieved this turn" : activeCitations.length ? "Traceable sources returned" : "Sources appear after the answer"}</span></li>
            </ul>
          </section>

          <section className="global-source-panel">
            <header>
              <span>Suggested capture</span>
              <b>{relatedScenario ? "Open scenario" : "Create scenario"}</b>
            </header>
            {relatedScenario ? (
              <>
                <h2>{relatedScenario.name}</h2>
                <p>{relatedScenario.description}</p>
                <div className="global-source-actions">
                  <Link href={`/app/scenarios/${relatedScenario.id}`}>Open scenario</Link>
                  <Link href="/app/templates">Browse templates</Link>
                </div>
              </>
            ) : (
              <div className="global-source-actions">
                <Link href="/app/templates">Choose a template</Link>
                <Link href="/app/create?mode=blank">Build your own scenario</Link>
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
    <FrontstageShell active="/app/templates" title="Templates" eyebrow="Best-practice entry point">
      <section className="ux-page-head template-library-head">
        <div>
          <span>Templates</span>
          <h1>Choose a knowledge app by business goal.</h1>
          <p>A template is more than a card: it is the best-practice path into a new scenario. Pick the business goal, upload files, and the admin console configures the real RAG ingest policy for that content and its permissions.</p>
        </div>
        <div className="template-library-actions">
          <Link className="primary" href="/app/create?mode=blank">Create scenario</Link>
          <Link href={`/app/create?template=${selectedTemplate.id}`}>Create selected template</Link>
        </div>
      </section>
      <div className="template-market-toolbar">
        <label>
          <span>Search templates</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers, policies, support, contracts..." />
        </label>
        <TemplateViewToggle view={view} onChange={setView} />
      </div>
      <section className="template-market-layout" aria-label="Template catalog">
        <aside className="template-filter-panel">
          <div>
            <span>Business category</span>
            <b>Narrow by goal</b>
          </div>
          <div className="template-category-list">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={item === category ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <span>{item}</span>
                <small>{item === "All" ? officialTemplates.length : officialTemplates.filter((template) => template.category === item).length}</small>
              </button>
            ))}
          </div>
          <div className="template-filter-note">
            <b>No good fit?</b>
            <p>Create your own scenario instead: upload files and the admin decides which knowledge pipeline fits.</p>
            <Link href="/app/create?mode=blank">Create scenario</Link>
          </div>
        </aside>

        <div className="template-market-main">
          <header>
            <div>
              <span>{activeView.label} view</span>
              <b>{visible.length} templates available</b>
            </div>
            <small>{activeView.description}</small>
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
  const template = templateById(id);
  if (!template) return <TemplateNotFound />;

  return (
    <FrontstageShell active="/app/templates" title={template.name} eyebrow="Template detail">
      <div className="ux-template-detail">
        <section className="ux-hero-panel">
          <span>{template.category}</span>
          <h1>{template.name}</h1>
          <p>{template.headline}</p>
          <div className="ux-actions">
            <Link className="ux-primary-link" href={`/app/create?template=${template.id}`}>Create with this template</Link>
            <Link href="#preview">See the preview</Link>
          </div>
        </section>
        <aside className="ux-side-panel">
          <Meta label="Setup time" value={template.setupTime} />
          <Meta label="Approval needed" value={template.reviewRequirement} />
          <Meta label="Accepted files" value={template.acceptedFiles.join(" / ")} />
        </aside>
        <InfoSection title="Best for" items={template.bestFor} />
        <InfoSection title="What you need to prepare" items={template.inputExamples} />
        <InfoSection title="What the system does" items={template.processingExplanation} ordered />
        <InfoSection title="What you can do afterwards" items={template.outputCapabilities} />
        <section id="preview" className="ux-demo-panel">
          <span>Template preview</span>
          <h2>{template.demoWalkthrough.scenarioName}</h2>
          <div className="ux-demo-grid">
            <div>
              <h3>Sample files</h3>
              {template.demoWalkthrough.sampleInputs.map((asset) => (
                <article key={asset.fileName} className="ux-source-card">
                  <b>{asset.title}</b>
                  <small>{displaySourceName(asset.fileName)}</small>
                  <p>{asset.description}</p>
                </article>
              ))}
            </div>
            <div>
              <h3>Processing steps</h3>
              <ol>{template.demoWalkthrough.processingPreview.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
          </div>
          <div className="ux-answer-preview">
            <small>Sample question</small>
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
      setSubmitError("Submission failed. Check that your files are still available and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FrontstageShell active="/app/templates" title="Create scenario" eyebrow="Create scenario">
      <section className="ux-page-head">
        <h1>Submit the business goal and files first; the admin console handles knowledge processing.</h1>
        <p>The workspace creates the scenario, uploads files, and describes the expected output; an admin confirms source quality, chooses the processing approach, then ingests and publishes.</p>
      </section>
      <div className="ux-create-layout">
        <section className="ux-form-panel create-scenario-form">
          <div className="create-mode-switch">
            <button type="button" className={!isCustomTemplate ? "active" : ""} onClick={() => selectTemplate("customer-360")}>From a template</button>
            <button type="button" className={isCustomTemplate ? "active" : ""} onClick={() => selectTemplate(customScenarioTemplate.id)}>Create scenario</button>
          </div>
          <div className="create-picker-block">
            <div className="create-section-title">
              <span>Choose a starting point</span>
              <small>Pick an official template, or upload files and build a scenario from scratch.</small>
            </div>
            <div className="create-template-options" role="radiogroup" aria-label="Choose a starting point">
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
                    <span>{custom ? "Custom" : item.category}</span>
                    <b>{item.name}</b>
                    <small>{custom ? "Upload files and state the goal; the admin picks the processing approach." : item.demoWalkthrough.scenarioName}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <label>Scenario name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. West Coast enterprise renewal risk review" />
          <label>Scenario description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Describe the problem, who uses it, and the result you expect." />
          <label>Expected result</label>
          <textarea value={processingGoal} onChange={(event) => setProcessingGoal(event.target.value)} rows={3} placeholder="e.g. Turn account files into a renewal brief you can question, with risks, opportunities, and citations." />

          <div className="create-intake-panel">
            <div className="create-section-title">
              <span>Access and files</span>
              <small>Decide who can use it, then add the business files for the admin to process.</small>
            </div>

            <div className="create-intake-grid">
              <section className="create-intake-section">
                <div className="create-mini-head">
                  <b>Publish scope</b>
                  <span>Decides who can use the scenario once processing finishes.</span>
                </div>
                <div className="create-visibility-options" role="radiogroup" aria-label="Publish scope">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={visibility === option.value ? "active" : ""}
                      role="radio"
                      aria-checked={visibility === option.value}
                      onClick={() => setVisibility(option.value)}
                    >
                      <b>{option.label}</b>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="create-intake-section create-source-advice">
                <div className="create-mini-head">
                  <b>Suggested file types</b>
                  <span>This template works best with these files first.</span>
                </div>
                <div className="create-file-type-list">
                  {template.acceptedFiles.map((fileType) => <span key={fileType}>{fileType}</span>)}
                </div>
              </section>
            </div>

            <section className="create-intake-section create-upload-section">
              <div className="create-mini-head">
                <b>Upload files</b>
                <span>{hasFiles ? "Files attached and ready for the admin console." : "No files yet. Pick at least one file, or use the sample files, before submitting."}</span>
              </div>
              <div className="create-upload-box">
                <input
                  id="scenario-file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.md,.txt,.csv,.xlsx,.json,.html"
                  onChange={(event) => setUploadedFiles(Array.from(event.currentTarget.files ?? []))}
                />
                <label htmlFor="scenario-file-upload">Choose files</label>
                <button type="button" onClick={() => setUploadedFiles(template.demoWalkthrough.sampleInputs.map(makeTemplateSampleFile))}>Use sample files</button>
                <span>{hasFiles ? `Attached ${uploadedFiles.length} files` : "Supports PDF, Word, Markdown, spreadsheets, JSON, and more"}</span>
              </div>

              <div className={`create-file-state ${hasFiles ? "ready" : ""}`}>
                <b>{hasFiles ? "Files attached" : "Waiting for files"}</b>
                {hasFiles ? (
                  <div className="ux-file-list create-file-list">
                    {uploadedFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`}>{displaySourceName(file.name)}</span>
                    ))}
                  </div>
                ) : (
                  <p>Upload your own files, or run the full flow with the template's sample files first.</p>
                )}
              </div>
            </section>
          </div>

          {submitError && <p className="create-submit-error">{submitError}</p>}
          <button className="ux-button" disabled={!name.trim() || !hasFiles || isSubmitting} onClick={submitScenario}>
            {isSubmitting ? "Submitting files" : "Submit for processing"}
          </button>
        </section>
        <aside className="ux-path-panel create-processing-panel">
          <h2>What happens next</h2>
          <div className="create-admin-note">
            <b>{draft.task.currentStep}</b>
            <span>{draft.task.userMessage}</span>
          </div>
          {scenarioLifecycle.map((stage, index) => (
            <div className="ux-stage-row" key={stage.key}>
              <i>{index + 1}</i>
              <div>
                <b>{stage.label}</b>
                <span>{stage.description}</span>
              </div>
            </div>
          ))}
          <div className="create-admin-note">
            <b>What the admin decides</b>
            <span>Source quality, publish scope, and processing strategy, then whether to use knowledge compile, document evidence, knowledge graph, or a combination.</span>
          </div>
        </aside>
      </div>
    </FrontstageShell>
  );
}

export function MyScenariosPage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { snapshot, state } = usePlatformSnapshot(initialSnapshot);
  const [status, setStatus] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scenarios = useMemo(() => sortScenariosByStatusAndTime(snapshot.scenarios).map(toScenarioInstance), [snapshot.scenarios]);
  const visible = scenarios.filter((scenario) => {
    const statusOk = status === "All" || statusLabel(scenario.status) === status;
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
    <FrontstageShell active="/app/scenarios" title="Scenarios" eyebrow="Knowledge assets" initialSnapshot={snapshot}>
      <section className="scenario-asset-head">
        <div>
          <span>Scenario assets</span>
          <h1>Manage the knowledge apps you created, are processing, and use most.</h1>
          <p>A scenario is not a one-off Q&A box. Each one binds files, permissions, processing tasks, past conversations, and deliverables, and opens into its own business workbench.</p>
        </div>
        <div className="scenario-asset-metrics" aria-label="Scenario stats">
          <span><b>{scenarios.length}</b>Total scenarios</span>
          <span><b>{readyCount}</b>Available</span>
          <span><b>{processingCount}</b>Processing</span>
          <span><b>{companyCount}</b>Company-wide</span>
        </div>
      </section>

      <div className="scenario-asset-layout">
        <aside className="scenario-asset-filter" aria-label="Scenario filters">
          <Link className="scenario-create-primary" href="/app/templates">Create scenario</Link>
          <section>
            <b>Status</b>
            {["All", "Available", "Processing", "Pending review", "Failed"].map((item) => (
              <button key={item} type="button" className={item === status ? "active" : ""} onClick={() => setStatus(item)}>
                <span>{item}</span>
                <em>{countScenariosByStatus(scenarios, item)}</em>
              </button>
            ))}
          </section>
          <section>
            <b>Access scope</b>
            {(["private", "team", "company"] as Visibility[]).map((item) => (
              <Link key={item} href={`/app/scenarios?scope=${item}`}>
                <span>{visibilityText(item)}</span>
                <em>{scenarios.filter((scenario) => scenario.visibility === item).length}</em>
              </Link>
            ))}
          </section>
        </aside>

        <section className="scenario-asset-table" aria-label="Scenario list">
          <header>
            <div>
              <span>Scenarios</span>
              <b>{visible.length} scenarios</b>
            </div>
            <label>
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search scenarios, templates, goals..." />
            </label>
          </header>
          <div className="scenario-list-head" aria-hidden="true">
            <span>Scenario</span>
            <span>Form</span>
            <span>Scope</span>
            <span>Status</span>
            <span>Actions</span>
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
                <b>No matching scenarios</b>
                <span>Adjust the filters, or create a new knowledge app from a template.</span>
                <Link href="/app/templates">Choose a template</Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="scenario-asset-inspector" aria-label="Scenario details">
          {selectedScenario ? (
            <ScenarioAssetInspector scenario={selectedScenario} />
          ) : (
            <section>
              <span>No scenario yet</span>
              <h2>Create a scenario first</h2>
              <p>After you upload files, an admin picks the real RAG ingest policy and publishes the scenario to the workspace.</p>
              <Link href="/app/templates">Choose a template</Link>
            </section>
          )}
        </aside>
      </div>
    </FrontstageShell>
  );
}

export function TaskCenterPage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
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
    <FrontstageShell active="/app/tasks" title="Tasks" eyebrow="Ingest and publish progress" initialSnapshot={initialSnapshot}>
      <section className="ux-page-head task-center-head">
        <div>
          <span>Task center</span>
          <h1>Track every file set from submission to publish.</h1>
          <p>Tasks are grouped by status, type, and time. Users see who a task is waiting on; admins use the same view to pick up ingest and review.</p>
        </div>
        <div className="task-head-metrics">
          <span><b>{pendingAdminCount}</b>Pending admin review</span>
          <span><b>{runningCount}</b>Processing</span>
          <span><b>{readyCount}</b>Available</span>
        </div>
      </section>
      {createdTask && (
        <section className="task-submit-banner">
          <b>New scenario submitted</b>
          <span>The admin console received the scenario name, files, and processing goal. The task is now pending admin review and needs a processing choice before ingest.</span>
        </section>
      )}
      <section className="task-control-bar" aria-label="Task filters and sorting">
        <div>
          {["All statuses", "Pending admin review", "Processing", "Available"].map((item) => (
            <button key={item} type="button" className={statusFilter === item ? "active" : ""} onClick={() => setStatusFilter(item)}>{item}</button>
          ))}
        </div>
        <div>
          {["All types", "File intake", "Admin review", "Publish review"].map((item) => (
            <button key={item} type="button" className={kindFilter === item ? "active" : ""} onClick={() => setKindFilter(item)}>{item}</button>
          ))}
        </div>
        <div>
          {["Recently updated", "Submitted", "Progress"].map((item) => (
            <button key={item} type="button" className={sortBy === item ? "active" : ""} onClick={() => setSortBy(item)}>{item}</button>
          ))}
        </div>
      </section>
      <div className="task-board-layout">
        <aside className="task-board-side">
          <b>Processing rules</b>
          <p>Personal files stay in your personal knowledge space; team files open only to team scenarios; company files need admin review before they reach CompanyBrain.</p>
          <div className="task-board-side-note">
            <span>The workspace only shows processing status</span>
            <strong>Ingest, review, and publishing happen in the admin console.</strong>
          </div>
        </aside>
        <div className="task-list">
          {allTasks.map((task) => <TaskCard key={task.id} task={task} />)}
          {allTasks.length === 0 ? (
            <article className="ux-task-card">
              <header className="task-card-head"><span>No tasks</span><small>File intake</small></header>
              <h2>No processing tasks yet</h2>
              <p>Upload files from a template or custom scenario and the real tasks show up here: waiting for admin review, ingesting, publishing, or sent back for more files.</p>
              <footer className="task-card-actions"><Link href="/app/templates">Choose a template</Link><Link href="/app/create?mode=blank">Create scenario</Link></footer>
            </article>
          ) : null}
        </div>
      </div>
    </FrontstageShell>
  );
}

export function KnowledgeSpacePage({ initialSnapshot }: { initialSnapshot?: PlatformSnapshot } = {}) {
  const { snapshot, state } = usePlatformSnapshot(initialSnapshot);
  const knowledgeObjects = useMemo(() => snapshot.knowledge.map(toKnowledgeSpaceObject), [snapshot.knowledge]);
  const [scopeFilter, setScopeFilter] = useState<KnowledgeAssetScope>("all");
  const [kindFilter, setKindFilter] = useState<KnowledgeAssetKindFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stats = useMemo(() => buildKnowledgeAssetStats(knowledgeObjects), [knowledgeObjects]);
  const filteredObjects = useMemo(
    () => filterKnowledgeAssets(knowledgeObjects, { scope: scopeFilter, kind: kindFilter, query }),
    [knowledgeObjects, scopeFilter, kindFilter, query]
  );
  const selectedObject = filteredObjects.find((object) => object.id === selectedId) ?? filteredObjects[0] ?? knowledgeObjects[0] ?? null;
  return (
    <FrontstageShell active="/app/knowledge" title="Knowledge" eyebrow="Retrievable knowledge space" initialSnapshot={snapshot}>
      <section className="knowledge-asset-head">
        <div>
          <span>Knowledge asset center</span>
          <h1>Manage retrievable knowledge assets, permission boundaries, and business sources.</h1>
          <p>This shows the document evidence, knowledge graph, knowledge wiki, and business artifacts your account can actually see. Users confirm what personal, team, or company scenarios can retrieve, and request updates, sharing, or publishing.</p>
        </div>
        <div className="knowledge-asset-metrics">
          <span><b>{stats.total}</b>Total assets</span>
          <span><b>{stats.private}</b>Personal</span>
          <span><b>{stats.team}</b>Team</span>
          <span><b>{stats.company}</b>Company</span>
        </div>
      </section>
      <div className="knowledge-asset-layout">
        <aside className="knowledge-asset-filter">
          <div className="knowledge-filter-block">
            <strong>Permission scope</strong>
            {knowledgeAssetScopes.map((scope) => (
              <button key={scope.id} type="button" className={scopeFilter === scope.id ? "active" : ""} onClick={() => setScopeFilter(scope.id)}>
                <b>{scope.label}</b>
                <span>{scope.description}</span>
              </button>
            ))}
          </div>
          <div className="knowledge-filter-block">
            <strong>Asset type</strong>
            {knowledgeAssetKinds.map((kind) => (
              <button key={kind.id} type="button" className={kindFilter === kind.id ? "active" : ""} onClick={() => setKindFilter(kind.id)}>
                <b>{kind.label}</b>
                <span>{kind.description}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="knowledge-asset-main">
          <div className="knowledge-asset-toolbar">
            <div>
              <span>Asset list</span>
              <b>{filteredObjects.length} / {stats.total}</b>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets, sources, owners, or scenarios..." aria-label="Search knowledge assets" />
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
                <b>No knowledge assets match</b>
                <p>Adjust the filters, or create a scenario from a template and submit files, then check back after ingest.</p>
                <Link href="/app/templates">Choose a template</Link>
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
  const { snapshot } = usePlatformSnapshot(initialSnapshot);
  const role = auth.user?.is_admin ? "admin" : "member";
  const model = useMemo(() => buildWorkspaceSettingsModel({ profile: workspaceProfile, role, snapshot }), [role, snapshot]);
  const recentTasks = snapshot.tasks.slice(0, 4);
  const readyScenarios = snapshot.scenarios.filter((scenario) => scenario.status === "ready").slice(0, 4);
  return (
    <FrontstageShell active="/app/settings" title="Space Settings" eyebrow="Permissions, connectors, and publish policy" initialSnapshot={snapshot}>
      <section className="settings-console-head">
        <div>
          <span>Workspace governance</span>
          <h1>Keep accounts, permissions, connectors, and publish policy on one control surface.</h1>
          <p>Workspace users only manage what they can reach; real ingest policy, model services, and company-level publishing stay with admins. This page makes business users, team permissions, and knowledge asset boundaries explicit.</p>
        </div>
        <div className="settings-user-card">
          <small>Current account</small>
          <b>{auth.user?.display_name || auth.user?.username || workspaceProfile.currentUser}</b>
          <span>{roleDisplayName(role)} · {workspaceProfile.plan}</span>
        </div>
      </section>
      <div className="settings-console-grid">
        <section className="settings-console-panel settings-identity-panel">
          <PanelHeading eyebrow="Identity and space" title="What this account can do" />
          <SettingsRows rows={model.identityRows} />
        </section>
        <section className="settings-console-panel settings-permission-panel">
          <PanelHeading eyebrow="Permission boundaries" title="Knowledge retrieval scope" />
          <SettingsRows rows={model.permissionRows} />
          <div className="settings-policy-note">
            <b>Default rules</b>
            <span>Personal files are not retrieved by teams; team files do not flow into CompanyBrain automatically; company knowledge needs a publish record.</span>
          </div>
        </section>
        <section className="settings-console-panel settings-connector-panel">
          <PanelHeading eyebrow="Connectors" title="How files enter the system" />
          <SettingsRows rows={model.connectorRows} />
        </section>
        <section className="settings-console-panel settings-policy-panel">
          <PanelHeading eyebrow="Publish policy" title="How a scenario becomes available" />
          <div className="settings-policy-flow">
            {["Submit files", "Admin ingest", "Permission review", "Publish"].map((step, index) => (
              <div key={step}>
                <i>{index + 1}</i>
                <b>{step}</b>
                <span>{index === 0 ? "Business user uploads files" : index === 1 ? "Admin picks the RAG pipeline" : index === 2 ? "Confirm personal/team/company boundary" : "Workspace scenario starts retrieving"}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="settings-console-panel settings-audit-panel">
          <PanelHeading eyebrow="Audit and pending" title="Recent items to watch" />
          <SettingsRows rows={model.auditRows} />
          <div className="settings-audit-list">
            {recentTasks.length > 0 ? recentTasks.map((task) => (
              <Link key={task.id} href={`/app/scenarios/${task.scenarioId}/tasks`}>
                <b>{task.title}</b>
                <span>{task.currentStep} · {task.progress}%</span>
              </Link>
            )) : <span>No pending tasks</span>}
          </div>
        </section>
        <section className="settings-console-panel settings-scenario-panel">
          <PanelHeading eyebrow="Available scenarios" title="Business entry points published in this space" />
          <div className="settings-scenario-list">
            {readyScenarios.length > 0 ? readyScenarios.map((scenario) => (
              <Link key={scenario.id} href={`/app/scenarios/${scenario.id}`}>
                <b>{scenario.name}</b>
                <span>{scenario.ownerName} · {knowledgeVisibilityLabel(scenario.visibility)}</span>
              </Link>
            )) : <span>No published scenarios yet</span>}
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
    <FrontstageShell active="/app/scenarios" title={scenario?.name ?? "Loading scenario"} eyebrow={template.name}>
      {state === "loading" ? (
        <section className="ux-page-head"><h1>Loading scenario</h1><p>Loading the real scenario data behind your submission and its ingest.</p></section>
      ) : state === "error" || !scenario ? (
        <section className="ux-page-head"><h1>Scenario unavailable</h1><p>Check your sign-in state and whether the local platform services are running.</p></section>
      ) : (
        <>
          <section className={`scenario-workbench-hero ${scenario.status === "ready" ? "ready" : ""}`}>
            <div className="scenario-workbench-title">
              <span>{template.category} · {surface.label} · {statusLabel(scenario.status)}</span>
              <h1>{scenario.name}</h1>
              <p>{scenario.description || scenario.processingGoal}</p>
            </div>
            <div className="scenario-workbench-primary">
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{surface.primaryAction.label}</Link>
              <Link href={`/app/scenarios/${scenario.id}/data`}>Manage files</Link>
            </div>
            <div className="ux-workbench-meta scenario-workbench-meta">
              <Meta label="Owner" value={scenario.ownerName} />
              <Meta label="Sources" value={`${scenario.sourceCount} `} />
              <Meta label="Publish scope" value={visibilityText(scenario.visibility)} />
            </div>
            <nav className="ux-tabs" aria-label="Scenario workbench">
              {tabs.map((item) => (
                <Link key={item} href={`/app/scenarios/${scenario.id}${item === "overview" ? "" : `/${item}`}`} className={item === tab ? "active" : ""}>
                  {scenarioTabLabel(item)}
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
  return (
    <FrontstageShell active="/app/scenarios" title="Scenario not found">
      <section className="ux-page-head">
        <h1>We could not find this scenario</h1>
        <p>It may be archived, or your account has no access.</p>
        <Link className="ux-primary-link" href="/app/scenarios">Back to scenarios</Link>
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
  const latestTask = tasks[0];
  const ready = scenario.status === "ready";
  return (
    <div className="scenario-live-console">
      <section className="scenario-use-panel">
        <div className="scenario-use-copy">
          <span>{ready ? "Available now" : statusLabel(scenario.status)}</span>
          <h2>{surface.workspaceTitle}</h2>
          <p>{ready ? surface.description : latestTask?.userMessage ?? "Once the admin finishes ingest and publish, the usable workbench appears here."}</p>
        </div>
        <div className="scenario-use-actions">
          <Link className="primary" href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{surface.primaryAction.label}</Link>
          {surface.secondaryActions.slice(0, 2).map((action) => (
            <Link key={action.label} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(action.prompt)}`}>{action.label}</Link>
          ))}
        </div>
      </section>

      <section className="scenario-live-section scenario-history-section">
        <header>
          <div><span>History</span><h3>Recent activity in this scenario</h3></div>
          <Link href={`/app/scenarios/${scenario.id}/ask`}>New chat</Link>
        </header>
        <div className="scenario-history-list">
          {sessions.slice(0, 4).map((session) => (
            <Link key={session.id} href={`/app/scenarios/${scenario.id}/ask?session=${session.id}`}>
              <b>{session.title}</b>
              <span>{session.latestMessage}</span>
              <small>{session.updatedAtText} · {session.messageCount} messages</small>
            </Link>
          ))}
          {sessions.length === 0 ? (
            <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>
              <b>No conversations yet</b>
              <span>Your first question is saved here automatically.</span>
              <small>{surface.primaryAction.label}</small>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="scenario-live-section scenario-material-section">
        <header>
          <div><span>File management</span><h3>{knowledge.length} ingested knowledge objects</h3></div>
          <Link href={`/app/scenarios/${scenario.id}/data`}>View files</Link>
        </header>
        <div className="scenario-material-list">
          {knowledge.slice(0, 5).map((item) => (
            <Link key={item.id} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(item.title)}`}>
              <b>{displaySourceName(item.sourceOriginalName)}</b>
              <span>{item.ragEngine}</span>
              <small>{truncateText(item.content, 72)}</small>
            </Link>
          ))}
          {knowledge.length === 0 ? <p>After an admin confirms ingest, the files, chunks, graph, or pages this scenario can retrieve appear here.</p> : null}
        </div>
      </section>

      <aside className="scenario-live-rail">
        <section>
          <span>Deliverables</span>
          <div className="scenario-output-actions">
            {(template.outputCapabilities.length ? template.outputCapabilities : ["Business summary", "Citations", "Next actions"]).slice(0, 5).map((item) => (
              <Link key={item} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item}`)}`}>{item}</Link>
            ))}
          </div>
        </section>
        <section>
          <span>Backend status</span>
          <div className="scenario-state-stack">
            <div><b>{statusLabel(scenario.status)}</b><small>{latestTask?.currentStep ?? scenario.processingGoal}</small></div>
            <div><b>{visibilityText(scenario.visibility)}</b><small>Permission filters apply to answers, files, and deliverables.</small></div>
            <div><b>{surface.label}</b><small>{surface.headline}</small></div>
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
  return (
    <aside className="scenario-chat-history">
      <header>
        <span>History</span>
        <button type="button" onClick={onNew}>New</button>
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
            <small>{session.updatedAtText} · {session.messageCount} messages</small>
          </button>
        ))}
        {sessions.length === 0 ? (
          <Link href={`/app/scenarios/${scenarioId}/ask`}>
            <b>No history</b>
            <span>Your first message is saved here.</span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function LiveScenarioDataPanel({ knowledge }: { knowledge: LiveKnowledgeRecord[] }) {
  return (
    <section className="ux-panel">
      <PanelTitle title="Ingested files" actionHref="/app/templates" actionLabel="Create another scenario" />
      <div className="ux-table">
        {knowledge.map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.title}</b>
              <span>{displaySourceName(item.sourceOriginalName)}</span>
            </div>
            <em>{item.ragEngine}</em>
            <strong>{visibilityText(item.visibility)}</strong>
            <small>{item.content}</small>
          </article>
        ))}
        {knowledge.length === 0 ? <p>No knowledge objects yet; wait for an admin to finish ingest.</p> : null}
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
      if (!response.ok) throw new Error(body.message ?? "Could not open this conversation.");
      setActiveSession(body.session as ScenarioChatSession);
      setAnimatingId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open this conversation.");
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
      if (!response.ok) throw new Error(body.message ?? "Could not start a chat.");
      const createdScenarioSession = body.session as ScenarioChatSession;
      setActiveSession(createdScenarioSession);
      const lastCreatedScenarioMsg = createdScenarioSession.messages[createdScenarioSession.messages.length - 1];
      if (lastCreatedScenarioMsg?.role === "assistant") setAnimatingId(lastCreatedScenarioMsg.id);
      await refreshSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start a chat.");
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
      if (!response.ok) throw new Error(body.message ?? "Could not send the follow-up.");
      const appendedScenarioSession = body.session as ScenarioChatSession;
      setActiveSession(appendedScenarioSession);
      const lastAppendedScenarioMsg = appendedScenarioSession.messages[appendedScenarioSession.messages.length - 1];
      if (lastAppendedScenarioMsg?.role === "assistant") setAnimatingId(lastAppendedScenarioMsg.id);
      await refreshSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the follow-up.");
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
    ? surface.emptyState
    : tasks[0]?.userMessage ?? "This scenario is still being processed in the admin console.";

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
            <span>{surface.label}</span>
            <h2>{surface.workspaceTitle}</h2>
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
                <span>{item.role === "user" ? "You" : scenario.name}</span>
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
                <p>Answering from this scenario's files...</p>
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
            placeholder={scenario.status === "ready" ? surface.primaryAction.prompt : "Available once the admin finishes ingest..."}
          />
          <button type="submit" disabled={pending || scenario.status !== "ready"}>{pending ? "Generating" : "Send"}</button>
        </form>
      </section>
      <aside className={`scenario-evidence-rail mode-${surface.rightRailMode}`}>
        <section>
          <span>{surface.contextPanelTitle}</span>
          <h2>{latestCitations.length ? `${latestCitations.length} citations in this answer` : "Waiting for this answer"}</h2>
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
          <span>Deliverables</span>
          <div className="scenario-output-actions">
            {surface.secondaryActions.map((action) => (
              <button key={action.label} type="button" onClick={() => setInput(action.prompt)}>{action.label}</button>
            ))}
          </div>
        </section>
        <section>
          <span>File status</span>
          <div className="scenario-state-stack">
            <div><b>{statusLabel(scenario.status)}</b><small>{tasks[0]?.currentStep ?? scenario.processingGoal}</small></div>
            <div><b>{knowledge.length} knowledge objects</b><small>Answers are filtered by your account permissions.</small></div>
          </div>
          <Link className="scenario-rail-link" href={`/app/scenarios/${scenario.id}/data`}>Manage files</Link>
        </section>
      </aside>
    </div>
  );
}

function ScenarioInlineCitations({ citations }: { citations: ScenarioCitation[] }) {
  const groups = groupScenarioCitations(citations);
  return (
    <div className="scenario-inline-citations" aria-label="Evidence types behind this answer">
      {groups.map((group) => (
        <em key={group.engine} className={`citation-${scenarioEngineClass(group.engine)}`}>
          <span>{group.label}</span>
          <b>{group.count} citations</b>
        </em>
      ))}
    </div>
  );
}

function ScenarioEvidenceCard({ citation }: { citation: ScenarioCitation }) {
  const label = knowledgeTypeLabel(citation.engine);
  const facts = scenarioEvidenceFacts(citation.excerpt);
  return (
    <article className={`scenario-evidence-card evidence-${scenarioEngineClass(citation.engine)}`}>
      <header>
        <span>{label}</span>
        <small>{scenarioEvidenceBadge(citation.engine)}</small>
      </header>
      <b>{displaySourceName(citation.sourceOriginalName)}</b>
      <p>{scenarioEvidenceHint(citation.engine)}</p>
      {facts.length > 1 ? (
        <ul>
          {facts.slice(0, 3).map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      ) : (
        <strong>{facts[0] ?? "Evidence matched but has no summary to show."}</strong>
      )}
    </article>
  );
}

function LiveScenarioOutputsPanel({ scenario, template, surface, knowledge }: { scenario: LiveScenarioRecord; template: LiveWorkbenchTemplate; surface: ScenarioProductSurface; knowledge: LiveKnowledgeRecord[] }) {
  return (
    <div className="scenario-output-workspace">
      <section className="scenario-output-head">
        <div>
          <span>{surface.label}</span>
          <h2>Business deliverables this scenario keeps producing</h2>
          <p>Deliverables are generated from ingested files; afterwards you can download, share, or keep asking inside the scenario.</p>
        </div>
        <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(surface.primaryAction.prompt)}`}>{surface.primaryAction.label}</Link>
      </section>
      <div className="scenario-output-list">
        {(template.outputCapabilities.length ? template.outputCapabilities : ["Business summary", "Citations", "Next actions"]).map((item) => (
          <article key={item}>
            <div>
              <span>Generates</span>
              <h3>{item}</h3>
              <p>{surface.description}</p>
            </div>
            <div className="scenario-output-row-actions">
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item}`)}`}>Generate</Link>
              <Link href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(`Generate ${item} (downloadable)`)}`}>Generate download</Link>
            </div>
          </article>
        ))}
      </div>
      <section className="scenario-output-sources">
        <span>Files available for generation</span>
        {knowledge.slice(0, 6).map((item) => (
          <Link key={item.id} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(item.title)}`}>
            <b>{displaySourceName(item.sourceOriginalName)}</b>
            <small>{item.ragEngine} · {truncateText(item.content, 90)}</small>
          </Link>
        ))}
        {knowledge.length === 0 ? <p>Knowledge objects appear once an admin confirms ingest.</p> : null}
      </section>
    </div>
  );
}

function LiveScenarioSettingsPanel({ scenario, surface, knowledge }: { scenario: LiveScenarioRecord; surface: ScenarioProductSurface; knowledge: LiveKnowledgeRecord[] }) {
  const engines = Array.from(new Set(knowledge.map((item) => item.ragEngine)));
  return (
    <div className="ux-settings-grid">
      <SettingsBlock title="Scenario access" items={[visibilityText(scenario.visibility), `Owner: ${scenario.ownerName}`, `Sources: ${scenario.sourceCount} `]} />
      <SettingsBlock title="Processing" items={[scenario.processingGoal || "Waiting for admin review", engines.length ? `Ingested: ${engines.join(", ")}` : "Ingest not finished"]} />
      <SettingsBlock title="Workbench" items={[surface.label, surface.workspaceTitle, scenario.status === "ready" ? surface.primaryAction.label : "Waiting for publish"]} />
    </div>
  );
}

function FrontstageShell({ active, title, eyebrow, initialSnapshot, children }: ShellProps) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { snapshot } = usePlatformSnapshot(initialSnapshot);
  const pendingCount = snapshot.tasks.filter((task) => task.status !== "ready" && task.status !== "failed").length;
  const currentUser = auth.user?.display_name || auth.user?.username || workspaceProfile.currentUser;
  const userInitial = currentUser.trim().slice(0, 1) || "U";
  const roleLabel = auth.user?.is_admin ? "Admin" : "Member";
  const scopeLabel = formatUserScope(auth.user);

  async function handleLogout() {
    await auth.logout();
    router.replace(`/login?next=${encodeURIComponent(pathname || active || "/app")}`);
  }

  return (
    <div className="ux-shell">
      <aside className="ux-sidebar">
        <Link href="/" className="ux-brand" aria-label="Back to the website"><Logo size={30} /></Link>
        <Link className="ux-sidebar-action" href="/app/templates">New scenario</Link>
        <nav className="ux-nav" aria-label="Workspace navigation">
          {workspaceNav.map((item) => {
            const isActive = active === item.href || (item.href !== "/app" && active.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={isActive ? "active" : ""}>
                <i aria-hidden>{navGlyphs[item.href] ?? "•"}</i>
                <b>{item.label}</b>
                <span>{item.description}</span>
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
            <input placeholder="Search scenarios, files, answers, tasks..." />
          </label>
          <div className="ux-header-actions">
            <Link className="ux-header-link" href="/app/tasks">
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </Link>
            <ThemeToggle />
            <details className="ux-account-menu">
              <summary aria-label="Account and permission menu">
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
                    <span>{auth.user?.username ?? "Current account"} · {roleLabel}</span>
                  </div>
                </div>
                <dl className="ux-account-meta">
                  <div>
                    <dt>Permission scope</dt>
                    <dd>{scopeLabel}</dd>
                  </div>
                  <div>
                    <dt>Data boundary</dt>
                    <dd>Personal, team, and company knowledge filtered by account</dd>
                  </div>
                </dl>
                <div className="ux-account-actions">
                  <Link href="/app/settings">Account and workspace settings</Link>
                  {auth.user?.is_admin ? <Link href="/admin">Open the admin console</Link> : null}
                  <button type="button" onClick={handleLogout}>Sign out</button>
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

function formatUserScope(user: { organization_id?: string; team_ids?: string[] } | null) {
  if (!user) return "Not signed in";
  const organizationName = formatOrganizationName(user.organization_id);
  const teamNames = (user.team_ids ?? []).map(formatTeamName).filter(Boolean);
  if (teamNames.length > 0) return `${organizationName} / ${teamNames.join(", ")}`;
  return `${organizationName} / Personal space`;
}

function formatOrganizationName(id?: string) {
  if (!id) return "Organization";
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
  const availability = scenarioAvailability(workbench.scenario);
  const isReady = workbench.scenario.status === "ready";
  return (
    <section className={`ux-workbench-head ${isReady ? "ready" : ""}`}>
      <div className="ux-workbench-title">
        <span>{workbench.template.category} · {availability.label}</span>
        <h1>{workbench.scenario.name}</h1>
        <p>{isReady ? availability.description : workbench.scenario.description}</p>
      </div>
      <div className="ux-workbench-meta">
        <Meta label="Owner" value={workbench.scenario.owner} />
        <Meta label="Sources" value={`${workbench.dataSources.length} `} />
        <Meta label="Publish scope" value={workbench.settings.publicationMode} />
      </div>
      {!isReady && (
        <div className="ux-lifecycle">
          {workbench.lifecycle.map((stage, index) => (
            <div key={stage.key} className={index < 4 ? "done" : ""}>
              <i>{index + 1}</i>
              <b>{stage.label}</b>
              <span>{stage.description}</span>
            </div>
          ))}
        </div>
      )}
      <nav className="ux-tabs" aria-label="Scenario workbench">
        {workbench.tabs.map((item) => (
          <Link key={item.key} href={item.href} className={item.key === activeTab ? "active" : ""}>{item.label}</Link>
        ))}
      </nav>
    </section>
  );
}

function ReadyScenarioUsePage({ workbench }: { workbench: ScenarioWorkbench }) {
  const availability = scenarioAvailability(workbench.scenario);
  const primaryQuestion = workbench.scenario.recommendedQuestions[0] ?? workbench.template.demoWalkthrough.sampleQuestion;
  const primaryOutputs = workbench.outputs.slice(0, 3);
  const primarySources = workbench.dataSources.slice(0, 4);
  return (
    <div className="scenario-workspace">
      <section className="scenario-use-console">
        <div className="scenario-use-head">
          <div>
            <span>{availability.label}</span>
            <h2>This scenario is ready for real work</h2>
            <p>{workbench.scenario.description}</p>
          </div>
          <div className="scenario-use-status">
            <b>Files published</b>
            <span>{workbench.dataSources.length} sources ·  {workbench.outputs.length} deliverables</span>
          </div>
        </div>

        <form className="scenario-question-bar" action={`/app/scenarios/${workbench.scenario.id}/ask`}>
          <label htmlFor="ready-scenario-question">Ask this scenario or generate a deliverable</label>
          <div>
            <input id="ready-scenario-question" name="q" defaultValue={primaryQuestion} aria-label="Scenario question" />
            <button type="submit">Send</button>
          </div>
        </form>

        <div className="scenario-business-actions" aria-label="Business tasks you can run">
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
            <span>Scenario files</span>
            <h3>Files this scenario uses</h3>
          </div>
          <Link href={`/app/scenarios/${workbench.scenario.id}/data`}>View all files</Link>
        </div>
        <div className="scenario-source-table">
          {primarySources.map((source) => (
            <article key={source.id}>
              <div>
                <b>{source.title}</b>
                <span>{displaySourceName(source.fileName)}</span>
              </div>
              <em>{displaySourceType(source.sourceType)}</em>
              <strong>{source.status}</strong>
            </article>
          ))}
        </div>
        <div className="scenario-data-actions">
          <button type="button" onClick={async () => { const r = await fetch(`/api/platform/scenarios/${workbench.scenario.id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? "File update request submitted."); }}>Request file update</button>
          <button type="button" onClick={() => { window.location.href = "/app/create"; }}>Upload files again</button>
          <button type="button" onClick={async () => { const r = await fetch(`/api/platform/scenarios/${workbench.scenario.id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? "File deletion request submitted."); }}>Request file deletion</button>
        </div>
      </section>

      <section className="scenario-evidence-console">
        <div className="scenario-section-title">
          <div>
            <span>Evidence and deliverables</span>
            <h3>Which files produced recent results</h3>
          </div>
          <Link href={`/app/scenarios/${workbench.scenario.id}/outputs`}>View deliverables</Link>
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
          <span>Suggested follow-ups</span>
          <div className="scenario-suggestion-list">
            {workbench.scenario.recommendedQuestions.slice(0, 4).map((question) => (
              <Link key={question} href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(question)}`}>{question}</Link>
            ))}
          </div>
        </section>

        <section>
          <span>Scenario governance</span>
          <div className="scenario-governance-list">
            <div><b>Access scope</b><em>{workbench.settings.publicationMode}</em></div>
            <div><b>Answer policy</b><em>{workbench.settings.answerPolicy}</em></div>
            <div><b>File policy</b><em>{workbench.settings.reviewPolicy}</em></div>
          </div>
        </section>

        <section>
          <span>Recent deliverables</span>
          <div className="scenario-output-list">
            {primaryOutputs.map((output) => (
              <Link key={output.id} href={`/app/scenarios/${workbench.scenario.id}/outputs`}>
                <b>{output.title.replace(`${workbench.scenario.name} · `, "")}</b>
                <em>{output.updatedAt}</em>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ScenarioOverview({ workbench }: { workbench: ScenarioWorkbench }) {
  return (
    <div className="ux-workbench-grid">
      <section className="ux-panel">
        <PanelTitle title="Suggested questions" actionHref={`/app/scenarios/${workbench.scenario.id}/ask`} actionLabel="Ask a follow-up" />
        <div className="ux-action-list">
          {workbench.scenario.recommendedQuestions.map((question) => (
            <Link key={question} href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(question)}`} className="ux-action-row">
              <b>{question}</b>
              <span>Answer with citations using this scenario's files and rules.</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="ux-panel">
        <PanelTitle title="Scenario capabilities" actionHref={`/app/scenarios/${workbench.scenario.id}/outputs`} actionLabel="View deliverables" />
        <Pills items={workbench.scenario.readyActions} />
        <div className="ux-meta-stack">
          <Meta label="Retrieval policy" value={workbench.settings.retrievalPolicy} />
          <Meta label="Answer policy" value={workbench.settings.answerPolicy} />
        </div>
      </section>
    </div>
  );
}

function ScenarioDataTab({ dataSources }: { dataSources: ScenarioDataSource[] }) {
  return (
    <section className="ux-panel">
      <PanelTitle title="File management" actionHref="/app/create" actionLabel="Upload files again" />
      <div className="ux-data-request-bar">
        <button type="button" onClick={async () => { const id = window.location.pathname.split("/")[3]; const r = await fetch(`/api/platform/scenarios/${id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? "File update request submitted."); }}>Request file update</button>
        <button type="button" onClick={async () => { const id = window.location.pathname.split("/")[3]; const r = await fetch(`/api/platform/scenarios/${id}/data-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete" }) }); const d = await r.json().catch(() => ({})); window.alert(d.message ?? "File deletion request submitted."); }}>Request file deletion</button>
        <button type="button" onClick={() => { window.location.href = "/admin/pipelines"; }}>View admin ingest records</button>
      </div>
      <div className="ux-table">
        {dataSources.map((source) => (
          <article key={source.id}>
            <div>
              <b>{source.title}</b>
              <span>{displaySourceName(source.fileName)}</span>
            </div>
            <em>{displaySourceType(source.sourceType)}</em>
            <strong>{source.status}</strong>
            <small>{source.evidencePolicy}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenarioTasksTab({ workbench }: { workbench: ScenarioWorkbench }) {
  if (workbench.scenario.status === "ready") {
    return (
      <div className="ux-task-grid">
        {workbench.outputs.map((output) => (
          <article key={output.id} className="ux-task-card ready-task">
            <span>{output.status}</span>
            <h2>{output.type}</h2>
            <p>{output.summary}</p>
            <div className="ux-actions">
              <Link href={`/app/scenarios/${workbench.scenario.id}/outputs`}>Open deliverable</Link>
              <Link href={`/app/scenarios/${workbench.scenario.id}/ask?q=${encodeURIComponent(output.type)}`}>Generate more</Link>
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
            <h2>{isReady ? "Continue the work" : "Next steps in this scenario"}</h2>
            <p>{isReady ? "Keep asking, generate deliverables, and capture tasks inside this scenario." : "Finish validation, review, publishing, and deliverable generation inside this scenario."}</p>
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
          <input name="q" placeholder={isReady ? "Ask this scenario, or have it generate a business deliverable..." : "Keep validating answers, citations, and boundaries in this scenario..."} />
          <button type="submit">{isReady ? "Send" : "Validate"}</button>
        </form>
      </section>
      <aside className="ux-context-panel">
        <span>{isReady ? "Usage policy" : "Validation policy"}</span>
        <h2>Current policy</h2>
        <p>{workbench.settings.retrievalPolicy}</p>
        <p>{workbench.settings.answerPolicy}</p>
        <div className="ux-context-section">
          <h3>Scenario files</h3>
          {workbench.dataSources.map((source) => (
            <div key={source.id} className="ux-context-row">
              <b>{displaySourceName(source.fileName)}</b>
              <span>{source.status}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
    <section className="ux-chat-follow-grid" aria-label={isReady ? "What you can do next with this scenario" : "What you can do after validating this scenario"}>
      <article className="ux-follow-card">
        <span>Tasks</span>
        <h2>{workbench.tasks[0]?.title ?? `Processing ${workbench.scenario.name}`}</h2>
        <p>{workbench.tasks[0]?.userMessage ?? "You can keep validating and reviewing this scenario."}</p>
        <Link href={`/app/scenarios/${workbench.scenario.id}/tasks`}>View processing tasks</Link>
      </article>
      <article className="ux-follow-card">
        <span>File sources</span>
        <h2>{workbench.dataSources.length} files linked</h2>
        <p>{workbench.settings.retrievalPolicy}</p>
        <Link href={`/app/scenarios/${workbench.scenario.id}/data`}>Manage file sources</Link>
      </article>
      <article className="ux-follow-card">
        <span>Deliverables</span>
        <h2>{workbench.outputs[0]?.title ?? workbench.scenario.name}</h2>
        <p>{workbench.outputs[0]?.summary ?? "Keep generating, reviewing, and publishing scenario deliverables."}</p>
        <div className="ux-follow-pills">
          {workbench.outputs.slice(0, 3).map((output) => <small key={output.id}>{output.type}</small>)}
        </div>
      </article>
    </section>
    <section className="ux-chat-ops-board" aria-label={isReady ? "Processing path in use" : "Processing path for validation"}>
      <article>
        <span>Scenario pipeline</span>
        <h2>From files to answers</h2>
        <div className="ux-ops-list">
          {workbench.template.processingExplanation.map((step) => <p key={step}>{step}</p>)}
        </div>
      </article>
      <article>
        <span>{isReady ? "Usage rules" : "Publish checks"}</span>
        <h2>{isReady ? "How this scenario stays reliable" : "What to confirm before launch"}</h2>
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
  return (
    <div className="ux-output-grid">
      {outputs.map((output) => (
        <article key={output.id} className="ux-card">
          <span>{output.type}</span>
          <h2>{output.title}</h2>
          <p>{output.summary}</p>
          <small>{output.status} · {output.updatedAt}</small>
        </article>
      ))}
    </div>
  );
}

function ScenarioSettingsTab({ settings }: { settings: ScenarioSettings }) {
  return (
    <div className="ux-settings-grid">
      <SettingsBlock title="Publish scope" items={[settings.publicationMode, settings.reviewPolicy]} />
      <SettingsBlock title="Retrieval and answers" items={[settings.retrievalPolicy, settings.answerPolicy]} />
      <SettingsBlock title="Connected sources" items={settings.connectedSources} />
    </div>
  );
}

function TemplateViewToggle({ view, onChange }: { view: TemplateLibraryView; onChange: (view: TemplateLibraryView) => void }) {
  return (
    <div className="template-view-switch" aria-label="Switch template view">
      {templateViewOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === view ? "active" : ""}
          aria-label={`${option.label} view`}
          aria-pressed={option.id === view}
          title={`${option.label} view`}
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
  if (templates.length === 0) {
    return (
      <div className="template-empty-state">
        <b>No matching templates</b>
        <p>Try another keyword, or create your own scenario and upload files.</p>
        <Link href="/app/create?mode=blank">Create scenario</Link>
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
        <span>{lead.category} · {templateSurfaceLabel(lead)}</span>
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
            <span>{templateSurfaceLabel(template)}</span>
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
          <small>{templateSurfaceLabel(template)}</small>
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
  return (
    <div className="template-compare-wrap">
      <table className="template-compare-table">
        <thead>
          <tr>
            <th>Template</th>
            <th>Best for</th>
            <th>Files to prepare</th>
            <th>Output</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className={template.id === selectedTemplate.id ? "active" : ""} onClick={() => onSelect(template.id)}>
              <td>
                <button type="button" onClick={() => onSelect(template.id)}>
                  <b>{template.name}</b>
                  <span>{template.category} · {templateSurfaceLabel(template)}</span>
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
  const surface = buildScenarioProductSurface(template.id, { productForm: template.productForm });
  return (
    <article className={`template-card ${active ? "active" : ""}`}>
      <div className="template-card-main">
        <span>{template.category} · {surface.label}</span>
        <h2>{template.name}</h2>
        <p>{template.headline}</p>
        <Pills items={template.inputExamples.slice(0, 3)} />
      </div>
      <dl>
        <div><dt>Outputs</dt><dd>{template.outputCapabilities.slice(0, 2).join(", ")}</dd></div>
        <div><dt>Setup</dt><dd>{template.setupTime}</dd></div>
      </dl>
      <footer>
        {onSelect ? <button type="button" onClick={() => onSelect(template.id)}>Select</button> : null}
        <Link href={`/app/templates/${template.id}`}>View template</Link>
        <Link className="primary" href={`/app/create?template=${template.id}`}>Create</Link>
      </footer>
    </article>
  );
}

function templateSurfaceLabel(template: ScenarioTemplate) {
  return buildScenarioProductSurface(template.id, { productForm: template.productForm }).label;
}

function TemplateCatalogPreview({ template }: { template: ScenarioTemplate }) {
  return (
    <aside className="template-preview-panel" aria-label="Template details">
      <div className="template-preview-head">
        <span>{template.category}Template</span>
        <h2>{template.name}</h2>
        <p>{template.headline}</p>
      </div>
      <div className="template-preview-meta">
        <div><span>Setup time</span><b>{template.setupTime}</b></div>
        <div><span>Review requirement</span><b>{template.reviewRequirement}</b></div>
      </div>
      <section>
        <span>Business questions it fits</span>
        <div className="template-preview-pills">
          {template.bestFor.slice(0, 4).map((item) => <em key={item}>{item}</em>)}
        </div>
      </section>
      <section>
        <span>Suggested files</span>
        <div className="template-preview-pills">
          {template.inputExamples.slice(0, 4).map((item) => <em key={item}>{item}</em>)}
        </div>
      </section>
      <section>
        <span>What you get</span>
        <ul className="template-output-list">
          {template.outputCapabilities.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section className="template-preview-demo">
        <span>Sample scenario</span>
        <b>{template.demoWalkthrough.scenarioName}</b>
        <p>{template.demoWalkthrough.sampleQuestion}</p>
      </section>
      <footer>
        <Link href={`/app/templates/${template.id}`}>View full details</Link>
        <Link className="primary" href={`/app/create?template=${template.id}`}>Create with this template</Link>
      </footer>
    </aside>
  );
}

function TemplateNotFound() {
  return (
    <FrontstageShell active="/app/templates" title="Template not found">
      <section className="ux-page-head">
        <h1>We could not find this template</h1>
        <p>Go back to the template library and pick another official scenario.</p>
        <Link className="ux-primary-link" href="/app/templates">Back to templates</Link>
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
          <small>{scenario.owner} · {scenario.sourceCount} sources ·  {scenario.updatedAt}</small>
        </div>
      </Link>
      <span className="scenario-row-surface">{surface.label}</span>
      <span className={`home-scope-badge scope-${scenario.visibility}`}>{visibilityText(scenario.visibility)}</span>
      <span className={`scenario-row-status status-${scenario.status}`}>{availability.label}</span>
      <div className="scenario-row-actions">
        <Link href={`/app/scenarios/${scenario.id}`}>{scenario.status === "ready" ? surface.primaryAction.label : availability.nextAction}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>Data</Link>
      </div>
    </article>
  );
}

function ScenarioAssetInspector({ scenario }: { scenario: ScenarioInstance }) {
  const template = templateById(scenario.templateId) ?? customScenarioTemplate;
  const surface = buildScenarioProductSurface(template.id, { productForm: template.productForm });
  const availability = scenarioAvailability(scenario);
  const prompts = scenario.status === "ready" ? surface.quickPrompts : scenario.recommendedQuestions;
  return (
    <section>
      <span>{template.name} · {availability.label}</span>
      <h2>{scenario.name}</h2>
      <p>{scenario.description}</p>
      <div className="scenario-inspector-meta">
        <div><small>Workbench form</small><b>{surface.label}</b></div>
        <div><small>Publish scope</small><b>{visibilityText(scenario.visibility)}</b></div>
        <div><small>File sources</small><b>{scenario.sourceCount} </b></div>
      </div>
      <div className="scenario-inspector-actions">
        <Link className="primary" href={`/app/scenarios/${scenario.id}`}>{scenario.status === "ready" ? surface.primaryAction.label : availability.nextAction}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>Manage files</Link>
      </div>
      <div className="scenario-inspector-prompts">
        <b>{scenario.status === "ready" ? "Common actions" : "Available after processing"}</b>
        {prompts.slice(0, 4).map((prompt) => (
          <Link key={prompt} href={`/app/scenarios/${scenario.id}/ask?q=${encodeURIComponent(prompt)}`}>{prompt}</Link>
        ))}
      </div>
    </section>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioInstance }) {
  const template = templateById(scenario.templateId) ?? officialTemplates[0];
  const availability = scenarioAvailability(scenario);
  return (
    <article className="ux-card scenario">
      <span>{template.name} · {availability.label}</span>
      <h2>{scenario.name}</h2>
      <p>{availability.description}</p>
      <div className="ux-card-meta">
        <small>{scenario.owner}</small>
        <small>{scenario.sourceCount} sources</small>
        <small>{scenario.updatedAt}</small>
      </div>
      <footer>
        <Link href={`/app/scenarios/${scenario.id}`}>{scenario.status === "ready" ? "Open scenario" : availability.nextAction}</Link>
        <Link href={`/app/scenarios/${scenario.id}/data`}>View files</Link>
      </footer>
    </article>
  );
}

function ScenarioCompactCard({ scenario }: { scenario: ScenarioInstance }) {
  const availability = scenarioAvailability(scenario);
  return (
    <Link className="ux-compact-row home-scenario-row" href={`/app/scenarios/${scenario.id}`} aria-label={`Open scenario: ${scenario.name}`}>
      <div className="home-row-copy">
        <div className="home-row-head">
          <b>{scenario.name}</b>
          <span className={`home-scope-badge scope-${scenario.visibility}`}>{visibilityText(scenario.visibility)}</span>
        </div>
        <p>{scenario.description}</p>
      </div>
      <em className="home-row-status">{availability.label}</em>
    </Link>
  );
}

function TaskCard({ task }: { task: ProcessingTask }) {
  return (
    <article className="ux-task-card">
      <header className="task-card-head">
        <span>{taskStatusGroup(task)}</span>
        <small>{task.kind} · {ragModeLabel(task.ragMode)}</small>
      </header>
      <h2>{task.title}</h2>
      <p>{task.userMessage}</p>
      <div className="task-meta-grid">
        <div><span>Waiting on</span><b>{task.waitingFor}</b></div>
        <div><span>Publish scope</span><b>{visibilityText(task.visibility)}</b></div>
        <div><span>Submitted by</span><b>{task.owner}</b></div>
        <div><span>Updated</span><b>{task.updatedAt}</b></div>
      </div>
      <div className="task-file-row">
        {task.files.slice(0, 3).map((fileName) => <span key={fileName}>{displaySourceName(fileName)}</span>)}
        {task.files.length > 3 && <span>+{task.files.length - 3}</span>}
      </div>
      <div className="ux-progress"><i style={{ width: `${task.progress}%` }} /></div>
      <footer className="task-card-actions">
        <Link href={`/app/scenarios/${task.scenarioId}/tasks`}>View task</Link>
        <Link href={`/app/scenarios/${task.scenarioId}/data`}>{task.status === "ready" ? "Manage files" : "Add files"}</Link>
      </footer>
    </article>
  );
}

function TaskMini({ task }: { task: ProcessingTask }) {
  return (
    <Link className="ux-task-mini-row home-task-row" href={`/app/scenarios/${task.scenarioId}/tasks`} aria-label={`View task: ${task.title}`}>
      <div className="home-row-copy">
        <div className="home-row-head">
          <b>{task.title}</b>
          <span className={`home-scope-badge scope-${task.visibility}`}>{visibilityText(task.visibility)}</span>
        </div>
        <p>{task.currentStep} · {task.progress}%</p>
        <span className="home-task-progress" aria-hidden="true"><i style={{ width: `${task.progress}%` }} /></span>
      </div>
    </Link>
  );
}

function KnowledgeAssetRow({ object, active, onSelect }: { object: KnowledgeSpaceObject; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`knowledge-asset-row ${active ? "active" : ""}`} onClick={onSelect} role="listitem">
      <span className={`knowledge-type-dot type-${object.mode}`} />
      <div className="knowledge-row-title">
        <b>{object.title}</b>
        <span>{truncateText(object.summary, 74)}</span>
      </div>
      <div className="knowledge-row-meta">
        <strong>{knowledgeModeLabel(object.mode)}</strong>
        <span>{object.sourceLabel}</span>
      </div>
      <div className="knowledge-row-scope">
        <strong>{knowledgeVisibilityLabel(object.visibility)}</strong>
        <span>{object.owner}</span>
      </div>
      <small>{object.updatedAt}</small>
    </button>
  );
}

function KnowledgeAssetInspector({ object }: { object: KnowledgeSpaceObject | null }) {
  if (!object) {
    return (
      <aside className="knowledge-asset-inspector">
        <PanelHeading eyebrow="Asset details" title="Select a knowledge asset" />
        <p>Once files are submitted and ingest finishes, sources, permission boundaries, and available governance actions appear here.</p>
        <Link href="/app/templates">From a template</Link>
      </aside>
    );
  }

  return (
    <aside className="knowledge-asset-inspector">
      <PanelHeading eyebrow={knowledgeModeLabel(object.mode)} title={object.title} />
      <p>{object.summary}</p>
      <dl className="knowledge-inspector-meta">
        <div><dt>Source</dt><dd>{object.sourceLabel}</dd></div>
        <div><dt>Owner</dt><dd>{object.owner}</dd></div>
        <div><dt>Access</dt><dd>{knowledgeVisibilityLabel(object.visibility)}</dd></div>
        <div><dt>Updated</dt><dd>{object.updatedAt}</dd></div>
      </dl>
      <div className="knowledge-inspector-note">
        <b>Permission impact</b>
        <span>{knowledgeAssetRiskNote(object)}</span>
      </div>
      <div className="knowledge-inspector-actions">
        {knowledgeGovernanceActions(object).map((action) => (
          action === "Open scenario"
            ? <Link key={action} href={`/app/scenarios/${object.linkedScenarioId}`}>{action}</Link>
            : <button key={action} type="button">{action}</button>
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
  return (
    <div className="settings-row-list">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="settings-row">
          <div>
            <b>{row.label}</b>
            <span>{row.value}</span>
          </div>
          <em className={`setting-status status-${row.status}`}>{workspaceSettingStatusLabel(row.status)}</em>
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
  if (status === "ready") return "Available";
  if (status === "processing") return "Processing";
  if (status === "waiting_review") return "Pending review";
  if (status === "submitted") return "Submitted";
  if (status === "failed") return "Failed";
  return "Draft";
}

function countScenariosByStatus(scenarios: ScenarioInstance[], label: string) {
  if (label === "All") return scenarios.length;
  if (label === "Processing") return scenarios.filter((scenario) => scenario.status !== "ready" && scenario.status !== "failed").length;
  return scenarios.filter((scenario) => statusLabel(scenario.status) === label).length;
}

function truncateText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function scenarioTabLabel(tab: ScenarioTab) {
  const labels: Record<ScenarioTab, string> = {
    overview: "Overview",
    data: "Data",
    tasks: "Tasks",
    ask: "Q&A",
    outputs: "Outputs",
    settings: "Settings"
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
  if (value === "private") return "Private";
  if (value === "team") return "Team";
  return "Company";
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
  if (engine === "Naive RAG") return "Document evidence";
  if (engine === "GraphRAG") return "Knowledge graph";
  return "Knowledge wiki";
}

// RagEngine values stay as stored fixture literals (the admin console dispatches on them); render English labels here.
function ragModeLabel(mode: ProcessingTask["ragMode"]) {
  if (mode === "知识百科") return "Knowledge wiki";
  if (mode === "文档证据") return "Document evidence";
  if (mode === "关系图谱") return "Knowledge graph";
  return "Mixed processing";
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
  if (engine === "Naive RAG") return "Source excerpt";
  if (engine === "GraphRAG") return "Relationship trail";
  return "Knowledge entry";
}

function scenarioEvidenceHint(engine: LiveScenarioAnswer["engine"]) {
  if (engine === "Naive RAG") return "From document chunks and vector retrieval; use it to check policy, contract, spreadsheet, and process text.";
  if (engine === "GraphRAG") return "From entities, events, and relationship paths; use it to read connections between customers, needs, risks, and evidence.";
  return "From settled pages and fact cards; use it to reuse stable conclusions and definitions.";
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
  if (type === "Document evidence") return "Traceable excerpts from PDF, Word, Markdown, and spreadsheets; best for checking policy, contract, and process evidence.";
  if (type === "Knowledge graph") return "Entities, events, and relationship paths; best for mapping links between customers, people, suppliers, and risk.";
  return "Settled pages, handbooks, and fact cards; best for reusing stable conclusions quickly.";
}

function sourceBadgeForCitation(citation: GlobalChatCitation) {
  if (citation.knowledgeType === "Document evidence") return "Source excerpt";
  if (citation.knowledgeType === "Knowledge graph") return "Relationship trail";
  return "Knowledge entry";
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
  if (scope === "private") return "Personal files";
  if (scope === "team") return "Team knowledge";
  return "Company-wide";
}

function scopeDescription(scope: GlobalChatScope) {
  if (scope === "private") return "Searches only files you submitted and that were published; nothing enters team or company retrieval.";
  if (scope === "team") return "Searches knowledge your teams can access, plus your own personal files.";
  return "Searches company-visible knowledge plus team and personal files your account can access.";
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
  if (normalized.includes("csv") || normalized.includes("xlsx")) return "Spreadsheet";
  if (normalized.includes("json")) return "Relationship data";
  if (normalized.includes("md") || normalized.includes("txt")) return "Text";
  return "Document";
}
