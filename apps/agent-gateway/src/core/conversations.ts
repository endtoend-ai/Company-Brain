import { randomUUID } from 'node:crypto';
import type { ModuleId, UserContext } from '@ff/contracts';
import { getAgentGatewayPool } from '../db';

export const SUPPORTED_AGENT_MODULES: ModuleId[] = ['nano-brain', 'traditional-rag', 'graph-rag'];

export type AgentConversationStatus = 'active' | 'archived';
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export class AgentGatewayError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_input'
      | 'unsupported_module'
      | 'not_found'
      | 'forbidden'
      | 'internal_error',
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AgentGatewayError';
  }
}

export type AgentConversation = {
  id: string;
  userId: string;
  username: string;
  activeModule: ModuleId;
  title: string | null;
  status: AgentConversationStatus;
  threadId: string;
  latestCheckpointId: string | null;
  checkpointBootstrappedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CheckpointMessage = Record<string, unknown>;

export type AgentRun = {
  id: string;
  conversationId: string;
  userId: string;
  threadId: string;
  status: AgentRunStatus;
  provider: string | null;
  model: string | null;
  activeModule: ModuleId;
  inputMessageId: string | null;
  outputMessageId: string | null;
  langsmithRunId: string | null;
  langsmithTraceId: string | null;
  runName: string | null;
  tags: unknown[];
  streamProtocol: string | null;
  streamVersion: string | null;
  lastEventSeq: number;
  latestCheckpointId: string | null;
  tokenUsage: Record<string, unknown>;
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type AgentToolCall = {
  id: string;
  runId: string;
  conversationId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  resultSummary: string | null;
  result: unknown;
  status: AgentToolCallStatus;
  error: Record<string, unknown> | null;
  sequence: number;
  langchainToolCallId: string | null;
  nodeName: string | null;
  namespace: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type AgentConversationDetails = AgentConversation & {
  messages: CheckpointMessage[];
  messageSource: 'langgraph_checkpoint';
  runs: AgentRun[];
};

export type AgentRunDetails = AgentRun & {
  toolCalls: AgentToolCall[];
};

function normalizeLimit(value: unknown, fallback: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), 1), max);
}

function isModuleId(value: string): value is ModuleId {
  return value === 'nano-brain' || value === 'traditional-rag' || value === 'graph-rag';
}

function assertSupportedActiveModule(value: unknown): ModuleId {
  if (typeof value !== 'string' || !isModuleId(value)) {
    throw new AgentGatewayError('active_module is invalid', 'invalid_input', 400);
  }
  if (!SUPPORTED_AGENT_MODULES.includes(value)) {
    throw new AgentGatewayError(`Agent Gateway does not support active_module=${value} yet`, 'unsupported_module', 400);
  }
  return value;
}

function normalizeTitle(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AgentGatewayError('title must be a string', 'invalid_input', 400);
  const title = value.trim();
  if (title.length > 200) throw new AgentGatewayError('title must be at most 200 characters', 'invalid_input', 400);
  return title.length > 0 ? title : null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentGatewayError('metadata must be an object', 'invalid_input', 400);
  }
  return value as Record<string, unknown>;
}

function mapConversation(row: any): AgentConversation {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    activeModule: row.active_module,
    title: row.title,
    status: row.status,
    threadId: row.thread_id,
    latestCheckpointId: row.latest_checkpoint_id,
    checkpointBootstrappedAt: row.checkpoint_bootstrapped_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any): AgentRun {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    threadId: row.thread_id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    activeModule: row.active_module,
    inputMessageId: row.input_message_id,
    outputMessageId: row.output_message_id,
    langsmithRunId: row.langsmith_run_id,
    langsmithTraceId: row.langsmith_trace_id,
    runName: row.run_name,
    tags: row.tags ?? [],
    streamProtocol: row.stream_protocol,
    streamVersion: row.stream_version,
    lastEventSeq: row.last_event_seq,
    latestCheckpointId: row.latest_checkpoint_id,
    tokenUsage: row.token_usage ?? {},
    error: row.error,
    metadata: row.metadata ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function mapToolCall(row: any): AgentToolCall {
  return {
    id: row.id,
    runId: row.run_id,
    conversationId: row.conversation_id,
    toolName: row.tool_name,
    arguments: row.arguments ?? {},
    resultSummary: row.result_summary,
    result: row.result,
    status: row.status,
    error: row.error,
    sequence: row.sequence,
    langchainToolCallId: row.langchain_tool_call_id,
    nodeName: row.node_name,
    namespace: row.namespace,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function assertCanReadConversation(ctx: UserContext, conversation: AgentConversation): void {
  if (conversation.userId !== ctx.userId && !ctx.isAdmin) {
    throw new AgentGatewayError('You do not have access to this agent conversation', 'forbidden', 403);
  }
}

export async function createAgentConversation(
  ctx: UserContext,
  input: { activeModule: unknown; title?: unknown; metadata?: unknown },
): Promise<AgentConversation> {
  const activeModule = assertSupportedActiveModule(input.activeModule);
  const title = normalizeTitle(input.title);
  const metadata = normalizeMetadata(input.metadata);
  const id = randomUUID();
  const threadId = id;
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `
      INSERT INTO agent_conversations (id, user_id, username, active_module, title, thread_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [id, ctx.userId, ctx.username, activeModule, title, threadId, JSON.stringify(metadata)],
  );
  return mapConversation(result.rows[0]);
}

export async function listAgentConversations(
  ctx: UserContext,
  input: { limit?: unknown } = {},
): Promise<AgentConversation[]> {
  const limit = normalizeLimit(input.limit, 20, 100);
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `
      SELECT *
      FROM agent_conversations
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [ctx.userId, limit],
  );
  return result.rows.map(mapConversation);
}

export async function getAgentConversation(
  ctx: UserContext,
  conversationId: string,
  input: { messageLimit?: unknown; runLimit?: unknown } = {},
): Promise<AgentConversationDetails> {
  // M25 不再维护自有 agent_messages 表；消息历史将由后续 LangGraph checkpointer 读取。
  // 这里保留 messageLimit 入参以稳定 HTTP API，但当前不用于 SQL 查询。
  normalizeLimit(input.messageLimit, 100, 500);
  const runLimit = normalizeLimit(input.runLimit, 20, 100);
  const pool = getAgentGatewayPool();
  const result = await pool.query(`SELECT * FROM agent_conversations WHERE id = $1`, [conversationId]);
  const row = result.rows[0];
  if (!row) throw new AgentGatewayError('Agent conversation not found', 'not_found', 404);
  const conversation = mapConversation(row);
  assertCanReadConversation(ctx, conversation);

  const runs = await pool.query(
    `
      SELECT *
      FROM agent_runs
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [conversationId, runLimit],
  );

  return {
    ...conversation,
    messages: [],
    messageSource: 'langgraph_checkpoint',
    runs: runs.rows.map(mapRun),
  };
}

export async function createAgentRun(input: {
  conversationId: string;
  userId: string;
  threadId: string;
  activeModule: ModuleId;
  status?: AgentRunStatus;
  provider?: string | null;
  model?: string | null;
  runName?: string | null;
  streamProtocol?: string | null;
  streamVersion?: string | null;
  startedAt?: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<AgentRun> {
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `
      INSERT INTO agent_runs (
        id, conversation_id, user_id, thread_id, status, provider, model, active_module,
        run_name, stream_protocol, stream_version, started_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      RETURNING *
    `,
    [
      randomUUID(),
      input.conversationId,
      input.userId,
      input.threadId,
      input.status ?? 'pending',
      input.provider ?? null,
      input.model ?? null,
      input.activeModule,
      input.runName ?? null,
      input.streamProtocol ?? null,
      input.streamVersion ?? null,
      input.startedAt ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return mapRun(result.rows[0]);
}

export const createAgentRunForTest = createAgentRun;

export async function updateAgentRun(input: {
  runId: string;
  status?: AgentRunStatus;
  lastEventSeq?: number;
  latestCheckpointId?: string | null;
  tokenUsage?: Record<string, unknown>;
  error?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  outputMessageId?: string | null;
  finishedAt?: Date | null;
}): Promise<AgentRun> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  function add(sql: string, value: unknown) {
    values.push(value);
    assignments.push(`${sql} = $${values.length}`);
  }
  if (input.status !== undefined) add('status', input.status);
  if (input.lastEventSeq !== undefined) add('last_event_seq', input.lastEventSeq);
  if (input.latestCheckpointId !== undefined) add('latest_checkpoint_id', input.latestCheckpointId);
  if (input.tokenUsage !== undefined) add('token_usage', JSON.stringify(input.tokenUsage));
  if (input.error !== undefined) add('error', input.error === null ? null : JSON.stringify(input.error));
  if (input.metadata !== undefined) add('metadata', JSON.stringify(input.metadata));
  if (input.outputMessageId !== undefined) add('output_message_id', input.outputMessageId);
  if (input.finishedAt !== undefined) add('finished_at', input.finishedAt);
  if (assignments.length === 0) {
    const pool = getAgentGatewayPool();
    const result = await pool.query(`SELECT * FROM agent_runs WHERE id = $1`, [input.runId]);
    if (!result.rows[0]) throw new AgentGatewayError('Agent run not found', 'not_found', 404);
    return mapRun(result.rows[0]);
  }
  values.push(input.runId);
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `UPDATE agent_runs SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (!result.rows[0]) throw new AgentGatewayError('Agent run not found', 'not_found', 404);
  return mapRun(result.rows[0]);
}

export async function createAgentToolCall(input: {
  runId: string;
  conversationId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  status?: AgentToolCallStatus;
  sequence: number;
  langchainToolCallId?: string | null;
  nodeName?: string | null;
  namespace?: string | null;
  startedAt?: Date | null;
}): Promise<AgentToolCall> {
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `
      INSERT INTO agent_tool_calls (
        id, run_id, conversation_id, tool_name, arguments, status, sequence,
        langchain_tool_call_id, node_name, namespace, started_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (run_id, sequence) DO UPDATE SET
        tool_name = EXCLUDED.tool_name,
        arguments = EXCLUDED.arguments,
        status = EXCLUDED.status,
        langchain_tool_call_id = EXCLUDED.langchain_tool_call_id,
        node_name = EXCLUDED.node_name,
        namespace = EXCLUDED.namespace,
        started_at = EXCLUDED.started_at
      RETURNING *
    `,
    [
      randomUUID(),
      input.runId,
      input.conversationId,
      input.toolName,
      JSON.stringify(input.arguments ?? {}),
      input.status ?? 'running',
      input.sequence,
      input.langchainToolCallId ?? null,
      input.nodeName ?? null,
      input.namespace ?? null,
      input.startedAt ?? null,
    ],
  );
  return mapToolCall(result.rows[0]);
}

export async function updateAgentToolCall(input: {
  runId: string;
  langchainToolCallId?: string | null;
  sequence?: number;
  status: AgentToolCallStatus;
  resultSummary?: string | null;
  result?: unknown;
  error?: Record<string, unknown> | null;
  finishedAt?: Date | null;
}): Promise<AgentToolCall | null> {
  const where: string[] = ['run_id = $1'];
  const values: unknown[] = [input.runId];
  if (input.langchainToolCallId) {
    values.push(input.langchainToolCallId);
    where.push(`langchain_tool_call_id = $${values.length}`);
  } else if (input.sequence !== undefined) {
    values.push(input.sequence);
    where.push(`sequence = $${values.length}`);
  } else {
    throw new AgentGatewayError('Updating a tool call requires langchainToolCallId or sequence', 'invalid_input', 400);
  }

  const assignments: string[] = [];
  function add(sql: string, value: unknown) {
    values.push(value);
    assignments.push(`${sql} = $${values.length}`);
  }
  add('status', input.status);
  if (input.resultSummary !== undefined) add('result_summary', input.resultSummary);
  if (input.result !== undefined) {
    const resultValue = typeof input.result === 'object' && input.result !== null ? input.result : { value: input.result };
    add('result', JSON.stringify(resultValue));
  }
  if (input.error !== undefined) add('error', input.error === null ? null : JSON.stringify(input.error));
  if (input.finishedAt !== undefined) add('finished_at', input.finishedAt);

  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `UPDATE agent_tool_calls SET ${assignments.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`,
    values,
  );
  return result.rows[0] ? mapToolCall(result.rows[0]) : null;
}

export async function getAgentRun(
  ctx: UserContext,
  conversationId: string,
  runId: string,
): Promise<AgentRunDetails> {
  const conversation = await getAgentConversation(ctx, conversationId, { messageLimit: 1, runLimit: 1 });
  const pool = getAgentGatewayPool();
  const result = await pool.query(
    `SELECT * FROM agent_runs WHERE id = $1 AND conversation_id = $2`,
    [runId, conversationId],
  );
  const row = result.rows[0];
  if (!row) throw new AgentGatewayError('Agent run not found', 'not_found', 404);
  const run = mapRun(row);
  if (run.conversationId !== conversation.id) {
    throw new AgentGatewayError('Agent run does not belong to this conversation', 'not_found', 404);
  }
  const toolCalls = await pool.query(
    `
      SELECT *
      FROM agent_tool_calls
      WHERE run_id = $1
      ORDER BY sequence ASC
    `,
    [runId],
  );
  return { ...run, toolCalls: toolCalls.rows.map(mapToolCall) };
}

export function toPublicConversation(conversation: AgentConversation) {
  return {
    id: conversation.id,
    user_id: conversation.userId,
    username: conversation.username,
    active_module: conversation.activeModule,
    title: conversation.title,
    status: conversation.status,
    thread_id: conversation.threadId,
    latest_checkpoint_id: conversation.latestCheckpointId,
    checkpoint_bootstrapped_at: conversation.checkpointBootstrappedAt?.toISOString() ?? null,
    metadata: conversation.metadata,
    created_at: conversation.createdAt.toISOString(),
    updated_at: conversation.updatedAt.toISOString(),
  };
}

export function toPublicRun(run: AgentRun) {
  return {
    id: run.id,
    conversation_id: run.conversationId,
    user_id: run.userId,
    thread_id: run.threadId,
    status: run.status,
    provider: run.provider,
    model: run.model,
    active_module: run.activeModule,
    input_message_id: run.inputMessageId,
    output_message_id: run.outputMessageId,
    langsmith_run_id: run.langsmithRunId,
    langsmith_trace_id: run.langsmithTraceId,
    run_name: run.runName,
    tags: run.tags,
    stream_protocol: run.streamProtocol,
    stream_version: run.streamVersion,
    last_event_seq: run.lastEventSeq,
    latest_checkpoint_id: run.latestCheckpointId,
    token_usage: run.tokenUsage,
    error: run.error,
    metadata: run.metadata,
    started_at: run.startedAt?.toISOString() ?? null,
    finished_at: run.finishedAt?.toISOString() ?? null,
    created_at: run.createdAt.toISOString(),
  };
}

export function toPublicToolCall(toolCall: AgentToolCall) {
  return {
    id: toolCall.id,
    run_id: toolCall.runId,
    conversation_id: toolCall.conversationId,
    tool_name: toolCall.toolName,
    arguments: toolCall.arguments,
    result_summary: toolCall.resultSummary,
    result: toolCall.result,
    status: toolCall.status,
    error: toolCall.error,
    sequence: toolCall.sequence,
    langchain_tool_call_id: toolCall.langchainToolCallId,
    node_name: toolCall.nodeName,
    namespace: toolCall.namespace,
    started_at: toolCall.startedAt?.toISOString() ?? null,
    finished_at: toolCall.finishedAt?.toISOString() ?? null,
    created_at: toolCall.createdAt.toISOString(),
  };
}
