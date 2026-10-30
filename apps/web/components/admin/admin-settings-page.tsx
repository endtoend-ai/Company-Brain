"use client";

import { useEffect, useMemo, useState } from "react";
import { adminIntegrationSettings, type AdminIntegrationSettings } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-pages";

type FetchState = "loading" | "ready" | "fallback";

export function AdminSettingsPage({ initialSettings }: { initialSettings?: AdminIntegrationSettings }) {
  const [settings, setSettings] = useState<AdminIntegrationSettings>(initialSettings ?? adminIntegrationSettings);
  const [state, setState] = useState<FetchState>(initialSettings ? "ready" : "loading");
  const [tests, setTests] = useState<Record<string, { status: "idle" | "testing" | "ok" | "fail"; latencyMs?: number; message?: string }>>({});
  const [editingPolicies, setEditingPolicies] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<Record<string, string>>({});
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [editingEngines, setEditingEngines] = useState(false);
  const [engineDraft, setEngineDraft] = useState<Record<string, string>>({});
  const [engineMinDraft, setEngineMinDraft] = useState<Record<string, string>>({});
  const [engineSaving, setEngineSaving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  async function testConnection(target: string) {
    setTests((prev) => ({ ...prev, [target]: { status: "testing" } }));
    try {
      const resp = await fetch("/api/platform/admin/integrations/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target })
      });
      const body = await resp.json().catch(() => ({}));
      const r = body.result ?? {};
      if (resp.ok && r.ok) {
        setTests((prev) => ({ ...prev, [target]: { status: "ok", latencyMs: r.latencyMs, message: r.detail } }));
      } else {
        setTests((prev) => ({ ...prev, [target]: { status: "fail", latencyMs: r.latencyMs, message: r.error ?? "Test failed" } }));
      }
    } catch {
      setTests((prev) => ({ ...prev, [target]: { status: "fail", message: "Request failed" } }));
    }
  }

  function startEditPolicies() {
    const draft: Record<string, string> = {};
    for (const p of settings.runtime_policies) {
      if (p.key && p.numeric) draft[p.key] = String(p.numeric.value);
    }
    setPolicyDraft(draft);
    setPolicyError(null);
    setEditingPolicies(true);
  }

  function cancelEditPolicies() {
    setEditingPolicies(false);
    setPolicyError(null);
  }

  async function savePolicies() {
    const body: Record<string, number> = {};
    for (const p of settings.runtime_policies) {
      if (!p.key || !p.numeric) continue;
      const raw = policyDraft[p.key];
      if (raw === undefined || raw === "") {
        setPolicyError(`"${p.label}" cannot be empty`);
        return;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        setPolicyError(`"${p.label}" must be a number`);
        return;
      }
      if (num < p.numeric.min || num > p.numeric.max) {
        setPolicyError(`"${p.label}" must be between ${p.numeric.min} and ${p.numeric.max}`);
        return;
      }
      if (Number.isInteger(p.numeric.step) && !Number.isInteger(num)) {
        setPolicyError(`"${p.label}" must be an integer`);
        return;
      }
      body[p.key] = num;
    }
    setPolicySaving(true);
    setPolicyError(null);
    try {
      const resp = await fetch("/api/platform/admin/runtime-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.settings) {
        setSettings(data.settings);
        setEditingPolicies(false);
      } else {
        setPolicyError(data.message ?? "Save failed");
      }
    } catch {
      setPolicyError("Request failed");
    } finally {
      setPolicySaving(false);
    }
  }

  async function resetPolicies() {
    if (!confirm("Reset runtime policies back to their environment variables and defaults?")) return;
    const body: Record<string, null> = {};
    for (const p of settings.runtime_policies) {
      if (p.key) body[p.key] = null;
    }
    setPolicySaving(true);
    setPolicyError(null);
    try {
      const resp = await fetch("/api/platform/admin/runtime-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.settings) {
        setSettings(data.settings);
        setEditingPolicies(false);
      } else {
        setPolicyError(data.message ?? "Reset failed");
      }
    } catch {
      setPolicyError("Request failed");
    } finally {
      setPolicySaving(false);
    }
  }

  function startEditEngines() {
    const draft: Record<string, string> = {};
    const minDraft: Record<string, string> = {};
    for (const item of settings.engine_retrieval) {
      draft[item.engine] = item.topK === null ? "" : String(item.topK);
      if (item.supportsMinScore) {
        minDraft[item.engine] = item.minScore === null ? "" : String(item.minScore);
      }
    }
    setEngineDraft(draft);
    setEngineMinDraft(minDraft);
    setEngineError(null);
    setEditingEngines(true);
  }

  function cancelEditEngines() {
    setEditingEngines(false);
    setEngineError(null);
  }

  async function saveEngines() {
    const body: Record<string, { topK: number | null; minScore?: number | null }> = {};
    for (const item of settings.engine_retrieval) {
      const entry: { topK: number | null; minScore?: number | null } = { topK: null };
      const raw = engineDraft[item.engine];
      if (raw !== undefined && raw !== "") {
        const num = Number(raw);
        if (!Number.isFinite(num) || !Number.isInteger(num)) {
          setEngineError(`"${item.label}" TopK must be an integer`);
          return;
        }
        if (num < item.min || num > item.max) {
          setEngineError(`"${item.label}" TopK must be between ${item.min} and ${item.max}`);
          return;
        }
        entry.topK = num;
      }
      if (item.supportsMinScore) {
        const rawMin = engineMinDraft[item.engine];
        if (rawMin === undefined || rawMin === "") {
          entry.minScore = null;
        } else {
          const m = Number(rawMin);
          if (!Number.isFinite(m) || m < item.minScoreMin || m > item.minScoreMax) {
            setEngineError(`"${item.label}" citation strength threshold must be between ${item.minScoreMin} and ${item.minScoreMax}`);
            return;
          }
          entry.minScore = m;
        }
      }
      body[item.engine] = entry;
    }
    setEngineSaving(true);
    setEngineError(null);
    try {
      const resp = await fetch("/api/platform/admin/engine-retrieval-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.settings) {
        setSettings(data.settings);
        setEditingEngines(false);
      } else {
        setEngineError(data.message ?? "Save failed");
      }
    } catch {
      setEngineError("Request failed");
    } finally {
      setEngineSaving(false);
    }
  }

  async function resetEngines() {
    if (!confirm("Reset every engine retrieval parameter (TopK and citation strength threshold) to its default?")) return;
    const body: Record<string, { topK: null; minScore?: null }> = {};
    for (const item of settings.engine_retrieval) {
      body[item.engine] = item.supportsMinScore ? { topK: null, minScore: null } : { topK: null };
    }
    setEngineSaving(true);
    setEngineError(null);
    try {
      const resp = await fetch("/api/platform/admin/engine-retrieval-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.settings) {
        setSettings(data.settings);
        setEditingEngines(false);
      } else {
        setEngineError(data.message ?? "Reset failed");
      }
    } catch {
      setEngineError("Request failed");
    } finally {
      setEngineSaving(false);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/platform/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("settings unavailable");
        return response.json();
      })
      .then((body) => {
        if (!alive) return;
        setSettings(body.settings ?? adminIntegrationSettings);
        setState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setSettings(initialSettings ?? adminIntegrationSettings);
        setState("fallback");
      });
    return () => {
      alive = false;
    };
  }, [initialSettings]);

  const statusLabel = settings.overall_status === "ready" ? "All available" : settings.overall_status === "blocked" ? "Configuration blocked" : "Partially unverified";
  const checkedAt = useMemo(() => formatCheckedAt(settings.checked_at), [settings.checked_at]);

  return (
    <AdminShell active="/admin/settings" title="Integrations">
      <section className="admin-head admin-settings-head">
        <span>Integrations</span>
        <h1>Integrations control center</h1>
        <p>Admins confirm here that the models, parsers, databases, and the three RAG engines are connected. Workspace scenarios only consume the business capabilities mapped from them.</p>
        <div className="admin-settings-toolbar">
          <strong className={`settings-status ${settings.overall_status}`}>{statusLabel}</strong>
          <small>{state === "ready" ? `Last checked: ${checkedAt}` : state === "loading" ? "Reading the platform API..." : "Platform API not connected; showing the local fallback configuration"}</small>
          <button type="button" onClick={() => window.location.reload()}>Recheck</button>
        </div>
      </section>

      <section className="settings-section settings-secret-matrix">
        <div className="settings-section-title">
          <h2>Secret status matrix</h2>
          <p>Only environment variable names, configuration state, and masked fingerprints are exposed, so the console never leaks real secrets.</p>
        </div>
        <div className="settings-secret-grid">
          {[...settings.providers, ...settings.parsers].flatMap((item) => item.secrets.map((secret) => (
            <article key={`${item.id}-${secret.env_name}`} className="settings-secret-row">
              <b>{secret.env_name}</b>
              <span>{item.label}</span>
              <em>{secret.configured ? "Configured" : "Not configured"}</em>
              <small>{secret.fingerprint ?? "No fingerprint"}</small>
            </article>
          )))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>Models and embeddings</h2>
          <p>These determine answer quality, embedding dimensions, and retrieval across all three knowledge bases.</p>
        </div>
        <div className="settings-card-grid">
          {settings.providers.map((provider) => (
            <article key={provider.id} className="settings-card">
              <header>
                <div>
                  <span>{provider.provider}</span>
                  <h3>{provider.label}</h3>
                </div>
                <SecretBadge configured={provider.secrets.every((item) => item.configured)} />
              </header>
              <dl>
                <div><dt>Endpoint</dt><dd>{provider.base_url ?? "Not configured"}</dd></div>
                <div><dt>Model</dt><dd>{provider.model ?? "Not configured"}</dd></div>
                {provider.dimensions ? <div><dt>Vector dimensions</dt><dd>{provider.dimensions}</dd></div> : null}
                {provider.secrets.map((secret) => <div key={secret.env_name}><dt>{secret.env_name}</dt><dd>{secret.configured ? `Configured ${secret.fingerprint ?? ""}` : "Not configured"}</dd></div>)}
              </dl>
              <div className="admin-pills">{provider.controls.map((item) => <span key={item}>{item}</span>)}</div>
              <TestConnectionControl target={provider.id} test={tests[provider.id]} onTest={testConnection} />
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>Document parsing</h2>
          <p>Turns PDFs into structured material that can be chunked, cited, and traced.</p>
        </div>
        <div className="settings-card-grid">
          {settings.parsers.map((parser) => (
            <article key={parser.id} className="settings-card">
              <header>
                <div>
                  <span>{parser.base_url ?? "Not configured"}</span>
                  <h3>{parser.label}</h3>
                </div>
                <SecretBadge configured={parser.secrets.every((item) => item.configured)} />
              </header>
              <dl>
                <div><dt>Version</dt><dd>{parser.model_version ?? "Not configured"}</dd></div>
                <div><dt>Language</dt><dd>{parser.language ?? "Not configured"}</dd></div>
                {parser.secrets.map((secret) => <div key={secret.env_name}><dt>{secret.env_name}</dt><dd>{secret.configured ? `Configured ${secret.fingerprint ?? ""}` : "Not configured"}</dd></div>)}
              </dl>
              <div className="admin-pills">{parser.options.map((item) => <span key={item}>{item}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>RAG module health</h2>
          <p>The admin console routes workspace scenarios to the real ingest and retrieval paths behind Gbrain, Naive RAG, and GraphRAG.</p>
        </div>
        <div className="settings-service-list">
          {settings.modules.map((module) => (
            <article key={module.id} className="settings-service-row">
              <div>
                <StatusDot status={module.status} />
                <div>
                  <h3>{module.label}</h3>
                  <p>{module.role}</p>
                </div>
              </div>
              <code>{module.base_url}</code>
              <span>{module.status === "ok" ? "Service available" : module.status === "error" ? "Service unavailable" : "Awaiting check"}</span>
              <TestConnectionControl target={module.id} test={tests[module.id]} onTest={testConnection} />
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div>
          <div className="settings-section-title">
            <h2>Database access boundaries</h2>
            <p>Only a connection summary is shown, never passwords or full connection strings; each database maps to its own permissions and knowledge asset boundary.</p>
          </div>
          <div className="admin-table settings-db-table">
            {settings.databases.map((database) => (
              <div key={database.id}>
                <b>{database.label}</b>
                <span>{database.database ?? "Not configured"}</span>
                <span>{database.host ? `${database.host}${database.port ? `:${database.port}` : ""}` : "Not configured"}</span>
                <em>{database.configured ? "Configured" : "Not configured"}</em>
                <small>{database.env_name}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-config-stack">
        <div>
          <div className="settings-section-title">
            <h2>Runtime policies</h2>
            <p>These affect task processing, state recovery, and where files are written.</p>
          </div>
          <div className="settings-policy-list">
            <div className="settings-policy-toolbar">
              {!editingPolicies ? (
                <button type="button" onClick={startEditPolicies}>Edit</button>
              ) : (
                <>
                  <button type="button" onClick={resetPolicies} disabled={policySaving}>Restore defaults</button>
                  <button type="button" onClick={cancelEditPolicies} disabled={policySaving}>Cancel</button>
                  <button type="button" onClick={savePolicies} disabled={policySaving}>
                    {policySaving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>
            {policyError ? <div className="settings-policy-error">{policyError}</div> : null}
            {(() => {
              const renderPolicy = (policy: (typeof settings.runtime_policies)[number]) => {
                const key = policy.key;
                if (key && editingPolicies && policy.numeric) {
                  return (
                    <article key={policy.label} className="settings-policy-edit">
                      <b>{policy.label}</b>
                      <input
                        type="number"
                        min={policy.numeric.min}
                        max={policy.numeric.max}
                        step={policy.numeric.step}
                        value={policyDraft[key] ?? ""}
                        onChange={(event) => setPolicyDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                      />
                      {policy.numeric.unit ? <span>{policy.numeric.unit}</span> : null}
                      <p>{policy.impact}</p>
                    </article>
                  );
                }
                return (
                  <article key={policy.label}>
                    <b>{policy.label}</b>
                    <span>{policy.value}</span>
                    {key && policy.source ? (
                      <small className="settings-policy-source">
                        {policy.source === "db" ? "DB override" : policy.source === "env" ? "Environment variable" : "Default"}
                      </small>
                    ) : null}
                    <p>{policy.impact}</p>
                  </article>
                );
              };
              const systemItems = settings.runtime_policies.filter((policy) => !policy.key);
              const retrievalItems = settings.runtime_policies.filter((policy) => policy.key);
              return (
                <>
                  <div className="settings-policy-group">
                    <div className="settings-policy-group-head">
                      <h3>System infrastructure</h3>
                      <p>Access tokens, ingest mode, and where files land (operations settings, mostly read-only).</p>
                    </div>
                    {systemItems.map(renderPolicy)}
                  </div>
                  <div className="settings-policy-group">
                    <div className="settings-policy-group-head">
                      <h3>Global reranking (rerank)</h3>
                      <p>Tuning for company-wide retrieval and reranking. Use Edit in the top-right to change values.</p>
                    </div>
                    {retrievalItems.map(renderPolicy)}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div>
        <div className="settings-section-title">
          <h2>Per-engine retrieval parameters</h2>
          <p>Override the number of retrieved results per engine (TopK, 1–30). Naive RAG also supports a relative citation strength threshold (0–1, normalized RRF filtering of weak citations; only this engine has that layer). Leave blank to use each retrieval path's default; neither setting affects the platform reranking layer.</p>
        </div>
        <div className="settings-policy-list">
          <div className="settings-policy-toolbar">
            {!editingEngines ? (
              <button type="button" onClick={startEditEngines}>Edit</button>
            ) : (
              <>
                <button type="button" onClick={resetEngines} disabled={engineSaving}>Restore defaults</button>
                <button type="button" onClick={cancelEditEngines} disabled={engineSaving}>Cancel</button>
                <button type="button" onClick={saveEngines} disabled={engineSaving}>
                  {engineSaving ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
          {engineError ? <div className="settings-policy-error">{engineError}</div> : null}
          {settings.engine_retrieval.map((item) => {
            if (editingEngines) {
              return (
                <article key={item.engine} className="settings-policy-edit">
                  <b>{item.label}</b>
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    step={1}
                    placeholder="TopK not set"
                    value={engineDraft[item.engine] ?? ""}
                    onChange={(event) => setEngineDraft((prev) => ({ ...prev, [item.engine]: event.target.value }))}
                  />
                  {item.supportsMinScore ? (
                    <input
                      type="number"
                      min={item.minScoreMin}
                      max={item.minScoreMax}
                      step={0.05}
                      placeholder="Citation threshold not set"
                      value={engineMinDraft[item.engine] ?? ""}
                      onChange={(event) => setEngineMinDraft((prev) => ({ ...prev, [item.engine]: event.target.value }))}
                    />
                  ) : null}
                  <p>{item.default_hint}{item.supportsMinScore ? "; relative citation strength threshold 0–1: leave blank for no filtering" : ""}</p>
                </article>
              );
            }
            return (
              <article key={item.engine}>
                <b>{item.label}</b>
                <span>TopK: {item.topK ?? "Not set"}</span>
                <small className="settings-policy-source">
                  {item.source === "db" ? "DB override" : "Default"}
                </small>
                {item.supportsMinScore ? (
                  <>
                    <span>Citation threshold: {item.minScore ?? "Not set"}</span>
                    <small className="settings-policy-source">
                      {item.minScoreSource === "db" ? "DB override" : "Default"}
                    </small>
                  </>
                ) : null}
                <p>{item.default_hint}</p>
              </article>
            );
          })}
        </div>
        </div>
      </section>
    </AdminShell>
  );
}

function SecretBadge({ configured }: { configured: boolean }) {
  return <b className={`secret-badge ${configured ? "ok" : "missing"}`}>{configured ? "Connected" : "Missing config"}</b>;
}

function TestConnectionControl({
  target,
  test,
  onTest
}: {
  target: string;
  test?: { status: "idle" | "testing" | "ok" | "fail"; latencyMs?: number; message?: string };
  onTest: (target: string) => void;
}) {
  const testing = test?.status === "testing";
  return (
    <div className="settings-test-connection">
      <button type="button" disabled={testing} onClick={() => onTest(target)}>
        {testing ? "Testing..." : "Test connection"}
      </button>
      {test && test.status !== "idle" && !testing ? (
        <span className={`settings-test-result ${test.status}`}>
          {test.status === "ok"
            ? `✅ OK${test.latencyMs != null ? ` (${test.latencyMs}ms)` : ""}`
            : `❌ ${test.message ?? "Failed"}`}
        </span>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "error" | "unknown" }) {
  return <i className={`service-dot ${status}`} aria-label={status} />;
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { hour12: false });
}
