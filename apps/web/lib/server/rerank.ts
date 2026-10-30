// Reranker provider adapters: DashScope (default), Cohere, Jina AI and Voyage AI.
// Each provider accepts a slightly different request body and returns a different envelope,
// so the global Q&A path and the admin connectivity probe share these pure helpers.

export type RerankProvider = "dashscope" | "cohere" | "jina" | "voyage";

type RerankProviderDefaults = {
  baseUrl: string;
  model: string;
};

export const RERANK_PROVIDER_DEFAULTS: Record<RerankProvider, RerankProviderDefaults> = {
  dashscope: {
    baseUrl: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank",
    model: "qwen3-rerank"
  },
  cohere: {
    baseUrl: "https://api.cohere.com/v2/rerank",
    model: "rerank-v3.5"
  },
  jina: {
    baseUrl: "https://api.jina.ai/v1/rerank",
    model: "jina-reranker-v2-base-multilingual"
  },
  voyage: {
    baseUrl: "https://api.voyageai.com/v1/rerank",
    model: "rerank-2.5"
  }
};

export function resolveRerankProvider(raw: string | null | undefined): RerankProvider {
  const value = raw?.trim().toLowerCase();
  if (value === "cohere" || value === "jina" || value === "voyage" || value === "dashscope") {
    return value;
  }
  return "dashscope";
}

export function buildRerankRequest(input: {
  provider: RerankProvider;
  model: string;
  query: string;
  documents: string[];
  topN: number;
}): Record<string, unknown> {
  const { provider, model, query, documents, topN } = input;
  if (provider === "cohere" || provider === "jina") {
    return { model, query, documents, top_n: topN };
  }
  if (provider === "voyage") {
    return { model, query, documents, top_k: topN };
  }
  // DashScope native text-rerank shape.
  return {
    model,
    input: { query, documents },
    parameters: { top_n: topN, return_documents: false }
  };
}

export type RerankResult = { index: number; score: number };

// Accepts the response envelopes used by the supported providers:
// - DashScope: { output: { results: [{ index, relevance_score }] } }
// - Cohere / Jina: { results: [{ index, relevance_score }] }
// - Voyage: { data: [{ index, relevance_score }] }
// Returns null when the payload does not look like a rerank response at all.
export function parseRerankResponse(body: unknown): RerankResult[] | null {
  const payload = body as Record<string, any> | null | undefined;
  if (!payload || typeof payload !== "object") return null;
  const list = payload.output?.results ?? payload.results ?? payload.data;
  if (!Array.isArray(list)) return null;
  const results: RerankResult[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const index = item.index;
    const score = item.relevance_score;
    if (typeof index === "number" && Number.isInteger(index) && typeof score === "number" && Number.isFinite(score)) {
      results.push({ index, score });
    }
  }
  return results;
}
