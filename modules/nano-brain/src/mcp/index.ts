import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getUserByBearerToken } from '@ff/identity';
import type { UserContext } from '@ff/contracts';
import { listAuditLogs, type AuditLog, type AuditAction } from '../core/audit';
import { captureContent } from '../core/capture';
import { saveFactCandidates } from '../core/fact-candidates';
import { getDreamStatus, getReadableDreamRunReport, runDream } from '../core/dream/runner';
import { type DreamPhase } from '../core/dream/types';
import { reviewFactSubmission, type FactReviewAction } from '../core/fact-review';
import { getFact, listEntityFacts, listFacts, type NanoFact } from '../core/facts';
import {
  getFactSubmission,
  listAdminFactSubmissions,
  listFactSubmissions,
  submitFactSubmission,
  type FactSubmission,
  type FactSubmissionStatus,
} from '../core/fact-submissions';
import { getPage, type NanoPage } from '../core/pages';
import { searchNanoBrain, type NanoSearchResult } from '../core/search';
import {
  graphQuery,
  listBacklinks,
  listOutgoingLinks,
  type NanoLink,
} from '../core/links';
import { NanoBrainError, type NanoSource } from '../core/sources';
import { NanoBrainPermissionError } from '../core/permissions';
import { toPublicDreamReport, toPublicDreamStatus } from '../http/serializers';

// Nano Brain 自带的 MCP Server，与 HTTP API（apps/api）并列的入口适配层。
// 业务逻辑全部复用本模块 core；本文件只做：鉴权、参数适配、序列化、错误映射。

const SERVER_NAME = 'nano-brain';
const SERVER_VERSION = '0.1.0';
const TOKEN_ENV = 'NANO_BRAIN_MCP_TOKEN';

class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpAuthError';
  }
}

// 与 HTTP API 一致：每次工具调用都按当前 Bearer Token 解析用户，尊重 token 过期。
async function resolveUserContext(): Promise<UserContext> {
  const token = process.env[TOKEN_ENV];
  if (!token) {
    throw new McpAuthError(`${TOKEN_ENV} is not configured; the MCP server cannot identify the caller`);
  }
  const user = await getUserByBearerToken(token);
  if (!user) {
    throw new McpAuthError('Token is invalid or expired');
  }
  return { userId: user.id, username: user.username, isAdmin: user.isAdmin };
}

function toPublicLink(link: NanoLink) {
  return {
    id: link.id,
    source_id: link.sourceId,
    from_page_id: link.fromPageId,
    from_slug: link.fromSlug,
    to_source_id: link.toSourceId,
    to_slug: link.toSlug,
    link_type: link.linkType,
    context: link.context,
    confidence: link.confidence,
    created_by: link.createdBy,
    created_at: link.createdAt,
  };
}

function toPublicSource(source: NanoSource) {
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    owner_user_id: source.ownerUserId,
    created_by: source.createdBy,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

function toPublicFact(fact: NanoFact) {
  return {
    id: fact.id,
    source_id: fact.sourceId,
    submission_id: fact.submissionId,
    entity_slug: fact.entitySlug,
    fact: fact.fact,
    kind: fact.kind,
    confidence: fact.confidence,
    notability: fact.notability,
    context: fact.context,
    valid_from: fact.validFrom,
    valid_until: fact.validUntil,
    claim_metric: fact.claimMetric,
    claim_value: fact.claimValue,
    claim_unit: fact.claimUnit,
    claim_period: fact.claimPeriod,
    evidence_url: fact.evidenceUrl,
    evidence_quote: fact.evidenceQuote,
    approved_by: fact.approvedBy,
    approved_at: fact.approvedAt,
    submitted_by: fact.submittedBy,
    submission_status: fact.submissionStatus,
    created_at: fact.createdAt,
    updated_at: fact.updatedAt,
  };
}

function toPublicAuditLog(log: AuditLog) {
  return {
    id: log.id,
    actor_user_id: log.actorUserId,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    previous_status: log.previousStatus,
    next_status: log.nextStatus,
    review_comment: log.reviewComment,
    payload: log.payload,
    created_at: log.createdAt,
  };
}

function toPublicFactSubmission(submission: FactSubmission) {
  return {
    id: submission.id,
    target_source_id: submission.targetSourceId,
    submitted_by: submission.submittedBy,
    raw_claim: submission.rawClaim,
    raw_evidence_text: submission.rawEvidenceText,
    raw_evidence_url: submission.rawEvidenceUrl,
    raw_context: submission.rawContext,
    warnings: submission.warnings,
    status: submission.status,
    normalized_candidates: submission.normalizedCandidates,
    created_at: submission.createdAt,
    updated_at: submission.updatedAt,
  };
}

function toPublicPage(page: NanoPage) {
  return {
    id: page.id,
    source_id: page.sourceId,
    slug: page.slug,
    title: page.title,
    body: page.body,
    content_hash: page.contentHash,
    created_by: page.createdBy,
    updated_by: page.updatedBy,
    created_at: page.createdAt,
    updated_at: page.updatedAt,
  };
}

function toPublicSearchResult(result: NanoSearchResult) {
  return {
    chunk_id: result.chunkId,
    page_id: result.pageId,
    source_id: result.sourceId,
    source_kind: result.sourceKind,
    source_name: result.sourceName,
    slug: result.slug,
    title: result.title,
    chunk_index: result.chunkIndex,
    snippet: result.snippet,
    score: result.score,
    match_types: result.matchTypes,
  };
}

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(error: unknown): ToolResult {
  let code = 'internal_error';
  let message = 'Tool execution failed';
  if (error instanceof McpAuthError) {
    code = 'unauthorized';
    message = error.message;
  } else if (error instanceof NanoBrainPermissionError) {
    code = 'forbidden';
    message = error.message;
  } else if (error instanceof NanoBrainError) {
    code = error.code;
    message = error.message;
  } else if (error instanceof Error) {
    message = error.message;
  }
  if (code === 'internal_error') {
    console.error(error);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: code, message }, null, 2) }],
    isError: true,
  };
}

// 把"鉴权 + 业务 + 序列化 + 错误映射"统一包装，工具处理器只关注核心调用。
function tool<Args>(handler: (ctx: UserContext, args: Args) => Promise<unknown>) {
  return async (args: Args): Promise<ToolResult> => {
    try {
      const ctx = await resolveUserContext();
      return ok(await handler(ctx, args));
    } catch (error) {
      return fail(error);
    }
  };
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  'nano_search',
  {
    title: 'Search Nano Brain',
    description:
      'Run hybrid keyword + vector search across sources the current user can read and return cited chunks. Use it to find content or similar passages.',
    inputSchema: {
      query: z.string().min(1).max(500).describe('Search query text'),
      limit: z.number().int().min(1).max(30).optional().describe('Maximum number of results, default 10'),
      source_id: z.string().optional().describe('Optional: restrict query-level search to this source; omit to search all readable sources'),
    },
  },
  tool<{ query: string; limit?: number; source_id?: string }>(async (ctx, args) => {
    const response = await searchNanoBrain(ctx, { query: args.query, limit: args.limit, source_id: args.source_id });
    return {
      query: response.query,
      results: response.results.map(toPublicSearchResult),
    };
  }),
);

server.registerTool(
  'nano_capture',
  {
    title: 'Capture content',
    description:
      'Write a block of text or Markdown into Nano Brain with minimal friction. Regular users write to their own private source by default; admins can write to a public source explicitly. The page pipeline reuses chunking, embeddings, and Markdown links after writing.',
    inputSchema: {
      text: z.string().min(1).max(1_000_000).optional().describe('Plain text content; used when format is text'),
      markdown: z.string().min(1).max(1_000_000).optional().describe('Markdown content; used when format is markdown'),
      title: z.string().min(1).max(200).optional().describe('Optional title; generated from the Markdown H1 or the timestamp when omitted'),
      format: z.enum(['text', 'markdown']).optional().describe('Input format; inferred from the markdown/text field by default'),
      target: z.enum(['private', 'public']).optional().describe('Target scope; regular users can use private only, admins can also use public'),
      source_id: z.string().min(1).optional().describe('Required when an admin captures to a public source'),
      slug: z.string().min(1).max(96).optional().describe('Optional slug; a unique slug is generated when omitted'),
    },
  },
  tool<{
    text?: string;
    markdown?: string;
    title?: string;
    format?: 'text' | 'markdown';
    target?: 'private' | 'public';
    source_id?: string;
    slug?: string;
  }>(async (ctx, args) => {
    const result = await captureContent(ctx, {
      text: args.text,
      markdown: args.markdown,
      title: args.title,
      format: args.format,
      target: args.target,
      sourceId: args.source_id,
      slug: args.slug,
    });
    return {
      capture: { target: result.target, format: result.format },
      source: toPublicSource(result.source),
      page: toPublicPage(result.page),
    };
  }),
);

server.registerTool(
  'nano_run_my_source_dream',
  {
    title: 'Run my private source dream',
    description:
      'Trigger the current user\'s own private source dream. Regular users can only run their own user_source; permissions match the HTTP Dream API.',
    inputSchema: {
      source_id: z.string().min(1).describe('The current user\'s own private source id'),
      phases: z.array(z.enum(['extract_links', 'refresh_embeddings', 'health_check', 'review_queue_summary'])).min(1).optional().describe('Optional dream phases; the source default phases are used when omitted'),
      dry_run: z.boolean().optional().describe('Whether to dry-run; a dry-run writes only the execution report, not derived data'),
    },
  },
  tool<{ source_id: string; phases?: DreamPhase[]; dry_run?: boolean }>(async (ctx, args) => {
    const report = await runDream(ctx, {
      target: { type: 'user_source', sourceId: args.source_id, userId: ctx.userId },
      phases: args.phases,
      dryRun: args.dry_run,
    });
    return { run: toPublicDreamReport(report) };
  }),
);

server.registerTool(
  'nano_admin_run_dream',
  {
    title: 'Admin: run dream',
    description:
      'Admin tool: trigger a public source dream or a review_queue dream. Calls from regular users return forbidden.',
    inputSchema: {
      target_type: z.enum(['public_source', 'review_queue']).describe('Dream target type'),
      source_id: z.string().min(1).optional().describe('Source id for public_source; also usable as the target public source id for review_queue'),
      target_source_id: z.string().min(1).optional().describe('review_queue only: summarize the review queue of a single public source'),
      phases: z.array(z.enum(['extract_links', 'refresh_embeddings', 'health_check', 'review_queue_summary'])).min(1).optional().describe('Optional dream phases; the target default phases are used when omitted'),
      dry_run: z.boolean().optional().describe('Whether to dry-run'),
    },
  },
  tool<{
    target_type: 'public_source' | 'review_queue';
    source_id?: string;
    target_source_id?: string;
    phases?: DreamPhase[];
    dry_run?: boolean;
  }>(async (ctx, args) => {
    const target = args.target_type === 'public_source'
      ? { type: 'public_source' as const, sourceId: args.source_id ?? '' }
      : { type: 'review_queue' as const, targetSourceId: args.target_source_id ?? args.source_id };
    const report = await runDream(ctx, { target, phases: args.phases, dryRun: args.dry_run });
    return { run: toPublicDreamReport(report) };
  }),
);

server.registerTool(
  'nano_get_dream_status',
  {
    title: 'Get dream status',
    description: 'Get the visible dream locks, recent runs, and recent failed runs. Regular users only see their own user_source dreams.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().describe('Number of items to return, default 10'),
    },
  },
  tool<{ limit?: number }>(async (ctx, args) => {
    const status = await getDreamStatus(ctx, { limit: args.limit });
    return { status: toPublicDreamStatus(status) };
  }),
);

server.registerTool(
  'nano_get_dream_run',
  {
    title: 'Get dream run report',
    description: 'Get a dream execution report by run id. Regular users can only read their own user_source dream runs.',
    inputSchema: {
      run_id: z.string().min(1).describe('Dream run id'),
    },
  },
  tool<{ run_id: string }>(async (ctx, args) => {
    const report = await getReadableDreamRunReport(ctx, args.run_id);
    if (!report) throw new NanoBrainError('dream run not found', 'not_found');
    return { run: toPublicDreamReport(report) };
  }),
);

server.registerTool(
  'nano_submit_fact',
  {
    title: 'Submit fact submission',
    description:
      'Submit a natural-language fact submission to a public source review queue. It does not write to public facts directly and does not modify public pages. Evidence can be empty but produces a missing_evidence warning.',
    inputSchema: {
      target_source_id: z.string().min(1).describe('Target public source id'),
      raw_claim: z.string().min(1).max(4000).describe('Natural-language fact submission from the user'),
      raw_evidence_text: z.string().max(12000).optional().describe('Optional evidence text'),
      raw_evidence_url: z.string().max(2048).optional().describe('Optional evidence URL, http(s) only'),
      raw_context: z.string().max(12000).optional().describe('Optional context'),
    },
  },
  tool<{
    target_source_id: string;
    raw_claim: string;
    raw_evidence_text?: string;
    raw_evidence_url?: string;
    raw_context?: string;
  }>(async (ctx, args) => {
    const submission = await submitFactSubmission(ctx, {
      targetSourceId: args.target_source_id,
      rawClaim: args.raw_claim,
      rawEvidenceText: args.raw_evidence_text,
      rawEvidenceUrl: args.raw_evidence_url,
      rawContext: args.raw_context,
    });
    return { submission: toPublicFactSubmission(submission) };
  }),
);

server.registerTool(
  'nano_list_my_fact_submissions',
  {
    title: 'List my fact submissions',
    description: 'List the current user\'s own fact submissions. When called by an admin, lists all submissions by default and can filter by submitted_by.',
    inputSchema: {
      status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']).optional().describe('Optional status filter'),
      submitted_by: z.string().optional().describe('Admin only: filter by submitter'),
      target_source_id: z.string().optional().describe('Optional target source filter'),
      limit: z.number().int().min(1).max(200).optional().describe('Number of items to return, default 50'),
    },
  },
  tool<{
    status?: FactSubmissionStatus;
    submitted_by?: string;
    target_source_id?: string;
    limit?: number;
  }>(async (ctx, args) => {
    const submissions = await listFactSubmissions(ctx, {
      status: args.status,
      submittedBy: args.submitted_by,
      targetSourceId: args.target_source_id,
      limit: args.limit,
    });
    return { submissions: submissions.map(toPublicFactSubmission) };
  }),
);

server.registerTool(
  'nano_admin_list_fact_submissions',
  {
    title: 'Admin: list fact submission queue',
    description: 'Admin tool: list all fact submissions, filterable by status / submitted_by / target_source_id. Calls from regular users return forbidden.',
    inputSchema: {
      status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']).optional().describe('Optional status filter'),
      submitted_by: z.string().optional().describe('Optional submitter filter'),
      target_source_id: z.string().optional().describe('Optional target source filter'),
      limit: z.number().int().min(1).max(200).optional().describe('Number of items to return, default 50'),
    },
  },
  tool<{
    status?: FactSubmissionStatus;
    submitted_by?: string;
    target_source_id?: string;
    limit?: number;
  }>(async (ctx, args) => {
    const submissions = await listAdminFactSubmissions(ctx, {
      status: args.status,
      submittedBy: args.submitted_by,
      targetSourceId: args.target_source_id,
      limit: args.limit,
    });
    return { submissions: submissions.map(toPublicFactSubmission) };
  }),
);

server.registerTool(
  'nano_save_fact_candidates',
  {
    title: 'Save structured fact candidates',
    description:
      'Admin/agent tool: save agent-generated structured candidates back to fact submission.normalized_candidates. Core enforces permissions and schema validation.',
    inputSchema: {
      submission_id: z.string().min(1).describe('Fact submission id'),
      candidates: z
        .array(
          z.object({
            entity_slug: z.string().nullable().optional().describe('Optional entity slug'),
            fact: z.string().min(1).max(4000).describe('Human-readable atomic fact'),
            kind: z.enum(['fact', 'event', 'preference', 'commitment', 'belief']).describe('Fact type'),
            confidence: z.number().min(0).max(1).describe('Fact confidence, 0-1'),
            notability: z.enum(['high', 'medium', 'low']).describe('Notability'),
            claim_metric: z.string().optional().describe('Optional metric name'),
            claim_value: z.number().optional().describe('Optional value'),
            claim_unit: z.string().optional().describe('Optional unit'),
            claim_period: z.string().optional().describe('Optional period'),
            evidence_quote: z.string().optional().describe('Optional evidence quote'),
            normalization_confidence: z.number().min(0).max(1).describe('Candidate normalization confidence, 0-1'),
            warnings: z
              .array(z.union([z.string(), z.object({ code: z.string(), message: z.string() })]))
              .optional()
              .describe('Optional candidate warning'),
          }),
        )
        .min(1)
        .max(20)
        .describe('Agent-generated structured candidate list'),
      generated_by: z.string().optional().describe('Optional generator type, e.g. agent'),
      generator: z.string().optional().describe('Optional generator name, e.g. admin-agent'),
    },
  },
  tool<{
    submission_id: string;
    candidates: unknown[];
    generated_by?: string;
    generator?: string;
  }>(async (ctx, args) => {
    const submission = await saveFactCandidates(ctx, {
      submissionId: args.submission_id,
      candidates: args.candidates,
      generatedBy: args.generated_by,
      generator: args.generator,
    });
    return { submission: toPublicFactSubmission(submission) };
  }),
);

server.registerTool(
  'nano_get_fact_submission',
  {
    title: 'Get fact submission',
    description: 'Get a single fact submission. Regular users can only read their own submissions; admins can read all.',
    inputSchema: {
      submission_id: z.string().min(1).describe('Fact submission id'),
    },
  },
  tool<{ submission_id: string }>(async (ctx, args) => {
    const submission = await getFactSubmission(ctx, args.submission_id);
    return { submission: toPublicFactSubmission(submission) };
  }),
);

server.registerTool(
  'nano_admin_review_fact_submission',
  {
    title: 'Admin: review fact submission',
    description:
      'Admin tool: approve, reject, or request_changes on a fact submission. Approving writes the fact table and records an audit entry; rejecting or requesting changes does not write the fact table.',
    inputSchema: {
      submission_id: z.string().min(1).describe('Fact submission id'),
      action: z.enum(['approve', 'reject', 'request_changes']).describe('Review action'),
      approved_fact: z
        .object({
          entity_slug: z.string().nullable().optional().describe('Optional entity slug'),
          fact: z.string().min(1).max(4000).describe('Final approved fact text'),
          kind: z.enum(['fact', 'event', 'preference', 'commitment', 'belief']).describe('Fact type'),
          confidence: z.number().min(0).max(1).describe('Confidence, 0-1'),
          notability: z.enum(['high', 'medium', 'low']).describe('Notability'),
          context: z.string().optional().describe('Optional context'),
          valid_from: z.string().optional().describe('Optional valid-from date, format YYYY-MM-DD'),
          valid_until: z.string().optional().describe('Optional valid-until date, format YYYY-MM-DD'),
          claim_metric: z.string().optional().describe('Optional metric name'),
          claim_value: z.number().optional().describe('Optional value'),
          claim_unit: z.string().optional().describe('Optional unit'),
          claim_period: z.string().optional().describe('Optional period'),
          evidence_url: z.string().optional().describe('Optional evidence URL, http(s) only'),
          evidence_quote: z.string().optional().describe('Optional evidence quote'),
        })
        .optional()
        .describe('Final approved fact required when approving; may be an edited version of the candidate'),
      review_comment: z.string().optional().describe('Review comment; required when rejecting or requesting changes'),
    },
  },
  tool<{
    submission_id: string;
    action: FactReviewAction;
    approved_fact?: unknown;
    review_comment?: string;
  }>(async (ctx, args) => {
    const result = await reviewFactSubmission(ctx, {
      submissionId: args.submission_id,
      action: args.action,
      approvedFact: args.approved_fact,
      reviewComment: args.review_comment,
    });
    return {
      submission: toPublicFactSubmission(result.submission),
      fact: result.fact ? toPublicFact(result.fact) : null,
      audit_log: toPublicAuditLog(result.auditLog),
    };
  }),
);

server.registerTool(
  'nano_list_facts',
  {
    title: 'List public facts',
    description:
      'List approved facts in sources the current user can read. Regular users can read approved facts in public sources; admins can read all facts and filter by source/submitted_by/status.',
    inputSchema: {
      source_id: z.string().optional().describe('Optional source id filter'),
      entity_slug: z.string().optional().describe('Optional entity slug filter'),
      submitted_by: z.string().optional().describe('Optional submitter filter, commonly used by admins'),
      status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']).optional().describe('Optional submission status filter'),
      limit: z.number().int().min(1).max(200).optional().describe('Number of items to return, default 50'),
    },
  },
  tool<{
    source_id?: string;
    entity_slug?: string;
    submitted_by?: string;
    status?: FactSubmissionStatus;
    limit?: number;
  }>(async (ctx, args) => {
    const facts = await listFacts(ctx, {
      sourceId: args.source_id,
      entitySlug: args.entity_slug,
      submittedBy: args.submitted_by,
      status: args.status,
      limit: args.limit,
    });
    return { facts: facts.map(toPublicFact) };
  }),
);

server.registerTool(
  'nano_get_fact',
  {
    title: 'Get fact',
    description: 'Get a single approved fact by fact id. Results are filtered by the sources the current user can read.',
    inputSchema: {
      fact_id: z.string().min(1).describe('Fact id'),
    },
  },
  tool<{ fact_id: string }>(async (ctx, args) => {
    const fact = await getFact(ctx, args.fact_id);
    return { fact: toPublicFact(fact) };
  }),
);

server.registerTool(
  'nano_get_entity_facts',
  {
    title: 'Get entity facts',
    description: 'List approved facts for an entity_slug in sources the current user can read.',
    inputSchema: {
      entity_slug: z.string().min(1).describe('Entity slug'),
      source_id: z.string().optional().describe('Optional source id filter'),
      submitted_by: z.string().optional().describe('Optional submitter filter, commonly used by admins'),
      status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']).optional().describe('Optional submission status filter'),
      limit: z.number().int().min(1).max(200).optional().describe('Number of items to return, default 50'),
    },
  },
  tool<{
    entity_slug: string;
    source_id?: string;
    submitted_by?: string;
    status?: FactSubmissionStatus;
    limit?: number;
  }>(async (ctx, args) => {
    const facts = await listEntityFacts(ctx, args.entity_slug, {
      sourceId: args.source_id,
      submittedBy: args.submitted_by,
      status: args.status,
      limit: args.limit,
    });
    return { facts: facts.map(toPublicFact) };
  }),
);

server.registerTool(
  'nano_admin_list_audit_logs',
  {
    title: 'Admin: list audit log',
    description: 'Admin tool: list audit log entries, filterable by action, target_type, target_id, and actor_user_id.',
    inputSchema: {
      action: z
        .enum(['fact_submission.approve', 'fact_submission.reject', 'fact_submission.request_changes'])
        .optional()
        .describe('Optional audit action filter'),
      target_type: z.string().optional().describe('Optional target type filter, e.g. fact_submission'),
      target_id: z.string().optional().describe('Optional target id filter'),
      actor_user_id: z.string().optional().describe('Optional actor filter'),
      limit: z.number().int().min(1).max(200).optional().describe('Number of items to return, default 50'),
    },
  },
  tool<{
    action?: AuditAction;
    target_type?: string;
    target_id?: string;
    actor_user_id?: string;
    limit?: number;
  }>(async (ctx, args) => {
    const logs = await listAuditLogs(ctx, {
      action: args.action,
      targetType: args.target_type,
      targetId: args.target_id,
      actorUserId: args.actor_user_id,
      limit: args.limit,
    });
    return { audit_logs: logs.map(toPublicAuditLog) };
  }),
);

server.registerTool(
  'nano_get_page',
  {
    title: 'Get page',
    description: 'Get the full text of a single Markdown page by source_id and slug. Returns forbidden when the source is not readable.',
    inputSchema: {
      source_id: z.string().min(1).describe('Id of the source that owns the page'),
      slug: z.string().min(1).describe('Page slug'),
    },
  },
  tool<{ source_id: string; slug: string }>(async (ctx, args) => {
    const page = await getPage(ctx, { sourceId: args.source_id, slug: args.slug });
    return toPublicPage(page);
  }),
);

server.registerTool(
  'nano_get_links',
  {
    title: 'Outgoing links',
    description: 'List all outgoing links from a page (source_id + slug), optionally filtered by link_type. Requires read access to the source.',
    inputSchema: {
      source_id: z.string().min(1).describe('Id of the source that owns the page'),
      slug: z.string().min(1).describe('Page slug'),
      link_type: z.string().optional().describe('Optional relationship type filter, e.g. mentions'),
    },
  },
  tool<{ source_id: string; slug: string; link_type?: string }>(async (ctx, args) => {
    const links = await listOutgoingLinks(ctx, {
      sourceId: args.source_id,
      slug: args.slug,
      linkType: args.link_type,
    });
    return { links: links.map(toPublicLink) };
  }),
);

server.registerTool(
  'nano_get_backlinks',
  {
    title: 'Backlinks',
    description:
      'List all pages that link to this slug (backlinks). Results are filtered at the database layer by the sources the current user can read, so private pages the user cannot access are never leaked.',
    inputSchema: {
      slug: z.string().min(1).describe('Target slug being pointed to'),
      link_type: z.string().optional().describe('Optional relationship type filter, e.g. mentions'),
    },
  },
  tool<{ slug: string; link_type?: string }>(async (ctx, args) => {
    const links = await listBacklinks(ctx, { slug: args.slug, linkType: args.link_type });
    return { links: links.map(toPublicLink) };
  }),
);

server.registerTool(
  'nano_graph_query',
  {
    title: 'Graph traversal',
    description:
      'Run a breadth-first traversal from a slug and return nodes and relationship edges. depth supports 1-2 in the first phase; direction is out/in/both. Results are filtered by the sources the current user can read.',
    inputSchema: {
      slug: z.string().min(1).describe('Starting node slug'),
      depth: z.number().int().min(1).max(2).optional().describe('Traversal depth, 1 or 2, default 1'),
      direction: z.enum(['out', 'in', 'both']).optional().describe('Traversal direction, default both'),
      link_type: z.string().optional().describe('Optional relationship type filter, e.g. mentions'),
    },
  },
  tool<{ slug: string; depth?: number; direction?: 'out' | 'in' | 'both'; link_type?: string }>(
    async (ctx, args) => {
      const result = await graphQuery(ctx, {
        slug: args.slug,
        depth: args.depth,
        direction: args.direction,
        linkType: args.link_type,
      });
      return {
        root_slug: result.rootSlug,
        depth: result.depth,
        direction: result.direction,
        nodes: result.nodes,
        links: result.links.map(toPublicLink),
      };
    },
  ),
);

export async function startNanoBrainMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio 模式下不能往 stdout 写非协议内容，日志走 stderr。
  console.error(`[${SERVER_NAME}] MCP server started (stdio), version ${SERVER_VERSION}`);
}

if (import.meta.main) {
  startNanoBrainMcpServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
