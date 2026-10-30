"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AdminShell, AdminPageHead, PanelHead } from "./admin-pages";
import { ConfirmDialog } from "./admin-confirm-dialog";
import type { NaiveDocument, DocChunk, GbrainPageSource, KnowledgePageItem } from "../../lib/server/platform-store";

const KNOWLEDGE_SUBNAV = [
  { label: "Asset Overview", href: "/admin/knowledge-bases" },
  { label: "Gbrain Management", href: "/admin/knowledge-bases/gbrain" },
  { label: "Naive RAG Management", href: "/admin/knowledge-bases/naive" },
  { label: "GraphRAG Management", href: "/admin/graph" }
];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/platform/${path}`, { headers: { "content-type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

function KnowledgeSubnav({ active }: { active: string }) {
  return (
    <nav className="curation-subnav" aria-label="Knowledge base management">
      {KNOWLEDGE_SUBNAV.map((item) => (
        <Link key={item.href} href={item.href} className={item.href === active ? "active" : ""}>{item.label}</Link>
      ))}
    </nav>
  );
}

// ========== Document form: browse document chunks / delete noisy chunks ==========
export function AdminDocCurationWorkbench({ documents }: { documents: NaiveDocument[] }) {
  const [active, setActive] = useState(documents[0]?.documentId ?? "");
  const [pending, setPending] = useState<{ title: string; description: string; danger?: boolean; confirmText?: string; run: () => void } | null>(null);
  const [chunks, setChunks] = useState<DocChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async (documentId: string, keep = false) => {
    if (!documentId) return;
    setLoading(true);
    if (!keep) setNotice("");
    try {
      const d = await api(`admin/doc-curation/chunks?documentId=${encodeURIComponent(documentId)}`);
      setChunks(d.chunks ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to load");
      setChunks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (active) void load(active); /* eslint-disable-next-line */ }, [active]);

  const remove = async (chunkId: string) => {
    setNotice("Deleting chunk (rewrites traditional_chunks)…");
    try {
      const r = await api("admin/doc-curation/chunk/delete", { method: "POST", body: JSON.stringify({ documentId: active, chunkId }) });
      setNotice(r.message || "Deleted");
      await load(active, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <AdminShell active="/admin/knowledge-bases" title="Naive RAG Management">
      <AdminPageHead eyebrow="Document form · editable governance" title="Inspect the chunks split from each document and delete noisy snippets" description="Document knowledge is split into chunks and searched by vector. Inspect the chunks actually produced for each document and delete noise such as blank, header, footer, or garbled chunks — changes rewrite traditional_chunks directly and take effect immediately in retrieval." />
      <KnowledgeSubnav active="/admin/knowledge-bases/naive" />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      {documents.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">No document-type sources have been ingested yet.</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow="Select document" title="View chunks by document" />
            <div className="curation-source-tabs">
              {documents.map((d) => (
                <button key={d.documentId} type="button" className={d.documentId === active ? "active" : ""} onClick={() => setActive(d.documentId)}>
                  {d.name}{d.scenarioName ? <small>{d.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            <p className="curation-meta">Total <b>{chunks.length}</b> chunks{loading ? " · Loading…" : ""}</p>
          </section>
          <section className="admin-panel">
            <PanelHead eyebrow="Chunk list" title="The actual split content of each chunk" />
            <div className="curation-chunk-list">
              {chunks.map((c) => (
                <article key={c.id}>
                  <header><b>#{c.chunkIndex}</b><span>{c.charCount} chars</span><button type="button" className="curation-danger" onClick={() => setPending({ title: "Delete chunk", description: `Delete chunk #${c.chunkIndex}? This cannot be undone (it rewrites traditional_chunks directly).`, danger: true, confirmText: "Delete", run: () => remove(c.id) })}>Delete</button></header>
                  <p>{c.text}</p>
                </article>
              ))}
              {!loading && chunks.length === 0 ? <p className="monitoring-empty">This document has no chunks yet.</p> : null}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog open={pending !== null} title={pending?.title ?? ""} description={pending?.description ?? ""} danger={pending?.danger} confirmText={pending?.confirmText} onConfirm={() => { const p = pending; setPending(null); if (p) p.run(); }} onCancel={() => setPending(null)} />
    </AdminShell>
  );
}

// ========== Knowledge-page form: browse pages / edit title and body (write-through + reindex) ==========
export function AdminPageCurationWorkbench({ sources }: { sources: GbrainPageSource[] }) {
  const [active, setActive] = useState(sources[0]?.sourceId ?? "");
  const [pending, setPending] = useState<{ title: string; description: string; danger?: boolean; confirmText?: string; run: () => void } | null>(null);
  const [pages, setPages] = useState<KnowledgePageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = async (sourceId: string, keep = false) => {
    if (!sourceId) return;
    setLoading(true);
    if (!keep) setNotice("");
    try {
      const d = await api(`admin/page-curation/pages?sourceId=${encodeURIComponent(sourceId)}`);
      setPages(d.pages ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to load");
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (active) void load(active); /* eslint-disable-next-line */ }, [active]);

  const startEdit = (p: KnowledgePageItem) => { setEditing(p.slug); setTitle(p.title); setBody(p.body); };

  const save = async () => {
    if (!editing) return;
    setNotice("Saving page (writes through and reindexes)…");
    try {
      const r = await api("admin/page-curation/page/edit", { method: "POST", body: JSON.stringify({ sourceId: active, slug: editing, title, body }) });
      setNotice(r.message || "Saved");
      setEditing(null);
      await load(active, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <AdminShell active="/admin/knowledge-bases" title="Gbrain Management">
      <AdminPageHead eyebrow="Knowledge-page form · editable governance" title="Edit the title and body of structured knowledge pages" description="Knowledge pages are structured pages authored or compiled ahead of time. Revise a page title and its Markdown body here; saving writes the change back and re-splits the index — a better fit than deleting chunks when correcting facts or adding content." />
      <KnowledgeSubnav active="/admin/knowledge-bases/gbrain" />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      {sources.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">No knowledge-page sources have been ingested yet.</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow="Select knowledge base" title="View pages by knowledge base" />
            <div className="curation-source-tabs">
              {sources.map((s) => (
                <button key={s.sourceId} type="button" className={s.sourceId === active ? "active" : ""} onClick={() => setActive(s.sourceId)}>
                  {s.name}{s.scenarioName ? <small>{s.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            <p className="curation-meta">Total <b>{pages.length}</b> pages{loading ? " · Loading…" : ""}</p>
          </section>
          <section className="admin-panel">
            <PanelHead eyebrow="Pages" title="Page title and body (editable)" />
            <div className="curation-page-list">
              {pages.map((p) => (
                <article key={p.slug}>
                  {editing === p.slug ? (
                    <div className="curation-edit-form">
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Markdown body" />
                      <div className="curation-edit-actions">
                        <button type="button" className="curation-primary" onClick={() => setPending({ title: "Overwrite page", description: "Saving overwrites this page body and reindexes it. Overwrite?", confirmText: "Save", run: save })}>Save and reindex</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <header><b>{p.title}</b><span>{p.slug}</span><button type="button" onClick={() => startEdit(p)}>Edit</button></header>
                      <pre>{p.body.slice(0, 600)}{p.body.length > 600 ? "…" : ""}</pre>
                    </>
                  )}
                </article>
              ))}
              {!loading && pages.length === 0 ? <p className="monitoring-empty">This knowledge base has no pages yet.</p> : null}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog open={pending !== null} title={pending?.title ?? ""} description={pending?.description ?? ""} danger={pending?.danger} confirmText={pending?.confirmText} onConfirm={() => { const p = pending; setPending(null); if (p) p.run(); }} onCancel={() => setPending(null)} />
    </AdminShell>
  );
}
