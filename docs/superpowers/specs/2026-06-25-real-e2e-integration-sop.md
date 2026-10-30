# FF CompanyBrain 真实前后端联调 SOP

> 状态：执行版  
> 日期：2026-06-25  
> 适用范围：`apps/web` 前台、后台管理台、`modules/nano-brain`、`modules/traditional-rag`、`modules/graph-rag`、本地 PostgreSQL、OpenRouter、MinerU。

## 1. 目标

本 SOP 用来约束后续所有前台和后台页面开发：任何页面、按钮、表单、弹窗和状态都不能只停留在 UI 或本地模拟数据层，必须能说明它调用哪个后端能力、写入哪些数据、改变什么状态、留下什么记录、失败后怎么恢复。

当前已经跑通的 MVP 闭环作为全站基准：

1. 前台用户登录。
2. 前台创建业务场景并上传文件。
3. 后台管理员看到待处理资料包。
4. 管理员选择 `Gbrain / Naive RAG / GraphRAG` 中的一条真实入库链路。
5. 平台调用对应 RAG 模块完成真实入库。
6. 平台记录 `moduleReferences`，并把场景状态改为 `ready`。
7. 前台用户进入场景提问。
8. 平台根据场景绑定的真实模块调用 `nano/ask`、`traditional/search` 或 `graph/ask`。
9. 前台展示答案、引用和来源文件。
10. 数据库中可以查到平台侧记录与 RAG 模块侧记录。

## 2. 联调总原则

### 2.1 禁止假闭环

以下情况不能算完成：

- 页面按钮点击后只更新 React state。
- 后端只写 `.platform-data`，没有调用真实 RAG 模块。
- 前台问答只读取本地上传文本，没有调用模块检索。
- 后台显示“已入库”，但模块数据库没有 source、document、page、chunk、entity、relationship 或 job 记录。
- 只有成功路径，没有失败状态、错误信息和重试入口。

### 2.2 每个动作必须有六项留痕

每个用户动作都必须能回答：

| 项 | 要求 |
| --- | --- |
| 触发入口 | 页面、按钮、表单或弹窗名称 |
| API | HTTP method、路径、请求体关键字段 |
| 平台留痕 | `.platform-data/platform-db.json` 中的场景、任务、文件、知识对象、`moduleReferences` 或审计记录 |
| 模块留痕 | Nano / Traditional / GraphRAG 对应数据库中的真实记录 |
| UI 状态 | 前台或后台如何显示处理中、成功、失败和可继续操作 |
| 验证方式 | 自动测试、真实 smoke、数据库查询、页面检查 |

### 2.3 前台不暴露技术决策

前台用户只看到：

- 场景能做什么。
- 需要上传什么资料。
- 现在是否可用。
- 能问什么问题。
- 答案来自哪些资料。
- 资料是否可以更新、删除或补充。

前台不让用户选择 `Gbrain / Naive RAG / GraphRAG`，不暴露 chunk、embedding、LightRAG、MinerU 等技术处理细节。

### 2.4 后台必须专业暴露真实链路

后台管理员需要看到：

- 资料包来源、上传人、权限范围、文件列表和预览。
- 推荐引擎与可选引擎。
- 每条引擎的参数。
- 处理进度。
- 入库后的真实资产。
- 检索测试结果。
- 失败原因与重试方式。
- 审计记录。

后台可以出现 `Gbrain / Naive RAG / GraphRAG`，因为后台面向管理员和技术运营人员。

## 3. 当前真实链路基准

### 3.1 Gbrain

| 项 | 当前基准 |
| --- | --- |
| 模块 | `modules/nano-brain` |
| 入库方式 | Markdown 写入 Nano page |
| 核心 API | `POST /internal/users/default-source`、`POST /nano/pages` |
| 问答 API | `POST /nano/ask` |
| 模块留痕 | `sources`、`pages`、`chunks` |
| 平台留痕 | `moduleReferences.moduleId = nano-brain`，`objectKind = page` |

### 3.2 Naive RAG

| 项 | 当前基准 |
| --- | --- |
| 模块 | `modules/traditional-rag` |
| 入库方式 | PDF / Markdown / TXT / DOCX 上传后处理 |
| 核心 API | `POST /traditional/sources`、`POST /traditional/documents`、`GET /traditional/jobs/:id` |
| 问答 API | `POST /traditional/search` |
| 模块留痕 | `traditional_sources`、`traditional_documents`、`traditional_jobs`、`traditional_chunks` |
| PDF 处理 | `PDF -> MinerU -> Markdown -> chunk -> embedding -> search` |
| 平台留痕 | `moduleReferences.moduleId = traditional-rag`，`objectKind = job` |

### 3.3 GraphRAG

| 项 | 当前基准 |
| --- | --- |
| 模块 | `modules/graph-rag` |
| 入库方式 | Markdown / TXT 写入 LightRAG workspace |
| 核心 API | `POST /graph/sources`、`POST /graph/documents/text` |
| 问答 API | `POST /graph/ask` |
| 模块留痕 | `graph_sources`、`graph_documents`、LightRAG entity / relation / chunks 向量表 |
| 平台留痕 | `moduleReferences.moduleId = graph-rag`，`objectKind = document` |

## 4. 页面动作矩阵

### 4.1 前台工作台 `/app`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看业务场景数量 | `GET /api/platform/scenarios` | 数量来自真实登录用户可见场景 | 不读取 fixture 作为最终数量 |
| 查看可用知识 | `GET /api/platform/knowledge-objects` | 展示已发布知识对象与绑定引擎 | 私有、团队、公司权限正确过滤 |
| 查看待处理任务 | `GET /api/platform/tasks` | 任务按处理中、已退回、已发布分组 | 任务状态来自平台真实任务 |
| 点击指标卡 | 跳到对应页面 | 不新开标签页 | 路由保持单标签内跳转 |
| 继续最近场景 | 跳到 `/app/scenarios/:id/ask` | ready 场景直接提问 | 不出现“进入测试”式文案 |

### 4.2 前台问公司大脑 `/app/ask`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 输入问题 | `POST /api/platform/scenarios/:id/ask` 或全局问答路由 | 显示答案、引用、可继续动作 | 必须调用真实模块检索 |
| 匹配已有场景 | 平台根据已发布场景和权限判断 | 推荐可继续使用的场景 | 不展示用户无权访问的场景 |
| 保存为新场景任务 | `POST /api/platform/scenarios` | 进入任务状态 | 后台管理员可看到请求 |

### 4.3 场景模板 `/app/templates`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看模板 | `GET /api/platform/templates` 或本地模板与后端同步 | 模板说明清楚输入、输出、适用情况 | 不只展示演示卡片 |
| 选择官方模板 | 跳转创建流程并带模板 id | 显示模板需要的资料类型 | 后续创建请求带 `template_id` |
| 自建场景 | 跳转 `/app/create` | 清楚选择创建方式 | 有上传资料入口 |
| 查看模板演示 | 读取模板 demo 数据 | 只作为理解模板，不写入真实库 | 与真实创建区分清楚 |

### 4.4 场景创建 `/app/create`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 填写名称和说明 | 表单校验 | 明确说明场景用途 | 名称不能为空 |
| 选择发布范围 | `private / team / company` | 显示权限影响 | 后台和模块读取遵守权限 |
| 上传文件 | `POST /api/platform/scenarios` multipart | 展示文件名、类型、大小 | 平台保存文件记录 |
| 提交后台处理 | 创建 scenario、task、file records | 跳到任务中心或场景任务页 | 后台请求队列出现该资料包 |

### 4.5 场景详情 `/app/scenarios/:id`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看概览 | `GET /api/platform/scenarios`、`tasks`、`knowledge-objects` | 显示当前状态、资料、可执行任务 | 不再显示创建教程式文案 |
| 查看资料 | 文件记录和知识对象 | 可看到上传资料、保留策略、后台处理结果 | retained 文件可预览 |
| 提问 | `POST /api/platform/scenarios/:id/ask` | 返回真实模块答案和引用 | Gbrain/Naive/GraphRAG 均可命中 |
| 查看任务 | `GET /api/platform/tasks` | 显示处理进度和失败原因 | 任务链接进入场景内页 |
| 设置 | 平台更新场景元数据 | 显示权限、名称、说明 | 权限变更需要后端持久化 |

### 4.6 任务中心 `/app/tasks`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看任务列表 | `GET /api/platform/tasks` | 按等待后台、处理中、已发布、已退回分组 | 不混入无权任务 |
| 查看任务详情 | 跳到 `/app/scenarios/:id/tasks` | 展示任务时间线、资料、后台结论 | 不只显示静态卡片 |
| 补充资料 | 新增文件并重新提交后台 | 任务状态变回待处理 | 后台出现新请求或更新请求 |
| 删除/撤回任务 | 后端更新任务状态 | UI 移入已撤回或不可操作 | 需要审计记录 |

### 4.7 前台知识空间 `/app/knowledge`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看知识对象 | `GET /api/platform/knowledge-objects` | 按场景、引擎、权限、来源筛选 | 只展示用户可读资产 |
| 查看来源引用 | 读取平台对象和模块引用 | 展示文件、chunk、page、graph context | 引用能回到具体场景 |
| 申请删除资料 | 创建后台处理请求 | 状态显示等待管理员 | 不能直接删除模块数据 |

## 5. 后台页面动作矩阵

### 5.1 后台 Dashboard `/admin`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 服务健康 | 调用 `/health`、8100、8101、8102 | 显示数据库、模型、MinerU、模块状态 | 不使用静态假状态 |
| 数据总览 | 读取平台 store + 模块数据库摘要 | 展示场景数、任务数、文档数、chunk 数、图谱对象数 | 数据与数据库查询一致 |
| 待办任务 | `GET /api/platform/admin/requests` | 显示待确认、处理中、失败 | 点击进入处理台 |
| 风险提示 | 后端诊断结果 | 显示失败任务、服务异常、未配置密钥 | 有跳转到处理页或设置页 |

### 5.2 后台处理管线 `/admin/pipelines`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 选择资料包 | `GET /api/platform/admin/requests` | 列表只突出待处理和失败项 | 已完成项进入历史，不占主处理区 |
| 预览文件 | `GET /api/platform/admin/files/:id/preview` | PDF、Markdown、CSV 可在线预览 | 非管理员不可访问 |
| 选择引擎 | `PATCH /api/platform/admin/requests/:id` | 展开对应参数和流程 | 引擎名后台可见 |
| 确认入库 | 调用真实模块 | 实时显示 processing、ready、failed | 平台和模块均有留痕 |
| 退回补充 | PATCH reject | 前台任务变为需补充 | 退回原因可见 |
| 重试失败任务 | 重新调用对应模块 | 清除旧失败状态或产生新版本 | 不重复污染旧引用 |

### 5.3 Gbrain 管理 `/admin/knowledge-bases/gbrain`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看 source/page/chunk | Nano DB 或模块 API | 页面、目录、chunk、互链 | 与 `moduleReferences` 可互跳 |
| 检索测试 | `POST /nano/ask` | 展示引用 chunk | 权限过滤正确 |
| 归档页面 | Nano archive API | 前台不再召回 | 平台同步状态 |

### 5.4 Naive RAG 管理 `/admin/knowledge-bases/naive`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看文档 | `traditional_documents` / module API | 文件、状态、MinerU metadata | PDF 显示 `mineru_embedded` |
| 查看 chunk | `GET /traditional/documents/:id/chunks` | chunk 文本、embedding 模型、维度 | chunk 数与数据库一致 |
| 检索测试 | `POST /traditional/search` | keyword / literal / vector diagnostics | 查询可命中入库内容 |
| 删除文档 | `DELETE /traditional/documents/:id` | 标记 archived | 前台不可召回 |

### 5.5 GraphRAG 管理 `/admin/knowledge-bases/graph`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看图谱 workspace | Graph source + LightRAG 表 | 展示 workspace、实体、关系、chunk | 实体关系数量来自真实表 |
| 查看文档 | `GET /graph/documents` | 文档状态、metadata、原文 | failed 显示错误 |
| 图谱问答测试 | `POST /graph/ask` | 展示 context、实体、关系 | 能召回 entity/relation context |
| 删除文档 | `DELETE /graph/documents/:id` | 同步 LightRAG 删除 | 前台不可召回 |

### 5.6 系统设置 `/admin/settings`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看服务配置 | 读取 env mask 和 health | 显示是否配置，不显示明文 key | key 不出现在前端源码或响应里 |
| 测试 OpenRouter | 调用后端诊断接口 | 显示 chat/embedding 是否可用 | 不在浏览器端直接用 key |
| 测试 MinerU | 调用后端诊断接口 | 显示 token、上传、解析状态 | 失败给出可执行原因 |
| 保存配置 | 后续接配置存储 | UI 显示需要重启或立即生效 | 不作为本轮 MVP 必需 |

### 5.7 审计记录 `/admin/audit`

| 动作 | 后端要求 | UI 状态 | 验收 |
| --- | --- | --- | --- |
| 查看审计 | 后端审计 store | 谁在何时创建、审批、入库、删除、重试 | 不只展示 fixture |
| 筛选 | 按用户、场景、引擎、时间 | 表格可筛选 | 与审计记录一致 |

## 6. 开发批次

### Batch 1：真实链路基座加固

目标：把已经跑通的 MVP 变成稳定基座。

任务：

1. 固化 `FF_PLATFORM_INGEST_MODE=real/local` 运行模式。
2. 平台 store 中的 `moduleReferences` 作为真实模块绑定 SSOT。
3. 所有前台问答通过 `moduleReferences` 路由。
4. 后台处理台展示真实模块状态。
5. PDF 入库必须形成可检索 chunk。
6. 增加真实 smoke 脚本，输出 scenario id、module reference、数据库记录和命中结果。

### Batch 2：前台任务与场景工作台

目标：用户可以理解场景状态，并围绕已发布场景使用资料。

任务：

1. 工作台指标全部接真实 API。
2. 任务中心按真实状态分组。
3. 场景详情按 `submitted / processing / ready / failed` 显示不同操作。
4. ready 场景直接进入业务使用。
5. 补充资料、申请删除、重新处理形成后台请求。

### Batch 3：后台处理台产品化

目标：管理员能完成真实资料处理，而不是看静态说明。

任务：

1. 待处理资料包使用表格或队列，不用大卡片堆叠。
2. 文件预览支持 PDF、Markdown、CSV、TXT。
3. 引擎选择后展开参数。
4. 确认入库时显示真实步骤进度。
5. 失败显示错误、上下文和重试。
6. 已完成项进入历史，不占用主处理位。

### Batch 4：三类知识资产管理

目标：后台能分别管理 Gbrain、Naive RAG、GraphRAG 的真实资产。

任务：

1. Gbrain 管理 page、chunk、source、互链。
2. Naive RAG 管理 document、job、chunk、embedding、search diagnostics。
3. GraphRAG 管理 source、workspace、document、entity、relation、context。
4. 知识资产总览只做聚合，不替代三类专项管理页。

### Batch 5：权限与资料生命周期

目标：资料从创建、入库、更新、删除、重试到审计都可追踪。

任务：

1. private / team / company 的平台权限过滤稳定。
2. 模块 private/public 能力与平台 ACL 对齐。
3. 团队范围由平台判断后代理读取 owner private source。
4. 删除和归档走后台审批。
5. 原始文件 retention 策略与解析产物状态可见。
6. 审计记录覆盖所有关键动作。

### Batch 6：系统设置与诊断

目标：管理员能知道系统为什么不可用。

任务：

1. 服务健康真实读取 8100 / 8101 / 8102 / PostgreSQL。
2. OpenRouter chat 和 embedding 单独诊断。
3. MinerU 上传和解析单独诊断。
4. GraphRAG LightRAG 依赖诊断。
5. 错误信息落到后台设置和任务详情中。

## 7. 每条链路的 TDD 标准

每条链路必须包含三层测试。

### 7.1 单元测试

用途：验证平台状态和权限逻辑。

示例：

- 创建场景后能看到任务。
- 非管理员不能看后台请求。
- private/team/company 权限过滤正确。
- 场景 ready 后前台可问答。

### 7.2 fake module 编排测试

用途：不依赖真实 OpenRouter/MinerU，也能证明平台调用了模块 API。

要求：

- fake server 记录路径和请求体。
- 管理员确认后必须调用对应模块 endpoint。
- 平台必须写入 `moduleReferences`。
- 前台 ask 必须再次调用对应模块 search/ask。

### 7.3 真实 smoke

用途：证明真实服务和数据库跑通。

要求：

- 启动 Web、Nano、Traditional、GraphRAG。
- 用真实登录 token。
- 用真实 multipart 上传。
- Naive RAG 至少跑一次真实 PDF。
- GraphRAG 至少跑一次真实 LightRAG 抽取。
- 查询数据库证明留痕存在。

## 8. 真实 smoke 固定检查项

每次真实联调至少输出：

```json
{
  "engine": "Naive RAG",
  "scenarioId": "scene_268e3b0a-e927-4031-bd92-6545bc305cce",
  "taskId": "task_cf99b489-e2f4-41b3-b07a-065d5933572a",
  "status": "已发布",
  "selectedEngine": "Naive RAG",
  "citations": 1,
  "hit": true,
  "moduleReference": {
    "moduleId": "traditional-rag",
    "sourceId": "11c15af3-234f-49f5-8b4c-61c0c20a8941",
    "documentId": "a0e08b61-96ed-4b15-8b9f-49a759adfa40",
    "jobId": "a67338b8-ce63-4558-b841-952bd409cd68",
    "status": "ready"
  }
}
```

数据库检查至少包含：

```sql
-- Nano
select p.id, p.title, count(c.id)
from pages p
left join chunks c on c.page_id = p.id
group by p.id, p.title;

-- Traditional RAG
select d.id, d.original_filename, d.status, j.status, j.stage, count(c.id)
from traditional_documents d
join traditional_jobs j on j.document_id = d.id
left join traditional_chunks c on c.document_id = d.id
group by d.id, d.original_filename, d.status, j.status, j.stage;

-- GraphRAG
select id, original_filename, status, metadata
from graph_documents
order by created_at desc;
```

## 9. 失败处理规范

### 9.1 入库失败

必须显示：

- 哪个模块失败。
- 哪个文件失败。
- 当前阶段。
- 后端错误摘要。
- 是否可以重试。
- 是否需要用户补充资料。

平台状态：

- task 变为 `failed` 或 `waiting_review`。
- scenario 不得变为 `ready`。
- 已写入的部分模块引用必须标记 `failed` 或保持可追踪。

### 9.2 问答失败

必须显示：

- 场景是否 ready。
- 绑定的模块是否健康。
- 是否有可检索的模块引用。
- 模块返回空结果还是调用失败。

前台不直接显示堆栈；后台可以显示详细错误。

### 9.3 权限失败

必须区分：

- 未登录。
- 不是管理员。
- 没有场景读取权限。
- 有平台权限但模块 private source 需要代理 owner 读取。

## 10. 验收门禁

一个页面或链路只有同时满足以下条件，才算完成：

1. UI 入口存在且文案清晰。
2. 按钮或表单调用真实 API。
3. 后端有持久化状态变化。
4. 对应 RAG 模块有真实记录。
5. 前台或后台能展示处理结果。
6. 失败路径可见。
7. 权限过滤正确。
8. 有 TDD 测试。
9. 有真实 smoke 或数据库检查。
10. 不泄露 API key、内部 token 或敏感配置。

## 11. 当前已完成基准

截至 2026-06-25，已经完成并验证：

1. Gbrain Markdown 入库到 Nano Brain，并通过前台 ask 命中。
2. Naive RAG PDF 经过 MinerU、切片、embedding 后，通过前台 ask 命中。
3. GraphRAG Markdown 经 LightRAG 抽取实体关系后，通过前台 ask 命中。
4. 平台侧 `moduleReferences` 可以追踪真实模块对象。
5. `bun test` 全量通过。
6. `bun --cwd apps/web build` 通过。

后续所有开发都以这条真实闭环为最低标准。
