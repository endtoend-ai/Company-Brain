import type { Context } from 'hono';
import type { UserContext } from '@ff/contracts';

const INTERNAL_TOKEN_ENV = 'RAG_INTERNAL_TOKEN';

export class ModuleHttpAuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
    this.name = 'ModuleHttpAuthError';
  }
}

function requireHeader(c: Context, name: string): string {
  const value = c.req.header(name);
  if (!value) throw new ModuleHttpAuthError(`Missing internal user context header: ${name}`, 401);
  return value;
}

export function requireInternalUser(c: Context): UserContext {
  const expectedToken = process.env[INTERNAL_TOKEN_ENV];
  if (!expectedToken) {
    throw new ModuleHttpAuthError(`Module is missing ${INTERNAL_TOKEN_ENV}`, 500);
  }
  const actualToken = c.req.header('x-ff-internal-token');
  if (!actualToken || actualToken !== expectedToken) {
    throw new ModuleHttpAuthError('Internal call token is invalid', 401);
  }

  return {
    userId: requireHeader(c, 'x-ff-user-id'),
    username: requireHeader(c, 'x-ff-username'),
    isAdmin: requireHeader(c, 'x-ff-is-admin') === 'true',
  };
}
