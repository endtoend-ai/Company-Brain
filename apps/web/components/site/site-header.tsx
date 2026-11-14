"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "../theme-provider";
import { LanguageSwitcher } from "../language-switcher";
import { useI18n } from "../../lib/i18n/language-context";

const links = [
  { href: "#scenarios", key: "nav.knowledgeBases" },
  { href: "#guide", key: "nav.scenarioGuide" },
  { href: "#stages", key: "nav.architecture" },
  { href: "#approach", key: "nav.principles" }
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap wrap-wide site-header-inner">
        <Link href="/" aria-label={t("nav.home")}>
          <Logo />
        </Link>
        <nav className="site-nav">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {t(l.key)}
            </a>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link href="/app" className="btn btn-primary btn-sm">
            {t("nav.openWorkspace")}
          </Link>
          <Link href="/admin" className="btn btn-ghost btn-sm hide-sm">
            {t("nav.adminConsole")}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
