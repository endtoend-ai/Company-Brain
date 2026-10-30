"""DSPy GEPA 优化路由 instruction（direct/retrieve 分类）。复用 memory reference_dspy_gepa_real_run 流程。
task LM = 项目实际路由模型 deepseek-v4-flash(OpenRouter)；reflection LM 用更强模型。"""
import json, os, random
import dspy

KEY = os.environ["AGENT_API_KEY"]; BASE = os.environ["AGENT_BASE_URL"].rstrip("/"); MODEL = os.environ["AGENT_MODEL"]
SC = os.path.dirname(__file__)

task_lm = dspy.LM(MODEL, api_key=KEY, api_base=BASE, temperature=0, max_tokens=200)
# reflection 用同款 deepseek-v4-flash（OpenRouter 确认可用，temperature 高做反思重写）
refl_lm = dspy.LM(MODEL, api_key=KEY, api_base=BASE, temperature=1.0, max_tokens=8000)
dspy.configure(lm=task_lm)


class RouteSig(dspy.Signature):
    """判断用户问题是否需要检索企业知识库。寒暄、闲聊、一般常识、无明确企业资料诉求 => direct；涉及企业资料、客户、合同、制度、数据、报告、来源、内部流程、已上传文件、业务分析 => retrieve。"""
    query = dspy.InputField(desc="用户问题")
    mode = dspy.OutputField(desc="只输出 direct 或 retrieve")


router = dspy.Predict(RouteSig)


def norm(m):
    return "retrieve" if "retrieve" in str(m).lower() else "direct"


def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
    got = norm(pred.mode)
    ok = got == gold.route
    if ok:
        fb = f"正确：「{gold.query}」应 {gold.route}。"
    elif gold.route == "retrieve":
        fb = (f"错误：「{gold.query}」应 retrieve 却判 {got}。这是企业内部实体问题（{gold.tag}）。"
              "判据补充：**企业人物姓名（如某人是谁/负责什么/汇报关系）、产品名、投资机构、公司名，"
              "即使字面像通用词或通用问法（X是谁/X是什么/X投了谁/X总部在哪），只要可能指向企业内部实体、"
              "需要内部资料才能准确回答，都必须 retrieve**，不能当通用常识 direct 直答（direct 会导致 LLM 编造企业事实）。")
    else:
        fb = (f"错误：「{gold.query}」应 direct 却判 {got}。寒暄/通用常识/通用文本生成（写邮件/翻译/写诗，"
              "不涉及具体企业实体或内部资料）应 direct，不必检索。")
    return dspy.Prediction(score=1.0 if ok else 0.0, feedback=fb)


rows = [json.loads(l) for l in open(SC + "/route_evalset.jsonl")]
examples = [dspy.Example(query=r["query"], route=r["route"], tag=r["tag"]).with_inputs("query") for r in rows]
random.seed(7); random.shuffle(examples)
n = len(examples); cut = int(n * 0.55)
train, val = examples[:cut], examples[cut:]
print(f"train={len(train)} val={len(val)}", flush=True)

ev = dspy.Evaluate(devset=val, metric=metric, num_threads=6, display_progress=False)
base_score = ev(router).score
print(f"\n[基线] val 准确率 = {base_score:.1f}%", flush=True)

gepa = dspy.GEPA(metric=metric, auto="light", reflection_lm=refl_lm)
optimized = gepa.compile(router, trainset=train, valset=val)

opt_score = ev(optimized).score
print(f"\n[GEPA优化后] val 准确率 = {opt_score:.1f}%", flush=True)

# 全集 + 边界 breakdown（判断是否真解决边界，而非 val 子集碰巧简单）
full_ev = dspy.Evaluate(devset=examples, metric=metric, num_threads=6, display_progress=False)
edge = [e for e in examples if "边界" in e.tag]
edge_ev = dspy.Evaluate(devset=edge, metric=metric, num_threads=6, display_progress=False)
print(f"[全集60] baseline={full_ev(router).score:.1f}%  optimized={full_ev(optimized).score:.1f}%", flush=True)
print(f"[边界25] baseline={edge_ev(router).score:.1f}%  optimized={edge_ev(optimized).score:.1f}%", flush=True)
print(f"\ndemos 数: {len(getattr(optimized,'demos',[]))}", flush=True)
print("instruction 是否变化:", optimized.signature.instructions != router.signature.instructions, flush=True)
print("\n===== 优化后 instruction =====")
print(optimized.signature.instructions)
open(SC + "/gepa_optimized_instruction.txt", "w").write(optimized.signature.instructions)
