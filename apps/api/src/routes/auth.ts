import { Hono } from 'hono';
import { createUser, login } from '@ff/identity';
import { initializeModuleUser } from '@ff/gateway';
import { protectedRoute } from '../lib/route';
import { handleError } from '../lib/errors';
import { toPublicUser } from '../lib/serializers';

// 认证与用户路由。
export const authRouter = new Hono();

authRouter.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json();
    const user = await createUser({ username: body.username, password: body.password, isAdmin: false });
    const userContext = { userId: user.id, username: user.username, isAdmin: user.isAdmin };
    await initializeModuleUser('nano-brain', userContext);
    await initializeModuleUser('traditional-rag', userContext);
    return c.json({ user: toPublicUser(user) }, 201);
  } catch (error) {
    return handleError(c, error, 'Registration failed');
  }
});

authRouter.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const result = await login({ username: body.username, password: body.password });
    return c.json({ token: result.token, token_type: 'Bearer', user: toPublicUser(result.user) });
  } catch (error) {
    return handleError(c, error, 'Sign-in failed');
  }
});

authRouter.get(
  '/auth/me',
  protectedRoute('Failed to load user', async (c, ctx) =>
    c.json({ user: { id: ctx.userId, username: ctx.username, is_admin: ctx.isAdmin } }),
  ),
);
