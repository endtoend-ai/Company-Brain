# Design · source 幂等化修复

> 对应 spec.md · 目标 AC1-AC6

## 1. 现状代码事实（源码核验）

`apps/web/lib/server/platform-store.ts`：

- `moduleJson<T>(engine, path, {method,user,body?,form?})`（:4663）：非 2xx 时 `throw new Error("... HTTP <status> <bodyJson>")`——**无结构化 status 字段**，错误信息里含 `HTTP 409` 和 `{"error":"duplicate_source",...}`。
- `realSourceName(scenario, suffix)`（:4717-4721）：返回 `scene-{scenario.id}-{suffix}`（ASCII slug，≤90 字符），**场景级**、同场景所有文件相同。
- 三处每文件建 source：
  - `ingestNaiveRagFile`（:4386）：`POST /traditional/sources` body `{name: realSourceName(s,"naive"), kind, description}` → `.source`。
  - `ingestGraphRagFile`（:4443）：`POST /graph/sources` body `{name: realSourceName(s,"graph"), kind, description}` → `.source`。
  - `ingestGbrainFile`（:4337-4347）：**公共分支** `POST /nano/sources` body `{name: realSourceName(s,"gbrain"), kind:"public"}` → `.source`；私有分支走 `/internal/users/default-source`（已幂等，不动）。
- 三模块均有 `GET /{module}/sources` 返回 `{sources: [{id, name, kind, ...}]}`（traditional `sources.py:24`、graph `sources.py:24`、nano `routes/sources.ts:8`）。
- `moduleHeaders` 需要 `RAG_INTERNAL_TOKEN` + 用户 headers（同一 `moduleJson` 调用即带）。

## 2. 方案选择

### 推荐 · Option B：新增幂等 `ensureModuleSource`（get-or-create），三处调用替换

理由：最小 diff、最局部、robust；不改函数签名、不动循环结构；天然覆盖「多文件同场景」与「re-approve 重试 source 已存在」两种 409。GLM 执行面小、Codex 审查面清晰。

```ts
// 幂等确保场景级 source 存在：先按 name 查已有，无则创建；创建撞 409 再兜底重查。
// 覆盖 (a) 同场景多文件第 2+ 篇、(b) re-approve/重试时 source 已存在 两种情形。
async function ensureModuleSource(
  engine: AdminRagEngine,
  listPath: string,     // e.g. "/traditional/sources" | "/graph/sources" | "/nano/sources"
  writer: StoreUser,
  createBody: { name: string; kind: "private" | "public"; description?: string }
): Promise<{ id: string; name: string; kind: "private" | "public" }> {
  // 1) 先查：命中同名直接复用
  const existing = await findModuleSourceByName(engine, listPath, writer, createBody.name);
  if (existing) return existing;
  // 2) 未命中则创建
  try {
    const created = await moduleJson<{ source: { id: string; name: string; kind: "private" | "public" } }>(
      engine, listPath, { method: "POST", user: writer, body: createBody }
    );
    return created.source;
  } catch (error) {
    // 3) 并发/竞态：创建时被他方抢先 → 409，回查复用；否则原样抛出
    if (isDuplicateSourceError(error)) {
      const raced = await findModuleSourceByName(engine, listPath, writer, createBody.name);
      if (raced) return raced;
    }
    throw error;
  }
}

async function findModuleSourceByName(engine, listPath, writer, name) {
  const { sources } = await moduleJson<{ sources: Array<{ id: string; name: string; kind: "private" | "public" }> }>(
    engine, listPath, { method: "GET", user: writer }
  );
  return (sources ?? []).find((s) => s.name === name) ?? null;
}

function isDuplicateSourceError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("HTTP 409") && error.message.includes("duplicate_source");
}
```

三处调用替换（示例 Naive）：
```ts
// 旧：const source = (await moduleJson(... POST /traditional/sources ...)).source;
const source = await ensureModuleSource("Naive RAG", "/traditional/sources", writer, {
  name: realSourceName(input.scenario, "naive"), kind: sourceKind, description: input.scenario.description
});
```
Graph、Gbrain（公共分支）同构替换（各自 listPath / suffix / body 保持原值）。

### 备选 · Option A：hoist 到 `ingestScenarioSources` 循环外，每场景 ensure 一次，sourceId 传入 per-file

更"正确"（source 是场景级概念），但改 3 个函数签名 + 循环，diff 更大、Codex/GLM 面更宽。**本次不采用**，除非 Codex 审出 Option B 有实质缺陷。

## 3. 关键设计点 / 边界

- **name 精确匹配**：`realSourceName` 已保证同场景稳定唯一 slug，`GET /sources` 只在该用户 readable 范围内列举，`find(s.name===name)` 安全。若同名多条（历史脏数据）取第一条即可（复用任一即达成入库）。
- **权限一致**：ensure 用与原调用相同的 `writer`（public 场景=admin，private=场景 owner），GET/POST 同权限，可见性一致。
- **幂等语义**：get-or-create 使「重复入库/重试」从"报错丢篇"变为"复用既有 source 继续入库后续文件"，符合 AC3。
- **不改错误传播**：若 GET 与 POST 都失败（真·模块不可用），仍抛原 Error → 落回 per-file catch continue（既有行为），不引入新静默。
- **ts 类型**：`AdminRagEngine` 已有类型；helper 复用 `moduleJson` 泛型，无 `as any`。

## 4. 后续建议（不在本次范围）

- I74#4：per-file 失败上抛到审批结果/资产台账（管理员可见「N 篇中 M 篇失败」），根治"部分入库静默"。
- Option A 的 hoist 重构可作为后续清理（减少 N-1 次冗余 GET）。

## 5. 验证设计（对应 AC）

- 静态：`bun x tsc --noEmit`（AC4）。
- 运行时（`[行为]`）：重启前端 → Playwright 重建场景 E(02+05) → 查 `traditional_rag_db` 同 source 下 2 doc ready + chunks（AC1）→ Q1/Q2/Q3 全命中、Q3 引 05（AC5）→ 场景 B(06+07) 两篇入（AC6）→ `bun run smoke:platform` GraphRAG 段不再 409（AC2/AC6）→ 对同场景再入库一次不 409（AC3）。
