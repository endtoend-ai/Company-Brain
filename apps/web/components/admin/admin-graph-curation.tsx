"use client";

import { useEffect, useState } from "react";

import { AdminShell, AdminPageHead, PanelHead } from "./admin-pages";
import { ConfirmDialog } from "./admin-confirm-dialog";
import type { GraphCurationSource, GraphCurationDetail } from "../../lib/server/platform-store";
import { useI18n } from "../../lib/i18n/language-context";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/platform/${path}`, { headers: { "content-type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export function AdminGraphCurationWorkbench({ sources }: { sources: GraphCurationSource[] }) {
  const { t } = useI18n();
  const [activeSource, setActiveSource] = useState<string>(sources[0]?.sourceId ?? "");
  const [detail, setDetail] = useState<GraphCurationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ title: string; description: string; danger?: boolean; confirmText?: string; run: () => void } | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const loadDetail = async (sourceId: string, keepNotice = false) => {
    if (!sourceId) return;
    setLoading(true);
    if (!keepNotice) setNotice("");
    try {
      const d = await api(`admin/graph-curation/detail?sourceId=${encodeURIComponent(sourceId)}`);
      setDetail(d);
      setSelected([]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.failedToLoad"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSource) void loadDetail(activeSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource]);

  const toggleSelect = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const doMerge = async () => {
    const target = mergeTarget.trim() || selected[0];
    if (selected.length < 2 || !target) {
      setNotice(t("adminCuration.mergeSelectNotice"));
      return;
    }
    setNotice(t("adminCuration.mergingEntities"));
    try {
      const r = await api("admin/graph-curation/merge", { method: "POST", body: JSON.stringify({ sourceId: activeSource, sourceEntities: selected, targetEntity: target }) });
      setNotice(r.message || t("adminCuration.merged"));
      setMergeTarget("");
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.mergeFailed"));
    }
  };

  const startEdit = (name: string, type: string, desc: string) => {
    setEditing(name);
    setEditName(name);
    setEditType(type);
    setEditDesc(desc);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setNotice(t("adminCuration.savingEntity"));
    try {
      const r = await api("admin/graph-curation/entity/edit", { method: "POST", body: JSON.stringify({ sourceId: activeSource, entityName: editing, newName: editName, entityType: editType, description: editDesc }) });
      setNotice(r.message || t("adminCuration.saved"));
      setEditing(null);
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.saveFailed"));
    }
  };

  const deleteEntity = async (name: string) => {
    setNotice(t("adminCuration.deletingEntity", { name }));
    try {
      const r = await api("admin/graph-curation/entity/delete", { method: "POST", body: JSON.stringify({ sourceId: activeSource, entityName: name }) });
      setNotice(r.message || t("adminCuration.deleted"));
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.deleteFailed"));
    }
  };

  const deleteRelation = async (src: string, target: string) => {
    setNotice(t("adminCuration.deletingRelationship", { source: src, target }));
    try {
      const r = await api("admin/graph-curation/relation/delete", { method: "POST", body: JSON.stringify({ sourceId: activeSource, sourceEntity: src, targetEntity: target }) });
      setNotice(r.message || t("adminCuration.relationshipDeleted"));
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.deleteFailed"));
    }
  };

  return (
    <AdminShell active="/admin/graph" title={t("adminCuration.graphShellTitle")}>
      <AdminPageHead
        eyebrow={t("adminCuration.graphEyebrow")}
        title={t("adminCuration.graphTitle")}
        description={t("adminCuration.graphDescription")}
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      {sources.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">{t("adminCuration.noGraphSources")}</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow={t("adminCuration.selectGraphSource")} title={t("adminCuration.pickGraphToCurate")} />
            <div className="curation-source-tabs">
              {sources.map((s) => (
                <button key={s.sourceId} type="button" className={s.sourceId === activeSource ? "active" : ""} onClick={() => setActiveSource(s.sourceId)}>
                  {s.name}{s.scenarioName ? <small>{s.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            {detail ? (
              <p className="curation-meta">{t("adminCuration.entities")} <b>{detail.entityCount}</b> · {t("adminCuration.relationships")} <b>{detail.relationCount}</b>{detail.duplicateNames.length ? <> · {t("adminCuration.possibleDuplicates")} <b className="curation-dup-count">{detail.duplicateNames.length}</b></> : null}</p>
            ) : null}
          </section>

          {detail && detail.duplicateNames.length > 0 ? (
            <section className="admin-panel">
              <PanelHead eyebrow={t("adminCuration.deduplicationHints")} title={t("adminCuration.deduplicationHintsTitle")} />
              <div className="curation-dup-chips">
                {detail.duplicateNames.map((d) => <span key={d}>{d}</span>)}
              </div>
            </section>
          ) : null}

          {/* Merge action bar */}
          <section className="admin-panel curation-merge-bar">
            <div>
              <b>{t("adminCuration.entitiesSelected", { count: selected.length })}</b>
              {selected.length > 0 ? <small>{selected.join(", ")}</small> : <small>{t("adminCuration.selectTwoOrMore")}</small>}
            </div>
            <input type="text" placeholder={t("adminCuration.mergedNamePlaceholder", { name: selected[0] ?? "" })} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} />
            <button type="button" className="curation-primary" disabled={selected.length < 2} onClick={() => setPending({ title: t("adminCuration.mergeEntities"), description: t("adminCuration.mergeDescription", { count: selected.length }), confirmText: t("adminCuration.merge"), run: doMerge })}>{t("adminCuration.mergeIntoOne")}</button>
          </section>

          <section className="curation-grid">
            {/* Entity list */}
            <section className="admin-panel">
              <PanelHead eyebrow={t("adminCuration.entities")} title={`${t("adminCuration.entityList")}${loading ? ` (${t("adminCuration.loading")})` : ""}`} />
              <div className="curation-entity-list">
                {(detail?.entities ?? []).map((e, i) => (
                  <article key={`${e.name}-${i}`} className={selected.includes(e.name) ? "is-selected" : ""}>
                    {editing === e.name ? (
                      <div className="curation-edit-form">
                        <input value={editName} onChange={(ev) => setEditName(ev.target.value)} placeholder={t("adminCuration.entityNamePlaceholder")} />
                        <input value={editType} onChange={(ev) => setEditType(ev.target.value)} placeholder={t("adminCuration.entityTypePlaceholder")} />
                        <textarea value={editDesc} onChange={(ev) => setEditDesc(ev.target.value)} placeholder={t("adminCuration.descriptionPlaceholder")} rows={2} />
                        <div className="curation-edit-actions">
                          <button type="button" className="curation-primary" onClick={saveEdit}>{t("adminCuration.save")}</button>
                          <button type="button" onClick={() => setEditing(null)}>{t("adminCuration.cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="curation-entity-head">
                          <input type="checkbox" checked={selected.includes(e.name)} onChange={() => toggleSelect(e.name)} />
                          <b>{e.name}</b>
                          <span className="curation-type">{e.type}</span>
                        </label>
                        {e.description ? <p>{e.description}</p> : null}
                        <div className="curation-row-actions">
                          <button type="button" onClick={() => startEdit(e.name, e.type, e.description)}>{t("adminCuration.edit")}</button>
                          <button type="button" className="curation-danger" onClick={() => setPending({ title: t("adminCuration.deleteEntity"), description: t("adminCuration.deleteEntityDescription", { name: e.name }), danger: true, confirmText: t("adminCuration.delete"), run: () => deleteEntity(e.name) })}>{t("adminCuration.delete")}</button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
                {!loading && (detail?.entities.length ?? 0) === 0 ? <p className="monitoring-empty">{t("adminCuration.noEntities")}</p> : null}
              </div>
            </section>

            {/* Relationship list */}
            <section className="admin-panel">
              <PanelHead eyebrow={t("adminCuration.relationships")} title={t("adminCuration.relationshipList")} />
              <div className="curation-relation-list">
                {(detail?.relations ?? []).map((r, i) => (
                  <article key={`${r.source}-${r.target}-${i}`}>
                    <div className="curation-relation-head">
                      <b>{r.source}</b><span>→</span><b>{r.target}</b>
                    </div>
                    {r.description ? <p>{r.description}</p> : null}
                    <button type="button" className="curation-danger" onClick={() => setPending({ title: t("adminCuration.deleteRelationship"), description: t("adminCuration.deleteRelationshipDescription", { source: r.source, target: r.target }), danger: true, confirmText: t("adminCuration.delete"), run: () => deleteRelation(r.source, r.target) })}>{t("adminCuration.deleteRelationship")}</button>
                  </article>
                ))}
                {!loading && (detail?.relations.length ?? 0) === 0 ? <p className="monitoring-empty">{t("adminCuration.noRelationships")}</p> : null}
              </div>
            </section>
          </section>
        </>
      )}
      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ""}
        description={pending?.description}
        danger={pending?.danger}
        confirmText={pending?.confirmText}
        onConfirm={() => { const p = pending; setPending(null); if (p) p.run(); }}
        onCancel={() => setPending(null)}
      />
    </AdminShell>
  );
}
