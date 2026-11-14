"use client";

import { useEffect, useMemo, useState } from "react";
import { adminIntegrationSettings, type AdminIntegrationSettings } from "../../lib/fixtures/admin-governance";
import { AdminShell } from "./admin-pages";
import { useI18n } from "../../lib/i18n/language-context";

type FetchState = "loading" | "ready" | "fallback";

export function AdminSettingsPage({ initialSettings }: { initialSettings?: AdminIntegrationSettings }) {
  const { t, formatDate } = useI18n();
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
        setTests((prev) => ({ ...prev, [target]: { status: "fail", latencyMs: r.latencyMs, message: r.error ?? t("adminSettings.testFailed") } }));
      }
    } catch {
      setTests((prev) => ({ ...prev, [target]: { status: "fail", message: t("adminSettings.requestFailed") } }));
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
        setPolicyError(t("adminSettings.cannotBeEmpty", { label: p.label }));
        return;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        setPolicyError(t("adminSettings.mustBeNumber", { label: p.label }));
        return;
      }
      if (num < p.numeric.min || num > p.numeric.max) {
        setPolicyError(t("adminSettings.mustBeBetween", { label: p.label, min: p.numeric.min, max: p.numeric.max }));
        return;
      }
      if (Number.isInteger(p.numeric.step) && !Number.isInteger(num)) {
        setPolicyError(t("adminSettings.mustBeInteger", { label: p.label }));
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
        setPolicyError(data.message ?? t("adminSettings.saveFailed"));
      }
    } catch {
      setPolicyError(t("adminSettings.requestFailed"));
    } finally {
      setPolicySaving(false);
    }
  }

  async function resetPolicies() {
    if (!confirm(t("adminSettings.confirmResetPolicies"))) return;
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
        setPolicyError(data.message ?? t("adminSettings.resetFailed"));
      }
    } catch {
      setPolicyError(t("adminSettings.requestFailed"));
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
          setEngineError(t("adminSettings.topKMustBeInteger", { label: item.label }));
          return;
        }
        if (num < item.min || num > item.max) {
          setEngineError(t("adminSettings.topKMustBeBetween", { label: item.label, min: item.min, max: item.max }));
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
            setEngineError(t("adminSettings.minScoreMustBeBetween", { label: item.label, min: item.minScoreMin, max: item.minScoreMax }));
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
        setEngineError(data.message ?? t("adminSettings.saveFailed"));
      }
    } catch {
      setEngineError(t("adminSettings.requestFailed"));
    } finally {
      setEngineSaving(false);
    }
  }

  async function resetEngines() {
    if (!confirm(t("adminSettings.confirmResetEngines"))) return;
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
        setEngineError(data.message ?? t("adminSettings.resetFailed"));
      }
    } catch {
      setEngineError(t("adminSettings.requestFailed"));
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

  const statusLabel =
    settings.overall_status === "ready"
      ? t("adminSettings.statusReady")
      : settings.overall_status === "blocked"
        ? t("adminSettings.statusBlocked")
        : t("adminSettings.statusPartial");
  const checkedAt = useMemo(
    () => formatDate(settings.checked_at, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
    [settings.checked_at, formatDate]
  );

  return (
    <AdminShell active="/admin/settings" title={t("adminSettings.shellTitle")}>
      <section className="admin-head admin-settings-head">
        <span>{t("adminSettings.eyebrow")}</span>
        <h1>{t("adminSettings.title")}</h1>
        <p>{t("adminSettings.description")}</p>
        <div className="admin-settings-toolbar">
          <strong className={`settings-status ${settings.overall_status}`}>{statusLabel}</strong>
          <small>
            {state === "ready"
              ? t("adminSettings.lastChecked", { value: checkedAt })
              : state === "loading"
                ? t("adminSettings.readingApi")
                : t("adminSettings.fallbackNote")}
          </small>
          <button type="button" onClick={() => window.location.reload()}>{t("adminSettings.recheck")}</button>
        </div>
      </section>

      <section className="settings-section settings-secret-matrix">
        <div className="settings-section-title">
          <h2>{t("adminSettings.secretMatrix")}</h2>
          <p>{t("adminSettings.secretMatrixBody")}</p>
        </div>
        <div className="settings-secret-grid">
          {[...settings.providers, ...settings.parsers].flatMap((item) => item.secrets.map((secret) => (
            <article key={`${item.id}-${secret.env_name}`} className="settings-secret-row">
              <b>{secret.env_name}</b>
              <span>{item.label}</span>
              <em>{secret.configured ? t("adminSettings.configured") : t("adminSettings.notConfigured")}</em>
              <small>{secret.fingerprint ?? t("adminSettings.noFingerprint")}</small>
            </article>
          )))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>{t("adminSettings.modelsAndEmbeddings")}</h2>
          <p>{t("adminSettings.modelsAndEmbeddingsBody")}</p>
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
                <div><dt>{t("adminSettings.endpoint")}</dt><dd>{provider.base_url ?? t("adminSettings.notConfigured")}</dd></div>
                <div><dt>{t("adminSettings.model")}</dt><dd>{provider.model ?? t("adminSettings.notConfigured")}</dd></div>
                {provider.dimensions ? <div><dt>{t("adminSettings.vectorDimensions")}</dt><dd>{provider.dimensions}</dd></div> : null}
                {provider.secrets.map((secret) => <div key={secret.env_name}><dt>{secret.env_name}</dt><dd>{secret.configured ? t("adminSettings.configuredFingerprint", { fingerprint: secret.fingerprint ?? "" }) : t("adminSettings.notConfigured")}</dd></div>)}
              </dl>
              <div className="admin-pills">{provider.controls.map((item) => <span key={item}>{item}</span>)}</div>
              <TestConnectionControl target={provider.id} test={tests[provider.id]} onTest={testConnection} />
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>{t("adminSettings.documentParsing")}</h2>
          <p>{t("adminSettings.documentParsingBody")}</p>
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
                <div><dt>{t("adminSettings.version")}</dt><dd>{parser.model_version ?? t("adminSettings.notConfigured")}</dd></div>
                <div><dt>{t("adminSettings.language")}</dt><dd>{parser.language ?? t("adminSettings.notConfigured")}</dd></div>
                {parser.secrets.map((secret) => <div key={secret.env_name}><dt>{secret.env_name}</dt><dd>{secret.configured ? t("adminSettings.configuredFingerprint", { fingerprint: secret.fingerprint ?? "" }) : t("adminSettings.notConfigured")}</dd></div>)}
              </dl>
              <div className="admin-pills">{parser.options.map((item) => <span key={item}>{item}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <h2>{t("adminSettings.ragModuleHealth")}</h2>
          <p>{t("adminSettings.ragModuleHealthBody")}</p>
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
              <span>{module.status === "ok" ? t("adminSettings.serviceAvailable") : module.status === "error" ? t("adminSettings.serviceUnavailable") : t("adminSettings.awaitingCheck")}</span>
              <TestConnectionControl target={module.id} test={tests[module.id]} onTest={testConnection} />
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div>
          <div className="settings-section-title">
            <h2>{t("adminSettings.databaseAccess")}</h2>
            <p>{t("adminSettings.databaseAccessBody")}</p>
          </div>
          <div className="admin-table settings-db-table">
            {settings.databases.map((database) => (
              <div key={database.id}>
                <b>{database.label}</b>
                <span>{database.database ?? t("adminSettings.notConfigured")}</span>
                <span>{database.host ? `${database.host}${database.port ? `:${database.port}` : ""}` : t("adminSettings.notConfigured")}</span>
                <em>{database.configured ? t("adminSettings.configured") : t("adminSettings.notConfigured")}</em>
                <small>{database.env_name}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section settings-config-stack">
        <div>
          <div className="settings-section-title">
            <h2>{t("adminSettings.runtimePolicies")}</h2>
            <p>{t("adminSettings.runtimePoliciesBody")}</p>
          </div>
          <div className="settings-policy-list">
            <div className="settings-policy-toolbar">
              {!editingPolicies ? (
                <button type="button" onClick={startEditPolicies}>{t("adminSettings.edit")}</button>
              ) : (
                <>
                  <button type="button" onClick={resetPolicies} disabled={policySaving}>{t("adminSettings.restoreDefaults")}</button>
                  <button type="button" onClick={cancelEditPolicies} disabled={policySaving}>{t("adminSettings.cancel")}</button>
                  <button type="button" onClick={savePolicies} disabled={policySaving}>
                    {policySaving ? t("adminSettings.saving") : t("adminSettings.save")}
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
                        {policy.source === "db" ? t("adminSettings.dbOverride") : policy.source === "env" ? t("adminSettings.envVar") : t("adminSettings.default")}
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
                      <h3>{t("adminSettings.systemInfrastructure")}</h3>
                      <p>{t("adminSettings.systemInfrastructureBody")}</p>
                    </div>
                    {systemItems.map(renderPolicy)}
                  </div>
                  <div className="settings-policy-group">
                    <div className="settings-policy-group-head">
                      <h3>{t("adminSettings.globalRerank")}</h3>
                      <p>{t("adminSettings.globalRerankBody")}</p>
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
          <h2>{t("adminSettings.perEngineRetrieval")}</h2>
          <p>{t("adminSettings.perEngineRetrievalBody")}</p>
        </div>
        <div className="settings-policy-list">
          <div className="settings-policy-toolbar">
            {!editingEngines ? (
              <button type="button" onClick={startEditEngines}>{t("adminSettings.edit")}</button>
            ) : (
              <>
                <button type="button" onClick={resetEngines} disabled={engineSaving}>{t("adminSettings.restoreDefaults")}</button>
                <button type="button" onClick={cancelEditEngines} disabled={engineSaving}>{t("adminSettings.cancel")}</button>
                <button type="button" onClick={saveEngines} disabled={engineSaving}>
                  {engineSaving ? t("adminSettings.saving") : t("adminSettings.save")}
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
                    placeholder={t("adminSettings.topKPlaceholder")}
                    value={engineDraft[item.engine] ?? ""}
                    onChange={(event) => setEngineDraft((prev) => ({ ...prev, [item.engine]: event.target.value }))}
                  />
                  {item.supportsMinScore ? (
                    <input
                      type="number"
                      min={item.minScoreMin}
                      max={item.minScoreMax}
                      step={0.05}
                      placeholder={t("adminSettings.citationThresholdPlaceholder")}
                      value={engineMinDraft[item.engine] ?? ""}
                      onChange={(event) => setEngineMinDraft((prev) => ({ ...prev, [item.engine]: event.target.value }))}
                    />
                  ) : null}
                  <p>{item.default_hint}{item.supportsMinScore ? t("adminSettings.minScoreHint") : ""}</p>
                </article>
              );
            }
            return (
              <article key={item.engine}>
                <b>{item.label}</b>
                <span>{t("adminSettings.topK", { value: item.topK ?? t("adminSettings.notSet") })}</span>
                <small className="settings-policy-source">
                  {item.source === "db" ? t("adminSettings.dbOverride") : t("adminSettings.default")}
                </small>
                {item.supportsMinScore ? (
                  <>
                    <span>{t("adminSettings.citationThreshold", { value: item.minScore ?? t("adminSettings.notSet") })}</span>
                    <small className="settings-policy-source">
                      {item.minScoreSource === "db" ? t("adminSettings.dbOverride") : t("adminSettings.default")}
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
  const { t } = useI18n();
  return <b className={`secret-badge ${configured ? "ok" : "missing"}`}>{configured ? t("adminSettings.connected") : t("adminSettings.missingConfig")}</b>;
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
  const { t } = useI18n();
  const testing = test?.status === "testing";
  return (
    <div className="settings-test-connection">
      <button type="button" disabled={testing} onClick={() => onTest(target)}>
        {testing ? t("adminSettings.testing") : t("adminSettings.testConnection")}
      </button>
      {test && test.status !== "idle" && !testing ? (
        <span className={`settings-test-result ${test.status}`}>
          {test.status === "ok"
            ? `✅ OK${test.latencyMs != null ? ` (${test.latencyMs}ms)` : ""}`
            : `❌ ${test.message ?? t("adminSettings.failed")}`}
        </span>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "error" | "unknown" }) {
  const { t } = useI18n();
  const label = status === "ok" ? t("adminSettings.serviceAvailable") : status === "error" ? t("adminSettings.serviceUnavailable") : t("adminSettings.awaitingCheck");
  return <i className={`service-dot ${status}`} aria-label={label} />;
}
