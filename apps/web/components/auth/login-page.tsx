"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";

type LoginMode = "login" | "register";

export function LoginPage({ nextPath, reason }: { nextPath: string; reason?: string }) {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<LoginMode>("login");
  const [username, setUsername] = useState("muyu");
  const [displayName, setDisplayName] = useState("Maya Chen");
  const [password, setPassword] = useState("muyu123456");
  const [error, setError] = useState("");
  const needsAdmin = reason === "admin" || nextPath.startsWith("/admin");
  const busy = auth.state === "loading";

  useEffect(() => {
    if (auth.state !== "authenticated") return;
    if (needsAdmin && !auth.user?.is_admin) return;
    router.replace(nextPath);
  }, [auth.state, auth.user?.is_admin, needsAdmin, nextPath, router]);

  const helper = useMemo(() => {
    if (needsAdmin && auth.user && !auth.user.is_admin) return "This account doesn't have admin access. Switch to an admin account to continue.";
    if (needsAdmin) return "The admin console checks the admin role; members can only enter the workspace.";
    return "After signing in you'll return to the page you were heading to, and a refresh keeps you signed in.";
  }, [auth.user, needsAdmin]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "register") await auth.register({ username, password, displayName });
      else await auth.login({ username, password });
      await auth.refresh();
      router.replace(nextPath);
    } catch {
      setError(auth.message || "Sign-in failed. Check your username and password.");
    }
  }

  function fillAccount(nextUsername: string, nextPassword: string, nextName: string) {
    setMode("login");
    setUsername(nextUsername);
    setPassword(nextPassword);
    setDisplayName(nextName);
    setError("");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <header className="auth-topbar">
          <Link href="/" aria-label="Back to the marketing site"><Logo size={28} /></Link>
          <ThemeToggle />
        </header>

        <div className="auth-grid">
          <section className="auth-copy">
            <span>Account & access</span>
            <h1>Confirm who you are, then enter the knowledge platform.</h1>
            <p>The workspace, the admin console, personal files, team files, and company-wide retrieval all pass through the same permission boundary.</p>
            <div className="auth-policy-list">
              <article><b>Workspace member</b><small>Create personal or team scenarios and see the tasks and knowledge you can access.</small></article>
              <article><b>Admin</b><small>Receive file requests, confirm how files are ingested, and control company-wide publishing.</small></article>
              <article><b>Retrieval boundary</b><small>Personal, team, and company knowledge is filtered at the API layer, not hidden by the page.</small></article>
            </div>
          </section>

          <section className="auth-card" aria-label="Sign in">
            <div className="auth-card-head">
              <div>
                <span>{needsAdmin ? "Admin sign-in" : "Workspace sign-in"}</span>
                <h2>{mode === "login" ? "Sign In" : "Create Account"}</h2>
              </div>
              <div className="auth-mode-switch">
                <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
              </div>
            </div>

            <p className="auth-helper">{helper}</p>

            <form className="auth-form" onSubmit={submit}>
              <label>
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </label>
              {mode === "register" && (
                <label>
                  <span>Display name</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
                </label>
              )}
              <label>
                <span>Password</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </label>
              {(error || auth.message) && <p className="auth-error" role="alert">{error || auth.message}</p>}
              <button className="auth-submit" type="submit" disabled={busy || !username.trim() || password.length < 8}>
                {busy ? "Verifying" : mode === "login" ? "Sign in" : "Create and continue"}
              </button>
            </form>

            <div className="auth-demo-row" aria-label="Demo accounts">
              <button type="button" onClick={() => fillAccount("muyu", "muyu123456", "Maya Chen")}>Member account</button>
              <button type="button" onClick={() => fillAccount("admin", "admin123456", "Admin")}>Admin account</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
