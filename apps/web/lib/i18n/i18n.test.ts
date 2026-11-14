import { describe, expect, test } from "bun:test";

import { en } from "./dictionaries/en";
import { zhCN } from "./dictionaries/zh-CN";
import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  getDictionary,
  interpolate,
  translate
} from "./index";
import { DEFAULT_LOCALE, LOCALE_LIST, isLocale, normalizeLocale } from "./types";

function leafPaths(source: unknown, prefix = ""): string[] {
  if (typeof source !== "object" || source === null) return [prefix];
  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("i18n dictionaries", () => {
  test("en and zh-CN expose exactly the same keys", () => {
    expect(leafPaths(zhCN).sort()).toEqual(leafPaths(en).sort());
  });

  test("every message is a non-empty string", () => {
    for (const dictionary of [en, zhCN]) {
      for (const key of leafPaths(dictionary)) {
        const value = translate(dictionary, key);
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("zh-CN keeps technical proper nouns in English", () => {
    expect(zhCN.meta.title).toBe("CompanyBrain");
    expect(zhCN.language.english).toBe("English");
  });
});

describe("locale resolution", () => {
  test("defaults to English and recognizes both shipped locales", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_LIST.map((item) => item.id)).toEqual(["en", "zh-CN"]);
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  test("getDictionary falls back to English for unknown locales", () => {
    expect(getDictionary("zh-CN")).toBe(zhCN);
    expect(getDictionary("de")).toBe(en);
    expect(getDictionary(null)).toBe(en);
  });
});

describe("translate", () => {
  test("resolves nested keys", () => {
    expect(translate(zhCN, "common.save")).toBe("保存");
    expect(translate(en, "common.save")).toBe("Save");
  });

  test("interpolates {name} placeholders", () => {
    expect(interpolate("Hello {name}", { name: "Maya" })).toBe("Hello Maya");
    expect(interpolate("{count} assets", { count: 3 })).toBe("3 assets");
    expect(translate(zhCN, "language.currentMode", { language: "简体中文" })).toContain("简体中文");
  });

  test("leaves unknown placeholders untouched", () => {
    expect(interpolate("Hello {name}", { other: "x" })).toBe("Hello {name}");
  });

  test("falls back to English then to the key itself", () => {
    const partial = { common: {} } as unknown as typeof en;
    expect(translate(partial, "common.save")).toBe("Save");
    expect(translate(en, "does.not.exist")).toBe("does.not.exist");
  });
});

describe("formatting helpers", () => {
  const sample = new Date("2026-03-09T12:00:00.000Z");

  test("formatNumber uses the active locale", () => {
    expect(formatNumber("en", 1234567)).toBe("1,234,567");
    expect(formatNumber("zh-CN", 1234567)).toBe("1,234,567");
    expect(formatNumber("en", 0.5, { style: "percent" })).toBe("50%");
  });

  test("formatDate renders both locales and keeps unparsable input verbatim", () => {
    expect(formatDate("en", sample, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" })).toBe("03/09/2026");
    expect(formatDate("zh-CN", sample, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" })).toBe("2026/03/09");
    expect(formatDate("en", "just now")).toBe("just now");
  });

  test("formatRelativeTime reports past and future distances", () => {
    const now = new Date("2026-03-09T12:00:00.000Z").getTime();
    expect(formatRelativeTime("en", new Date(now - 2 * 60 * 60 * 1000), now)).toBe("2 hours ago");
    expect(formatRelativeTime("en", new Date(now + 3 * 24 * 60 * 60 * 1000), now)).toBe("in 3 days");
    expect(formatRelativeTime("zh-CN", new Date(now - 5 * 60 * 1000), now)).toContain("5");
    expect(formatRelativeTime("en", "not a date")).toBe("not a date");
  });
});
