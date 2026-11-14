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
    q: "siteDemo.heroDemo.westCoast.question",
    lib: "siteDemo.heroDemo.westCoast.library",
    libColor: "var(--c-relation)",
    answer: "siteDemo.heroDemo.westCoast.answer",
    cites: [
      { title: "siteDemo.heroDemo.westCoast.accountCitation", meta: "siteDemo.heroDemo.westCoast.accountCitationMeta" },
      { title: "siteDemo.heroDemo.westCoast.callCitation", meta: "siteDemo.heroDemo.westCoast.callCitationMeta" }
    ]
  },
  {
    q: "siteDemo.heroDemo.expense.question",
    lib: "siteDemo.heroDemo.expense.library",
    libColor: "var(--c-document)",
    answer: "siteDemo.heroDemo.expense.answer",
    cites: [
      { title: "siteDemo.heroDemo.expense.policyCitation", meta: "siteDemo.heroDemo.expense.policyCitationMeta" },
      { title: "siteDemo.heroDemo.expense.reportCitation", meta: "siteDemo.heroDemo.expense.reportCitationMeta" }
    ]
  },
  {
    q: "siteDemo.heroDemo.chunks.question",
    lib: "siteDemo.heroDemo.chunks.library",
    libColor: "var(--c-personal)",
    answer: "siteDemo.heroDemo.chunks.answer",
    cites: [
      { title: "siteDemo.heroDemo.chunks.notesCitation", meta: "siteDemo.heroDemo.chunks.notesCitationMeta" }
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
            {t(d.q)}
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
                {t("siteDemo.heroMatched", { library: t(d.lib) })}
              </span>
            </div>
            <p className="hero-a-text">{t(d.answer)}</p>
            <div className="hero-cites">
              <span className="hero-cites-label">{d.cites.length} {d.cites.length === 1 ? t("siteDemo.heroCitation") : t("siteDemo.heroCitations")}</span>
              {d.cites.map((c, k) => (
                <div className="hero-cite" key={k}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <div>
                    <strong>{t(c.title)}</strong>
                    <span>{t(c.meta)}</span>
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
