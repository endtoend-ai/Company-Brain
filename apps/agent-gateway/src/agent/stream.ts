import type { UserContext } from '@ff/contracts';
import {
  AgentGatewayError,
  createAgentRun,
  createAgentToolCall,
  getAgentConversation,
  updateAgentRun,
  updateAgentToolCall,
  type AgentConversationDetails,
  type AgentRun,
} from '../core/conversations';
import {
  buildAdminReviewToolPolicy,
  createAdminReviewAgent,
  loadAdminReviewMcpTools,
} from './admin-review';
import { getAgentPostgresSaver } from './checkpointer';
import { buildAgentRuntimeContext } from './context';
import { createCompanyBrainAgent } from './factory';
import { loadGraphRagMcpTools, loadNanoBrainMcpTools, loadTraditionalRagMcpTools, type CompanyBrainMcpToolsSession } from './mcp';
import { buildAgentSystemPrompt } from './prompt';

export type AgentStreamEventName =
  | 'run_started'
  | 'message_delta'
  | 'tool_call_started'
  | 'tool_call_finished'
  | 'message_completed'
  | 'run_completed'
  | 'error';

export type AgentStreamEvent = {
  event: AgentStreamEventName;
  data: Record<string, unknown>;
  id?: string;
};

export type AgentStreamDependencies = {
  model?: unknown;
  tools?: unknown[];
  checkpointer?: unknown;
  loadTools?: (input: { user: UserContext; bearerToken: string }) => Promise<CompanyBrainMcpToolsSession>;
};

export type AgentStreamMode = 'default' | 'admin_review';

export type PrepareAgentStreamInput = {
  user: UserContext;
  bearerToken: string;
  conversationId: string;
  message: string;
  mode?: AgentStreamMode;
  requestId?: string;
  dependencies?: AgentStreamDependencies;
};

export type PreparedAgentStream = {
  conversation: AgentConversationDetails;
  run: AgentRun;
  events: (signal?: AbortSignal) => AsyncGenerator<AgentStreamEvent>;
};

function assertValidMessage(value: string): string {
  const message = value.trim();
  if (!message) throw new Error('message must not be empty');
  if (message.length > 20_000) throw new Error('message must be at most 20000 characters');
  return message;
}

function summarizeUnknown(value: unknown, maxLength = 2000): string {
  if (typeof value === 'string') return value.slice(0, maxLength);
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
}

function getLastAssistantMessage(output: any): { id: string | null; content: string } {
  const messages = Array.isArray(output?.messages) ? output.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const typeName = message?.constructor?.name ?? '';
    const hasToolCalls = Array.isArray(message?.tool_calls) || Array.isArray(message?.toolCalls);
    if (typeName.includes('AIMessage') || hasToolCalls || message?.kwargs?.type === 'ai') {
      const content = message?.content ?? message?.kwargs?.content ?? '';
      return {
        id: message?.id ?? message?.kwargs?.id ?? null,
        content: typeof content === 'string' ? content : summarizeUnknown(content),
      };
    }
  }
  return { id: null, content: '' };
}

function eventId(runId: string, seq: number | string): string {
  return `${runId}:${seq}`;
}

function normalizeLangChainEvent(raw: any, runId: string, activeToolNames: Map<string, string>): AgentStreamEvent[] {
  const seq = typeof raw?.seq === 'number' ? raw.seq : undefined;
  const data = raw?.params?.data;
  const events: AgentStreamEvent[] = [];

  if (raw?.method === 'messages' && data?.event === 'content-block-delta') {
    const delta = data.delta ?? {};
    if (delta.type === 'text-delta' && typeof delta.text === 'string' && delta.text.length > 0) {
      events.push({
        event: 'message_delta',
        id: seq === undefined ? undefined : eventId(runId, seq),
        data: {
          run_id: runId,
          seq,
          text: delta.text,
          node: raw.params?.node,
          namespace: raw.params?.namespace ?? [],
        },
      });
    }
  }

  if (raw?.method === 'tools' && data?.event === 'tool-started') {
    events.push({
      event: 'tool_call_started',
      id: seq === undefined ? undefined : eventId(runId, seq),
      data: {
        run_id: runId,
        seq,
        tool_call_id: data.tool_call_id,
        tool_name: data.tool_name,
        input: data.input,
      },
    });
  }

  if (raw?.method === 'tools' && data?.event === 'tool-finished') {
    events.push({
      event: 'tool_call_finished',
      id: seq === undefined ? undefined : eventId(runId, seq),
      data: {
        run_id: runId,
        seq,
        tool_call_id: data.tool_call_id,
        tool_name: activeToolNames.get(data.tool_call_id) ?? data.tool_name ?? null,
        status: 'completed',
        result_summary: summarizeUnknown(data.output, 1000),
      },
    });
  }

  if (raw?.method === 'tools' && data?.event === 'tool-error') {
    events.push({
      event: 'error',
      id: seq === undefined ? undefined : eventId(runId, seq),
      data: {
        run_id: runId,
        seq,
        tool_call_id: data.tool_call_id,
        tool_name: activeToolNames.get(data.tool_call_id) ?? data.tool_name ?? null,
        message: data.message ?? data.error ?? 'tool error',
      },
    });
  }

  return events;
}

function loadModuleMcpTools(input: {
  user: UserContext;
  bearerToken: string;
  activeModule: AgentConversationDetails['activeModule'];
}): Promise<CompanyBrainMcpToolsSession> {
  if (input.activeModule === 'nano-brain') {
    return loadNanoBrainMcpTools({ user: input.user, bearerToken: input.bearerToken });
  }
  if (input.activeModule === 'traditional-rag') {
    return loadTraditionalRagMcpTools({ user: input.user, bearerToken: input.bearerToken });
  }
  if (input.activeModule === 'graph-rag') {
    return loadGraphRagMcpTools({ user: input.user, bearerToken: input.bearerToken });
  }
  throw new AgentGatewayError(`Agent Gateway does not support active_module=${input.activeModule} yet`, 'unsupported_module', 400);
}

export async function prepareAgentStream(input: PrepareAgentStreamInput): Promise<PreparedAgentStream> {
  const message = assertValidMessage(input.message);
  const mode: AgentStreamMode = input.mode ?? 'default';
  if (mode === 'admin_review' && !input.user.isAdmin) {
    throw new AgentGatewayError('Only admins can use the admin review assistant agent', 'forbidden', 403);
  }
  const conversation = await getAgentConversation(input.user, input.conversationId, { messageLimit: 1, runLimit: 5 });
  const run = await createAgentRun({
    conversationId: conversation.id,
    userId: input.user.userId,
    threadId: conversation.threadId,
    activeModule: conversation.activeModule,
    status: 'running',
    provider: process.env.AGENT_PROVIDER ?? 'unknown',
    model: process.env.AGENT_MODEL ?? 'unknown',
    runName: mode === 'admin_review' ? 'admin-review-agent-stream' : 'agent-chat-stream',
    streamProtocol: 'langchain-event-stream',
    streamVersion: 'v3',
    startedAt: new Date(),
    metadata: { requestId: input.requestId ?? null, mode },
  });

  async function* events(signal?: AbortSignal): AsyncGenerator<AgentStreamEvent> {
    let lastSeq = 0;
    let latestCheckpointId: string | null = null;
    let closeToolsSession: any = null;
    const activeToolNames = new Map<string, string>();

    yield {
      event: 'run_started',
      id: eventId(run.id, 'start'),
      data: {
        run_id: run.id,
        conversation_id: conversation.id,
        active_module: conversation.activeModule,
        thread_id: conversation.threadId,
      },
    };

    try {
      const tools = input.dependencies?.tools ?? (await (async () => {
        const toolsSession = input.dependencies?.loadTools
          ? await input.dependencies.loadTools({ user: input.user, bearerToken: input.bearerToken })
          : mode === 'admin_review'
            ? await loadAdminReviewMcpTools({ user: input.user, bearerToken: input.bearerToken })
            : await loadModuleMcpTools({
                user: input.user,
                bearerToken: input.bearerToken,
                activeModule: conversation.activeModule,
              });
        closeToolsSession = toolsSession.close;
        return toolsSession.tools;
      })());

      const createAgentForMode = mode === 'admin_review' ? createAdminReviewAgent : createCompanyBrainAgent;
      const agent = createAgentForMode({
        model: input.dependencies?.model,
        tools,
        systemPrompt: mode === 'admin_review'
          ? undefined
          : buildAgentSystemPrompt({
              username: input.user.username,
              isAdmin: input.user.isAdmin,
              activeModule: conversation.activeModule,
            }),
        checkpointer: input.dependencies?.checkpointer ?? (await getAgentPostgresSaver()),
      });

      const context = buildAgentRuntimeContext({
        userId: input.user.userId,
        username: input.user.username,
        isAdmin: input.user.isAdmin,
        activeModule: conversation.activeModule,
        conversationId: conversation.id,
        runId: run.id,
        requestId: input.requestId,
        toolPolicy: mode === 'admin_review' ? buildAdminReviewToolPolicy() : undefined,
        permissions: mode === 'admin_review' ? ['admin_review_assistant'] : [],
      });

      const langChainStream = await (agent as any).streamEvents(
        { messages: [{ role: 'user', content: message }] },
        {
          version: 'v3',
          configurable: { thread_id: conversation.threadId },
          context,
          signal,
        },
      );

      for await (const rawEvent of langChainStream) {
        if (signal?.aborted) throw new Error('Agent stream aborted');
        if (typeof rawEvent?.seq === 'number') lastSeq = rawEvent.seq;
        const checkpointId = rawEvent?.method === 'checkpoints' ? rawEvent?.params?.data?.id : null;
        if (typeof checkpointId === 'string') latestCheckpointId = checkpointId;

        const rawData = rawEvent?.params?.data;
        if (rawEvent?.method === 'tools' && rawData?.event === 'tool-started') {
          if (rawData.tool_call_id && rawData.tool_name) activeToolNames.set(rawData.tool_call_id, rawData.tool_name);
          await createAgentToolCall({
            runId: run.id,
            conversationId: conversation.id,
            toolName: rawData.tool_name ?? 'unknown_tool',
            arguments: typeof rawData.input === 'object' && rawData.input !== null ? rawData.input : { value: rawData.input },
            status: 'running',
            sequence: typeof rawEvent.seq === 'number' ? rawEvent.seq : lastSeq,
            langchainToolCallId: rawData.tool_call_id ?? null,
            nodeName: rawEvent.params?.node ?? null,
            namespace: Array.isArray(rawEvent.params?.namespace) ? rawEvent.params.namespace.join('/') : null,
            startedAt: new Date(),
          }).catch(() => undefined);
        }
        if (rawEvent?.method === 'tools' && rawData?.event === 'tool-finished') {
          await updateAgentToolCall({
            runId: run.id,
            langchainToolCallId: rawData.tool_call_id ?? null,
            status: 'completed',
            resultSummary: summarizeUnknown(rawData.output, 1000),
            result: rawData.output,
            error: null,
            finishedAt: new Date(),
          }).catch(() => undefined);
        }
        if (rawEvent?.method === 'tools' && rawData?.event === 'tool-error') {
          await updateAgentToolCall({
            runId: run.id,
            langchainToolCallId: rawData.tool_call_id ?? null,
            status: 'failed',
            resultSummary: rawData.message ?? rawData.error ?? 'tool error',
            error: { message: rawData.message ?? rawData.error ?? 'tool error', code: rawData.code ?? null },
            finishedAt: new Date(),
          }).catch(() => undefined);
        }

        for (const event of normalizeLangChainEvent(rawEvent, run.id, activeToolNames)) {
          yield event;
        }
      }

      const output = await langChainStream.output;
      const finalMessage = getLastAssistantMessage(output);
      await updateAgentRun({
        runId: run.id,
        status: 'completed',
        lastEventSeq: lastSeq,
        latestCheckpointId,
        outputMessageId: finalMessage.id,
        finishedAt: new Date(),
      });

      yield {
        event: 'message_completed',
        id: eventId(run.id, 'message_completed'),
        data: {
          run_id: run.id,
          message: finalMessage,
          latest_checkpoint_id: latestCheckpointId,
        },
      };
      yield {
        event: 'run_completed',
        id: eventId(run.id, 'completed'),
        data: { run_id: run.id, status: 'completed', last_event_seq: lastSeq },
      };
    } catch (error) {
      const aborted = signal?.aborted;
      await updateAgentRun({
        runId: run.id,
        status: aborted ? 'cancelled' : 'failed',
        lastEventSeq: lastSeq,
        latestCheckpointId,
        error: aborted ? { message: 'Agent stream aborted' } : { message: error instanceof Error ? error.message : String(error) },
        finishedAt: new Date(),
      }).catch(() => undefined);
      if (!aborted) {
        yield {
          event: 'error',
          id: eventId(run.id, 'error'),
          data: {
            run_id: run.id,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    } finally {
      await closeToolsSession?.().catch(() => undefined);
    }
  }

  return { conversation, run, events };
}
