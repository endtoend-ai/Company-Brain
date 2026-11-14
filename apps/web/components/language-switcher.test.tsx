import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LanguageSwitcher } from "./language-switcher";
import { I18nProvider } from "../lib/i18n/language-context";
import { ThemeProvider } from "./theme-provider";

describe("language switcher", () => {
  test("renders both locales and marks English active without a provider", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <LanguageSwitcher />
      </ThemeProvider>
    );

    expect(html).toContain("EN");
    expect(html).toContain("中文");
    expect(html).toContain('aria-label="Interface language"');
    expect(html).toContain('aria-label="English"');
    expect(html).toContain('aria-label="简体中文"');
  });

  test("renders Chinese chrome when the provider starts in zh-CN", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="zh-CN">
        <LanguageSwitcher />
      </I18nProvider>
    );

    expect(html).toContain('aria-label="界面语言"');
  });

  test("renders a labelled select in the settings variant", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <LanguageSwitcher variant="section" />
      </I18nProvider>
    );

    expect(html).toContain("<select");
    expect(html).toContain("English");
    expect(html).toContain("简体中文");
  });
});
