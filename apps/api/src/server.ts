import { serve } from '@hono/node-server';
import { createApp } from './app';

// 进程入口：创建 app 并启动 HTTP 服务。
const app = createApp();
const port = Number(process.env.API_PORT ?? 3001);

serve({ fetch: app.fetch, port });

console.log(`FF-CompanyBrain API listening on http://localhost:${port}`);
