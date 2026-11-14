"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "../../lib/i18n/language-context";

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
    prompt: "siteDemo.guidePersonalPrompt",
    solution: "siteDemo.guidePersonalSolution",
    posture: "siteDemo.guidePostureRead",
    color: "var(--c-personal)",
    soft: "var(--c-personal-soft)",
    bright: "var(--accent-bright)",
    icon: IconRead,
    why: "siteDemo.guidePersonalWhy",
    result: "siteDemo.guidePersonalResult"
  },
  {
    key: "relation",
    prompt: "siteDemo.guideRelationPrompt",
    solution: "siteDemo.guideRelationSolution",
    posture: "siteDemo.guidePostureRelation",
    color: "var(--c-relation)",
    soft: "var(--c-relation-soft)",
    bright: "var(--c-relation-bright)",
    icon: IconRelation,
    why: "siteDemo.guideRelationWhy",
    result: "siteDemo.guideRelationResult"
  },
  {
    key: "document",
    prompt: "siteDemo.guideDocumentPrompt",
    solution: "siteDemo.guideDocumentSolution",
    posture: "siteDemo.guidePostureSearch",
    color: "var(--c-document)",
    soft: "var(--c-document-soft)",
    bright: "var(--c-document-bright)",
    icon: IconSearch,
    why: "siteDemo.guideDocumentWhy",
    result: "siteDemo.guideDocumentResult"
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
  const { t } = useI18n();
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
              <span className="gc-prompt">{t(r.prompt)}</span>
              <span className="gc-sol">{t(r.solution)}</span>
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
          placeholder={t("siteDemo.guidePlaceholder")}
          aria-label={t("siteDemo.guideDescribeAria")}
        />
        {matchedFromText && (
          <span className="guide-flag matched">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {t("siteDemo.guideMatched")}
          </span>
        )}
        {noMatch && <span className="guide-flag warn">{t("siteDemo.guideTryDifferent")}</span>}
      </div>

      {noMatch && (
        <div className="guide-hint">
          <span>{t("siteDemo.guideNoMatchHint")}</span>
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
              <span className="gr-badge">{t("siteDemo.guideRecommended")}</span>
              <h3>
                {t(current.solution)}
                <span className="gr-posture">{t("siteDemo.guideMode", { posture: t(current.posture) })}</span>
              </h3>
            </div>
          </div>
          <div className="gr-grid">
            <div>
              <span className="gr-label">{t("siteDemo.guideWhyThis")}</span>
              <p>{t(current.why)}</p>
            </div>
            <div>
              <span className="gr-label">{t("siteDemo.guideWhatYouGet")}</span>
              <p>{t(current.result)}</p>
            </div>
          </div>
          <div className="gr-actions">
            <Link href="/admin/new" className="btn btn-primary">
              {t("siteDemo.guideStartBuilding")}
            </Link>
            <Link href="/app" className="btn btn-ghost">
              {t("siteDemo.guideTryWorkspace")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
