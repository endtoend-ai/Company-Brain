# Tasks · source 幂等化修复

> 执行链：Opus 规划审核 · GLM 执行 · Opus 落盘 · Codex 第三方审核 · 测试验证

## T1 · 实现（GLM 执行，Opus 落盘）
- [ ] T1.1 新增 `ensureModuleSource` + `findModuleSourceByName` + `isDuplicateSourceError`（`apps/web/lib/server/platform-store.ts`，紧邻 `moduleJson`/`realSourceName` 附近）。
- [ ] T1.2 `ingestNaiveRagFile`（:4386）source 创建改用 `ensureModuleSource("Naive RAG","/traditional/sources",...)`。
- [ ] T1.3 `ingestGraphRagFile`（:4443）改用 `ensureModuleSource("GraphRAG","/graph/sources",...)`。
- [ ] T1.4 `ingestGbrainFile`（:4337 公共分支）改用 `ensureModuleSource("Gbrain","/nano/sources",...)`；私有分支不动。
- [ ] T1.5 孤儿清理：无遗留未用导入/变量（仅本次改动引入的才清）。

## T2 · 静态验证（Opus）
- [ ] T2.1 `bun x tsc --noEmit` 通过。

## T3 · Codex 第三方独立审核
- [ ] T3.1 codex exec 独立审：get-or-create 正确性 / 幂等 / 409 检测健壮性（字符串匹配是否够稳）/ name 精确匹配风险 / 权限一致 / 是否引入新静默失败 / 与既有 withDbLock·非原子容错的相容性。
- [ ] T3.2 Opus 对 Codex 建议做三验（事实可验 / 与既有约束一致 / 代价评估）再决定采纳，避免 reviewer 错改方向堵门。

## T4 · 运行时端到端验证（Opus，Playwright + DB + curl）
- [ ] T4.1 重启前端 dev（改的是 apps/web 运行时代码，HMR 可能不覆盖 server 模块，必要时重启）。
- [ ] T4.2 重建场景 E（02+05）→ DB 查同 source 下 2 doc ready + chunks（AC1）。
- [ ] T4.3 三问 Q1/Q2/Q3 全命中，Q3 引 05 含 99.95%/≤800ms（AC5）。
- [ ] T4.4 幂等复验：对同一场景再触发一次入库，不再 409（AC3）。
- [ ] T4.5 回归：场景 B(06+07) 两篇入（AC6）；`bun run smoke:platform` GraphRAG 段不再 409（AC2/AC6）；单文件场景仍正常（AC4）。

## T5 · 收尾
- [ ] T5.1 台账 I87 状态更新为「已修 + 验证」，补 commit hash + Codex verdict（模板 7 字段补全 4/5/6/7）。
- [ ] T5.2 清理调试场景（旧 partial E / SLA合同单测05 / SLA合同重试 / 多余重复 E），备份 platform-db.json 后操作（承接任务 #27）。
- [ ] T5.3（可选）用户批准后提交 commit（当前非 default 分支约束按仓库 CLAUDE.md）。

## 依赖顺序
T1 → T2 →（T3 与 T4 可并行，但 T3 有阻断权：BLOCK 则回 T1）→ T5。
GATE：spec 未经用户确认，不进入 T1。
