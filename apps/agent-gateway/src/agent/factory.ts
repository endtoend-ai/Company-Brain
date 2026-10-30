import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { agentContextSchema } from './context';
import { getAgentModelConfig, type AgentModelConfig } from './config';
import { NANO_BRAIN_AGENT_SYSTEM_PROMPT } from './prompt';

export type CreateCompanyBrainAgentInput = {
  model?: unknown;
  tools?: unknown[];
  systemPrompt?: string;
  checkpointer?: unknown;
  middleware?: unknown[];
};

export function createAgentChatModel(config: AgentModelConfig = getAgentModelConfig()): ChatOpenAI {
  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature: config.temperature,
    streamUsage: config.streamUsage,
    configuration: {
      baseURL: config.baseUrl,
    },
  });
}

export function createCompanyBrainAgent(input: CreateCompanyBrainAgentInput = {}) {
  return createAgent({
    model: input.model ?? createAgentChatModel(),
    tools: input.tools ?? [],
    systemPrompt: input.systemPrompt ?? NANO_BRAIN_AGENT_SYSTEM_PROMPT,
    contextSchema: agentContextSchema,
    checkpointer: input.checkpointer,
    middleware: input.middleware,
  } as any);
}
