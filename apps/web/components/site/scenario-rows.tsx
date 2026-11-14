"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n/language-context";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

/* ---------- demo: 文档资料库 (搜) ---------- */
function DocDemo() {
  const { t } = useI18n();
  const qs = [
    {
      q: "What's the hotel limit for travel?",
      a1: "In San Francisco, lodging is capped at ",
      hi: "$280 / night",
      a2: ", meals run $75 a day, and receipts are due within 30 days.",
      cite: "Northwind Labs Travel & Expense Policy v3, Section 4 · Paragraph 2"
    },
    {
      q: "How does PTO work in the first year?",
      a1: "You accrue ",
      hi: "15 days",
      a2: " a year, prorated by months worked, and unused days carry over until March 31.",
      cite: "Time Off & Leave Policy, Section 7"
    }
  ];
  const [i, setI] = useState(0);
  const { ref, seen } = useInView<HTMLDivElement>();
  useEffect(() => {
    if (!seen) return;
    const t = setInterval(() => setI((v) => (v + 1) % qs.length), 4200);
    return () => clearInterval(t);
  }, [seen]);
  const d = qs[i];
  return (
    <div className="sd sd-doc" ref={ref}>
      <div className="sd-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span key={"q" + i} className="sd-typed">{d.q}</span>
      </div>
      <div className="sd-ans" key={"a" + i}>
        <p>
          {d.a1}
          <mark>{d.hi}</mark>
          {d.a2}
        </p>
        <div className="sd-cite">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          {d.cite}
          <span className="sd-open">{t("siteDemo.docOpenSource")}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- demo: 个人知识库 (读) ---------- */
function ReadDemo() {
  const { t } = useI18n();
  const { ref, seen } = useInView<HTMLDivElement>();
  const lines = [
    t("siteDemo.docPoint1"),
    t("siteDemo.docPoint2"),
    t("siteDemo.docPoint3")
  ];
  return (
    <div className={`sd sd-read ${seen ? "in" : ""}`} ref={ref}>
      <div className="sd-doc-head">
        <span className="sd-kind">{t("siteDemo.docKind")}</span>
        <span className="sd-src">{t("siteDemo.docTraces")}</span>
      </div>
      <h4>{t("siteDemo.docTitle")}</h4>
      <p className="sd-lead">{t("siteDemo.docLead")}</p>
      <ul className="sd-points">
        {lines.map((l, k) => (
          <li key={k} style={{ transitionDelay: `${k * 220 + 200}ms` }}>
            {l}
          </li>
        ))}
      </ul>
      <div className="sd-followup">
        <span>{t("siteDemo.docFollowup")}</span>
        <i className="sd-caret" />
      </div>
    </div>
  );
}

/* ---------- demo: 关系知识库 (探) ---------- */
const REL_EDGES = [
  { d: "M170,100 Q104,62 58,46", label: "owns", lx: 104, ly: 56 },
  { d: "M170,100 Q104,142 62,154", label: "linked to", lx: 104, ly: 142 },
  { d: "M170,100 Q238,62 284,52", label: "in talks", lx: 226, ly: 58 },
  { d: "M170,100 Q244,130 290,140", label: "renews", lx: 238, ly: 136 },
  { d: "M170,100 Q170,140 170,178", label: "part of", lx: 200, ly: 148 }
];
const REL_NODES = [
  { x: 58, y: 46, r: 21, t: ["Maya", "Chen"], d: "0.18s" },
  { x: 62, y: 154, r: 21, t: ["Project", "Atlas"], d: "0.30s" },
  { x: 284, y: 52, r: 22, t: ["Deals", "×2"], d: "0.42s" },
  { x: 290, y: 140, r: 21, t: ["Jordan", "Lee"], d: "0.54s" },
  { x: 170, y: 178, r: 22, t: ["Life", "sciences"], d: "0.66s" }
];

function RelationDemo() {
  const { t } = useI18n();
  const { ref, seen } = useInView<HTMLDivElement>();
  return (
    <div className={`sd sd-rel ${seen ? "in" : ""}`} ref={ref}>
      <div className="sd-rel-head">
        <span className="sd-kind">{t("siteDemo.graphKind")}</span>
        <span className="sd-src">{t("siteDemo.graphTraces")}</span>
      </div>
      <svg viewBox="0 0 340 208" className="sd-graph" aria-hidden>
        <defs>
          <radialGradient id="relCore" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="var(--rc-bright)" />
            <stop offset="100%" stopColor="var(--rc)" />
          </radialGradient>
          <radialGradient id="relNode" cx="40%" cy="32%" r="80%">
            <stop offset="0%" stopColor="var(--surface-raise)" />
            <stop offset="100%" stopColor="var(--rcs)" />
          </radialGradient>
          <filter id="relGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base edges */}
        <g className="g-edge" fill="none">
          {REL_EDGES.map((e, i) => (
            <path key={i} d={e.d} />
          ))}
        </g>
        {/* flowing pulses */}
        <g className="g-flow" fill="none" filter="url(#relGlow)">
          {REL_EDGES.map((e, i) => (
            <path key={i} d={e.d} style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </g>
        {/* labels */}
        <g className="g-label" fontSize="9.5">
          {REL_EDGES.map((e, i) => (
            <text key={i} x={e.lx} y={e.ly}>
              {e.label}
            </text>
          ))}
        </g>
        {/* satellite nodes */}
        <g className="g-nodes">
          {REL_NODES.map((n, i) => (
            <g key={i} className="g-node" style={{ ["--nd" as any]: n.d }}>
              <circle cx={n.x} cy={n.y} r={n.r} />
              {n.t.length === 1 ? (
                <text x={n.x} y={n.y + 3.4}>{n.t[0]}</text>
              ) : (
                <>
                  <text x={n.x} y={n.y - 2}>{n.t[0]}</text>
                  <text x={n.x} y={n.y + 9}>{n.t[1]}</text>
                </>
              )}
            </g>
          ))}
          <g className="g-node g-core">
            <circle className="g-core-halo" cx="170" cy="100" r="40" />
            <circle cx="170" cy="100" r="32" />
            <text x="170" y="97">Acme</text>
            <text x="170" y="110">Health</text>
          </g>
        </g>
      </svg>
      <p className="sd-rel-ans">
        <strong>{t("siteDemo.graphAnswerSubject")}</strong> {t("siteDemo.graphAnswerRest")}
      </p>
    </div>
  );
}

const rows = [
  {
    key: "document",
    badge: "siteDemo.rowDocumentBadge",
    color: "var(--c-document)",
    soft: "var(--c-document-soft)",
    title: "siteDemo.rowDocumentTitle",
    desc: "siteDemo.rowDocumentDesc",
    demo: <DocDemo />
  },
  {
    key: "personal",
    badge: "siteDemo.rowPersonalBadge",
    color: "var(--c-personal)",
    soft: "var(--c-personal-soft)",
    title: "siteDemo.rowPersonalTitle",
    desc: "siteDemo.rowPersonalDesc",
    demo: <ReadDemo />
  },
  {
    key: "relation",
    badge: "siteDemo.rowRelationBadge",
    color: "var(--c-relation)",
    soft: "var(--c-relation-soft)",
    bright: "var(--c-relation-bright)",
    title: "siteDemo.rowRelationTitle",
    desc: "siteDemo.rowRelationDesc",
    demo: <RelationDemo />
  }
];

export function ScenarioRows() {
  const { t } = useI18n();
  return (
    <div className="scn-rows">
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={`scn-row ${i % 2 === 1 ? "rev" : ""}`}
          style={{
            ["--rc" as any]: r.color,
            ["--rcs" as any]: r.soft,
            ["--rc-bright" as any]: (r as any).bright ?? r.color
          }}
        >
          <div className="scn-row-text">
            <span className="scn-badge">{t(r.badge)}</span>
            <h3 className="display">{t(r.title)}</h3>
            <p>{t(r.desc)}</p>
          </div>
          <div className="scn-row-demo">{r.demo}</div>
        </div>
      ))}
    </div>
  );
}
