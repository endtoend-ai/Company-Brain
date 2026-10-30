# Spec · 多文件场景入库 source 幂等化修复（I87 / I74#3 / I84）

> dev-team proposal 模式 · 2026-07-02 · 增量变更（brownfield）
> 关联台账：`PKP/07-问题与修复台账.md` I87（Naive）、I74#3（Gbrain）、I84（GraphRAG）、I74#4（非原子容错次要项）

## 1. 背景与问题（Why）

在真实 UI 端到端测试「场景 E · 制度与合同文档库（Naive RAG + MinerU，2 份 PDF）」时坐实一个**系统性功能缺陷**：

- 现象：上传 02+05 两份 PDF、管理员点「确认入库」，UI 显示「已确认入库·可使用」，但**实际只入了第 1 篇（02），第 2 篇（05）被静默丢弃**，前台问「北方银行合同 SLA 指标」答不出。
- 根因（`[行为]`+`[源码核验]`）：`ingestScenarioSources`（`apps/web/lib/server/platform-store.ts:4209`）按文件循环入库，每个 per-file 函数各自 `POST /{module}/sources` 建 source；而 source 名是**场景级**（`realSourceName` = `scene-{scenario.id}-{engine}`，同场景所有文件同名）。→ 第 1 篇建 source 成功，**第 2 篇起用同名再建必得 `HTTP 409 duplicate_source`** → 抛错 → 被 per-file `try/catch + continue`（:4218-4235）静默跳过。因非全失败，`:4299` 守卫不触发，整场景仍标「可使用」，UI 不暴露丢失。
- 三引擎同根同源：`ingestGbrainFile`（:4256，公共分支）= I74#3；`ingestGraphRagFile`（:4443）= I84；`ingestNaiveRagFile`（:4386）= I87。本 spec **一次性修复三条腿**。
- 附带覆盖 re-approve/重试场景：source 在上一次尝试已建，重试时**连第 1 篇也会 409**（正是 I84「全 3 篇失败」成因）。

证据链见台账 I87（前端日志 409 原文含 05/07、DB 只入 02、三次批量必丢、Q3 拒答；反证：05 单独入库成功 + 补入后 Q3 完美召回「可用性 99.95%/P99≤800ms」）。

## 2. 目标（What / 验收条件）

以「先写验收条件，再让它通过」的方式定义完成标准：

- **AC1（核心）**：含 ≥2 文件的 Naive RAG 场景入库后，同一 source 下**每一篇**都有 `document`（status=ready）与 chunks/table_rows，**无一篇因 409 被丢**。
- **AC2**：三引擎一致——Gbrain（公共）、GraphRAG 同类多文件场景同样全篇入库。
- **AC3（幂等）**：对**同一场景重复入库/重试**（source 已存在）不再 409，复用既有 source，不重复建、不报错。
- **AC4（回归不破）**：单文件场景、私有场景（Gbrain 走 default-source）、既有已入库场景检索行为不变；`bun x tsc --noEmit` 通过。
- **AC5（端到端）**：重建场景 E（02+05）→ Q1（密级编号）/Q2（差旅报销）/Q3（北方银行 SLA）**全部命中且带正确原文引用**（Q3 引 05，含 99.95%/≤800ms）。
- **AC6（回归验证）**：场景 B（06 csv+07 xlsx）两篇都入；GraphRAG 冒烟不再因 `POST /graph/sources` 409 失败。

## 3. 范围（Scope）

**改**：仅 `apps/web/lib/server/platform-store.ts`（前端统一 API 编排层）。
- 新增 `ensureModuleSource`（get-or-create 幂等 helper）。
- 三处 source 创建改用它：`ingestNaiveRagFile`、`ingestGraphRagFile`、`ingestGbrainFile`（公共分支）。

**不改**（明确排除）：
- 不碰三个 RAG 模块（`modules/*`）与任何 DB schema/迁移——三模块已具备 `GET /{module}/sources`，无需后端改动（符合架构边界：apps 只经模块 HTTP 边界）。
- 不改 `ingestScenarioSources` 的非原子容错语义（I74#4 次要项，本次不动，仅在 design 记建议）。
- 不改 Gbrain 私有分支（`/internal/users/default-source` 已幂等）。
- 不做检索编排/表格召回（I83/I85）等其它台账项。

## 4. 非目标 / 已知次要项

- I74#4「部分入库静默、仅全失败才报错」：本次不修，但**建议**后续把 per-file 失败上抛到审批结果/资产台账，使管理员可见。记入 design「后续建议」。
- I88 的 MinerU 瞬时 SSL EOF：环境网络抖动，非本次代码范围。

## 5. 风险与影响面

- **低风险**：单文件层、get-or-create 是加法式增强，不改既有成功路径的数据形态。
- 主要风险点：① `GET /sources` 按 name 精确匹配的正确性（避免误配）；② 并发/竞态（同场景并发入库）——现有 `withDbLock` + 每场景 sequential 循环已基本串行化，helper 内再兜底 409→重查。
- 回滚简单（见 rollback.md）：单文件、无 DB 迁移，`git revert` 即可。

## 6. 执行方式（协作链）

Opus 规划+审核 → GLM（经 llm-router）执行代码 → Opus 落盘 → Codex 第三方独立审核（三验后采纳）→ 测试验证（tsc + 重启 + Playwright 端到端 + 回归）。
