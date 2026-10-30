import Link from "next/link";
import { SiteHeader } from "../components/site/site-header";
import { SiteFooter } from "../components/site/site-footer";
import { HeroAnswer } from "../components/site/hero-answer";
import { PainGuide } from "../components/site/pain-guide";
import { ScenarioRows } from "../components/site/scenario-rows";
import { Reveal } from "../components/site/reveal";

const flow = [
  { n: 1, t: "Choose a scenario", d: "Admins pick the knowledge base that fits a business pain point" },
  { n: 2, t: "Build it", d: "Upload files; the system turns them into knowledge you can ask" },
  { n: 3, t: "Publish", d: "Publish the knowledge base as a Q&A scenario" },
  { n: 4, t: "Ask", d: "Employees just ask and get answers with evidence" }
];

const principles = [
  {
    k: "01",
    t: "One entry point, every knowledge base",
    d: "Employees don't have to guess which knowledge base holds the answer. Ask a question and the system searches across every built knowledge base, keeping the complexity in the admin console."
  },
  {
    k: "02",
    t: "Every answer carries its source",
    d: "Answers come with sources you can open—the original paragraph, the relationship chain, or the knowledge entry. Conclusions hold up, and you can check them anytime."
  },
  {
    k: "03",
    t: "Workspace and admin console, each with a clear job",
    d: "The workspace exists for business users and stays clean and usable; the admin console carries building and running knowledge bases, with everything visible and adjustable."
  }
];

export default function Home() {
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
              Enterprise Knowledge Platform
            </span>
            <h1 className="display hero-title rise" style={{ animationDelay: "80ms" }}>
              Make company knowledge
              <br />
              <span className="hero-accent">askable · trustworthy · governable</span>
            </h1>
            <p className="hero-sub rise" style={{ animationDelay: "180ms" }}>
              Turn the knowledge scattered across documents, conversations, and business systems
              into knowledge bases built around real scenarios. Employees ask in one place and get
              answers with evidence; admins can see how each knowledge base is built, tuned, and
              run—<strong>the technology stays behind the scenes; what the business gets is a
              definite answer.</strong>
            </p>
            <div className="hero-cta rise" style={{ animationDelay: "280ms" }}>
              <a href="#guide" className="btn btn-primary btn-lg">
                Find your knowledge base
              </a>
              <Link href="/app" className="btn btn-ghost btn-lg">
                Open the workspace
              </Link>
            </div>
            <div className="hero-trust rise" style={{ animationDelay: "380ms" }}>
              <div>
                <strong>3</strong>
                <span>
                  knowledge base types
                  <br />
                  covering the scenarios companies run on
                </span>
              </div>
              <div className="hero-trust-sep" />
              <div>
                <strong>1</strong>
                <span>
                  place to ask
                  <br />
                  searching every knowledge base
                </span>
              </div>
              <div className="hero-trust-sep" />
              <div>
                <strong>100%</strong>
                <span>
                  answers with sources
                  <br />
                  open to verify
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
            <span className="eyebrow">Knowledge Bases</span>
            <h2 className="display section-title">The right knowledge base for every scenario</h2>
            <p className="section-lead">
              Each one solves a different real problem and works differently—search where search
              is what you need, read where reading is, explore relationships where the answer lives
              in them. Three different tools, not three identical chat boxes.
            </p>
          </Reveal>
          <ScenarioRows />
        </div>
      </section>

      {/* PAIN GUIDE */}
      <section className="section" id="guide">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">Scenario Guide</span>
            <h2 className="display section-title">What do you want to solve with a knowledge base?</h2>
            <p className="section-lead">
              Pick the closest scenario, or just describe your pain point—the product recommends a
              knowledge base, explains why, and takes you to build it.
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
            <span className="eyebrow">How It Works</span>
            <h2 className="display section-title">
              Four steps from a pile of files to a knowledge base you can ask
            </h2>
            <p className="section-lead">
              Admins build the knowledge base and publish it, and employees can ask right away—one
              clear path.
            </p>
          </Reveal>
          <Reveal as="div" className="flow">
            <div className="flow-track">
              {flow.map((s) => (
                <div className="flow-step" key={s.n} style={{ ["--fd" as any]: `${s.n * 0.12}s` }}>
                  <span className="flow-num display">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
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
            <span className="eyebrow">Architecture</span>
            <h2 className="display section-title">Business applications in front, knowledge operations behind</h2>
            <p className="section-lead">
              Employees get the workspace; admins get the admin console. The two serve different
              roles but share one permission model, one file store, and one RAG ingestion pipeline.
            </p>
          </Reveal>
          <div className="stage-grid">
            <Reveal className="stage-card stage-front">
              <div className="stage-tag">Workspace · employee-facing</div>
              <h3 className="display">Ask in one place, get evidence every time</h3>
              <p>Employees come in with a question. One entry point searches every knowledge base and returns a direct conclusion with sources they can open; they can also browse settled knowledge like an encyclopedia and follow up on any entry. The navigation has three items: Ask CompanyBrain / Browse Knowledge / Me—no engine names, no parameters, no technical panels.</p>
              <div className="stage-mock stage-mock-front">
                <div className="sm-bar">
                  <span>Ask CompanyBrain</span>
                  <span>Browse Knowledge</span>
                  <span>Me</span>
                </div>
                <div className="sm-ask">
                  Ask anything…<span className="sm-go">Ask</span>
                </div>
                <div className="sm-ans">
                  <p>The answer states the conclusion and lists 3 citations you can open one by one.</p>
                  <div className="sm-cite">▸ Travel &amp; Expense Policy v3, Section 4 · Open source</div>
                </div>
              </div>
              <Link href="/app" className="btn btn-soft">
                Open the workspace →
              </Link>
            </Reveal>

            <Reveal delay={120} className="stage-card stage-back">
              <div className="stage-tag stage-tag-back">Admin console · knowledge base management</div>
              <h3 className="display">A real business pipeline, clearly laid out</h3>
              <p>Organized by domain, building a knowledge base is a visible linear pipeline; parameters are wrapped as business presets instead of exposed as raw knobs.</p>
              <div className="stage-mock stage-mock-back">
                <div className="sm-steps">
                  <span className="on">① Files</span>
                  <span>② Parse preview</span>
                  <span>③ Settings</span>
                  <span>④ Recall check</span>
                </div>
                <div className="sm-files">
                  <div>
                    <i className="d-ok" />
                    accounts.xlsx<em>Ready</em>
                  </div>
                  <div>
                    <i className="d-run" />
                    call-notes.docx<em>Ingesting</em>
                  </div>
                  <div>
                    <i className="d-wait" />
                    contract-2024.pdf<em>Pending</em>
                  </div>
                </div>
                <div className="sm-knobs">
                  <span>Evidence scope　Focused ●———— Broad</span>
                  <span>Match strictness　Loose ——●— Strict</span>
                </div>
              </div>
              <Link href="/admin" className="btn btn-soft">
                Open the admin console →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* APPROACH / RESEARCH */}
      <section className="section section-alt" id="approach">
        <div className="wrap wrap-wide">
          <Reveal>
            <span className="eyebrow">Principles</span>
            <h2 className="display section-title">Leave the complexity to the system, the certainty to the business</h2>
            <p className="section-lead">
              Three principles that run through the workspace and the admin console, so company
              knowledge is genuinely askable, trustworthy, and governable.
            </p>
          </Reveal>
          <div className="appr-grid">
            {principles.map((p, i) => (
              <Reveal key={p.k} delay={i * 100} className="appr-card card card-pad">
                <span className="appr-k mono">{p.k}</span>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
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
              <span>Turn company knowledge into</span>
              <span>assets you can question, trace, and operate</span>
            </h2>
            <p className="cta-sub">
              Start with a business question in the workspace; the admin console handles file
              intake, permission review, RAG ingestion, and knowledge asset governance.
            </p>
            <div className="cta-actions">
              <Link href="/app" className="btn btn-primary btn-lg">
                Open the workspace
              </Link>
              <Link href="/admin" className="btn btn-ghost btn-lg">
                Open the admin console
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
