import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { getNanoBrainPool } from '../db';
import { NanoBrainError } from './sources';
import type { FactSubmission, FactSubmissionStatus } from './fact-submissions';

export type FactKind = 'fact' | 'event' | 'preference' | 'commitment' | 'belief';
export type FactNotability = 'high' | 'medium' | 'low';

export type ApprovedFactInput = {
  entitySlug?: string | null;
  fact: string;
  kind: FactKind;
  confidence: number;
  notability: FactNotability;
  context?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  claimMetric?: string | null;
  claimValue?: number | null;
  claimUnit?: string | null;
  claimPeriod?: string | null;
  evidenceUrl?: string | null;
  evidenceQuote?: string | null;
};

export type NanoFact = {
  id: string;
  sourceId: string;
  submissionId: string;
  entitySlug: string | null;
  fact: string;
  kind: FactKind;
  confidence: number;
  notability: FactNotability;
  context: string | null;
  validFrom: string | null;
  validUntil: string | null;
  claimMetric: string | null;
  claimValue: number | null;
  claimUnit: string | null;
  claimPeriod: string | null;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
  approvedBy: string;
  approvedAt: Date;
  submittedBy?: string;
  submissionStatus?: FactSubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ListFactsInput = {
  sourceId?: string;
  entitySlug?: string;
  submittedBy?: string;
  status?: FactSubmissionStatus;
  limit?: number;
};

const FACT_KINDS = new Set<FactKind>(['fact', 'event', 'preference', 'commitment', 'belief']);
const NOTABILITY_VALUES = new Set<FactNotability>(['high', 'medium', 'low']);
const MAX_FACT_LENGTH = 4000;
const MAX_SHORT_TEXT_LENGTH = 512;
const MAX_CONTEXT_LENGTH = 12000;
const MAX_EVIDENCE_QUOTE_LENGTH = 4000;
const MAX_URL_LENGTH = 2048;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function normalizeRequiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new NanoBrainError(`${label} must be a string`, 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) throw new NanoBrainError(`${label} must not be empty`, 'invalid_input');
  if (trimmed.length > maxLength) throw new NanoBrainError(`${label} must be at most ${maxLength} characters`, 'invalid_input');
  return trimmed;
}

function normalizeOptionalString(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new NanoBrainError(`${label} must be a string`, 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new NanoBrainError(`${label} must be at most ${maxLength} characters`, 'invalid_input');
  return trimmed;
}

function normalizeNumber01(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new NanoBrainError(`${label} must be a number between 0 and 1`, 'invalid_input');
  }
  return value;
}

function normalizeOptionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NanoBrainError(`${label} must be a number`, 'invalid_input');
  }
  return value;
}

function normalizeKind(value: unknown): FactKind {
  if (typeof value !== 'string' || !FACT_KINDS.has(value as FactKind)) {
    throw new NanoBrainError('approved_fact.kind is invalid', 'invalid_input');
  }
  return value as FactKind;
}

function normalizeNotability(value: unknown): FactNotability {
  if (typeof value !== 'string' || !NOTABILITY_VALUES.has(value as FactNotability)) {
    throw new NanoBrainError('approved_fact.notability is invalid', 'invalid_input');
  }
  return value as FactNotability;
}

function normalizeStatus(value: FactSubmissionStatus | undefined): FactSubmissionStatus | undefined {
  if (value === undefined) return undefined;
  if (value === 'pending_review' || value === 'needs_changes' || value === 'approved' || value === 'rejected') {
    return value;
  }
  throw new NanoBrainError('submission status is invalid', 'invalid_input');
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new NanoBrainError(`limit must be an integer between 1 and ${MAX_LIMIT}`, 'invalid_input');
  }
  return value;
}

function normalizeOptionalFilter(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new NanoBrainError(`${label} must be a string`, 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_SHORT_TEXT_LENGTH) {
    throw new NanoBrainError(`${label} must be at most ${MAX_SHORT_TEXT_LENGTH} characters`, 'invalid_input');
  }
  return trimmed;
}

function normalizeOptionalDate(value: unknown, label: string): string | null {
  const normalized = normalizeOptionalString(value, label, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new NanoBrainError(`${label} must use the YYYY-MM-DD format`, 'invalid_input');
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new NanoBrainError(`${label} is not a valid date`, 'invalid_input');
  }
  return normalized;
}

function normalizeOptionalUrl(value: unknown): string | null {
  const url = normalizeOptionalString(value, 'approved_fact.evidence_url', MAX_URL_LENGTH);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    return parsed.toString();
  } catch {
    throw new NanoBrainError('approved_fact.evidence_url must be a valid http(s) URL', 'invalid_input');
  }
}

export function normalizeApprovedFact(input: unknown): ApprovedFactInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new NanoBrainError('approved_fact must be an object', 'invalid_input');
  }
  const object = input as Record<string, unknown>;
  return {
    entitySlug: normalizeOptionalString(object.entity_slug, 'approved_fact.entity_slug', MAX_SHORT_TEXT_LENGTH),
    fact: normalizeRequiredString(object.fact, 'approved_fact.fact', MAX_FACT_LENGTH),
    kind: normalizeKind(object.kind),
    confidence: normalizeNumber01(object.confidence, 'approved_fact.confidence'),
    notability: normalizeNotability(object.notability),
    context: normalizeOptionalString(object.context, 'approved_fact.context', MAX_CONTEXT_LENGTH),
    validFrom: normalizeOptionalDate(object.valid_from, 'approved_fact.valid_from'),
    validUntil: normalizeOptionalDate(object.valid_until, 'approved_fact.valid_until'),
    claimMetric: normalizeOptionalString(object.claim_metric, 'approved_fact.claim_metric', MAX_SHORT_TEXT_LENGTH),
    claimValue: normalizeOptionalNumber(object.claim_value, 'approved_fact.claim_value'),
    claimUnit: normalizeOptionalString(object.claim_unit, 'approved_fact.claim_unit', MAX_SHORT_TEXT_LENGTH),
    claimPeriod: normalizeOptionalString(object.claim_period, 'approved_fact.claim_period', MAX_SHORT_TEXT_LENGTH),
    evidenceUrl: normalizeOptionalUrl(object.evidence_url),
    evidenceQuote: normalizeOptionalString(object.evidence_quote, 'approved_fact.evidence_quote', MAX_EVIDENCE_QUOTE_LENGTH),
  };
}

export function mapFact(row: any): NanoFact {
  return {
    id: row.id,
    sourceId: row.source_id,
    submissionId: row.submission_id,
    entitySlug: row.entity_slug,
    fact: row.fact,
    kind: row.kind,
    confidence: Number(row.confidence),
    notability: row.notability,
    context: row.context,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    claimMetric: row.claim_metric,
    claimValue: row.claim_value === null || row.claim_value === undefined ? null : Number(row.claim_value),
    claimUnit: row.claim_unit,
    claimPeriod: row.claim_period,
    evidenceUrl: row.evidence_url,
    evidenceQuote: row.evidence_quote,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    submittedBy: row.submitted_by,
    submissionStatus: row.submission_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function factSelectColumns(): string {
  return `
    f.id,
    f.source_id,
    f.submission_id,
    f.entity_slug,
    f.fact,
    f.kind,
    f.confidence,
    f.notability,
    f.context,
    f.valid_from,
    f.valid_until,
    f.claim_metric,
    f.claim_value,
    f.claim_unit,
    f.claim_period,
    f.evidence_url,
    f.evidence_quote,
    f.approved_by,
    f.approved_at,
    fs.submitted_by,
    fs.status AS submission_status,
    f.created_at,
    f.updated_at
  `;
}

function buildReadableFactWhere(ctx: { isAdmin: boolean; userId: string }, input: ListFactsInput = {}) {
  const sourceId = normalizeOptionalFilter(input.sourceId, 'source_id');
  const entitySlug = normalizeOptionalFilter(input.entitySlug, 'entity_slug');
  const submittedBy = normalizeOptionalFilter(input.submittedBy, 'submitted_by');
  const status = normalizeStatus(input.status);

  const values: unknown[] = [ctx.isAdmin, ctx.userId];
  const conditions = [`($1::boolean = true OR s.kind = 'public' OR s.owner_user_id = $2)`];

  if (sourceId) {
    values.push(sourceId);
    conditions.push(`f.source_id = $${values.length}`);
  }

  if (entitySlug) {
    values.push(entitySlug);
    conditions.push(`f.entity_slug = $${values.length}`);
  }

  if (submittedBy) {
    values.push(submittedBy);
    conditions.push(`fs.submitted_by = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`fs.status = $${values.length}`);
  }

  return { whereClause: `WHERE ${conditions.join(' AND ')}`, values };
}

export async function listFacts(ctx: { isAdmin: boolean; userId: string }, input: ListFactsInput = {}): Promise<NanoFact[]> {
  const limit = normalizeLimit(input.limit);
  const { whereClause, values } = buildReadableFactWhere(ctx, input);
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT ${factSelectColumns()}
      FROM facts f
      JOIN sources s ON s.id = f.source_id
      JOIN fact_submissions fs ON fs.id = f.submission_id
      ${whereClause}
      ORDER BY f.approved_at DESC, f.created_at DESC, f.id DESC
      LIMIT ${limitPlaceholder}
    `,
    values,
  );
  return result.rows.map(mapFact);
}

export async function getFact(ctx: { isAdmin: boolean; userId: string }, factId: string): Promise<NanoFact> {
  if (!factId?.trim()) throw new NanoBrainError('fact id must not be empty', 'invalid_input');
  const { whereClause, values } = buildReadableFactWhere(ctx);
  values.push(factId.trim());
  const factIdPlaceholder = `$${values.length}`;

  const pool = getNanoBrainPool();
  const result = await pool.query(
    `
      SELECT ${factSelectColumns()}
      FROM facts f
      JOIN sources s ON s.id = f.source_id
      JOIN fact_submissions fs ON fs.id = f.submission_id
      ${whereClause}
        AND f.id = ${factIdPlaceholder}
      LIMIT 1
    `,
    values,
  );
  if (!result.rows[0]) throw new NanoBrainError('fact not found', 'not_found');
  return mapFact(result.rows[0]);
}

export async function listEntityFacts(
  ctx: { isAdmin: boolean; userId: string },
  entitySlug: string,
  input: Omit<ListFactsInput, 'entitySlug'> = {},
): Promise<NanoFact[]> {
  const normalizedEntitySlug = normalizeOptionalFilter(entitySlug, 'entity_slug');
  if (!normalizedEntitySlug) throw new NanoBrainError('entity_slug must not be empty', 'invalid_input');
  return listFacts(ctx, { ...input, entitySlug: normalizedEntitySlug });
}

export async function insertApprovedFact(
  client: pg.PoolClient,
  input: { actorUserId: string; submission: FactSubmission; approvedFact: ApprovedFactInput },
): Promise<NanoFact> {
  const result = await client.query(
    `
      WITH inserted_fact AS (
        INSERT INTO facts (
          id,
          source_id,
          submission_id,
          entity_slug,
          fact,
          kind,
          confidence,
          notability,
          context,
          valid_from,
          valid_until,
          claim_metric,
          claim_value,
          claim_unit,
          claim_period,
          evidence_url,
          evidence_quote,
          approved_by,
          approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12, $13, $14, $15, $16, $17, $18, now())
        RETURNING id, source_id, submission_id, entity_slug, fact, kind, confidence, notability, context,
          valid_from, valid_until, claim_metric, claim_value, claim_unit, claim_period, evidence_url, evidence_quote,
          approved_by, approved_at, created_at, updated_at
      )
      SELECT inserted_fact.*, fs.submitted_by, 'approved'::text AS submission_status
      FROM inserted_fact
      JOIN fact_submissions fs ON fs.id = inserted_fact.submission_id
    `,
    [
      randomUUID(),
      input.submission.targetSourceId,
      input.submission.id,
      input.approvedFact.entitySlug,
      input.approvedFact.fact,
      input.approvedFact.kind,
      input.approvedFact.confidence,
      input.approvedFact.notability,
      input.approvedFact.context,
      input.approvedFact.validFrom,
      input.approvedFact.validUntil,
      input.approvedFact.claimMetric,
      input.approvedFact.claimValue,
      input.approvedFact.claimUnit,
      input.approvedFact.claimPeriod,
      input.approvedFact.evidenceUrl ?? input.submission.rawEvidenceUrl,
      input.approvedFact.evidenceQuote,
      input.actorUserId,
    ],
  );
  return mapFact(result.rows[0]);
}
