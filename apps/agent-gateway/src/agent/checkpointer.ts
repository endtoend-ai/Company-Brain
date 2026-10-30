import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { getAgentModelConfig } from './config';
import { createCompanyBrainAgent } from './factory';
import type { AgentConversation } from '../core/conversations';

let checkpointer: PostgresSaver | null = null;
let setupDone = false;

function getCheckpointSchema(): string {
  return process.env.AGENT_CHECKPOINT_SCHEMA?.trim() || 'langgraph';
}

function getAgentDatabaseUrl(): string {
  const url = process.env.AGENT_DATABASE_URL?.trim();
  if (!url) throw new Error('AGENT_DATABASE_URL is not configured; cannot initialize LangGraph PostgresSaver');
  return url;
}

export async function getAgentPostgresSaver(): Promise<PostgresSaver> {
  if (!checkpointer) {
    checkpointer = PostgresSaver.fromConnString(getAgentDatabaseUrl(), { schema: getCheckpointSchema() });
    setupDone = false;
  }
  if (!setupDone) {
    await checkpointer.setup();
    setupDone = true;
  }
  return checkpointer;
}

export async function closeAgentPostgresSaver(): Promise<void> {
  if (checkpointer) {
    await checkpointer.end();
    checkpointer = null;
    setupDone = false;
  }
}

export type CheckpointMessageDto = {
  id: string | null;
  type: string;
  role: string;
  content: unknown;
  text: string | null;
  name: string | null;
  tool_call_id: string | null;
  tool_calls: unknown[];
  invalid_tool_calls: unknown[];
  usage_metadata: unknown;
  response_metadata: unknown;
  status: string | null;
  raw: unknown;
};

function getMessageType(message: any): string {
  if (typeof message?.getType === 'function') return message.getType();
  return message?.type ?? message?.kwargs?.type ?? message?.constructor?.name ?? 'unknown';
}

function roleFromType(type: string): string {
  if (type === 'human' || type === 'HumanMessage') return 'user';
  if (type === 'ai' || type === 'AIMessage') return 'assistant';
  if (type === 'system' || type === 'SystemMessage') return 'system';
  if (type === 'tool' || type === 'ToolMessage') return 'tool';
  return type;
}

function serializeRawMessage(message: any): unknown {
  if (typeof message?.toDict === 'function') return message.toDict();
  if (typeof message?.toJSON === 'function') return message.toJSON();
  return message;
}

export function serializeCheckpointMessage(message: any): CheckpointMessageDto {
  const type = getMessageType(message);
  const content = message?.content ?? message?.kwargs?.content ?? '';
  return {
    id: message?.id ?? message?.kwargs?.id ?? null,
    type,
    role: roleFromType(type),
    content,
    text: typeof message?.text === 'string' ? message.text : typeof content === 'string' ? content : null,
    name: message?.name ?? message?.kwargs?.name ?? null,
    tool_call_id: message?.tool_call_id ?? message?.kwargs?.tool_call_id ?? null,
    tool_calls: message?.tool_calls ?? message?.toolCalls ?? [],
    invalid_tool_calls: message?.invalid_tool_calls ?? [],
    usage_metadata: message?.usage_metadata ?? null,
    response_metadata: message?.response_metadata ?? {},
    status: message?.status ?? null,
    raw: serializeRawMessage(message),
  };
}

export type ReadCheckpointMessagesInput = {
  conversation: AgentConversation;
  checkpointer?: unknown;
  model?: unknown;
  tools?: unknown[];
};

export async function readConversationCheckpointMessages(
  input: ReadCheckpointMessagesInput,
): Promise<{ messages: CheckpointMessageDto[]; checkpointId: string | null }> {
  const checkpointer = input.checkpointer ?? (await getAgentPostgresSaver());
  const agent = createCompanyBrainAgent({
    model: input.model,
    tools: input.tools ?? [],
    checkpointer,
  });

  // getState 只读取 checkpoint thread state；模型不会被调用。
  const state = await (agent as any).getState({ configurable: { thread_id: input.conversation.threadId } });
  const messages = Array.isArray(state?.values?.messages) ? state.values.messages : [];
  const checkpointId = state?.config?.configurable?.checkpoint_id ?? null;
  return { messages: messages.map(serializeCheckpointMessage), checkpointId };
}

export function hasAgentModelEnv(): boolean {
  try {
    getAgentModelConfig();
    return true;
  } catch {
    return false;
  }
}
