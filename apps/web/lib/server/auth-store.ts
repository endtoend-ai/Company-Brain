import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { User } from "../api";
import type { StoreUser } from "./platform-store";

export const AUTH_COOKIE_NAME = "ff_companybrain_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type IdentityRole = "member" | "admin";
export type IdentityUser = User & {
  display_name: string;
  organization_id: string;
  team_ids: string[];
};

type StoredUser = IdentityUser & {
  password_salt: string;
  password_hash: string;
  created_at: string;
};

type StoredSession = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
};

type AuthDb = {
  users: StoredUser[];
  sessions: StoredSession[];
};

const emptyDb = (): AuthDb => ({ users: [], sessions: [] });

export async function resetAuthStore() {
  await rm(authDbPath(), { force: true });
}

export async function registerUser(input: {
  username: string;
  password: string;
  displayName?: string;
  role?: IdentityRole;
  organizationId?: string;
  teamIds?: string[];
}): Promise<IdentityUser> {
  // 先在真 identity 库注册；不可用时回退本地。
  const viaApi = await apiRegister({ username: input.username, password: input.password });
  if (viaApi) return viaApi;
  const username = normalizeUsername(input.username);
  assertPassword(input.password);
  const db = await readAuthDb();
  if (db.users.some((user) => user.username === username)) throw new Error("User already exists");

  const now = new Date().toISOString();
  const salt = randomBytes(16).toString("base64url");
  const user: StoredUser = {
    id: `user_${randomUUID()}`,
    username,
    display_name: input.displayName?.trim() || username,
    is_admin: input.role === "admin",
    organization_id: normalizeOrganizationId(input.organizationId),
    team_ids: normalizeTeamIds(input.teamIds, input.role === "admin"),
    password_salt: salt,
    password_hash: hashPassword(input.password, salt),
    created_at: now
  };

  db.users.push(user);
  await writeAuthDb(db);
  return publicUser(user);
}

// ===== 真 identity（apps/api → Postgres ff_identity）集成 =====
// 登录/注册/校验优先走统一 API 的真实 identity 库；不可用时回退本地 scrypt 用户库，保证可用性。
function platformIdentityBaseUrl(): string {
  const raw = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  return raw.replace(/\/+$/, "");
}

function mapApiUser(apiUser: { id: string; username: string; is_admin?: boolean }): IdentityUser {
  return {
    id: apiUser.id,
    username: apiUser.username,
    display_name: apiUser.username,
    is_admin: Boolean(apiUser.is_admin),
    // 真 identity 暂不带组织/团队字段；给统一默认值，company 级知识对所有人可见、团队级回落到默认团队。
    organization_id: "org_companybrain",
    team_ids: apiUser.is_admin ? ["platform-admin"] : ["default-team"]
  };
}

function isPlatformIdentityToken(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith("ff_");
}

async function apiLogin(input: { username: string; password: string }): Promise<{ token: string; user: IdentityUser } | null> {
  try {
    const response = await fetch(`${platformIdentityBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as any;
    if (!body?.token || !body?.user) return null;
    return { token: body.token, user: mapApiUser(body.user) };
  } catch {
    return null;
  }
}

async function apiRegister(input: { username: string; password: string }): Promise<IdentityUser | null> {
  try {
    const response = await fetch(`${platformIdentityBaseUrl()}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as any;
    return body?.user ? mapApiUser(body.user) : null;
  } catch {
    return null;
  }
}

async function apiMe(token: string): Promise<IdentityUser | null> {
  try {
    const response = await fetch(`${platformIdentityBaseUrl()}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as any;
    return body?.user ? mapApiUser(body.user) : null;
  } catch {
    return null;
  }
}

export async function authenticateUser(input: { username: string; password: string }): Promise<{ token: string; user: IdentityUser } | null> {
  // 先走真 identity；真库无此用户或服务不可用时回退本地。
  const viaApi = await apiLogin(input);
  if (viaApi) return viaApi;
  await ensureDefaultUsers();
  const db = await readAuthDb();
  const username = normalizeUsername(input.username);
  const user = db.users.find((item) => item.username === username);
  if (!user || !verifyPassword(input.password, user)) return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const session: StoredSession = {
    id: `session_${randomUUID()}`,
    user_id: user.id,
    token_hash: hashToken(token),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + AUTH_COOKIE_MAX_AGE_SECONDS * 1000).toISOString()
  };
  db.sessions.unshift(session);
  db.sessions = db.sessions.filter((item) => new Date(item.expires_at).getTime() > now.getTime());
  await writeAuthDb(db);
  return { token, user: publicUser(user) };
}

export async function getSessionUser(token: string | null | undefined): Promise<IdentityUser | null> {
  if (!token) return null;
  // 真 identity 颁发的 token（ff_ 前缀）走统一 API 校验；本地 token 走本地库。
  if (isPlatformIdentityToken(token)) {
    return apiMe(token);
  }
  const db = await readAuthDb();
  const now = Date.now();
  const tokenHash = hashToken(token);
  const session = db.sessions.find((item) => item.token_hash === tokenHash && new Date(item.expires_at).getTime() > now);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.user_id);
  return user ? publicUser(user) : null;
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  const db = await readAuthDb();
  const tokenHash = hashToken(token);
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((item) => item.token_hash !== tokenHash);
  if (db.sessions.length !== before) await writeAuthDb(db);
}

export async function getRequestUser(request: Request): Promise<IdentityUser | null> {
  return getSessionUser(getRequestSessionToken(request));
}

export function getRequestSessionToken(request: Request) {
  return readBearerToken(request) ?? readCookie(request, AUTH_COOKIE_NAME);
}

export function userToStoreUser(user: IdentityUser): StoreUser {
  return {
    userId: user.id,
    name: user.display_name || user.username,
    role: user.is_admin ? "admin" : "member",
    organizationId: user.organization_id,
    teamIds: user.team_ids
  };
}

export function sessionCookie(token: string) {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function dataRoot() {
  return process.env.FF_PLATFORM_DATA_DIR || join(process.cwd(), ".platform-data");
}

function authDbPath() {
  return join(dataRoot(), "auth-db.json");
}

async function readAuthDb(): Promise<AuthDb> {
  try {
    const raw = await readFile(authDbPath(), "utf8");
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

async function writeAuthDb(db: AuthDb) {
  await mkdir(dataRoot(), { recursive: true });
  await writeFile(authDbPath(), JSON.stringify(db, null, 2));
}

async function ensureDefaultUsers() {
  const db = await readAuthDb();
  if (db.users.length > 0) return;
  const now = new Date().toISOString();
  db.users.push(createSeedUser("muyu", "muyu123456", "Maya Chen", false, now, "org_companybrain", ["sales"]));
  db.users.push(createSeedUser("admin", "admin123456", "Admin", true, now, "org_companybrain", ["platform-admin"]));
  await writeAuthDb(db);
}

function createSeedUser(username: string, password: string, displayName: string, isAdmin: boolean, now: string, organizationId: string, teamIds: string[]): StoredUser {
  const salt = randomBytes(16).toString("base64url");
  return {
    id: `user_${randomUUID()}`,
    username,
    display_name: displayName,
    is_admin: isAdmin,
    organization_id: organizationId,
    team_ids: teamIds,
    password_salt: salt,
    password_hash: hashPassword(password, salt),
    created_at: now
  };
}

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!username) throw new Error("Enter a username");
  return username;
}

function assertPassword(value: string) {
  if (value.length < 8) throw new Error("Password must be at least 8 characters");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("base64url");
}

function verifyPassword(password: string, user: StoredUser) {
  const actual = Buffer.from(hashPassword(password, user.password_salt));
  const expected = Buffer.from(user.password_hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function publicUser(user: StoredUser): IdentityUser {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    is_admin: user.is_admin,
    organization_id: normalizeOrganizationId(user.organization_id),
    team_ids: normalizeTeamIds(user.team_ids, user.is_admin)
  };
}

function normalizeOrganizationId(value?: string) {
  return value?.trim() || "org_companybrain";
}

function normalizeTeamIds(value?: string[], isAdmin = false) {
  const ids = Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
  if (ids.length > 0) return ids;
  return isAdmin ? ["platform-admin"] : [];
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice("bearer ".length).trim();
}

function readCookie(request: Request, key: string) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === key) return decodeURIComponent(rest.join("="));
  }
  return null;
}
