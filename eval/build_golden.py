"""把 _p7_source.jsonl（doc_stems 中间态）映射成两个模块的黄金集。

nano-brain：doc → slug（p7-NN，按 corpus 排序索引，与 ingest_nano.py 一致）。
traditional：doc → filename（stem + '.md'，与 ingest_traditional.py 上传名一致）。
每个 stem 必须对应真实语料文件，否则报错退出。
用法：python eval/build_golden.py
"""
import glob
import json
import os
import sys

ROOT = "/Users/mac/Git/ff-companybrain/eval"
DOCS = f"{ROOT}/corpus/graph-rag/docs"
NANO_SID = "ab60d419-1273-4f72-ba60-8eb2c02d854c"
TRAD_SID = "e9de33c1-70d1-42f5-9723-3068861a9ae7"

files = sorted(glob.glob(DOCS + "/*.md"))
stem_to_slug = {os.path.basename(f)[:-3]: f"p7-{i:02d}" for i, f in enumerate(files)}
valid_stems = set(stem_to_slug)

src = [json.loads(x) for x in open(f"{ROOT}/golden/_p7_source.jsonl", encoding="utf-8") if x.strip()]
nano_rows, trad_rows, bad = [], [], []
for r in src:
    stems = r["expected"]["doc_stems"]
    for s in stems:
        if s not in valid_stems:
            bad.append((r["id"], s))
    kws = r["expected"].get("keywords", [])
    nano_rows.append({
        "id": "nb-" + r["id"].split("-")[1], "query": r["query"], "source_id": NANO_SID,
        "layer": r.get("layer"),
        "expected": {"docs": [stem_to_slug[s] for s in stems if s in valid_stems], "keywords": kws},
    })
    trad_rows.append({
        "id": "tr-" + r["id"].split("-")[1], "query": r["query"], "source_id": TRAD_SID,
        "layer": r.get("layer"),
        "expected": {"docs": [s + ".md" for s in stems], "keywords": kws},
    })

if bad:
    print("ERROR 未知 doc_stem:", bad, file=sys.stderr)
    raise SystemExit(1)

with open(f"{ROOT}/golden/nano-brain.jsonl", "w", encoding="utf-8") as f:
    for r in nano_rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
with open(f"{ROOT}/golden/traditional.jsonl", "w", encoding="utf-8") as f:
    for r in trad_rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"OK nano={len(nano_rows)} traditional={len(trad_rows)} 全部 stem 校验通过")
