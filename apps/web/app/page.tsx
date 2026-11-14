"use client";

import Link from "next/link";
import { SiteHeader } from "../components/site/site-header";
import { SiteFooter } from "../components/site/site-footer";
import { HeroAnswer } from "../components/site/hero-answer";
import { PainGuide } from "../components/site/pain-guide";
import { ScenarioRows } from "../components/site/scenario-rows";
import { Reveal } from "../components/site/reveal";
import { useI18n } from "../lib/i18n/language-context";

const flow = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }] as const;
const principles = ["01", "02", "03"] as const;

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <SiteHeader />

      {/* HERO */}
      <section className="hero">
        <div className="hero-glow hero-glow-1" aria-hidden />
        <div className="hero-glow hero-glow-2" aria-hidden />
        <div className="wrap wrap-wide hero-grid">
          <div className="hero-left">
            <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
              {t("site.heroEyebrow")}
            </span>
            <h1 className="display hero-title rise" style={{ animationDelay: "80ms" }}>
              {t("site.heroTitleLead")}
              <br />
              <span className="hero-accent">{t("site.heroTitleAccent")}</span>
            </h1>
            <p className="hero-sub rise" style={{ animationDelay: "180ms" }}>
              {t("site.heroSubLead")}
              <strong>{t("site.heroSubStrong")}</strong>
            </p>
            <div className="hero-cta rise" style={{ animationDelay: "280ms" }}>
              <a href="#guide" className="btn btn-primary btn-lg">
                {t("site.heroCtaFind")}
              </a>
              <Link href="/app" className="btn btn-ghost btn-lg">
                {t("site.heroCtaWorkspace")}
              </Link>
            </div>
            <div className="hero-trust rise" style={{ animationDelay: "380ms" }}>
              <div>
                <strong>{t("site.trustKbTypesValue")}</strong>
                <span>
                  {t("site.trustKbTypesLine1")}
                  <br />
                  {t("site.trustKbTypesLine2")}
                </span>
              </div>
              <div className="hero-trust-sep" />
              <div>
                <strong>{t("site.trustAskValue")}</strong>
                <span>
                  {t("site.trustAskLine1")}
                  <br />
                  {t("site.trustAskLine2")}
                </span>
              </div>
              <div className="hero-trust-sep" />
              <div>
                <strong>{t("site.trustSourcesValue")}</strong>
                <span>
                  {t("site.trustSourcesLine1")}
                  <br />
                  {t("site.trustSourcesLine2")}
                </span>
              </div>
            </div>
          </div>
          <div className="hero-right rise" style={{ animationDelay: "320ms" }}>
            <HeroAnswer />
          </div>
        </div>
      </section>

      {/* SCENARIOS */}
      <section className="section section-alt" id="scenarios">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">{t("site.scenariosEyebrow")}</span>
            <h2 className="display section-title">{t("site.scenariosTitle")}</h2>
            <p className="section-lead">
              {t("site.scenariosLead")}
            </p>
          </Reveal>
          <ScenarioRows />
        </div>
      </section>

      {/* PAIN GUIDE */}
      <section className="section" id="guide">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">{t("site.guideEyebrow")}</span>
            <h2 className="display section-title">{t("site.guideTitle")}</h2>
            <p className="section-lead">
              {t("site.guideLead")}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <PainGuide />
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS — timeline */}
      <section className="section section-alt">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">{t("siteFlow.eyebrow")}</span>
            <h2 className="display section-title">{t("siteFlow.title")}</h2>
            <p className="section-lead">
              {t("siteFlow.lead")}
            </p>
          </Reveal>
          <Reveal as="div" className="flow">
            <div className="flow-track">
              {flow.map((s) => (
                <div className="flow-step" key={s.n} style={{ ["--fd" as any]: `${s.n * 0.12}s` }}>
                  <span className="flow-num display">{s.n}</span>
                  <h3>{t(`siteFlow.step${s.n}Title`)}</h3>
                  <p>{t(`siteFlow.step${s.n}Body`)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* STAGES: application workspace / operations console */}
      <section className="section" id="stages">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">{t("site.stagesEyebrow")}</span>
            <h2 className="display section-title">{t("site.stagesTitle")}</h2>
            <p className="section-lead">
              {t("site.stagesLead")}
            </p>
          </Reveal>
          <div className="stage-grid">
            <Reveal className="stage-card stage-front">
              <div className="stage-tag">{t("siteStages.frontTag")}</div>
              <h3 className="display">{t("siteStages.frontTitle")}</h3>
              <p>{t("siteStages.frontBody")}</p>
              <div className="stage-mock stage-mock-front">
                <div className="sm-bar">
                  <span>{t("siteStages.mockAsk")}</span>
                  <span>{t("siteStages.mockBrowse")}</span>
                  <span>{t("siteStages.mockMe")}</span>
                </div>
                <div className="sm-ask">
                  {t("siteStages.mockAskPlaceholder")}<span className="sm-go">{t("siteStages.mockAskAction")}</span>
                </div>
                <div className="sm-ans">
                  <p>{t("siteStages.mockAnswer")}</p>
                  <div className="sm-cite">▸ Travel &amp; Expense Policy v3, Section 4 · {t("siteStages.mockOpenSource")}</div>
                </div>
              </div>
              <Link href="/app" className="btn btn-soft">
                {t("siteStages.frontCta")}
              </Link>
            </Reveal>

            <Reveal delay={120} className="stage-card stage-back">
              <div className="stage-tag stage-tag-back">{t("siteStages.backTag")}</div>
              <h3 className="display">{t("siteStages.backTitle")}</h3>
              <p>{t("siteStages.backBody")}</p>
              <div className="stage-mock stage-mock-back">
                <div className="sm-steps">
                  <span className="on">{t("siteStages.stepFiles")}</span>
                  <span>{t("siteStages.stepParse")}</span>
                  <span>{t("siteStages.stepSettings")}</span>
                  <span>{t("siteStages.stepRecall")}</span>
                </div>
                <div className="sm-files">
                  <div>
                    <i className="d-ok" />
                    accounts.xlsx<em>{t("siteStages.fileReady")}</em>
                  </div>
                  <div>
                    <i className="d-run" />
                    call-notes.docx<em>{t("siteStages.fileIngesting")}</em>
                  </div>
                  <div>
                    <i className="d-wait" />
                    contract-2024.pdf<em>{t("siteStages.filePending")}</em>
                  </div>
                </div>
                <div className="sm-knobs">
                  <span>{t("siteStages.knobEvidence")}</span>
                  <span>{t("siteStages.knobStrictness")}</span>
                </div>
              </div>
              <Link href="/admin" className="btn btn-soft">
                {t("siteStages.backCta")}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* APPROACH / RESEARCH */}
      <section className="section section-alt" id="approach">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">{t("siteApproach.eyebrow")}</span>
            <h2 className="display section-title">{t("siteApproach.title")}</h2>
            <p className="section-lead">
              {t("siteApproach.lead")}
            </p>
          </Reveal>
          <div className="appr-grid">
            {principles.map((key, i) => (
              <Reveal key={key} delay={i * 100} className="appr-card card card-pad">
                <span className="appr-k mono">{key}</span>
                <h3>{t(`siteApproach.item${key}Title`)}</h3>
                <p>{t(`siteApproach.item${key}Body`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section cta-section">
        <div className="hero-glow cta-glow" aria-hidden />
        <div className="wrap wrap-wide cta-inner">
          <Reveal>
            <h2 className="display cta-title">
              <span>{t("site.ctaTitleLine1")}</span>
              <span>{t("site.ctaTitleLine2")}</span>
            </h2>
            <p className="cta-sub">
              {t("site.ctaSub")}
            </p>
            <div className="cta-actions">
              <Link href="/app" className="btn btn-primary btn-lg">
                {t("site.ctaWorkspace")}
              </Link>
              <Link href="/admin" className="btn btn-ghost btn-lg">
                {t("site.ctaAdmin")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
