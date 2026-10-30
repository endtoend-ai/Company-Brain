"""测当前 classifyQueryWithModel 路由 prompt 在评测集上的基线准确率。用项目 AGENT LLM(deepseek-v4-flash via OpenRouter)。"""
import json, os, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = os.environ["AGENT_BASE_URL"].rstrip("/")
KEY = os.environ["AGENT_API_KEY"]
MODEL = os.environ["AGENT_MODEL"]

# 强化版（GEPA metric feedback 提炼的边界规则 + 保守默认，platform-store.ts 待移植）
SYS = "\n".join([
    "你是企业知识中台的 Agentic RAG 路由器，判断用户问题是否需要检索企业知识库。",
    "【direct】仅限：寒暄闲聊、与具体企业实体无关的通用常识、通用文本生成（翻译/写诗/写通用模板邮件）。",
    "【retrieve】涉及任何企业内部实体、或需要内部资料才能准确回答的问题。",
    "**特别注意（最易误判）**：企业人物姓名（X是谁/X负责什么/X向谁汇报/X的背景）、产品名（X是什么/X怎么样/X做什么）、投资机构（X投了谁/X和谁合作）、公司名（X总部在哪/X何时成立/X的CFO是谁），**即使字面像通用词或通用问法，只要可能指向企业内部实体，一律判 retrieve**——因为误走 direct 会让模型编造企业事实。",
    "判断不确定时默认 retrieve（宁可检索后诚实拒答，也不可 direct 直答编造）。",
    "只返回 JSON：{\"mode\":\"direct|retrieve\",\"reason\":\"简短中文原因\"}。",
])

def classify(query):
    body = json.dumps({
        "model": MODEL, "temperature": 0, "max_tokens": 160,
        "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": query}],
    }).encode()
    req = urllib.request.Request(BASE + "/chat/completions", data=body, method="POST",
        headers={"authorization": f"Bearer {KEY}", "content-type": "application/json"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                content = json.loads(r.read())["choices"][0]["message"]["content"]
            s = content.strip()
            i, j = s.find("{"), s.rfind("}")
            obj = json.loads(s[i:j+1])
            return "retrieve" if obj.get("mode") == "retrieve" else "direct"
        except Exception:
            continue
    return "ERROR"

rows = [json.loads(l) for l in open(os.path.dirname(__file__)+"/route_evalset.jsonl")]
def one(r):
    got = classify(r["query"])
    return {**r, "got": got, "ok": got == r["route"]}
with ThreadPoolExecutor(max_workers=6) as ex:
    res = list(ex.map(one, rows))

ok = sum(1 for r in res if r["ok"])
print(f"路由基线准确率: {ok}/{len(res)} = {round(100*ok/len(res),1)}%\n")
print("=== 误判清单(重点看边界)===")
for r in res:
    if not r["ok"]:
        print(f"  [{r['tag']}] expect={r['route']} got={r['got']} | {r['query']}")
# 边界例单独统计
edge = [r for r in res if "边界" in r["tag"]]
edge_ok = sum(1 for r in edge if r["ok"])
print(f"\n边界例准确率: {edge_ok}/{len(edge)} = {round(100*edge_ok/len(edge),1)}%")
