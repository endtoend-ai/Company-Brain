import { randomUUID } from 'node:crypto';
import { getIdentityPool } from './db';
import { hashPassword, verifyPassword } from './password';
import { createBearerToken, getSessionExpiry, hashBearerToken } from './tokens';

export { closeIdentityPool, getIdentityPool } from './db';
export { migrateIdentityDatabase } from './migrations';

export type IdentityUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
};

export type AuthResult = {
  token: string;
  user: IdentityUser;
};

export class IdentityError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_input' | 'username_taken' | 'invalid_credentials' | 'not_found',
  ) {
    super(message);
    this.name = 'IdentityError';
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function assertValidCredentialsInput(username: string, password: string): string {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 64) {
    throw new IdentityError('Username must be between 3 and 64 characters', 'invalid_input');
  }
  if (!/^[a-z0-9_.@-]+$/.test(normalized)) {
    throw new IdentityError('Username may contain only letters, digits, underscores, dots, @ or hyphens', 'invalid_input');
  }
  if (password.length < 8 || password.length > 256) {
    throw new IdentityError('Password must be between 8 and 256 characters', 'invalid_input');
  }
  return normalized;
}

function mapUser(row: any): IdentityUser {
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
  };
}

export async function createUser(input: {
  username: string;
  password: string;
  isAdmin?: boolean;
}): Promise<IdentityUser> {
  const username = assertValidCredentialsInput(input.username, input.password);
  const passwordHash = await hashPassword(input.password);
  const pool = getIdentityPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO users (id, username, password_hash, is_admin)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, is_admin, created_at
      `,
      [randomUUID(), username, passwordHash, input.isAdmin ?? false],
    );
    return mapUser(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new IdentityError('Username already exists', 'username_taken');
    }
    throw error;
  }
}

export async function login(input: { username: string; password: string }): Promise<AuthResult> {
  const username = normalizeUsername(input.username);
  const pool = getIdentityPool();
  const result = await pool.query(
    `SELECT id, username, password_hash, is_admin, created_at FROM users WHERE username = $1`,
    [username],
  );
  const row = result.rows[0];
  if (!row) {
    throw new IdentityError('Incorrect username or password', 'invalid_credentials');
  }

  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) {
    throw new IdentityError('Incorrect username or password', 'invalid_credentials');
  }

  const token = createBearerToken();
  const tokenHash = hashBearerToken(token);
  await pool.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [randomUUID(), row.id, tokenHash, getSessionExpiry()],
  );

  return { token, user: mapUser(row) };
}

export async function getUserByBearerToken(token: string): Promise<IdentityUser | null> {
  const pool = getIdentityPool();
  const tokenHash = hashBearerToken(token);
  const result = await pool.query(
    `
      SELECT u.id, u.username, u.is_admin, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
    `,
    [tokenHash],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function requireUserByBearerToken(token: string): Promise<IdentityUser> {
  const user = await getUserByBearerToken(token);
  if (!user) {
    throw new IdentityError('Not signed in or session expired', 'invalid_credentials');
  }
  return user;
}
