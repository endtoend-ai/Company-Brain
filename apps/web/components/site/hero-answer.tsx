"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n/language-context";

type Demo = {
  q: string;
  lib: string;
  libColor: string;
  answer: string;
  cites: { title: string; meta: string }[];
};

const demos: Demo[] = [
  {
    q: "Who's working our biggest West Coast accounts this quarter?",
    lib: "Relationship knowledge base",
    libColor: "var(--c-relation)",
    answer:
      "Six priority accounts are in play in the West region this quarter. Acme Health is owned by Maya Chen and linked to Project Atlas plus two contracts in negotiation; Summit Manufacturing is owned by Jordan Lee and is in renewal talks.",
    cites: [
      { title: "Account map: Maya Chen — owns — Acme Health", meta: "Relationship chain · open graph view" },
      { title: "Call notes Q1 FY26.docx", meta: "Paragraph 3 · West Coast" }
    ]
  },
  {
    q: "Can I expense rideshare on a business trip, and what's the cap?",
    lib: "Document library",
    libColor: "var(--c-document)",
    answer:
      "Yes. Under the current Travel & Expense Policy v3, local ground transport is reimbursed with receipts up to $80 per one-way trip; anything above needs manager approval.",
    cites: [
      { title: "Travel & Expense Policy v3, Section 4", meta: "Ground transport · source paragraph highlighted" },
      { title: "Expense report how-to.pdf", meta: "Page 2 · approval workflow" }
    ]
  },
  {
    q: "How do we pick chunk size for vector retrieval?",
    lib: "Personal knowledge base",
    libColor: "var(--c-personal)",
    answer:
      "The team's notes give three rules: split on semantic boundaries, keep each chunk independently understandable, then backtest with real questions. You can follow up on that entry.",
    cites: [
      { title: "Knowledge entry: tuning retrieval quality", meta: "Browsable · traces to 4 source files" }
    ]
  }
];

export function HeroAnswer() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"ask" | "think" | "answer">("ask");

  useEffect(() => {
    let t1: any, t2: any, t3: any;
    setPhase("ask");
    t1 = setTimeout(() => setPhase("think"), 1100);
    t2 = setTimeout(() => setPhase("answer"), 2100);
    t3 = setTimeout(() => setI((v) => (v + 1) % demos.length), 6200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [i]);

  const d = demos[i];

  return (
    <div className="hero-card" role="img" aria-label={t("siteDemo.heroAria")}>
      <div className="hero-card-bar">
        <span className="hero-card-dot" />
        <span className="hero-card-title mono">{t("siteDemo.heroTitle")}</span>
        <span className="hero-card-live">
          <span className="live-dot" /> {t("siteDemo.heroLive")}
        </span>
      </div>

      <div className="hero-card-body">
        <div className="hero-q">
          <span className="hero-q-avatar">Q</span>
          <p key={"q" + i} className="hero-q-text">
            {d.q}
          </p>
        </div>

        {phase === "think" && (
          <div className="hero-think">
            <span className="tdot" />
            <span className="tdot" />
            <span className="tdot" />
            <em>{t("siteDemo.heroThinking")}</em>
          </div>
        )}

        {phase === "answer" && (
          <div className="hero-a" key={"a" + i}>
            <div className="hero-a-head">
              <span className="hero-a-avatar">A</span>
              <span
                className="hero-a-lib"
                style={{ color: d.libColor, borderColor: d.libColor }}
              >
                {t("siteDemo.heroMatched", { library: d.lib })}
              </span>
            </div>
            <p className="hero-a-text">{d.answer}</p>
            <div className="hero-cites">
              <span className="hero-cites-label">{d.cites.length} {d.cites.length === 1 ? t("siteDemo.heroCitation") : t("siteDemo.heroCitations")}</span>
              {d.cites.map((c, k) => (
                <div className="hero-cite" key={k}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <div>
                    <strong>{c.title}</strong>
                    <span>{c.meta}</span>
                  </div>
                  <span className="hero-cite-open">{t("siteDemo.heroOpen")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hero-card-foot">
        {demos.map((_, k) => (
          <button
            key={k}
            aria-label={t("siteDemo.heroExample", { index: k + 1 })}
            className={k === i ? "hd active" : "hd"}
            onClick={() => setI(k)}
          />
        ))}
      </div>
    </div>
  );
}
