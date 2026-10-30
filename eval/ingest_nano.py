"""把 eval/corpus/graph-rag/docs/*.md 灌进 nano-brain 指定 source（复用同世界语料）。

用法：RAG_INTERNAL_TOKEN=... python eval/ingest_nano.py <source_id> [docs_dir]
nano putMarkdownPage 同步 embed（prepareChunksForMarkdown→embedTexts），入库即可检索，无需 Dream。
slug 用 p7-NN（ascii 安全，中文文件名做 title），逐篇 POST /nano/pages。
"""
import glob
import json
import os
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8100"
SID = sys.argv[1]
DOCS = sys.argv[2] if len(sys.argv) > 2 else "/Users/mac/Git/ff-companybrain/eval/corpus/graph-rag/docs"
TOKEN = os.environ["RAG_INTERNAL_TOKEN"]

HEADERS = {
    "x-ff-internal-token": TOKEN,
    "x-ff-user-id": "00000000-0000-0000-0000-000000000000",
    "x-ff-username": "admin",
    "x-ff-is-admin": "true",
    "content-type": "application/json",
}


def _put_page(slug, title, body):
    data = json.dumps(
        {"source_id": SID, "slug": slug, "title": title, "body": body, "content_type": "text/markdown"}
    ).encode("utf-8")
    # 同步 embed 偶发瞬时 500（provider 抖动），有界重试退避。
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE + "/nano/pages", data=data, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())["page"]["id"]
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise last


def main():
    files = sorted(glob.glob(DOCS + "/*.md"))
    print(f"{len(files)} docs, source={SID}", flush=True)
    ok = fail = 0
    for i, f in enumerate(files):
        title = os.path.basename(f)[:-3]
        body = open(f, encoding="utf-8").read()
        slug = f"p7-{i:02d}"
        try:
            pid = _put_page(slug, title, body)
            ok += 1
            print(f"OK {slug} {title} -> {pid}", flush=True)
        except Exception as e:
            fail += 1
            print(f"FAIL {slug} {title}: {e}", flush=True)
    print(f"DONE ok={ok} fail={fail} total={len(files)}", flush=True)


if __name__ == "__main__":
    main()
