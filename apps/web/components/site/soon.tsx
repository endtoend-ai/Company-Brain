import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "../theme-provider";

export function Soon({ title, kind }: { title: string; kind: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="site-header scrolled">
        <div className="wrap wrap-wide site-header-inner">
          <Link href="/" aria-label="Back to home">
            <Logo />
          </Link>
          <div className="site-header-actions" style={{ marginLeft: "auto" }}>
            <ThemeToggle />
            <Link href="/" className="btn btn-ghost btn-sm">
              Back to home
            </Link>
          </div>
        </div>
      </header>
      <div
        className="wrap"
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          paddingTop: 120
        }}
      >
        <div>
          <span className="chip">
            <span className="chip-dot" /> {kind}
          </span>
          <h1 className="display" style={{ fontSize: 44, margin: "22px 0 14px" }}>
            {title}
          </h1>
          <p style={{ color: "var(--text-2)", maxWidth: "32em", margin: "0 auto", lineHeight: 1.7 }}>
            This area is still being built against the agreed visual system. Head back to the
            homepage to preview the marketing site and the workspace / admin console.
          </p>
          <div style={{ marginTop: 30 }}>
            <Link href="/" className="btn btn-primary">
              ← Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
