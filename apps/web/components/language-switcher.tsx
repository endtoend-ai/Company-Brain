"use client";

import { LOCALE_LIST, type Locale } from "../lib/i18n/types";
import { useI18n } from "../lib/i18n/language-context";

/**
 * Compact header control. `variant="section"` renders the wider form used in
 * the settings pages.
 */
export function LanguageSwitcher({
  variant = "compact",
  className
}: {
  variant?: "compact" | "section";
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  const label = t("language.switcherLabel");

  if (variant === "section") {
    return (
      <label className={className ? `language-select ${className}` : "language-select"}>
        <span>{label}</span>
        <select
          value={locale}
          aria-label={label}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          {LOCALE_LIST.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className={className ? `language-toggle ${className}` : "language-toggle"}
      role="group"
      aria-label={label}
    >
      {LOCALE_LIST.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === locale ? "active" : ""}
          aria-pressed={item.id === locale}
          aria-label={item.label}
          title={item.label}
          onClick={() => setLocale(item.id)}
        >
          {item.shortLabel}
        </button>
      ))}
    </div>
  );
}
