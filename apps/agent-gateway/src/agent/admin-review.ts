import { createMiddleware, ToolMessage } from 'langchain';
import type { UserContext } from '@ff/contracts';
import { z } from 'zod';
import { createCompanyBrainAgent, type CreateCompanyBrainAgentInput } from './factory';
import { loadNanoBrainMcpTools, type NanoBrainMcpToolPolicy, type NanoBrainMcpToolsSession } from './mcp';

export const ADMIN_REVIEW_AGENT_ALLOWED_TOOLS = [
  'nano_admin_list_fact_submissions',
  'nano_get_fact_submission',
  'nano_save_fact_candidates',
  'nano_get_dream_status',
  'nano_get_dream_run',
  'nano_list_facts',
] as const;

export const ADMIN_REVIEW_HIGH_RISK_TOOLS = ['nano_admin_review_fact_submission'] as const;

export const ADMIN_REVIEW_AGENT_SYSTEM_PROMPT = `You are the admin fact review assistant agent for CompanyBrain.

You can:
- Read the fact submission queue and individual submissions.
- Read public facts and dream reports.
- Summarize review risk, missing evidence, likely duplicates, and likely conflicts.
- Save structured fact candidates to submission.normalized_candidates for admins to review.
- Recommend approve_candidate / reject_candidate / request_changes_candidate.

You must never:
- Approve, reject, or request_changes on your own.
- Claim that a review decision has been made.
- Call or attempt to call nano_admin_review_fact_submission.
- Bypass Nano Brain core permissions.

If you believe a submission should be approved, only recommend approve_candidate and state that a human admin must approve it in the review UI or an explicit backend confirmation flow.`;

export type AdminReviewToolPolicy = {
  allowedTools: string[];
  highRiskTools: string[];
  allowAutoApprove: false;
};

export const adminReviewContextSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  isAdmin: z.boolean(),
  activeModule: z.literal('nano-brain'),
  conversationId: z.string().min(1),
  runId: z.string().min(1),
  requestId: z.string().optional(),
  locale: z.string().default('en-US'),
  permissions: z.array(z.string()).default([]),
  toolPolicy: z.object({
    allowedTools: z.array(z.string()),
    highRiskTools: z.array(z.string()),
    allowAutoApprove: z.literal(false),
  }),
});

export function buildAdminReviewToolPolicy(): AdminReviewToolPolicy {
  return {
    allowedTools: [...ADMIN_REVIEW_AGENT_ALLOWED_TOOLS],
    highRiskTools: [...ADMIN_REVIEW_HIGH_RISK_TOOLS],
    allowAutoApprove: false,
  };
}

export function assertAdminReviewUser(user: UserContext): void {
  if (!user.isAdmin) {
    throw new Error('Only admins can use the admin review assistant agent');
  }
}

function getAllowedToolsFromRuntime(runtime: any): string[] {
  const allowed = runtime?.context?.toolPolicy?.allowedTools;
  return Array.isArray(allowed) ? allowed : [...ADMIN_REVIEW_AGENT_ALLOWED_TOOLS];
}

export const adminReviewToolPolicyMiddleware = createMiddleware({
  name: 'AdminReviewToolPolicy',
  contextSchema: adminReviewContextSchema,
  wrapModelCall: async (request: any, handler: any) => {
    const allowedTools = new Set(getAllowedToolsFromRuntime(request.runtime));
    const tools = (request.tools ?? []).filter((tool: any) => allowedTools.has(tool.name));
    return handler({ ...request, tools });
  },
  wrapToolCall: async (request: any, handler: any) => {
    const allowedTools = new Set(getAllowedToolsFromRuntime(request.runtime));
    const name = request.toolCall?.name;
    const toolCallId = request.toolCall?.id ?? 'unknown_tool_call';

    if (ADMIN_REVIEW_HIGH_RISK_TOOLS.includes(name as any)) {
      return new ToolMessage({
        tool_call_id: toolCallId,
        content: 'DENIED: Automated review actions are not allowed. A human admin must approve/reject/request_changes in the review UI or an explicit confirmation flow.',
      });
    }

    if (!allowedTools.has(name)) {
      return new ToolMessage({
        tool_call_id: toolCallId,
        content: `DENIED: tool '${name}' is not in the admin review assistant agent's allowed tool list.`,
      });
    }

    return handler(request);
  },
} as any);

export function createAdminReviewAgent(input: CreateCompanyBrainAgentInput = {}) {
  return createCompanyBrainAgent({
    ...input,
    systemPrompt: input.systemPrompt ?? ADMIN_REVIEW_AGENT_SYSTEM_PROMPT,
    middleware: [...(input.middleware ?? []), adminReviewToolPolicyMiddleware],
  });
}

export async function loadAdminReviewMcpTools(input: {
  user: UserContext;
  bearerToken: string;
  repoRoot?: string;
}): Promise<NanoBrainMcpToolsSession> {
  assertAdminReviewUser(input.user);
  const policy: NanoBrainMcpToolPolicy = {
    allowedTools: [...ADMIN_REVIEW_AGENT_ALLOWED_TOOLS],
    includeAdminTools: true,
    includeHighRiskTools: false,
  };
  return loadNanoBrainMcpTools({ ...input, policy });
}
