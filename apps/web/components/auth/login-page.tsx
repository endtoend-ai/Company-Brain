"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { Logo } from "../site/logo";
import { ThemeToggle } from "../theme-provider";
import { LanguageSwitcher } from "../language-switcher";
import { useI18n } from "../../lib/i18n/language-context";

type LoginMode = "login" | "register";

export function LoginPage({ nextPath, reason }: { nextPath: string; reason?: string }) {
  const router = useRouter();
  const auth = useAuth();
  const { t } = useI18n();
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
    if (needsAdmin && auth.user && !auth.user.is_admin) return t("auth.helperNoAdmin");
    if (needsAdmin) return t("auth.helperAdmin");
    return t("auth.helperDefault");
  }, [auth.user, needsAdmin, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "register") await auth.register({ username, password, displayName });
      else await auth.login({ username, password });
      await auth.refresh();
      router.replace(nextPath);
    } catch {
      setError(auth.message || t("auth.signInFailed"));
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
          <Link href="/" aria-label={t("nav.backToMarketing")}><Logo size={28} /></Link>
          <div className="auth-topbar-actions">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="auth-grid">
          <section className="auth-copy">
            <span>{t("auth.eyebrow")}</span>
            <h1>{t("auth.title")}</h1>
            <p>{t("auth.body")}</p>
            <div className="auth-policy-list">
              <article><b>{t("auth.policyMemberTitle")}</b><small>{t("auth.policyMemberBody")}</small></article>
              <article><b>{t("auth.policyAdminTitle")}</b><small>{t("auth.policyAdminBody")}</small></article>
              <article><b>{t("auth.policyBoundaryTitle")}</b><small>{t("auth.policyBoundaryBody")}</small></article>
            </div>
          </section>

          <section className="auth-card" aria-label={t("auth.cardLabel")}>
            <div className="auth-card-head">
              <div>
                <span>{needsAdmin ? t("auth.adminSignIn") : t("auth.workspaceSignIn")}</span>
                <h2>{mode === "login" ? t("auth.signInHeading") : t("auth.createAccountHeading")}</h2>
              </div>
              <div className="auth-mode-switch">
                <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t("auth.modeSignIn")}</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>{t("auth.modeRegister")}</button>
              </div>
            </div>

            <p className="auth-helper">{helper}</p>

            <form className="auth-form" onSubmit={submit}>
              <label>
                <span>{t("auth.username")}</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </label>
              {mode === "register" && (
                <label>
                  <span>{t("auth.displayName")}</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
                </label>
              )}
              <label>
                <span>{t("auth.password")}</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </label>
              {(error || auth.message) && <p className="auth-error" role="alert">{error || auth.message}</p>}
              <button className="auth-submit" type="submit" disabled={busy || !username.trim() || password.length < 8}>
                {busy ? t("auth.verifying") : mode === "login" ? t("auth.modeSignIn") : t("auth.createAndContinue")}
              </button>
            </form>

            <div className="auth-demo-row" aria-label={t("auth.demoAccounts")}>
              <button type="button" onClick={() => fillAccount("muyu", "muyu123456", "Maya Chen")}>{t("auth.memberAccount")}</button>
              <button type="button" onClick={() => fillAccount("admin", "admin123456", "Admin")}>{t("auth.adminAccount")}</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
