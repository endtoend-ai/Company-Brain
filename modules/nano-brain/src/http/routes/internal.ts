import { Hono } from 'hono';
import { ensureDefaultPrivateSource } from '../../core/sources';
import { internalRoute } from '../route';
import { toPublicSource } from '../serializers';

export const internalRouter = new Hono();

internalRouter.post(
  '/internal/users/default-source',
  internalRoute('Failed to initialize Nano Brain user', async (c, ctx) => {
    const source = await ensureDefaultPrivateSource({ userId: ctx.userId, username: ctx.username });
    return c.json({ source: toPublicSource(source) });
  }),
);
