import { describe, expect, test } from "bun:test";

import {
  buildRerankRequest,
  parseRerankResponse,
  RERANK_PROVIDER_DEFAULTS,
  resolveRerankProvider
} from "./rerank";

describe("rerank provider adapters", () => {
  test("resolves known providers and falls back to dashscope", () => {
    expect(resolveRerankProvider("cohere")).toBe("cohere");
    expect(resolveRerankProvider(" JINA ")).toBe("jina");
    expect(resolveRerankProvider("voyage")).toBe("voyage");
    expect(resolveRerankProvider("dashscope")).toBe("dashscope");
    expect(resolveRerankProvider(undefined)).toBe("dashscope");
    expect(resolveRerankProvider("unknown")).toBe("dashscope");
  });

  test("ships a default endpoint and model per provider", () => {
    for (const provider of ["dashscope", "cohere", "jina", "voyage"] as const) {
      expect(RERANK_PROVIDER_DEFAULTS[provider].baseUrl).toStartWith("https://");
      expect(RERANK_PROVIDER_DEFAULTS[provider].model.length).toBeGreaterThan(0);
    }
  });

  test("builds provider-specific request bodies", () => {
    const base = { model: "m", query: "q", documents: ["a", "b"], topN: 2 };

    expect(buildRerankRequest({ ...base, provider: "dashscope" })).toEqual({
      model: "m",
      input: { query: "q", documents: ["a", "b"] },
      parameters: { top_n: 2, return_documents: false }
    });
    expect(buildRerankRequest({ ...base, provider: "cohere" })).toEqual({
      model: "m",
      query: "q",
      documents: ["a", "b"],
      top_n: 2
    });
    expect(buildRerankRequest({ ...base, provider: "jina" })).toEqual({
      model: "m",
      query: "q",
      documents: ["a", "b"],
      top_n: 2
    });
    expect(buildRerankRequest({ ...base, provider: "voyage" })).toEqual({
      model: "m",
      query: "q",
      documents: ["a", "b"],
      top_k: 2
    });
  });

  test("parses the response envelope of every provider", () => {
    expect(parseRerankResponse({ output: { results: [{ index: 0, relevance_score: 0.9 }] } })).toEqual([
      { index: 0, score: 0.9 }
    ]);
    expect(parseRerankResponse({ results: [{ index: 1, relevance_score: 0.4 }] })).toEqual([
      { index: 1, score: 0.4 }
    ]);
    expect(parseRerankResponse({ data: [{ index: 2, relevance_score: 0.2 }] })).toEqual([
      { index: 2, score: 0.2 }
    ]);
  });

  test("ignores malformed results and unrelated payloads", () => {
    expect(parseRerankResponse(null)).toBeNull();
    expect(parseRerankResponse({ choices: [] })).toBeNull();
    expect(parseRerankResponse({ results: "nope" })).toBeNull();
    expect(parseRerankResponse({ results: [{ index: "0", relevance_score: 0.9 }] })).toEqual([]);
    expect(parseRerankResponse({ results: [{ index: 0 }] })).toEqual([]);
  });
});
