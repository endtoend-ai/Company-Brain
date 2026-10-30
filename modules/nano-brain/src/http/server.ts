import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { captureRouter } from './routes/capture';
import { dreamRouter } from './routes/dream';
import { factSubmissionsRouter } from './routes/fact-submissions';
import { factsRouter } from './routes/facts';
import { graphRouter } from './routes/graph';
import { internalRouter } from './routes/internal';
import { pagesRouter } from './routes/pages';
import { searchRouter } from './routes/search';
import { sourcesRouter } from './routes/sources';
import { systemRouter } from './routes/system';
import { recoverInterruptedDreamRuns } from '../core/dream/runner';
import { closeNanoBrainPool } from '../db';

export function createNanoBrainHttpApp(): Hono {
  const app = new Hono();

  // 模块 HTTP 服务面向 apps/api / packages/gateway 的内部调用。
  // CORS 只为本地调试保留，生产环境应放在统一 API 层控制。
  app.use('*', cors());

  app.route('/', systemRouter);
  app.route('/', internalRouter);
  app.route('/', captureRouter);
  app.route('/', dreamRouter);
  app.route('/', factSubmissionsRouter);
  app.route('/', factsRouter);
  app.route('/', sourcesRouter);
  app.route('/', pagesRouter);
  app.route('/', graphRouter);
  app.route('/', searchRouter);

  return app;
}

export async function startNanoBrainHttpServer(port = Number(process.env.NANO_BRAIN_HTTP_PORT ?? 8100)) {
  // G2 启动恢复：把上次进程崩溃遗留的 running/pending dream_runs 标 failed + 清对应锁（不静默）。
  const startupTime = new Date();
  const recovered = await recoverInterruptedDreamRuns(startupTime);
  console.log(`[Nano Brain] startup recovery: marked ${recovered} interrupted dream runs as failed`);

  const app = createNanoBrainHttpApp();
  const server = serve({ fetch: app.fetch, port });
  console.log(`Nano Brain HTTP service listening on http://localhost:${port}`);

  // G2 优雅停机：SIGTERM/SIGINT → 关 server、关连接池；in-flight 后台 Dream 靠下次启动恢复兜底（KISS）。
  const handleShutdown = async (signal: string) => {
    try {
      console.log(`[Nano Brain] received ${signal}, shutting down gracefully...`);
      server.close();
      await closeNanoBrainPool();
      console.log('[Nano Brain] shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[Nano Brain] shutdown error:', err);
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
  process.once('SIGINT', () => handleShutdown('SIGINT'));
}

if (import.meta.main) {
  startNanoBrainHttpServer();
}
