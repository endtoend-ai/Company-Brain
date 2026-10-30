# Rollback · source 幂等化修复

## 回滚触发条件
- Codex 审出实质缺陷且无法在本轮修正；
- 验证阶段出现回归（既有场景检索行为变化、tsc 失败、入库反而更差）；
- 用户叫停。

## 回滚方式（单文件、无 DB 迁移，极简）
1. **代码**：改动仅限 `apps/web/lib/server/platform-store.ts`。
   - 若已 commit：`git revert <hash>`（不使用 `reset --hard`）。
   - 若未 commit：`git checkout -- apps/web/lib/server/platform-store.ts` 或删除新增 helper + 还原三处调用为原 `moduleJson(POST /sources)`。
2. **无需回滚数据**：本次不改 DB schema、不做迁移；已入库的 source/document/chunk 保持有效，回滚后行为退回"多文件第 2 篇 409 被丢"（即修复前状态），不损坏既有数据。
3. **服务**：回滚后重启前端 dev 使其生效。

## 数据侧注意
- 本修复期间为验证会**新建若干测试场景**并在 RAG 模块产生 source/document/chunk。回滚代码**不会**自动清理这些测试数据；测试数据清理走独立步骤（承接任务 #27，备份 `apps/web/.platform-data/platform-db.json` 后按场景 id 移除，并可选清理 `traditional_rag_db` 对应 source）。
- 回滚不影响 `PKP/07-问题与修复台账.md` 已记录的 I87/I88（保留为历史）。

## 验证回滚成功
- `bun x tsc --noEmit` 通过；前端重启后 `/admin/pipelines` 可正常单文件入库；行为回到修复前基线。
