"""检索评测 harness（P5/P7）。读 golden/{module}.jsonl，调模块 /search，算指标，出 markdown 报告。

用法：RAG_INTERNAL_TOKEN=... python eval/run_eval.py <module> [tag]
  module ∈ {graph-rag, nano-brain, traditional}；tag 缺省用时间戳，用于区分 A/B（如 before-l1 / after-l1）。

指标：
  - graph-rag：返回证据文本 context（无 chunk id）→ 代理指标 keyword_coverage / source_hit / nonempty（不叫 recall）。
  - nano-brain / traditional：返回 doc 级稳定标识（nano=slug / traditional=filename）+ score →
    **文档级 recall@1/3/5/10 + MRR**（chunk_id 重切后变，不作锚点；page/doc 级稳定）+ keyword_coverage（次要）。
    recall@k = |expected_docs ∩ top-k doc_ids| / |expected_docs|，逐条算后求均值。
"""
import glob  # noqa: F401  (保留给后续多模块扩展)
import json
import os
import sys
import time
import urllib.request
from datetime import datetime


def _pctl(values, p):
    # 简单分位（nearest-rank），values 已含所有成功查询的延迟 ms。
    if not values:
        return None
    s = sorted(values)
    idx = min(len(s) - 1, int(round((p / 100) * (len(s) - 1))))
    return round(s[idx], 1)

ROOT = os.path.dirname(os.path.abspath(__file__))
_positional = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
_flags = {
    arg.split("=", 1)[0]: arg.split("=", 1)[1]
    for arg in sys.argv[1:]
    if arg.startswith("--") and "=" in arg
}
MODULE = _positional[0] if _positional else "graph-rag"
TAG = _positional[1] if len(_positional) > 1 else datetime.now().strftime("%Y%m%d-%H%M")
TOKEN = os.environ["RAG_INTERNAL_TOKEN"]
GOLDEN_PATH = _flags.get("--golden", f"{ROOT}/golden/{MODULE}.jsonl")
REPORTS_DIR = _flags.get("--reports", f"{ROOT}/reports")

BASE_BY_MODULE = {
    "graph-rag": os.environ.get("GRAPH_RAG_HTTP_URL", "http://127.0.0.1:8102").rstrip("/"),
    "nano-brain": os.environ.get("NANO_BRAIN_HTTP_URL", "http://127.0.0.1:8100").rstrip("/"),
    "traditional": os.environ.get("TRADITIONAL_RAG_HTTP_URL", "http://127.0.0.1:8101").rstrip("/"),
}

# module → (检索路径前缀, 结果里取 doc_id 的方式, 取 snippet 的方式)
RETRIEVAL_ADAPTERS = {
    "nano-brain": {
        "path": "nano",
        "doc_id": lambda x: x.get("slug"),
        "snippet": lambda x: x.get("snippet", ""),
    },
    "traditional": {
        "path": "traditional",
        "doc_id": lambda x: (x.get("document") or {}).get("filename"),
        "snippet": lambda x: (x.get("chunk") or {}).get("snippet", ""),
    },
}
RECALL_KS = [1, 3, 5, 10]

HEADERS = {
    "x-ff-internal-token": TOKEN,
    "x-ff-user-id": "00000000-0000-0000-0000-000000000000",
    "x-ff-username": "admin",
    "x-ff-is-admin": "true",
    "content-type": "application/json",
}


def _post(base, path, body):
    # query embedding 偶发瞬时 500/429（provider 抖动），有界重试退避，避免污染 A/B 对比。
    data = json.dumps(body).encode("utf-8")
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(base + path, data=data, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503) and attempt < 3:
                import time
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise last


# ---------- graph-rag（P5，保持原逻辑）----------
def _graph_search(query, source_id, mode, k):
    body = {"query": query, "limit": k, "mode": mode}
    if source_id:
        body["source_id"] = source_id
    return _post(BASE_BY_MODULE["graph-rag"], "/graph/search", body)


def _eval_graph(rows):
    per, kw_scores, hit_scores, nonempty, lats = [], [], [], 0, []
    for r in rows:
        k = r.get("k", 10)
        t0 = time.perf_counter()
        try:
            res = _graph_search(r["query"], r.get("source_id"), r.get("mode", "mix"), k)
            results = res.get("results", [])
        except Exception as e:
            per.append({"id": r["id"], "query": r["query"], "error": str(e)})
            continue
        lat_ms = round((time.perf_counter() - t0) * 1000, 1)
        lats.append(lat_ms)
        ctx = " ".join(str(x.get("context", "")) for x in results)
        kws = r["expected"].get("keywords", [])
        hit_kw = [w for w in kws if w in ctx]
        kw_cov = round(len(hit_kw) / len(kws), 3) if kws else None
        exp_sids = set(r["expected"].get("source_ids", []))
        got_sids = {x.get("source_id") for x in results}
        src_hit = (len(exp_sids & got_sids) > 0) if exp_sids else None
        if results:
            nonempty += 1
        if kw_cov is not None:
            kw_scores.append(kw_cov)
        if src_hit is not None:
            hit_scores.append(1 if src_hit else 0)
        per.append({
            "id": r["id"], "query": r["query"], "mode": r.get("mode", "mix"),
            "n_results": len(results), "kw_cov": kw_cov, "src_hit": src_hit,
            "missed_kw": [w for w in kws if w not in ctx],
        })
    summary = {
        "total": len(rows),
        "nonempty_rate": round(nonempty / len(rows), 3) if rows else 0,
        "keyword_coverage_avg": round(sum(kw_scores) / len(kw_scores), 3) if kw_scores else None,
        "source_hit_rate": round(sum(hit_scores) / len(hit_scores), 3) if hit_scores else None,
        "latency_ms": {"p50": _pctl(lats, 50), "p95": _pctl(lats, 95), "max": max(lats) if lats else None},
    }
    return per, summary


# ---------- nano-brain / traditional（P7，文档级真 recall）----------
def _eval_retrieval(rows, module):
    adapter = RETRIEVAL_ADAPTERS[module]
    base = BASE_BY_MODULE[module]
    path = f"/{adapter['path']}/search"
    # fail-fast（codex 异源审）：检索评测每行必须有非空 expected.docs 锚点。空行是畸形数据——
    # 若放行，recall 会被跳过而 MRR 记 0，把"无相关文档"误当失败样本，指标不一致。
    missing = [r["id"] for r in rows if not r.get("expected", {}).get("docs")]
    if missing:
        raise SystemExit(f"golden 行缺 expected.docs（检索评测必须有文档锚点）：{missing}")
    per = []
    agg = {f"recall@{k}": [] for k in RECALL_KS}
    mrr_list, kw_scores, nonempty, lats = [], [], 0, []
    for r in rows:
        k = r.get("k", 10)
        body = {"query": r["query"], "limit": k}
        if r.get("source_id"):
            body["source_id"] = r["source_id"]
        t0 = time.perf_counter()
        try:
            res = _post(base, path, body)
            results = res.get("results", [])
        except Exception as e:
            per.append({"id": r["id"], "query": r["query"], "error": str(e)})
            continue
        lats.append(round((time.perf_counter() - t0) * 1000, 1))
        doc_ids = [adapter["doc_id"](x) for x in results]
        snippets = " ".join(str(adapter["snippet"](x)) for x in results)
        expected = set(r["expected"].get("docs", []))
        kws = r["expected"].get("keywords", [])

        if results:
            nonempty += 1
        # 逐 k recall（命中的 expected 数 / expected 总数）
        row_recall = {}
        for kk in RECALL_KS:
            topk = set(d for d in doc_ids[:kk] if d is not None)
            row_recall[kk] = (len(expected & topk) / len(expected)) if expected else None
            if row_recall[kk] is not None:
                agg[f"recall@{kk}"].append(row_recall[kk])
        # MRR：首个命中 expected 的 1-indexed 排名
        hit_rank = next((i + 1 for i, d in enumerate(doc_ids) if d in expected), None)
        mrr_list.append(1 / hit_rank if hit_rank else 0)
        # keyword_coverage（次要）
        kw_cov = round(len([w for w in kws if w in snippets]) / len(kws), 3) if kws else None
        if kw_cov is not None:
            kw_scores.append(kw_cov)
        missed_docs = [d for d in expected if d not in set(doc_ids[:10])]
        per.append({
            "id": r["id"], "query": r["query"], "n_results": len(results),
            "hit_rank": hit_rank, "recall@10": round(row_recall[10], 3) if row_recall[10] is not None else None,
            "kw_cov": kw_cov, "missed_docs": missed_docs,
            "missed_kw": [w for w in kws if w not in snippets],
        })
    summary = {"total": len(rows), "nonempty_rate": round(nonempty / len(rows), 3) if rows else 0}
    for kk in RECALL_KS:
        vals = agg[f"recall@{kk}"]
        summary[f"recall@{kk}"] = round(sum(vals) / len(vals), 3) if vals else None
    summary["mrr"] = round(sum(mrr_list) / len(mrr_list), 3) if mrr_list else None
    summary["keyword_coverage_avg"] = round(sum(kw_scores) / len(kw_scores), 3) if kw_scores else None
    summary["latency_ms"] = {"p50": _pctl(lats, 50), "p95": _pctl(lats, 95), "max": max(lats) if lats else None}
    # A/B 干净性（deepseek 异源审）：异常行被跳过会让两次跑的分母漂移、recall 均值不可比。
    # 不把 provider 错误当 recall=0（那是测量失败非检索失败），而是 fail-loud：有残留 error 就标记，main 里非零退出，operator 重跑。
    summary["errored"] = len([p for p in per if "error" in p])
    summary["errored_ids"] = [p["id"] for p in per if "error" in p]
    return per, summary


# ---------- 报告 ----------
def _write_report(per, summary, is_graph):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    path = f"{REPORTS_DIR}/{MODULE}-{TAG}.md"
    lines = [f"# {MODULE} 检索评测报告 · {TAG}", ""]
    if is_graph:
        lines.append("## 汇总（相对回归指标，非绝对 recall）")
        lines.append(f"- 条目数：{summary['total']}")
        lines.append(f"- 召回非空率 nonempty_rate：{summary['nonempty_rate']}")
        lines.append(f"- 关键词覆盖均值 keyword_coverage_avg：{summary['keyword_coverage_avg']}")
        lines.append(f"- source 命中率 source_hit_rate：{summary['source_hit_rate']}")
        lat = summary.get("latency_ms", {})
        lines.append(f"- 检索延迟 latency_ms：p50={lat.get('p50')} / p95={lat.get('p95')} / max={lat.get('max')}")
        lines.append("")
        lines.append("## 逐条")
        lines.append("| id | mode | n | kw_cov | src_hit | missed_keywords | query |")
        lines.append("|---|---|---|---|---|---|---|")
        for p in per:
            if "error" in p:
                lines.append(f"| {p['id']} | - | ERR | - | - | {p['error'][:40]} | {p['query'][:40]} |")
                continue
            missed = "、".join(p["missed_kw"]) if p["missed_kw"] else "—"
            lines.append(
                f"| {p['id']} | {p['mode']} | {p['n_results']} | {p['kw_cov']} | {p['src_hit']} | {missed} | {p['query'][:40]} |"
            )
    else:
        lines.append("## 汇总（文档级真 recall）")
        lines.append(f"- 条目数：{summary['total']}")
        lines.append(f"- 召回非空率 nonempty_rate：{summary['nonempty_rate']}")
        for kk in RECALL_KS:
            lines.append(f"- recall@{kk}：{summary[f'recall@{kk}']}")
        lines.append(f"- MRR：{summary['mrr']}")
        lines.append(f"- 关键词覆盖均值 keyword_coverage_avg：{summary['keyword_coverage_avg']}")
        lat = summary.get("latency_ms", {})
        lines.append(f"- 检索延迟 latency_ms：p50={lat.get('p50')} / p95={lat.get('p95')} / max={lat.get('max')}")
        lines.append("")
        lines.append("## 逐条")
        lines.append("| id | n | hit_rank | recall@10 | kw_cov | missed_docs | query |")
        lines.append("|---|---|---|---|---|---|---|")
        for p in per:
            if "error" in p:
                lines.append(f"| {p['id']} | ERR | - | - | - | {p['error'][:40]} | {p['query'][:40]} |")
                continue
            missed = "、".join(p["missed_docs"]) if p["missed_docs"] else "—"
            lines.append(
                f"| {p['id']} | {p['n_results']} | {p['hit_rank']} | {p['recall@10']} | {p['kw_cov']} | {missed} | {p['query'][:40]} |"
            )
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    summary_path = f"{REPORTS_DIR}/{MODULE}-{TAG}-summary.json"
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "module": MODULE,
                "tag": TAG,
                "generated_at": datetime.now().isoformat(),
                "summary": summary,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
    return path


def main():
    golden = GOLDEN_PATH
    rows = [json.loads(x) for x in open(golden, encoding="utf-8") if x.strip()]
    if MODULE == "graph-rag":
        per, summary = _eval_graph(rows)
    elif MODULE in RETRIEVAL_ADAPTERS:
        per, summary = _eval_retrieval(rows, MODULE)
    else:
        raise SystemExit(f"未知 module：{MODULE}（支持 graph-rag / nano-brain / traditional）")
    path = _write_report(per, summary, is_graph=(MODULE == "graph-rag"))
    print(json.dumps(summary, ensure_ascii=False))
    print("report:", path)
    # fail-loud：retrieval 类若有查询在重试后仍失败，本次报告不得用于 A/B（分母不足 total），非零退出提示重跑。
    if summary.get("errored"):
        print(
            f"WARNING: {summary['errored']} 条查询重试后仍失败 {summary['errored_ids']}，"
            f"分母 < {summary['total']}，本报告不可用于 A/B 对比，请重跑。",
            file=sys.stderr,
        )
        raise SystemExit(2)


if __name__ == "__main__":
    main()
