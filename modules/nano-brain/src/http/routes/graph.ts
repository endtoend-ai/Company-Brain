import { Hono } from 'hono';
import { graphQuery, listBacklinks, listOutgoingLinks } from '../../core/links';
import { internalRoute } from '../route';
import { toPublicLink } from '../serializers';

export const graphRouter = new Hono();

graphRouter.get(
  '/nano/links',
  internalRoute('Failed to load links', async (c, ctx) => {
    const sourceId = c.req.query('source_id');
    const slug = c.req.query('slug');
    if (!sourceId || !slug) {
      return c.json({ error: 'invalid_input', message: 'source_id and slug must not be empty' }, 400);
    }
    const links = await listOutgoingLinks(ctx, { sourceId, slug, linkType: c.req.query('link_type') });
    return c.json({ links: links.map(toPublicLink) });
  }),
);

graphRouter.get(
  '/nano/links/:sourceId/:slug',
  internalRoute('Failed to load links', async (c, ctx) => {
    const links = await listOutgoingLinks(ctx, {
      sourceId: c.req.param('sourceId')!,
      slug: c.req.param('slug')!,
      linkType: c.req.query('link_type'),
    });
    return c.json({ links: links.map(toPublicLink) });
  }),
);

graphRouter.get(
  '/nano/backlinks',
  internalRoute('Failed to load backlinks', async (c, ctx) => {
    const slug = c.req.query('slug');
    if (!slug) {
      return c.json({ error: 'invalid_input', message: 'slug must not be empty' }, 400);
    }
    const links = await listBacklinks(ctx, { slug, linkType: c.req.query('link_type') });
    return c.json({ links: links.map(toPublicLink) });
  }),
);

graphRouter.get(
  '/nano/backlinks/:slug',
  internalRoute('Failed to load backlinks', async (c, ctx) => {
    const links = await listBacklinks(ctx, { slug: c.req.param('slug')!, linkType: c.req.query('link_type') });
    return c.json({ links: links.map(toPublicLink) });
  }),
);

graphRouter.post(
  '/nano/graph/query',
  internalRoute('Failed to query the knowledge graph', async (c, ctx) => {
    const body = await c.req.json();
    const result = await graphQuery(ctx, {
      slug: body.slug,
      depth: body.depth,
      direction: body.direction,
      linkType: body.link_type,
    });
    return c.json({
      root_slug: result.rootSlug,
      depth: result.depth,
      direction: result.direction,
      nodes: result.nodes,
      links: result.links.map(toPublicLink),
    });
  }),
);
