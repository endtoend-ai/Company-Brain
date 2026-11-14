"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  formatDate as formatDateWith,
  formatDisplayTime as formatDisplayTimeWith,
  formatNumber as formatNumberWith,
  formatRelativeTime as formatRelativeTimeWith,
  getDictionary,
  translate,
  type Dictionary,
  type TranslateVars
} from "./index";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  normalizeLocale,
  type Locale
} from "./types";

export type I18nValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: TranslateVars) => string;
  dictionary: Dictionary;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (value: Date | string | number, now?: Date | number) => string;
  formatDisplayTime: (value: Date | string | number, now?: Date | number) => string;
};

function buildValue(locale: Locale, setLocale: (next: Locale) => void): I18nValue {
  const dictionary = getDictionary(locale);
  return {
    locale,
    setLocale,
    dictionary,
    t: (key, vars) => translate(dictionary, key, vars),
    formatDate: (value, options) => formatDateWith(locale, value, options),
    formatNumber: (value, options) => formatNumberWith(locale, value, options),
    formatRelativeTime: (value, now) => formatRelativeTimeWith(locale, value, now),
    formatDisplayTime: (value, now) => formatDisplayTimeWith(locale, value, now)
  };
}

/**
 * Default value so `useI18n()` works in components rendered without a
 * provider (existing component tests wrap only ThemeProvider/AuthProvider).
 */
const FALLBACK: I18nValue = buildValue(DEFAULT_LOCALE, () => {});

const Ctx = createContext<I18nValue>(FALLBACK);

export function persistLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {}
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));

  const setLocale = useCallback((next: Locale) => {
    const resolved = normalizeLocale(next);
    setLocaleState(resolved);
    persistLocale(resolved);
    if (typeof document !== "undefined") {
      document.documentElement.lang = LOCALES[resolved].htmlLang;
    }
  }, []);

  const value = useMemo(() => buildValue(locale, setLocale), [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}
