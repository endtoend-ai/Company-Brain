# Product Language Guide — English (US) & Brand

This guide is the single source of truth for user-facing copy, demo content, and brand naming in
CompanyBrain. Apply it to every change that touches UI text, seeded data, or user-visible errors.

## 1. Brand

- Product name: **CompanyBrain** (one word, capital C and B).
- Remove every occurrence of the former vendor name (the Chinese two-character brand) from code,
  fixtures, docs, tests, and comments. Replace with `CompanyBrain` or delete the phrase.
- The browser title and wordmark read `CompanyBrain`. Do not add a tagline that repeats the product
  name.
- Package names (`@ff/*`), env var names, API paths, and database names are identifiers: never
  translate or rename them.

## 2. Locale

- UI language: English (US). `<html lang="en">`.
- Dates: `Jan 5, 2026` (short) or `01/05/2026` (numeric). Locale for `toLocaleString` /
  `toLocaleDateString` is `en-US`.
- Currency: `$1,200`, `$280/night`. Never use `元`, `￥`, or `人民币`.
- Numbers: thousands separators (`12,480`), percentages (`18%`).
- Time zones: `PT`, `ET` when a zone matters. No China-specific references (`国内`, `一线城市`,
  `华东`, `华南`, `微信`, `飞书`, `钉钉`, `阿里云`).
- Sentence case for descriptions and buttons; Title Case for navigation labels and page titles.

## 3. Terminology

| Chinese | English |
| --- | --- |
| 企业知识中台 | enterprise knowledge platform |
| 知识应用工作台 / 前台工作区 | workspace |
| 知识运营后台 / 后台 | admin console |
| 全域问答 / 问公司大脑 | Ask CompanyBrain / company-wide Q&A |
| 知识库 | knowledge base |
| 业务场景 / 场景 | scenario |
| 方案模板 / 场景模板 / 模板 | template |
| 知识资产 | knowledge assets |
| 资料 / 文件 | files |
| 来源 / 知识来源 | source |
| 文档 | document |
| 文档资料库 | document library |
| 关系知识库 | relationship knowledge base |
| 个人知识库 | personal knowledge base |
| 空间 / 知识空间 | knowledge space |
| 入库 / 已入库 / 入库中 | ingest / ingested / ingesting |
| 处理管线 | processing pipeline |
| 处理任务 | processing tasks |
| 待处理 | pending |
| 复核 / 等待复核 | review / pending review |
| 检索策略 | retrieval policy |
| 质量评估 | quality evaluation |
| 运行监控 | monitoring |
| 系统接入 | integrations |
| 模板治理 | template governance |
| 资产总览 | asset overview |
| 关系图谱 | knowledge graph |
| 审计记录 | audit log |
| 试问 / 召回验证 | recall verification |
| 精排 | rerank |
| 召回 | retrieval |
| 引用 / 证据 | citation / evidence |
| 切片 | chunk |
| 解析 | parse |
| 事实卡 / 事实线索 | fact card / fact submission |
| 知识页 | page |
| 捕获 | capture |
| 巡检 | health check |
| 成品 | deliverable |
| 成员 | member |
| 管理员 | admin |
| 员工 | employee |
| 可见范围 / 权限 | visibility / permissions |
| 数据集 | dataset |
| 测试问题集 | evaluation question set |
| 拒答 | refusal (answer-with-no-evidence) |
| 低置信 | low confidence |
| 实体 / 关系边 | entity / relationship edge |
| 社区摘要 | community summary |
| 多跳 | multi-hop |
| 索引重建 | reindex |

Use “Gbrain”, “Naive RAG”, “GraphRAG”, “LangGraph”, “DeepSeek”, “DashScope”, “OpenRouter”, and
“MinerU” verbatim. They are product/provider names, not copy to translate.

## 4. Demo universe (US)

The demo tenant is **Northwind Labs**, a ~180-person B2B SaaS company headquartered in San
Francisco. All scenarios, files, people, and answers must fit that company.

Departments: Sales, Sales Ops, HR & Finance, Legal, Solutions Engineering, Customer Success, Risk &
Compliance, Industry Research, Business Analytics, IT Operations, Product Ops.

People (replace the corresponding Chinese demo names):

| Chinese | English |
| --- | --- |
| 张磊 | Maya Chen |
| 林澄 | Jordan Lee |
| 周琪 | Priya Shah |
| 陈予 | Daniel Kim |
| 许宁 | Alex Rivera |
| 刘洋 | Emily Carter |
| 孟然 | Michael Torres |
| 何晴 | Sarah Johnson |
| 沈知夏 | Olivia Grant |
| 陆衡 | Ethan Brooks |
| 秦知予 | Rachel Nguyen |
| 何清宁 | Hannah Lee |
| 顾问团队 | Research team |
| 木羽 (demo member) | Maya Chen |

Customer accounts: Acme Health (Bay Area), Summit Manufacturing (Austin), Pacific Union Bank,
Atlas Industrial, Skyline Networks, Northstar Cloud, Bridgepoint Capital, Redwood Retail.

Projects: Project Atlas, Project Aurora, Project Bluefin.

Geography: West Coast, East Coast, Southwest; San Francisco, New York, Austin, Seattle.

Policies and facts must be US-plausible:

- Travel: `$280/night` hotel cap in San Francisco, `$75/day` meals, receipts within 30 days.
- PTO: 15 days, 10 holidays, parental leave 12 weeks.
- Compliance: SOC 2 Type II, HIPAA, CCPA; vendor security review takes 2 weeks.
- Contracts: MSA, DPA, auto-renewal 60 days before term end, 30-day termination notice.
- Metrics: ARR, NRR, churn, pipeline coverage; quarters as `Q3 FY26`.

Example scenario flavor:

- Personal: “Maya's customer call notes”, “Sales objection handling wiki”.
- Team: “New hire onboarding handbook”, “Acme Health renewal brief”.
- Company: “Travel & expense policy Q&A”, “IT access request policy”.
- Graph: “Acme Health account map”, “Supplier risk investigation”.
- Documents: “SOC 2 evidence pack”, “Vendor security questionnaire responses”.

## 5. Engineering rules

1. Translate only user-facing strings: JSX text, labels, placeholders, `aria-label`, `title`,
   toasts, empty states, errors shown in UI, seeded demo content, and API error messages that the
   UI renders.
2. Leave identifiers, keys, slugs, enum values, DB columns, env vars, URLs, and file paths
   unchanged.
3. Code comments may stay in Chinese; brand references inside comments must still be removed.
4. Keep the existing structure: do not reformat files, rename variables, or change behavior.
5. Update tests that assert translated copy. Test titles may stay in Chinese.
6. Do not introduce an i18n framework or a language switch; English is the only UI language.
7. After editing, run `bun run check:brand` and confirm it passes, and run
   `bun x tsc --noEmit` (7 pre-existing errors are known: test fixtures, seed script, and a
   duplicate export in `packages/platform/src/index.ts`).
8. Report changed files and any string you intentionally left in Chinese (with reason).
