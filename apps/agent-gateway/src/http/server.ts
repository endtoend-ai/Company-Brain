import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireUserByBearerToken } from '@ff/identity';
import type { UserContext } from '@ff/contracts';
import {
  AgentGatewayError,
  createAgentConversation,
  getAgentConversation,
  getAgentRun,
  listAgentConversations,
  toPublicConversation,
  toPublicRun,
  toPublicToolCall,
} from '../core/conversations';
import { getAgentPostgresSaver, hasAgentModelEnv, readConversationCheckpointMessages } from '../agent/checkpointer';
import { prepareAgentStream, type AgentStreamDependencies } from '../agent/stream';
import { migrateAgentGatewayDatabase } from '../migrations';

function extractBearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

async function requireAuth(c: any): Promise<{ user: UserContext; bearerToken: string }> {
  const token = extractBearerToken(c.req.header('authorization'));
  if (!token) {
    throw new AgentGatewayError('Missing Bearer token', 'forbidden', 401);
  }
  const user = await requireUserByBearerToken(token);
  return {
    bearerToken: token,
    user: {
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    },
  };
}

async function requireUser(c: any): Promise<UserContext> {
  return (await requireAuth(c)).user;
}

async function readJson(c: any): Promise<any> {
  try {
    return await c.req.json();
  } catch {
    throw new AgentGatewayError('Request body must be JSON', 'invalid_input', 400);
  }
}

function mapError(error: unknown) {
  if (error instanceof AgentGatewayError) {
    return {
      status: error.status,
      body: { error: error.code, message: error.message },
    };
  }
  if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'invalid_credentials') {
    return {
      status: 401,
      body: { error: 'unauthorized', message: 'Not signed in or session expired' },
    };
  }
  return {
    status: 500,
    body: {
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function encodeSse(input: { event: string; data: unknown; id?: string }): Uint8Array {
  const encoder = new TextEncoder();
  const lines = [
    input.id ? `id: ${input.id}` : null,
    `event: ${input.event}`,
    `data: ${JSON.stringify(input.data)}`,
    '',
    '',
  ].filter((line) => line !== null);
  return encoder.encode(lines.join('\n'));
}

export function createAgentGatewayHttpApp(options: { streamDependencies?: AgentStreamDependencies } = {}): Hono {
  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'agent-gateway' }));

  app.post('/agent/conversations', async (c) => {
    try {
      const user = await requireUser(c);
      const body = await readJson(c);
      const conversation = await createAgentConversation(user, {
        activeModule: body.active_module,
        title: body.title,
        metadata: body.metadata,
      });
      return c.json({ conversation: toPublicConversation(conversation) }, 201);
    } catch (error) {
      const mapped = mapError(error);
      return c.json(mapped.body, mapped.status as any);
    }
  });

  app.get('/agent/conversations', async (c) => {
    try {
      const user = await requireUser(c);
      const conversations = await listAgentConversations(user, { limit: c.req.query('limit') });
      return c.json({ conversations: conversations.map(toPublicConversation) });
    } catch (error) {
      const mapped = mapError(error);
      return c.json(mapped.body, mapped.status as any);
    }
  });

  app.get('/agent/conversations/:conversationId', async (c) => {
    try {
      const user = await requireUser(c);
      const details = await getAgentConversation(user, c.req.param('conversationId'), {
        messageLimit: c.req.query('message_limit'),
        runLimit: c.req.query('run_limit'),
      });
      let messages = details.messages;
      let checkpoint_id: string | null = null;
      let message_source = details.messageSource;
      if (options.streamDependencies?.checkpointer || hasAgentModelEnv()) {
        try {
          const checkpoint = await readConversationCheckpointMessages({
            conversation: details,
            checkpointer: options.streamDependencies?.checkpointer,
            model: options.streamDependencies?.model,
            tools: options.streamDependencies?.tools,
          });
          messages = checkpoint.messages;
          checkpoint_id = checkpoint.checkpointId;
          message_source = 'langgraph_checkpoint';
        } catch {
          // M25/M26 兼容：未配置生产 Agent 模型或 checkpoint 时仍可读取会话索引。
        }
      }
      return c.json({
        conversation: toPublicConversation(details),
        messages,
        message_source,
        checkpoint_id,
        runs: details.runs.map(toPublicRun),
      });
    } catch (error) {
      const mapped = mapError(error);
      return c.json(mapped.body, mapped.status as any);
    }
  });

  app.post('/agent/conversations/:conversationId/stream', async (c) => {
    let prepared: Awaited<ReturnType<typeof prepareAgentStream>>;
    const abort = new AbortController();
    try {
      const auth = await requireAuth(c);
      const body = await readJson(c);
      if (typeof body.message !== 'string' || body.message.trim().length === 0) {
        throw new AgentGatewayError('message must not be empty', 'invalid_input', 400);
      }
      prepared = await prepareAgentStream({
        user: auth.user,
        bearerToken: auth.bearerToken,
        conversationId: c.req.param('conversationId'),
        message: body.message,
        mode: body.mode === 'admin_review' ? 'admin_review' : 'default',
        requestId: c.req.header('x-request-id') ?? undefined,
        dependencies: options.streamDependencies,
      });
    } catch (error) {
      const mapped = mapError(error);
      return c.json(mapped.body, mapped.status as any);
    }

    c.req.raw.signal.addEventListener('abort', () => abort.abort());

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const event of prepared.events(abort.signal)) {
              if (abort.signal.aborted) break;
              controller.enqueue(encodeSse(event));
            }
          } catch (error) {
            if (!abort.signal.aborted) {
              controller.enqueue(
                encodeSse({
                  event: 'error',
                  data: { message: error instanceof Error ? error.message : String(error) },
                }),
              );
            }
          } finally {
            controller.close();
          }
        },
        cancel() {
          abort.abort();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  });

  app.get('/agent/conversations/:conversationId/runs/:runId', async (c) => {
    try {
      const user = await requireUser(c);
      const run = await getAgentRun(user, c.req.param('conversationId'), c.req.param('runId'));
      return c.json({
        run: toPublicRun(run),
        tool_calls: run.toolCalls.map(toPublicToolCall),
        events: [],
      });
    } catch (error) {
      const mapped = mapError(error);
      return c.json(mapped.body, mapped.status as any);
    }
  });

  return app;
}

export async function startAgentGatewayHttpServer(input: { port?: number; migrate?: boolean } = {}) {
  if (input.migrate ?? true) {
    await migrateAgentGatewayDatabase();
    await getAgentPostgresSaver();
  }
  const app = createAgentGatewayHttpApp();
  const port = input.port ?? Number(process.env.AGENT_GATEWAY_PORT ?? 3002);
  serve({ fetch: app.fetch, port });
  console.log(`FF-CompanyBrain Agent Gateway listening on http://localhost:${port}`);
  return { app, port };
}
