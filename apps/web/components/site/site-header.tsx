"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "../theme-provider";

const links = [
  { href: "#scenarios", label: "Knowledge Bases" },
  { href: "#guide", label: "Scenario Guide" },
  { href: "#stages", label: "Architecture" },
  { href: "#approach", label: "Principles" }
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap wrap-wide site-header-inner">
        <Link href="/" aria-label="CompanyBrain home">
          <Logo />
        </Link>
        <nav className="site-nav">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link href="/app" className="btn btn-primary btn-sm">
            Open workspace
          </Link>
          <Link href="/admin" className="btn btn-ghost btn-sm hide-sm">
            Admin console
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
