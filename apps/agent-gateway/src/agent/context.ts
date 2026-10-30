import { z } from 'zod';
import type { ModuleId } from '@ff/contracts';

export const agentContextSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  isAdmin: z.boolean(),
  activeModule: z.enum(['nano-brain', 'traditional-rag', 'graph-rag']),
  conversationId: z.string().min(1),
  runId: z.string().min(1),
  requestId: z.string().optional(),
  locale: z.string().default('en-US'),
  timezone: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  toolPolicy: z
    .object({
      allowedTools: z.array(z.string()).optional(),
      requireApprovalFor: z.array(z.string()).optional(),
      highRiskTools: z.array(z.string()).optional(),
      allowAutoApprove: z.literal(false).optional(),
    })
    .optional(),
});

export type AgentRuntimeContext = z.infer<typeof agentContextSchema>;

export function buildAgentRuntimeContext(input: {
  userId: string;
  username: string;
  isAdmin: boolean;
  activeModule: ModuleId;
  conversationId: string;
  runId: string;
  requestId?: string;
  locale?: string;
  timezone?: string;
  permissions?: string[];
  toolPolicy?: AgentRuntimeContext['toolPolicy'];
}): AgentRuntimeContext {
  return agentContextSchema.parse({
    ...input,
    locale: input.locale ?? 'en-US',
    permissions: input.permissions ?? [],
  });
}
