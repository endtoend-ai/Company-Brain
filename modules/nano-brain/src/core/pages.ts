import { createHash, randomUUID } from 'node:crypto';
import type { UserContext } from '@ff/contracts';
import { getNanoBrainPool } from '../db';
import { prepareChunksForMarkdown, replacePageChunks } from './chunks';
import { replacePageLinks } from './links';
import { assertCanReadSource, assertCanWriteSource } from './permissions';
import { getSourceById, NanoBrainError } from './sources';

const MAX_MARKDOWN_BYTES = 1024 * 1024;

export type NanoPage = {
  id: string;
  sourceId: string;
  slug: string;
  title: string;
  body: string;
  contentHash: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type PutMarkdownPageInput = {
  sourceId: string;
  slug?: string;
  title?: string;
  body: string;
  contentType: string;
};

function normalizeMarkdownBody(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd() + '\n';
}

function assertMarkdownInput(input: { body: unknown; contentType: unknown }): string {
  if (input.contentType !== 'text/markdown') {
    throw new NanoBrainError('The first phase only supports text/markdown', 'invalid_input');
  }
  if (typeof input.body !== 'string') {
    throw new NanoBrainError('Markdown content must be a string', 'invalid_input');
  }
  const body = normalizeMarkdownBody(input.body);
  if (body.trim().length === 0) {
    throw new NanoBrainError('Markdown content must not be empty', 'invalid_input');
  }
  if (Buffer.byteLength(body, 'utf8') > MAX_MARKDOWN_BYTES) {
    throw new NanoBrainError('Markdown content exceeds the first-phase size limit', 'invalid_input');
  }
  return body;
}

function extractH1Title(body: string): string | null {
  for (const line of body.split('\n')) {
    const match = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function assertValidSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 1 || normalized.length > 96) {
    throw new NanoBrainError('Page slug must be between 1 and 96 characters', 'invalid_input');
  }
  if (!/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_./-]*$/.test(normalized)) {
    throw new NanoBrainError('Page slug may contain only letters, digits, Chinese characters, underscores, dots, slashes or hyphens, and must start with a letter, digit or Chinese character', 'invalid_input');
  }
  return normalized;
}

function resolveSlug(inputSlug: string | undefined, title: string, body: string): string {
  if (inputSlug) return assertValidSlug(inputSlug);
  const candidate = slugify(title);
  if (candidate) return assertValidSlug(candidate);
  const shortHash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return `untitled-${shortHash}`;
}

function resolveTitle(inputTitle: string | undefined, body: string, slug: string): string {
  const title = inputTitle?.trim() || extractH1Title(body) || slug;
  if (title.length > 200) {
    throw new NanoBrainError('Page title must be at most 200 characters', 'invalid_input');
  }
  return title;
}

function hashContent(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function mapPage(row: any): NanoPage {
  return {
    id: row.id,
    sourceId: row.source_id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    contentHash: row.content_hash,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRequiredSource(sourceId: string) {
  const source = await getSourceById(sourceId);
  if (!source) throw new NanoBrainError('source not found', 'not_found');
  return source;
}

export async function putMarkdownPage(ctx: UserContext, input: PutMarkdownPageInput): Promise<NanoPage> {
  const source = await getRequiredSource(input.sourceId);
  assertCanWriteSource(ctx, source);

  const body = assertMarkdownInput({ body: input.body, contentType: input.contentType });
  const preliminaryTitle = input.title?.trim() || extractH1Title(body) || '';
  const slug = resolveSlug(input.slug, preliminaryTitle, body);
  const title = resolveTitle(input.title, body, slug);
  const contentHash = hashContent(body);
  const chunks = await prepareChunksForMarkdown(body);

  const pool = getNanoBrainPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        INSERT INTO pages (id, source_id, slug, title, body, content_hash, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (source_id, slug)
        DO UPDATE SET
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          content_hash = EXCLUDED.content_hash,
          updated_by = EXCLUDED.updated_by,
          updated_at = now(),
          archived_at = NULL,
          archived_by = NULL
        RETURNING id, source_id, slug, title, body, content_hash, created_by, updated_by, created_at, updated_at
      `,
      [randomUUID(), input.sourceId, slug, title, body, contentHash, ctx.userId],
    );
    const page = mapPage(result.rows[0]);
    await replacePageChunks(client, { pageId: page.id, sourceId: page.sourceId, slug: page.slug, chunks });
    await replacePageLinks(client, { pageId: page.id, sourceId: page.sourceId, fromSlug: page.slug, body, createdBy: ctx.userId });
    await client.query('COMMIT');
    return page;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPage(ctx: UserContext, input: { sourceId: string; slug: string }): Promise<NanoPage> {
  const source = await getRequiredSource(input.sourceId);
  assertCanReadSource(ctx, source);

  const slug = assertValidSlug(input.slug);
  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT id, source_id, slug, title, body, content_hash, created_by, updated_by, created_at, updated_at
      FROM pages
      WHERE source_id = $1 AND slug = $2 AND archived_at IS NULL
    `,
    [input.sourceId, slug],
  );

  if (!result.rows[0]) throw new NanoBrainError('Page not found', 'not_found');
  return mapPage(result.rows[0]);
}

export async function listPages(ctx: UserContext, input: { sourceId: string }): Promise<NanoPage[]> {
  const source = await getRequiredSource(input.sourceId);
  assertCanReadSource(ctx, source);

  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT id, source_id, slug, title, body, content_hash, created_by, updated_by, created_at, updated_at
      FROM pages
      WHERE source_id = $1 AND archived_at IS NULL
      ORDER BY updated_at DESC, slug ASC
    `,
    [input.sourceId],
  );

  return result.rows.map(mapPage);
}

export async function archivePage(ctx: UserContext, input: { sourceId: string; slug: string }): Promise<NanoPage> {
  const source = await getRequiredSource(input.sourceId);
  assertCanWriteSource(ctx, source);

  const slug = assertValidSlug(input.slug);
  const pool = getNanoBrainPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        UPDATE pages
        SET archived_at = now(), archived_by = $3, updated_by = $3, updated_at = now()
        WHERE source_id = $1 AND slug = $2 AND archived_at IS NULL
        RETURNING id, source_id, slug, title, body, content_hash, created_by, updated_by, created_at, updated_at
      `,
      [input.sourceId, slug, ctx.userId],
    );

    if (!result.rows[0]) throw new NanoBrainError('Page not found', 'not_found');

    const page = mapPage(result.rows[0]);
    await client.query('DELETE FROM links WHERE from_page_id = $1', [page.id]);
    await client.query('DELETE FROM chunks WHERE page_id = $1', [page.id]);
    await client.query('COMMIT');
    return page;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
