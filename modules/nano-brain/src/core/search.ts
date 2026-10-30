import type { UserContext } from '@ff/contracts';
import { getNanoBrainPool } from '../db';
import { embedTexts, vectorToSqlLiteral } from './embeddings';
import { NanoBrainError } from './sources';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const SEARCH_POOL_LIMIT = 40;
const RRF_K = 60;

export type SearchMatchType = 'keyword' | 'vector';

export type NanoSearchResult = {
  chunkId: string;
  pageId: string;
  sourceId: string;
  sourceKind: 'private' | 'public';
  sourceName: string;
  slug: string;
  title: string;
  chunkIndex: number;
  snippet: string;
  score: number;
  matchTypes: SearchMatchType[];
};

export type NanoSearchResponse = {
  query: string;
  results: NanoSearchResult[];
};

type Candidate = {
  chunkId: string;
  pageId: string;
  sourceId: string;
  sourceKind: 'private' | 'public';
  sourceName: string;
  slug: string;
  title: string;
  chunkIndex: number;
  chunkText: string;
};

function normalizeQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new NanoBrainError('query must be a string', 'invalid_input');
  }
  const normalized = query.trim();
  if (normalized.length < 1) {
    throw new NanoBrainError('query must not be empty', 'invalid_input');
  }
  if (normalized.length > 500) {
    throw new NanoBrainError('query must be at most 500 characters', 'invalid_input');
  }
  return normalized;
}

function normalizeLimit(limit: unknown): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  const value = Number(limit);
  if (!Number.isInteger(value) || value < 1) {
    throw new NanoBrainError('limit must be a positive integer', 'invalid_input');
  }
  return Math.min(value, MAX_LIMIT);
}

function mapCandidate(row: any): Candidate {
  return {
    chunkId: row.chunk_id,
    pageId: row.page_id,
    sourceId: row.source_id,
    sourceKind: row.source_kind,
    sourceName: row.source_name,
    slug: row.slug,
    title: row.title,
    chunkIndex: Number(row.chunk_index),
    chunkText: row.chunk_text,
  };
}

function makeSnippet(text: string, query: string): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const lowerText = normalizedText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index < 0) return normalizedText.slice(0, 240);

  const start = Math.max(0, index - 80);
  const end = Math.min(normalizedText.length, index + lowerQuery.length + 160);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < normalizedText.length ? '…' : '';
  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
}

function candidateToResult(
  candidate: Candidate,
  input: { query: string; score: number; matchTypes: Set<SearchMatchType> },
): NanoSearchResult {
  return {
    chunkId: candidate.chunkId,
    pageId: candidate.pageId,
    sourceId: candidate.sourceId,
    sourceKind: candidate.sourceKind,
    sourceName: candidate.sourceName,
    slug: candidate.slug,
    title: candidate.title,
    chunkIndex: candidate.chunkIndex,
    snippet: makeSnippet(candidate.chunkText, input.query),
    score: Number(input.score.toFixed(6)),
    matchTypes: Array.from(input.matchTypes).sort(),
  };
}

async function keywordSearch(ctx: UserContext, query: string, sourceId: string | null): Promise<Candidate[]> {
  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT
        c.id AS chunk_id,
        c.page_id,
        c.source_id,
        s.kind AS source_kind,
        s.name AS source_name,
        c.slug,
        p.title,
        c.chunk_index,
        c.chunk_text
      FROM chunks c
      JOIN pages p ON p.id = c.page_id
      JOIN sources s ON s.id = c.source_id
      WHERE p.archived_at IS NULL
        AND ($1::boolean = true OR s.kind = 'public' OR s.owner_user_id = $2)
        AND (c.chunk_text ILIKE $3 OR p.title ILIKE $3 OR c.slug ILIKE $3)
        AND ($5::text IS NULL OR c.source_id = $5::text)
      ORDER BY
        CASE WHEN p.title ILIKE $3 THEN 0 ELSE 1 END,
        p.updated_at DESC,
        c.chunk_index ASC
      LIMIT $4
    `,
    [ctx.isAdmin, ctx.userId, `%${query}%`, SEARCH_POOL_LIMIT, sourceId],
  );
  return result.rows.map(mapCandidate);
}

async function vectorSearch(ctx: UserContext, query: string, sourceId: string | null): Promise<Candidate[]> {
  const { embeddings } = await embedTexts([query]);
  const queryVector = embeddings[0];
  if (!queryVector) return [];

  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT
        c.id AS chunk_id,
        c.page_id,
        c.source_id,
        s.kind AS source_kind,
        s.name AS source_name,
        c.slug,
        p.title,
        c.chunk_index,
        c.chunk_text,
        c.embedding <=> $3::vector AS distance
      FROM chunks c
      JOIN pages p ON p.id = c.page_id
      JOIN sources s ON s.id = c.source_id
      WHERE p.archived_at IS NULL
        AND ($1::boolean = true OR s.kind = 'public' OR s.owner_user_id = $2)
        AND vector_dims(c.embedding) = $5
        AND ($6::text IS NULL OR c.source_id = $6::text)
      ORDER BY c.embedding <=> $3::vector ASC
      LIMIT $4
    `,
    [ctx.isAdmin, ctx.userId, vectorToSqlLiteral(queryVector), SEARCH_POOL_LIMIT, queryVector.length, sourceId],
  );
  return result.rows.map(mapCandidate);
}

export async function searchNanoBrain(
  ctx: UserContext,
  input: { query: unknown; limit?: unknown; source_id?: unknown },
): Promise<NanoSearchResponse> {
  const query = normalizeQuery(input.query);
  const limit = normalizeLimit(input.limit);
  const sourceId = typeof input.source_id === 'string' && input.source_id.trim() ? input.source_id.trim() : null;

  const [keywordCandidates, vectorCandidates] = await Promise.all([
    keywordSearch(ctx, query, sourceId),
    vectorSearch(ctx, query, sourceId),
  ]);

  const byId = new Map<string, { candidate: Candidate; score: number; matchTypes: Set<SearchMatchType> }>();

  keywordCandidates.forEach((candidate, index) => {
    const current = byId.get(candidate.chunkId) ?? { candidate, score: 0, matchTypes: new Set<SearchMatchType>() };
    current.score += 1 / (RRF_K + index + 1);
    current.matchTypes.add('keyword');
    byId.set(candidate.chunkId, current);
  });

  vectorCandidates.forEach((candidate, index) => {
    const current = byId.get(candidate.chunkId) ?? { candidate, score: 0, matchTypes: new Set<SearchMatchType>() };
    current.score += 1 / (RRF_K + index + 1);
    current.matchTypes.add('vector');
    byId.set(candidate.chunkId, current);
  });

  const results = Array.from(byId.values())
    .sort((a, b) => b.score - a.score || a.candidate.chunkIndex - b.candidate.chunkIndex)
    .slice(0, limit)
    .map((item) => candidateToResult(item.candidate, { query, score: item.score, matchTypes: item.matchTypes }));

  return { query, results };
}

export async function askNanoBrain(
  ctx: UserContext,
  input: { query: unknown; limit?: unknown; source_id?: unknown },
): Promise<{ query: string; answer: string; citations: NanoSearchResult[] }> {
  const search = await searchNanoBrain(ctx, input);
  return {
    query: search.query,
    answer: 'The first-phase Q&A returns retrieval citations only and does not call a generation model yet. See citations.',
    citations: search.results,
  };
}
