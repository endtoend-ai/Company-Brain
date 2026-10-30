"""把 eval/corpus/graph-rag/docs/*.md 灌进 traditional-rag 指定 source（复用同世界语料）。

用法：RAG_INTERNAL_TOKEN=... python eval/ingest_traditional.py <source_id> [docs_dir] [batch]
traditional POST /documents 是 multipart 上传 + 后台 job（chunk+embed 异步），需 poll document status→ready。
分批上传，控制并发。
"""
import glob
import json
import os
import sys
import time
import urllib.request
import uuid

BASE = "http://127.0.0.1:8101"
SID = sys.argv[1]
DOCS = sys.argv[2] if len(sys.argv) > 2 else "/Users/mac/Git/ff-companybrain/eval/corpus/graph-rag/docs"
BATCH = int(sys.argv[3]) if len(sys.argv) > 3 else 5
TOKEN = os.environ["RAG_INTERNAL_TOKEN"]

BASE_HEADERS = {
    "x-ff-internal-token": TOKEN,
    "x-ff-user-id": "00000000-0000-0000-0000-000000000000",
    "x-ff-username": "admin",
    "x-ff-is-admin": "true",
}


def _multipart(fields, filename, filecontent):
    """构造 multipart/form-data body。fields=普通表单项 dict，file 字段名固定 'file'。"""
    boundary = "----ff" + uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8"))
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: text/markdown\r\n\r\n".encode("utf-8")
    )
    parts.append(filecontent)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(parts)
    return body, f"multipart/form-data; boundary={boundary}"


def _upload(filename, content):
    body, ctype = _multipart({"source_id": SID}, filename, content)
    headers = dict(BASE_HEADERS)
    headers["content-type"] = ctype
    req = urllib.request.Request(BASE + "/traditional/documents", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["document"]["id"]


def _status(did):
    req = urllib.request.Request(BASE + f"/traditional/documents/{did}", headers=BASE_HEADERS)
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
            name = os.path.basename(f)
            content = open(f, "rb").read()
            try:
                ids[_upload(name, content)] = name
            except Exception as e:
                print("UPLOAD_FAIL", name, e, flush=True)
                fail += 1
        deadline = time.time() + 300
        pending = set(ids)
        while pending and time.time() < deadline:
            time.sleep(4)
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
