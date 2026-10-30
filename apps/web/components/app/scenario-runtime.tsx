"use client";

import { useMemo, useState } from "react";
import type { DeliverableBlock, ScenarioApp } from "../../lib/fixtures/scenarios";
import { capabilityLabel, capabilityTone, runtimeLabel } from "../../lib/fixtures/scenarios";

type RuntimeProps = {
  scenario: ScenarioApp;
};

export function ScenarioRuntime({ scenario }: RuntimeProps) {
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const tone = capabilityTone[scenario.capabilities[0]];
  const samples = useMemo(
    () => Object.fromEntries(scenario.inputs.map((input) => [input.key, input.sample])),
    [scenario.inputs]
  );

  const runScenario = () => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setRan(true);
    }, 520);
  };

  return (
    <div className="run" style={{ ["--rc" as any]: tone.color, ["--rcs" as any]: tone.soft }}>
      <div className="run-head sp-run-head">
        <div className="run-ic">{scenario.name.slice(0, 1)}</div>
        <div>
          <div className="run-name">{scenario.name}</div>
          <p className="run-tag">{scenario.description}</p>
          <div className="sp-chip-row">
            {scenario.capabilities.map((capability) => (
              <span key={capability} className="sp-chip" style={{ ["--chip" as any]: capabilityTone[capability].color, ["--chips" as any]: capabilityTone[capability].soft }}>
                {capabilityLabel[capability]}
              </span>
            ))}
          </div>
        </div>
        <span className="run-cat">{runtimeLabel[scenario.runtime]}</span>
      </div>

      <div className="run-grid">
        <aside className="run-form">
          <div className="run-form-label">Inputs and knowledge scope</div>
          {scenario.inputs.map((input) => (
            <div className="run-field" key={input.key}>
              <label>{input.label}</label>
              {input.type === "select" ? (
                <RuntimeChoice options={input.options} defaultValue={input.sample} />
              ) : input.type === "file" ? (
                <div className="sp-file-input">
                  <span>{input.sample}</span>
                  <button>Replace</button>
                </div>
              ) : (
                <textarea rows={3} defaultValue={samples[input.key]} placeholder={input.placeholder} />
              )}
            </div>
          ))}

          <div className="sp-knowledge-box">
            <b>Bound knowledge sources</b>
            {scenario.knowledgeBindings.map((binding) => (
              <span key={binding.id}>
                <i style={{ background: capabilityTone[binding.capability].color }} />
                {binding.name}
              </span>
            ))}
          </div>

          <button className="run-go" onClick={runScenario} disabled={loading}>
            {loading ? "Running..." : "Run scenario"}
          </button>
          <p className="run-hint">Enter the business object and the system queries the knowledge bases bound to this scenario, returning a savable deliverable with traceable evidence.</p>
        </aside>

        <section className="run-out">
          {!ran && !loading && <RuntimePreview scenario={scenario} />}
          {loading && (
            <div className="run-loading">
              <span className="run-spinner" />
              Retrieving knowledge, assembling evidence, and generating the deliverable
            </div>
          )}
          {ran && <RuntimeDeliverable scenario={scenario} />}
        </section>
      </div>
    </div>
  );
}

function RuntimePreview({ scenario }: RuntimeProps) {
  return (
    <div className="sp-runtime-preview">
      <div className="run-empty-ic">{scenario.name.slice(0, 1)}</div>
      <p>Ready to run {runtimeLabel[scenario.runtime]}</p>
      <span>Running produces "{scenario.outputTypes.join(" / ")}" with evidence, quality signals, and next actions.</span>
      <div className="sp-preview-grid">
        {scenario.outputTypes.map((type) => (
          <div key={type}>
            <b>{type}</b>
            <span>Structured deliverable</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuntimeDeliverable({ scenario }: RuntimeProps) {
  if (scenario.runtime === "questionnaire-grid") return <QuestionnaireRuntime scenario={scenario} />;
  if (scenario.runtime === "document-review") return <DocumentReviewRuntime scenario={scenario} />;
  if (scenario.runtime === "embedded-widget") return <SupportWidgetRuntime scenario={scenario} />;
  if (scenario.runtime === "account-brief" || scenario.runtime === "investigation-brief") return <BriefRuntime scenario={scenario} />;
  if (scenario.runtime === "notebook-report") return <NotebookRuntime scenario={scenario} />;
  return <DefaultRuntime scenario={scenario} />;
}

function BriefRuntime({ scenario }: RuntimeProps) {
  return (
    <div className="run-doc sp-brief-runtime">
      <DeliverableHeader scenario={scenario} />
      <div className="sp-brief-layout">
        <article>
          <h2 className="run-doc-title">{scenario.deliverable.title}</h2>
          <div className="run-doc-body">
            <RenderBlocks blocks={scenario.deliverable.blocks} />
          </div>
        </article>
        <aside className="sp-path-panel">
          <b>Relationship path evidence</b>
          <PathLine items={scenario.id === "customer-360" ? ["Northwind Labs", "Daniel Kim", "Project Atlas", "Renewal contract"] : ["Skyline Networks", "Northstar Cloud", "SLA breach event", "Alternative supplier"]} />
          <span>Lead with the business conclusion; open a risk to see its path rather than making the graph the main interface.</span>
        </aside>
      </div>
    </div>
  );
}

function DocumentReviewRuntime({ scenario }: RuntimeProps) {
  return (
    <div className="sp-doc-review">
      <div className="sp-doc-paper">
        <div className="sp-doc-line">Section 7 · Data ownership and use</div>
        <p>Customer business data belongs to the customer; the vendor processes it only within the scope of service delivery.</p>
        <div className="sp-doc-line hi">Section 9 · The contract auto-renews at term end unless otherwise agreed.</div>
        <p>No advance notice period is set; add a written reminder 30 days before term end.</p>
        <div className="sp-doc-line hi">Section 12 · Liquidated damages are capped at 5% of total contract value.</div>
      </div>
      <div className="run-doc sp-doc-result">
        <DeliverableHeader scenario={scenario} />
        <h2 className="run-doc-title">{scenario.deliverable.title}</h2>
        <div className="run-doc-body">
          <RenderBlocks blocks={scenario.deliverable.blocks} />
        </div>
      </div>
    </div>
  );
}

function QuestionnaireRuntime({ scenario }: RuntimeProps) {
  const rows = [
    { q: "Do you support SSO?", answer: "Yes — SAML 2.0 and OIDC, integrated with the customer IdP.", source: "Identity authentication whitepaper", status: "Approved" },
    { q: "How is data at rest encrypted?", answer: "AES-256 at rest and TLS 1.2+ in transit.", source: "Security whitepaper v4", status: "Approved" },
    { q: "How often are suppliers audited?", answer: "A security SME should add the latest audit cycle.", source: "To be added", status: "Needs review" },
    { q: "Do you support data deletion requests?", answer: "Yes — tenant-level deletion requests, initiated by an admin.", source: "DPA appendix", status: "Generated" }
  ];
  return (
    <div className="sp-q">
      <DeliverableHeader scenario={scenario} />
      <div className="sp-q-top">
        <h2>{scenario.deliverable.title}</h2>
        <span>42 of 48 generated · 6 need review</span>
      </div>
      <div className="sp-q-table">
        {rows.map((row) => (
          <div className="sp-q-row" key={row.q}>
            <b>{row.q}</b>
            <p>{row.answer}</p>
            <span>{row.source}</span>
            <em className={row.status === "Needs review" ? "warn" : ""}>{row.status}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotebookRuntime({ scenario }: RuntimeProps) {
  return (
    <div className="run-doc sp-notebook">
      <DeliverableHeader scenario={scenario} />
      <div className="sp-notebook-layout">
        <aside>
          <b>Handbook outline</b>
          <span>01 Product and customer basics</span>
          <span>02 Using scenario tools</span>
          <span>03 Completing a customer retrospective</span>
          <b>Sources</b>
          <span>Sales onboarding</span>
          <span>Customer brief template</span>
        </aside>
        <article>
          <h2 className="run-doc-title">{scenario.deliverable.title}</h2>
          <div className="run-doc-body">
            <RenderBlocks blocks={scenario.deliverable.blocks} />
          </div>
        </article>
      </div>
    </div>
  );
}

function SupportWidgetRuntime({ scenario }: RuntimeProps) {
  return (
    <div className="sp-widget-runtime">
      <div className="sp-shop-page">
        <div className="sp-shop-bar" />
        <div className="sp-shop-card" />
        <div className="sp-shop-card wide" />
        <div className="sp-chat-widget">
          <b>Live assistant</b>
          <p>Why is order 8842 delayed?</p>
          <span>The order is delayed one day by a West Coast warehouse cycle count. Offer the customer a shipping credit.</span>
        </div>
      </div>
      <div className="run-doc">
        <DeliverableHeader scenario={scenario} />
        <h2 className="run-doc-title">{scenario.deliverable.title}</h2>
        <div className="run-doc-body">
          <RenderBlocks blocks={scenario.deliverable.blocks} />
        </div>
      </div>
    </div>
  );
}

function DefaultRuntime({ scenario }: RuntimeProps) {
  return (
    <div className="run-doc">
      <DeliverableHeader scenario={scenario} />
      <h2 className="run-doc-title">{scenario.deliverable.title}</h2>
      <div className="run-doc-body">
        <RenderBlocks blocks={scenario.deliverable.blocks} />
      </div>
    </div>
  );
}

function DeliverableHeader({ scenario }: RuntimeProps) {
  return (
    <div className="run-doc-bar">
      <span className="run-doc-kind">{scenario.deliverable.kind}</span>
      <div className="run-doc-actions">
        {scenario.actions.slice(0, 3).map((action) => (
          <button key={action}>{action}</button>
        ))}
      </div>
    </div>
  );
}

export function RenderBlocks({ blocks }: { blocks: DeliverableBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "lead") return <p className="bk-lead" key={index}>{block.text}</p>;
        if (block.type === "section") {
          return (
            <section className="bk-section" key={index}>
              <h3>{block.heading}</h3>
              <p>{block.body}</p>
            </section>
          );
        }
        if (block.type === "bullets") {
          return (
            <section className="bk-section" key={index}>
              <h3>{block.heading}</h3>
              <ul className="bk-bullets">
                {block.items.map((item) => (
                  <li key={item.text}>
                    <span>{item.text}</span>
                    {item.cite && <em className="bk-cite">{item.cite}</em>}
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        if (block.type === "risk") {
          return (
            <section className="bk-section" key={index}>
              <h3>{block.heading}</h3>
              <div className="bk-risks">
                {block.items.map((item) => (
                  <div className={`bk-risk lv-${item.level}`} key={item.title}>
                    <span className="bk-risk-lv">{item.level === "high" ? "High" : item.level === "mid" ? "Mid" : "Low"}</span>
                    <div>
                      <b>{item.title}</b>
                      <p>{item.note}</p>
                      <em className="bk-cite">{item.cite}</em>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        return (
          <div className="bk-sources" key={index}>
            <span className="bk-sources-label">Source evidence</span>
            {block.items.map((item) => (
              <div className="bk-src" key={item.title}>
                <SourceIcon />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <span className="bk-src-open">Open</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function RuntimeChoice({ options, defaultValue }: { options: string[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="run-choice-group" role="radiogroup" aria-label="Choose a business option">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "active" : ""}
          role="radio"
          aria-checked={value === option}
          onClick={() => setValue(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function PathLine({ items }: { items: string[] }) {
  return (
    <div className="sp-path-line">
      {items.map((item, index) => (
        <span key={item}>
          {item}
          {index < items.length - 1 && <i />}
        </span>
      ))}
    </div>
  );
}

function SourceIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
