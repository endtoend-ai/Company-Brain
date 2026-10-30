"""批量把 eval/corpus/graph-rag/docs/*.md ingest 进 graph-rag 指定 source。

用法：RAG_INTERNAL_TOKEN=... python eval/ingest_corpus.py <source_id> [docs_dir] [batch]
分批 POST + poll ready，控制并发避免同时打爆 LLM 抽取 provider。
"""
import glob
import json
import os
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8102"
SID = sys.argv[1]
DOCS = sys.argv[2] if len(sys.argv) > 2 else "/Users/mac/Git/ff-companybrain/eval/corpus/graph-rag/docs"
BATCH = int(sys.argv[3]) if len(sys.argv) > 3 else 5
TOKEN = os.environ["RAG_INTERNAL_TOKEN"]

HEADERS = {
    "x-ff-internal-token": TOKEN,
    "x-ff-user-id": "00000000-0000-0000-0000-000000000000",
    "x-ff-username": "admin",
    "x-ff-is-admin": "true",
    "content-type": "application/json",
}


def _post_text(text, title):
    body = json.dumps({"source_id": SID, "text": text, "title": title}).encode("utf-8")
    req = urllib.request.Request(BASE + "/graph/documents/text", data=body, headers=HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())["document"]["id"]


def _status(did):
    req = urllib.request.Request(BASE + f"/graph/documents/{did}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())["document"]["status"]


def main():
    files = sorted(glob.glob(DOCS + "/*.md"))
    print(f"{len(files)} docs, batch={BATCH}, source={SID}", flush=True)
    done = fail = 0
    for i in range(0, len(files), BATCH):
        batch = files[i:i + BATCH]
        ids = {}
        for f in batch:
            title = os.path.basename(f)[:-3]
            text = open(f, encoding="utf-8").read()
            try:
                ids[_post_text(text, title)] = title
            except Exception as e:
                print("POST_FAIL", title, e, flush=True)
                fail += 1
        deadline = time.time() + 300
        pending = set(ids)
        while pending and time.time() < deadline:
            time.sleep(6)
            for did in list(pending):
                try:
                    st = _status(did)
                except Exception:
                    continue
                if st in ("ready", "failed"):
                    pending.discard(did)
                    if st == "ready":
                        done += 1
                    else:
                        fail += 1
                        print("INGEST_FAIL", ids[did], flush=True)
        if pending:
            print("TIMEOUT_BATCH pending:", [ids[d] for d in pending], flush=True)
            fail += len(pending)
        print(f"progress: done={done} fail={fail} / {len(files)}", flush=True)
    print(f"DONE ready={done} failed={fail} total={len(files)}", flush=True)


if __name__ == "__main__":
    main()
