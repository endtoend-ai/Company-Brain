"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Rec = {
  key: string;
  prompt: string;
  solution: string;
  posture: string;
  color: string;
  soft: string;
  bright: string;
  icon: React.ReactNode;
  why: string;
  result: string;
};

const IconRead = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H2z" />
    <path d="M22 4.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H22z" />
  </svg>
);
const IconRelation = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="18" cy="7" r="2.4" />
    <circle cx="12" cy="18" r="2.4" />
    <path d="M7.7 7.6 10.5 16M16.6 8.7 13.4 16M8.2 6.4h7.6" />
  </svg>
);
const IconSearch = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const recs: Rec[] = [
  {
    key: "personal",
    prompt: "Settle team experience into knowledge you can trust on demand",
    solution: "Personal knowledge base",
    posture: "Read",
    color: "var(--c-personal)",
    soft: "var(--c-personal-soft)",
    bright: "var(--accent-bright)",
    icon: IconRead,
    why: "Experience, research, and writing fit reading best—the system reads a pile of files and turns it into one browsable, question-ready, citable entry instead of retrieving from scratch every time.",
    result: "Employees browse settled knowledge like an encyclopedia and ask follow-ups on any entry, each tracing back to its source files."
  },
  {
    key: "relation",
    prompt: "Map how customers, projects, and teams relate, and build profiles",
    solution: "Relationship knowledge base",
    posture: "Ask + Explore",
    color: "var(--c-relation)",
    soft: "var(--c-relation-soft)",
    bright: "var(--c-relation-bright)",
    icon: IconRelation,
    why: "For account profiles, due diligence, and vertical research, the value is in who relates to whom and why. The system finds the key entities across files and their links, then answers with the relationship chain.",
    result: "One question returns a relational answer with the chain visible inside it; expand into the graph view when you need to explore further."
  },
  {
    key: "document",
    prompt: "Turn policies, contracts, and reports into searchable evidence",
    solution: "Document library",
    posture: "Search",
    color: "var(--c-document)",
    soft: "var(--c-document-soft)",
    bright: "var(--c-document-bright)",
    icon: IconSearch,
    why: "What formal documents are for is evidence with a source. The system searches hundreds of documents and highlights the exact paragraph that supports the answer.",
    result: "Answer, plus the exact source paragraph and one click to the original, so every conclusion holds up and can be checked."
  }
];

const keywords: { match: string[]; key: string }[] = [
  {
    match: ["customer", "account", "profile", "sales", "relationship", "due diligence", "organization", "project", "supplier", "vendor", "network", "graph", "channel", "partner", "who works", "investment", "competitor", "pipeline"],
    key: "relation"
  },
  {
    match: ["policy", "contract", "report", "expense", "process", "procedure", "document", "spreadsheet", "compliance", "handbook", "clause", "legal", "invoice", "standard", "sop", "search", "evidence", "source", "section"],
    key: "document"
  },
  {
    match: ["experience", "notes", "research", "writing", "encyclopedia", "wiki", "summary", "learn", "tutorial", "practice", "method", "retro", "training", "new hire", "onboarding", "knowledge", "ask"],
    key: "personal"
  }
];

const hintExamples = [
  { text: "I want account profiles for my sales team", key: "relation" },
  { text: "How do I look up the expense limits", key: "document" },
  { text: "Capture what the team learned on projects", key: "personal" }
];

export function PainGuide() {
  const [active, setActive] = useState<string>("personal");
  const [typed, setTyped] = useState("");

  const matchedFromText = useMemo(() => {
    if (!typed.trim()) return null;
    const t = typed.toLowerCase();
    for (const k of keywords) {
      if (k.match.some((m) => t.includes(m.toLowerCase()))) return k.key;
    }
    return null;
  }, [typed]);

  const noMatch = typed.trim().length > 0 && !matchedFromText;
  const currentKey = matchedFromText ?? active;
  const current = recs.find((r) => r.key === currentKey)!;

  return (
    <div className="guide">
      <div className="guide-choices">
        {recs.map((r) => {
          const on = currentKey === r.key;
          return (
            <button
              key={r.key}
              className={`gc ${on ? "on" : ""}`}
              style={{ ["--gc" as any]: r.color, ["--gcs" as any]: r.soft }}
              onClick={() => {
                setActive(r.key);
                setTyped("");
              }}
            >
              <span className="gc-icon">{r.icon}</span>
              <span className="gc-prompt">{r.prompt}</span>
              <span className="gc-sol">{r.solution}</span>
              <span className="gc-check" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <div className={`guide-or ${noMatch ? "nomatch" : ""}`}>
        <svg className="guide-or-ic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Or describe it yourself, e.g. I want account profiles for my sales team"
          aria-label="Describe your scenario"
        />
        {matchedFromText && (
          <span className="guide-flag matched">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Matched for you
          </span>
        )}
        {noMatch && <span className="guide-flag warn">Try different words ↓</span>}
      </div>

      {noMatch && (
        <div className="guide-hint">
          <span>Couldn't place that. Try describing it like this:</span>
          {hintExamples.map((h) => (
            <button key={h.text} onClick={() => setTyped(h.text)}>
              {h.text}
            </button>
          ))}
        </div>
      )}

      <div
        className="gr"
        key={currentKey + String(matchedFromText)}
        style={{
          ["--gc" as any]: current.color,
          ["--gcs" as any]: current.soft,
          ["--gcb" as any]: current.bright
        }}
      >
        <div className="gr-rail" />
        <div className="gr-main">
          <div className="gr-head">
            <span className="gr-icon">{current.icon}</span>
            <div className="gr-head-text">
              <span className="gr-badge">Recommended</span>
              <h3>
                {current.solution}
                <span className="gr-posture">Mode · {current.posture}</span>
              </h3>
            </div>
          </div>
          <div className="gr-grid">
            <div>
              <span className="gr-label">Why this one</span>
              <p>{current.why}</p>
            </div>
            <div>
              <span className="gr-label">What you get</span>
              <p>{current.result}</p>
            </div>
          </div>
          <div className="gr-actions">
            <Link href="/admin/new" className="btn btn-primary">
              Start building this knowledge base
            </Link>
            <Link href="/app" className="btn btn-ghost">
              Try the Q&amp;A in the workspace first
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
