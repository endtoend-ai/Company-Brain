"use client";

import { useEffect, useState } from "react";

import { AdminShell, AdminPageHead, PanelHead } from "./admin-pages";
import { ConfirmDialog } from "./admin-confirm-dialog";
import type { GraphCurationSource, GraphCurationDetail } from "../../lib/server/platform-store";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/platform/${path}`, { headers: { "content-type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export function AdminGraphCurationWorkbench({ sources }: { sources: GraphCurationSource[] }) {
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
      setNotice(e instanceof Error ? e.message : "Failed to load");
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
      setNotice("Select at least 2 entities to merge and give the merged entity a name.");
      return;
    }
    setNotice("Merging entities (rewrites the LightRAG graph)…");
    try {
      const r = await api("admin/graph-curation/merge", { method: "POST", body: JSON.stringify({ sourceId: activeSource, sourceEntities: selected, targetEntity: target }) });
      setNotice(r.message || "Merged");
      setMergeTarget("");
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Merge failed");
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
    setNotice("Saving entity (rewrites the LightRAG graph)…");
    try {
      const r = await api("admin/graph-curation/entity/edit", { method: "POST", body: JSON.stringify({ sourceId: activeSource, entityName: editing, newName: editName, entityType: editType, description: editDesc }) });
      setNotice(r.message || "Saved");
      setEditing(null);
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed");
    }
  };

  const deleteEntity = async (name: string) => {
    setNotice(`Deleting entity "${name}"…`);
    try {
      const r = await api("admin/graph-curation/entity/delete", { method: "POST", body: JSON.stringify({ sourceId: activeSource, entityName: name }) });
      setNotice(r.message || "Deleted");
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const deleteRelation = async (src: string, target: string) => {
    setNotice(`Deleting relationship "${src} → ${target}"…`);
    try {
      const r = await api("admin/graph-curation/relation/delete", { method: "POST", body: JSON.stringify({ sourceId: activeSource, sourceEntity: src, targetEntity: target }) });
      setNotice(r.message || "Relationship deleted");
      await loadDetail(activeSource, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <AdminShell active="/admin/graph" title="Knowledge Graph">
      <AdminPageHead
        eyebrow="Knowledge graph · editable workbench"
        title="Add, edit, and delete entities and relationships in the knowledge graph"
        description="Entities and relationships extracted by GraphRAG can be duplicated, fragmented, or mislinked. Merge duplicates, rename or retype entities, fill in descriptions, and delete noisy entities or wrong relationships here — every change rewrites the LightRAG graph store, so answers reflect it immediately."
      />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}

      {sources.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">No GraphRAG graph sources have been ingested yet. Upload graph-type material in a scenario and finish ingestion first.</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow="Select graph source" title="Pick the graph to curate by knowledge base or scenario" />
            <div className="curation-source-tabs">
              {sources.map((s) => (
                <button key={s.sourceId} type="button" className={s.sourceId === activeSource ? "active" : ""} onClick={() => setActiveSource(s.sourceId)}>
                  {s.name}{s.scenarioName ? <small>{s.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            {detail ? (
              <p className="curation-meta">Entities <b>{detail.entityCount}</b> · Relationships <b>{detail.relationCount}</b>{detail.duplicateNames.length ? <> · Possible duplicates <b className="curation-dup-count">{detail.duplicateNames.length}</b></> : null}</p>
            ) : null}
          </section>

          {detail && detail.duplicateNames.length > 0 ? (
            <section className="admin-panel">
              <PanelHead eyebrow="Deduplication hints" title="Possible duplicate entities (select same-name entities below, then merge)" />
              <div className="curation-dup-chips">
                {detail.duplicateNames.map((d) => <span key={d}>{d}</span>)}
              </div>
            </section>
          ) : null}

          {/* Merge action bar */}
          <section className="admin-panel curation-merge-bar">
            <div>
              <b>{selected.length} entities selected</b>
              {selected.length > 0 ? <small>{selected.join(", ")}</small> : <small>Select 2 or more entities to merge</small>}
            </div>
            <input type="text" placeholder={`Merged name (defaults to "${selected[0] ?? ""}")`} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} />
            <button type="button" className="curation-primary" disabled={selected.length < 2} onClick={() => setPending({ title: "Merge entities", description: `The ${selected.length} selected entities will be merged into one; the originals are replaced. Merge?`, confirmText: "Merge", run: doMerge })}>Merge into one entity</button>
          </section>

          <section className="curation-grid">
            {/* Entity list */}
            <section className="admin-panel">
              <PanelHead eyebrow="Entities" title={`Entity list${loading ? " (Loading…)" : ""}`} />
              <div className="curation-entity-list">
                {(detail?.entities ?? []).map((e, i) => (
                  <article key={`${e.name}-${i}`} className={selected.includes(e.name) ? "is-selected" : ""}>
                    {editing === e.name ? (
                      <div className="curation-edit-form">
                        <input value={editName} onChange={(ev) => setEditName(ev.target.value)} placeholder="Entity name" />
                        <input value={editType} onChange={(ev) => setEditType(ev.target.value)} placeholder="Type (organization/person/concept…)" />
                        <textarea value={editDesc} onChange={(ev) => setEditDesc(ev.target.value)} placeholder="Description" rows={2} />
                        <div className="curation-edit-actions">
                          <button type="button" className="curation-primary" onClick={saveEdit}>Save</button>
                          <button type="button" onClick={() => setEditing(null)}>Cancel</button>
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
                          <button type="button" onClick={() => startEdit(e.name, e.type, e.description)}>Edit</button>
                          <button type="button" className="curation-danger" onClick={() => setPending({ title: "Delete entity", description: `Deleting cannot be undone. Delete entity "${e.name}"?`, danger: true, confirmText: "Delete", run: () => deleteEntity(e.name) })}>Delete</button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
                {!loading && (detail?.entities.length ?? 0) === 0 ? <p className="monitoring-empty">This graph source has no entities yet.</p> : null}
              </div>
            </section>

            {/* Relationship list */}
            <section className="admin-panel">
              <PanelHead eyebrow="Relationships" title="Relationship list" />
              <div className="curation-relation-list">
                {(detail?.relations ?? []).map((r, i) => (
                  <article key={`${r.source}-${r.target}-${i}`}>
                    <div className="curation-relation-head">
                      <b>{r.source}</b><span>→</span><b>{r.target}</b>
                    </div>
                    {r.description ? <p>{r.description}</p> : null}
                    <button type="button" className="curation-danger" onClick={() => setPending({ title: "Delete relationship", description: `Delete the relationship "${r.source} → ${r.target}"?`, danger: true, confirmText: "Delete", run: () => deleteRelation(r.source, r.target) })}>Delete relationship</button>
                  </article>
                ))}
                {!loading && (detail?.relations.length ?? 0) === 0 ? <p className="monitoring-empty">This graph source has no relationships yet.</p> : null}
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
