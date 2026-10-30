import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  authenticateUser,
  getSessionUser,
  registerUser,
  revokeSession,
  resetAuthStore,
  userToStoreUser
} from "./auth-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ff-auth-store-"));
  process.env.FF_PLATFORM_DATA_DIR = root;
  await resetAuthStore();
});

afterEach(async () => {
  delete process.env.FF_PLATFORM_DATA_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("auth store", () => {
  test("registers users, creates sessions and maps roles for resource permissions", async () => {
    const member = await registerUser({ username: "muyu", password: "muyu-pass-123", displayName: "Maya Chen", organizationId: "org-main", teamIds: ["sales"] });
    const admin = await registerUser({ username: "admin", password: "admin-pass-123", displayName: "管理员", role: "admin" });

    const memberLogin = await authenticateUser({ username: "muyu", password: "muyu-pass-123" });
    const adminLogin = await authenticateUser({ username: "admin", password: "admin-pass-123" });

    expect(member.is_admin).toBe(false);
    expect(admin.is_admin).toBe(true);
    expect(memberLogin?.token).toBeString();
    expect(adminLogin?.user.is_admin).toBe(true);
    expect(await getSessionUser(memberLogin!.token)).toMatchObject({ username: "muyu", is_admin: false, organization_id: "org-main", team_ids: ["sales"] });
    expect(userToStoreUser(memberLogin!.user)).toEqual({ userId: member.id, name: "Maya Chen", role: "member", organizationId: "org-main", teamIds: ["sales"] });
    expect(userToStoreUser(adminLogin!.user)).toEqual({ userId: admin.id, name: "管理员", role: "admin", organizationId: "org_companybrain", teamIds: ["platform-admin"] });
  });

  test("rejects invalid passwords and duplicate users", async () => {
    await registerUser({ username: "muyu", password: "muyu-pass-123", displayName: "Maya Chen" });

    await expect(registerUser({ username: "muyu", password: "another-pass", displayName: "Maya Chen 2" })).rejects.toThrow("User already exists");
    expect(await authenticateUser({ username: "muyu", password: "wrong-pass" })).toBeNull();
    expect(await getSessionUser("bad-token")).toBeNull();
  });

  test("revokes sessions when users log out", async () => {
    await registerUser({ username: "muyu", password: "muyu-pass-123", displayName: "Maya Chen" });
    const login = await authenticateUser({ username: "muyu", password: "muyu-pass-123" });

    expect(await getSessionUser(login!.token)).toMatchObject({ username: "muyu" });

    await revokeSession(login!.token);

    expect(await getSessionUser(login!.token)).toBeNull();
  });
});
