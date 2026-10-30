import { Hono } from 'hono';
import { listPageChunks } from '../../core/chunks';
import { archivePage, getPage, listPages, putMarkdownPage } from '../../core/pages';
import { internalRoute } from '../route';
import { toPublicChunk, toPublicPage } from '../serializers';

export const pagesRouter = new Hono();

pagesRouter.post(
  '/nano/pages',
  internalRoute('Failed to write page', async (c, ctx) => {
    const body = await c.req.json();
    const page = await putMarkdownPage(ctx, {
      sourceId: body.source_id,
      slug: body.slug,
      title: body.title,
      body: body.body,
      contentType: body.content_type,
    });
    return c.json({ page: toPublicPage(page) }, 201);
  }),
);

pagesRouter.get(
  '/nano/sources/:sourceId/pages',
  internalRoute('Failed to load page list', async (c, ctx) => {
    const pages = await listPages(ctx, { sourceId: c.req.param('sourceId')! });
    return c.json({ pages: pages.map(toPublicPage) });
  }),
);

pagesRouter.get(
  '/nano/pages/:sourceId/:slug',
  internalRoute('Failed to load page', async (c, ctx) => {
    const page = await getPage(ctx, { sourceId: c.req.param('sourceId')!, slug: c.req.param('slug')! });
    return c.json({ page: toPublicPage(page) });
  }),
);

pagesRouter.put(
  '/nano/pages/:sourceId/:slug',
  internalRoute('Failed to update page', async (c, ctx) => {
    const body = await c.req.json();
    const page = await putMarkdownPage(ctx, {
      sourceId: c.req.param('sourceId')!,
      slug: c.req.param('slug')!,
      title: body.title,
      body: body.body,
      contentType: body.content_type,
    });
    return c.json({ page: toPublicPage(page) });
  }),
);

pagesRouter.delete(
  '/nano/pages/:sourceId/:slug',
  internalRoute('Failed to archive page', async (c, ctx) => {
    const page = await archivePage(ctx, { sourceId: c.req.param('sourceId')!, slug: c.req.param('slug')! });
    return c.json({ page: toPublicPage(page), archived: true });
  }),
);

pagesRouter.get(
  '/nano/pages/:sourceId/:slug/chunks',
  internalRoute('Failed to load chunks', async (c, ctx) => {
    const chunks = await listPageChunks(ctx, { sourceId: c.req.param('sourceId')!, slug: c.req.param('slug')! });
    return c.json({ chunks: chunks.map(toPublicChunk) });
  }),
);
