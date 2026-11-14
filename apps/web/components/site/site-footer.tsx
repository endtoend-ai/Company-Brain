"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { useI18n } from "../../lib/i18n/language-context";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="wrap wrap-wide">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Logo />
            <p>{t("footer.tagline")}</p>
          </div>
          <div className="site-footer-cols">
            <div>
              <h5>{t("footer.workspaceHeading")}</h5>
              <Link href="/app">{t("footer.askCompanyBrain")}</Link>
              <Link href="/app/knowledge">{t("footer.knowledgeSpaces")}</Link>
              <Link href="/app/settings">{t("footer.mySettings")}</Link>
            </div>
            <div>
              <h5>{t("footer.adminHeading")}</h5>
              <Link href="/admin">{t("footer.knowledgeBases")}</Link>
              <Link href="/admin/new">{t("footer.newKnowledgeBase")}</Link>
              <Link href="/admin/diagnostics">{t("footer.monitoring")}</Link>
            </div>
            <div>
              <h5>{t("footer.kbHeading")}</h5>
              <a href="#scenarios">{t("footer.personalKb")}</a>
              <a href="#scenarios">{t("footer.relationshipKb")}</a>
              <a href="#scenarios">{t("footer.documentLibrary")}</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
