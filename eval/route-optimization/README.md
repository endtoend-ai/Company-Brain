# 全域问答路由 prompt 优化（台账 I74 #9）

用 DSPy 评测驱动优化全域问答的 direct/retrieve 路由判断，减少"像通用词的企业实体"被误判 direct → LLM 幻觉。

## 结果

| | 路由总准确率 | 边界例(25 条) |
|---|---|---|
| 原 zero-shot JSON prompt | 86.4% | 65% |
| 强化后（已移植 `platform-store.ts`） | **98.3%** | **100%** |

**关键发现**：GEPA 未产出新 instruction——DSPy 结构化 signature 格式下 baseline 已 98.3%/边界100%（"不动满分"）。说明模型能力足够、真问题在原 prompt 格式+边界规则缺失。落地是把边界规则手工移植回 TS `classifyQueryWithModel` + `generateDirectGlobalReply`。详见 memory `reference_dspy_gepa_real_run`。

## 文件

- `route_evalset.jsonl` — 路由评测集 60 条（含 25 边界例：人名/产品名/机构/公司名像通用词）
- `baseline_route.py` — 测某版 prompt 在评测集上的准确率（SYS 变量=当前强化版；对比改回原 prompt）
- `gepa_route.py` — DSPy 3.2.1 GEPA 优化脚本（task=deepseek-v4-flash / reflection 同款；metric feedback 教边界规则）
- `gepa_optimized_instruction.txt` — GEPA 输出的 instruction（本次=未变，见上）

## 环境（venv 不进 git，本目录 `.venv/`）

重建（首次或 .venv 缺失时）：

```bash
cd eval/route-optimization
python3 -m venv .venv
source .venv/bin/activate
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple dspy
```

## 运行

```bash
cd /Users/mac/Git/ff-companybrain
set -a; source .env; set +a                       # AGENT_BASE_URL/KEY/MODEL（路由 LLM）
source eval/route-optimization/.venv/bin/activate
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
python eval/route-optimization/baseline_route.py  # 测当前 prompt 准确率 + 边界 breakdown
python eval/route-optimization/gepa_route.py       # GEPA 优化（含全集/边界对比）
```

## 待办（#9 ③）

`no_answer_policy`（后台"拒答策略"下拉）当前是死配置（未接线到答案生成）。接线 + 按档位分 prompt 见台账 I74 #9 正解方向③。
