# 变更提案 · Naive RAG 问答接入表格检索（根治 I83）

> 类型：brownfield 缺陷根治 ｜ 日期：2026-07-02 ｜ 关联：`PKP/07-问题与修复台账.md` I83
> 协作：Opus 规划+审核+落盘+回归 ｜ glm 执行（生成代码）｜ codex 第三方审核

## 一、问题与根因（已实证，见 I83）

CSV/XLSX 资料入库走表格分支，数据写入 `traditional_structured_rows`（每行 embedding，pgvector），**不产 chunk**。而平台问答的 Naive RAG 检索只调 chunk 端点 `POST /traditional/search`（SQL 全部 `FROM traditional_chunks`）→ 纯表格资料（场景 B 06csv/07xlsx）永远召回空。

- 场景内问答：`citations=0`，返回兜底话术。
- 全域问答：命中同世界观 05 合同 PDF 的 chunk，**静默答错数值**（D1 北方银行年度合同额答成 ¥1,680,000，正确应为 06 csv 的 3,600,000）。

模块已有 `/traditional/structured/search` 端点且实测秒命中（北方银行行 score 1.76，literal+vector），**缺口仅在问答层未调用它**。

## 二、方案（方案 A：前端合并，后端零改）

### 唯一改动文件：`apps/web/lib/server/platform-store.ts`

Naive RAG 检索的唯一底层调用点是两个函数，所有上层（全域问答 :1891/:2896、场景 ask :4527、知识验证 :1914/:2853）都经它们拿 `{text,sourceId,documentId}[]`。**在这两个函数内把 chunk 检索与表格检索结果合并返回，全部上层自动获得表格召回、零改。**

**新增 helper**（表格单源检索，两处复用）：
```ts
// 表格资料（CSV/XLSX）数据存 traditional_structured_rows，chunk /search 查不到（I83 根治）。
// /traditional/structured/search 仅支持单 source_id；把命中行的 semantic_text 作为召回文本，与 chunk 结果同构。
async function searchNaiveStructured(
  reader: StoreUser, query: string, sourceId: string, limit: number
): Promise<Array<{ text: string; sourceId: string; documentId: string }>> {
  const body = await moduleJson<{ results?: any[] }>("Naive RAG", "/traditional/structured/search", {
    method: "POST", user: reader,
    body: { query, limit, source_id: sourceId }
  });
  return (body.results ?? [])
    .map((row) => ({ text: String(row.semantic_text ?? ""), sourceId: String(row.source_id ?? ""), documentId: String(row.document_id ?? "") }))
    .filter((r) => r.text.trim() && r.sourceId);
}
```

**改 `searchNaiveGlobal`（多源）**：chunk 多源检索保持不变；追加按源并行调 `searchNaiveStructured`（因 structured 端点仅单源），单源失败隔离（`.catch(()=>[])`），合并返回。reader 沿用已有 `{...user, role:"admin"}`（sourceIds 充当权限边界）。

**改 `searchModuleForReference` 的 Naive 分支（单源）**：chunk 检索保持不变；追加一路 `searchNaiveStructured(reader, query, ref.sourceId, limit)`（reader 用现有 `moduleReaderForReference(user, ref)`），单源失败隔离，把 `.text` 并入返回的 `string[]`。

### 关键约束（glm 必须遵守）
1. **chunk 检索原行为零变化**：不动 `/traditional/search` 调用、min_score 透传逻辑、结果映射。只做「追加合并」。
2. **数据映射**：表格行 `text=semantic_text`、`sourceId=source_id`、`documentId=document_id`。
3. **失败隔离**：structured 检索失败（单源或整体）必须 `.catch` 兜底为空数组，绝不能让新增路径拖垮已有 chunk 召回。
4. **数量控制**：`searchNaiveStructured` 的 limit 传入不超过上层 limit；合并后交上层 rerank/截断处理，不在 helper 内额外放大。
5. **后端 Python / 数据库 / 迁移零改**。

### 为何不选方案 B（后端加 source_ids 复数）
方案 B 需改 `structured.py` `_build_scope` + `StructuredSearchRequest` + 可能迁移，跨模块跨语言、回归面大。方案 A 纯 TS 单文件、后端零改，符合 KISS 与 brownfield 最小侵入。全域按源循环的额外开销可控（Naive 源数量少 + 并行）。

## 三、任务分解（协作三角）

| # | 任务 | 负责 |
|---|---|---|
| T1 | 出本 spec + 钉死代码事实与映射 | Opus（已完成）|
| T2 | 按 spec 生成 `searchNaiveStructured` + 改两函数的完整代码 | glm（llm-router）|
| T3 | 审 glm 产出 + 落盘到 platform-store.ts | Opus |
| T4 | 第三方独立审 diff（事实核查/失败隔离/映射正确性/无回归） | codex exec |
| T5 | 回归验证（见四） | Opus |

## 四、回归验证方案（成功标准）

1. **类型**：`bun x tsc --noEmit` 通过。
2. **单测**：`bun test apps/web/lib/server/platform-store.test.ts packages/platform/src/scenarios.test.ts` 全绿（无回归）。
3. **后端 API 断言**（member token）：`POST /api/platform/scenarios/{sceneB}/ask`
   - D1「北方银行的年度合同额是多少？」→ `citations>0` 且证据/答案含 **3600000**（或 3,600,000）。
   - A1「合同号 ZY-CONTRACT-2026-0087 是哪个客户的？」→ 场景内 `citations>0` 且命中 06 csv。
   - D2「企业版套餐包含哪些模块、文档配额多少？」→ 命中 07 xlsx 行。
4. **Playwright UI 复测**：场景内问答 D1/D2 从「兜底空召回」变为命中 06/07 表格并答对；全域问答 D1 不再静默答错（应召回 06 的 3,600,000）。
5. **无副作用**：Gbrain/GraphRAG 检索路径、chunk 召回（如 05 PDF）行为不变。

## 五、回滚

单文件改动，`git diff apps/web/lib/server/platform-store.ts` 可完整回退；无迁移、无数据变更、无后端改动，回滚零风险。

## 六、状态（✅ 全部完成 2026-07-02）

- [x] T1 规划（Opus）
- [x] T2 glm 执行（zhipu/glm-5.2 生成 helper + 两函数改动）
- [x] T3 落盘（Opus，含防御性类型加固）
- [x] T4 codex 审（gpt-5.5，verdict PASS_WITH_NITS；NIT#4 structured 超时已采纳，加 8s 超时兜底）
- [x] T5 回归：tsc 0 错 / 单测零回归（stash 对比）/ API 断言 D1=3,600,000·A1=北方银行 / Playwright UI 端到端 D1 从空召回→3,600,000

**结论**：I83 已根治。Naive RAG 场景内 + 全域问答现可召回 CSV/XLSX 表格数据并答对。台账 I83 已标记 ✅ 已根治。
**遗留（非本提案）**：场景 B 的 07 xlsx 因 I87（多文件 source 同名 409 静默丢弃）未入库，D2「企业版套餐」问题需待 I87（`proposals/2026-07-02-idempotent-source-ensure/`）修复后自然解决。
