import { Hono } from 'hono';
import { askNanoBrain, searchNanoBrain } from '../../core/search';
import { internalRoute } from '../route';
import { toPublicSearchResult } from '../serializers';

export const searchRouter = new Hono();

searchRouter.post(
  '/nano/search',
  internalRoute('Search failed', async (c, ctx) => {
    const body = await c.req.json();
    const result = await searchNanoBrain(ctx, { query: body.query, limit: body.limit, source_id: body.source_id });
    return c.json({ query: result.query, results: result.results.map(toPublicSearchResult) });
  }),
);

searchRouter.post(
  '/nano/ask',
  internalRoute('Q&A failed', async (c, ctx) => {
    const body = await c.req.json();
    const result = await askNanoBrain(ctx, { query: body.query, limit: body.limit, source_id: body.source_id });
    return c.json({
      query: result.query,
      answer: result.answer,
      citations: result.citations.map(toPublicSearchResult),
    });
  }),
);
