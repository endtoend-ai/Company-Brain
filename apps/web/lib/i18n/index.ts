import { en, type Dictionary } from "./dictionaries/en";
import { zhCN } from "./dictionaries/zh-CN";
import { DEFAULT_LOCALE, LOCALES, normalizeLocale, type Locale } from "./types";

export type { Dictionary } from "./dictionaries/en";
export * from "./types";

const dictionaries: Record<Locale, Dictionary> = {
  en,
  "zh-CN": zhCN
};

/** Dot-separated leaf paths of the English dictionary. */
export type TranslationKey = LeafKeys<Dictionary>;

type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];

export type TranslateVars = Record<string, string | number>;

export function getDictionary(locale: unknown): Dictionary {
  return dictionaries[normalizeLocale(locale)];
}

function lookup(source: unknown, key: string): string | undefined {
  let current: unknown = source;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/**
 * Resolves `key` against `dictionary`, falling back to English and then to the
 * key itself so a missing message never blanks out the UI.
 */
export function translate(dictionary: Dictionary, key: string, vars?: TranslateVars): string {
  const message = lookup(dictionary, key) ?? lookup(en, key);
  if (message === undefined) return key;
  return interpolate(message, vars);
}

export function intlLocale(locale: unknown): string {
  return LOCALES[normalizeLocale(locale)].intlLocale;
}

export function formatNumber(locale: unknown, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatDate(
  locale: unknown,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 }
];

export function formatRelativeTime(
  locale: unknown,
  value: Date | string | number,
  now: Date | number = Date.now()
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  const diff = date.getTime() - (now instanceof Date ? now.getTime() : now);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(0, "second");
}

export { en };
