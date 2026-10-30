import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap wrap-wide">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Logo />
            <p>
              The enterprise knowledge platform. Turn scattered knowledge into trusted assets
              employees can ask about anytime, with evidence behind every answer and admins in
              control.
            </p>
          </div>
          <div className="site-footer-cols">
            <div>
              <h5>Workspace · Business Users</h5>
              <Link href="/app">Ask CompanyBrain</Link>
              <Link href="/app/knowledge">Knowledge Spaces</Link>
              <Link href="/app/settings">My Settings</Link>
            </div>
            <div>
              <h5>Admin Console · Knowledge Bases</h5>
              <Link href="/admin">Knowledge Bases</Link>
              <Link href="/admin/new">New Knowledge Base</Link>
              <Link href="/admin/diagnostics">Monitoring & Diagnostics</Link>
            </div>
            <div>
              <h5>Knowledge Bases</h5>
              <a href="#scenarios">Personal Knowledge Base</a>
              <a href="#scenarios">Relationship Knowledge Base</a>
              <a href="#scenarios">Document Library</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
