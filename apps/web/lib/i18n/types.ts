export type Locale = "en" | "zh-CN";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "cb_locale";

export const LOCALE_STORAGE_KEY = "cb-locale";

export type LocaleMeta = {
  id: Locale;
  /** Native name shown in the language switcher. */
  label: string;
  /** Compact name used inside the header control. */
  shortLabel: string;
  /** Value for the `lang` attribute on `<html>`. */
  htmlLang: string;
  /** BCP 47 tag handed to `Intl` constructors. */
  intlLocale: string;
};

export const LOCALES: Record<Locale, LocaleMeta> = {
  en: {
    id: "en",
    label: "English",
    shortLabel: "EN",
    htmlLang: "en",
    intlLocale: "en-US"
  },
  "zh-CN": {
    id: "zh-CN",
    label: "简体中文",
    shortLabel: "中文",
    htmlLang: "zh-CN",
    intlLocale: "zh-CN"
  }
};

export const LOCALE_LIST: LocaleMeta[] = [LOCALES.en, LOCALES["zh-CN"]];

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
