import type { Context } from 'hono';
import type { UserContext } from '@ff/contracts';
import { getUserByBearerToken } from '@ff/identity';

// 从 Authorization 头解析 Bearer Token。
export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function toUserContext(user: { id: string; username: string; isAdmin: boolean }): UserContext {
  return {
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

// 校验请求身份：成功返回 UserContext，失败返回 401 响应。
export async function getRequiredUser(c: Context): Promise<UserContext | Response> {
  const token = getBearerToken(c.req.header('authorization'));
  if (!token) {
    return c.json({ error: 'unauthorized', message: 'Missing Bearer token' }, 401);
  }
  const user = await getUserByBearerToken(token);
  if (!user) {
    return c.json({ error: 'unauthorized', message: 'Not signed in or session expired' }, 401);
  }
  return toUserContext(user);
}
