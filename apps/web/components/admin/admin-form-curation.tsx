"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AdminShell, AdminPageHead, PanelHead } from "./admin-pages";
import { ConfirmDialog } from "./admin-confirm-dialog";
import type { NaiveDocument, DocChunk, GbrainPageSource, KnowledgePageItem } from "../../lib/server/platform-store";
import { useI18n } from "../../lib/i18n/language-context";

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
  const { t } = useI18n();
  return (
    <nav className="curation-subnav" aria-label={t("adminCuration.subnavAria")}>
      {KNOWLEDGE_SUBNAV.map((item) => (
        <Link key={item.href} href={item.href} className={item.href === active ? "active" : ""}>{t(item.href === "/admin/knowledge-bases" ? "admin.subnav.assetOverview" : item.href === "/admin/knowledge-bases/gbrain" ? "admin.subnav.gbrain" : item.href === "/admin/knowledge-bases/naive" ? "admin.subnav.naive" : "admin.subnav.graph")}</Link>
      ))}
    </nav>
  );
}

// ========== Document form: browse document chunks / delete noisy chunks ==========
export function AdminDocCurationWorkbench({ documents }: { documents: NaiveDocument[] }) {
  const { t } = useI18n();
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
      setNotice(e instanceof Error ? e.message : t("adminCuration.failedToLoad"));
      setChunks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (active) void load(active); /* eslint-disable-next-line */ }, [active]);

  const remove = async (chunkId: string) => {
    setNotice(t("adminCuration.deletingChunk"));
    try {
      const r = await api("admin/doc-curation/chunk/delete", { method: "POST", body: JSON.stringify({ documentId: active, chunkId }) });
      setNotice(r.message || t("adminCuration.deleted"));
      await load(active, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.deleteFailed"));
    }
  };

  return (
    <AdminShell active="/admin/knowledge-bases" title={t("adminCuration.docShellTitle")}>
      <AdminPageHead eyebrow={t("adminCuration.docEyebrow")} title={t("adminCuration.docTitle")} description={t("adminCuration.docDescription")} />
      <KnowledgeSubnav active="/admin/knowledge-bases/naive" />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      {documents.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">{t("adminCuration.noDocuments")}</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow={t("adminCuration.selectDocument")} title={t("adminCuration.viewChunksByDocument")} />
            <div className="curation-source-tabs">
              {documents.map((d) => (
                <button key={d.documentId} type="button" className={d.documentId === active ? "active" : ""} onClick={() => setActive(d.documentId)}>
                  {d.name}{d.scenarioName ? <small>{d.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            <p className="curation-meta">{t("adminCuration.totalChunks", { count: chunks.length })}{loading ? ` · ${t("adminCuration.loading")}` : ""}</p>
          </section>
          <section className="admin-panel">
            <PanelHead eyebrow={t("adminCuration.chunkList")} title={t("adminCuration.chunkListTitle")} />
            <div className="curation-chunk-list">
              {chunks.map((c) => (
                <article key={c.id}>
                  <header><b>#{c.chunkIndex}</b><span>{t("adminCuration.chars", { count: c.charCount })}</span><button type="button" className="curation-danger" onClick={() => setPending({ title: t("adminCuration.deleteChunk"), description: t("adminCuration.deleteChunkDescription", { index: c.chunkIndex }), danger: true, confirmText: t("adminCuration.delete"), run: () => remove(c.id) })}>{t("adminCuration.delete")}</button></header>
                  <p>{c.text}</p>
                </article>
              ))}
              {!loading && chunks.length === 0 ? <p className="monitoring-empty">{t("adminCuration.noChunks")}</p> : null}
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
  const { t } = useI18n();
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
      setNotice(e instanceof Error ? e.message : t("adminCuration.failedToLoad"));
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (active) void load(active); /* eslint-disable-next-line */ }, [active]);

  const startEdit = (p: KnowledgePageItem) => { setEditing(p.slug); setTitle(p.title); setBody(p.body); };

  const save = async () => {
    if (!editing) return;
    setNotice(t("adminCuration.savingPage"));
    try {
      const r = await api("admin/page-curation/page/edit", { method: "POST", body: JSON.stringify({ sourceId: active, slug: editing, title, body }) });
      setNotice(r.message || t("adminCuration.saved"));
      setEditing(null);
      await load(active, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("adminCuration.saveFailed"));
    }
  };

  return (
    <AdminShell active="/admin/knowledge-bases" title={t("adminCuration.pageShellTitle")}>
      <AdminPageHead eyebrow={t("adminCuration.pageEyebrow")} title={t("adminCuration.pageTitle")} description={t("adminCuration.pageDescription")} />
      <KnowledgeSubnav active="/admin/knowledge-bases/gbrain" />
      {notice ? <p className="admin-console-notice" role="status">{notice}</p> : null}
      {sources.length === 0 ? (
        <section className="admin-panel"><p className="monitoring-empty">{t("adminCuration.noKnowledgePages")}</p></section>
      ) : (
        <>
          <section className="admin-panel">
            <PanelHead eyebrow={t("adminCuration.selectKnowledgeBase")} title={t("adminCuration.viewPagesByKnowledgeBase")} />
            <div className="curation-source-tabs">
              {sources.map((s) => (
                <button key={s.sourceId} type="button" className={s.sourceId === active ? "active" : ""} onClick={() => setActive(s.sourceId)}>
                  {s.name}{s.scenarioName ? <small>{s.scenarioName}</small> : null}
                </button>
              ))}
            </div>
            <p className="curation-meta">{t("adminCuration.totalPages", { count: pages.length })}{loading ? ` · ${t("adminCuration.loading")}` : ""}</p>
          </section>
          <section className="admin-panel">
            <PanelHead eyebrow={t("adminCuration.pages")} title={t("adminCuration.pageTitleBody")} />
            <div className="curation-page-list">
              {pages.map((p) => (
                <article key={p.slug}>
                  {editing === p.slug ? (
                    <div className="curation-edit-form">
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("adminCuration.titlePlaceholder")} />
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder={t("adminCuration.bodyPlaceholder")} />
                      <div className="curation-edit-actions">
                        <button type="button" className="curation-primary" onClick={() => setPending({ title: t("adminCuration.overwritePage"), description: t("adminCuration.overwritePageDescription"), confirmText: t("adminCuration.save"), run: save })}>{t("adminCuration.saveAndReindex")}</button>
                        <button type="button" onClick={() => setEditing(null)}>{t("adminCuration.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <header><b>{p.title}</b><span>{p.slug}</span><button type="button" onClick={() => startEdit(p)}>{t("adminCuration.edit")}</button></header>
                      <pre>{p.body.slice(0, 600)}{p.body.length > 600 ? "…" : ""}</pre>
                    </>
                  )}
                </article>
              ))}
              {!loading && pages.length === 0 ? <p className="monitoring-empty">{t("adminCuration.noPages")}</p> : null}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog open={pending !== null} title={pending?.title ?? ""} description={pending?.description ?? ""} danger={pending?.danger} confirmText={pending?.confirmText} onConfirm={() => { const p = pending; setPending(null); if (p) p.run(); }} onCancel={() => setPending(null)} />
    </AdminShell>
  );
}
