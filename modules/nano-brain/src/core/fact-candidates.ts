import type { UserContext } from '@ff/contracts';
import { getNanoBrainPool } from '../db';
import { NanoBrainPermissionError } from './permissions';
import { getFactSubmission, type FactSubmission } from './fact-submissions';
import { NanoBrainError } from './sources';

export type FactCandidateKind = 'fact' | 'event' | 'preference' | 'commitment' | 'belief';
export type FactCandidateNotability = 'high' | 'medium' | 'low';

export type FactCandidateWarning = string | { code: string; message: string };

export type FactCandidate = {
  entity_slug: string | null;
  fact: string;
  kind: FactCandidateKind;
  confidence: number;
  notability: FactCandidateNotability;
  claim_metric?: string;
  claim_value?: number;
  claim_unit?: string;
  claim_period?: string;
  evidence_quote?: string;
  normalization_confidence: number;
  warnings: FactCandidateWarning[];
};

export type SaveFactCandidatesInput = {
  submissionId: string;
  candidates: unknown;
  generatedBy?: string;
  generator?: string;
};

const FACT_KINDS = new Set<FactCandidateKind>(['fact', 'event', 'preference', 'commitment', 'belief']);
const NOTABILITY_VALUES = new Set<FactCandidateNotability>(['high', 'medium', 'low']);
const MAX_CANDIDATES = 20;
const MAX_FACT_LENGTH = 4000;
const MAX_SHORT_TEXT_LENGTH = 512;
const MAX_EVIDENCE_QUOTE_LENGTH = 4000;
const MAX_WARNING_LENGTH = 1000;

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NanoBrainError(`${label} must be an object`, 'invalid_input');
  }
  return value as Record<string, unknown>;
}

function normalizeRequiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new NanoBrainError(`${label} must be a string`, 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) throw new NanoBrainError(`${label} must not be empty`, 'invalid_input');
  if (trimmed.length > maxLength) throw new NanoBrainError(`${label} must be at most ${maxLength} characters`, 'invalid_input');
  return trimmed;
}

function normalizeOptionalString(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new NanoBrainError(`${label} must be a string`, 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) throw new NanoBrainError(`${label} must be at most ${maxLength} characters`, 'invalid_input');
  return trimmed;
}

function normalizeNullableString(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  return normalizeOptionalString(value, label, maxLength) ?? null;
}

function normalizeNumber01(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new NanoBrainError(`${label} must be a number between 0 and 1`, 'invalid_input');
  }
  return value;
}

function normalizeOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NanoBrainError(`${label} must be a number`, 'invalid_input');
  }
  return value;
}

function normalizeKind(value: unknown): FactCandidateKind {
  if (typeof value !== 'string' || !FACT_KINDS.has(value as FactCandidateKind)) {
    throw new NanoBrainError('candidate.kind is invalid', 'invalid_input');
  }
  return value as FactCandidateKind;
}

function normalizeNotability(value: unknown): FactCandidateNotability {
  if (typeof value !== 'string' || !NOTABILITY_VALUES.has(value as FactCandidateNotability)) {
    throw new NanoBrainError('candidate.notability is invalid', 'invalid_input');
  }
  return value as FactCandidateNotability;
}

function normalizeWarning(value: unknown): FactCandidateWarning {
  if (typeof value === 'string') {
    const message = value.trim();
    if (!message) throw new NanoBrainError('candidate.warning must not be empty', 'invalid_input');
    if (message.length > MAX_WARNING_LENGTH) throw new NanoBrainError('candidate.warning is too long', 'invalid_input');
    return message;
  }

  const object = assertObject(value, 'candidate.warning');
  const code = normalizeRequiredString(object.code, 'candidate.warning.code', 128);
  const message = normalizeRequiredString(object.message, 'candidate.warning.message', MAX_WARNING_LENGTH);
  return { code, message };
}

function normalizeWarnings(value: unknown): FactCandidateWarning[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new NanoBrainError('candidate.warnings must be an array', 'invalid_input');
  return value.map(normalizeWarning);
}

function normalizeCandidate(value: unknown, index: number): FactCandidate {
  const object = assertObject(value, `candidate[${index}]`);
  const candidate: FactCandidate = {
    entity_slug: normalizeNullableString(object.entity_slug, 'candidate.entity_slug', MAX_SHORT_TEXT_LENGTH),
    fact: normalizeRequiredString(object.fact, 'candidate.fact', MAX_FACT_LENGTH),
    kind: normalizeKind(object.kind),
    confidence: normalizeNumber01(object.confidence, 'candidate.confidence'),
    notability: normalizeNotability(object.notability),
    normalization_confidence: normalizeNumber01(object.normalization_confidence, 'candidate.normalization_confidence'),
    warnings: normalizeWarnings(object.warnings),
  };

  const claimMetric = normalizeOptionalString(object.claim_metric, 'candidate.claim_metric', MAX_SHORT_TEXT_LENGTH);
  const claimValue = normalizeOptionalNumber(object.claim_value, 'candidate.claim_value');
  const claimUnit = normalizeOptionalString(object.claim_unit, 'candidate.claim_unit', MAX_SHORT_TEXT_LENGTH);
  const claimPeriod = normalizeOptionalString(object.claim_period, 'candidate.claim_period', MAX_SHORT_TEXT_LENGTH);
  const evidenceQuote = normalizeOptionalString(object.evidence_quote, 'candidate.evidence_quote', MAX_EVIDENCE_QUOTE_LENGTH);

  if (claimMetric !== undefined) candidate.claim_metric = claimMetric;
  if (claimValue !== undefined) candidate.claim_value = claimValue;
  if (claimUnit !== undefined) candidate.claim_unit = claimUnit;
  if (claimPeriod !== undefined) candidate.claim_period = claimPeriod;
  if (evidenceQuote !== undefined) candidate.evidence_quote = evidenceQuote;

  return candidate;
}

export function normalizeFactCandidates(candidates: unknown): FactCandidate[] {
  if (!Array.isArray(candidates)) throw new NanoBrainError('candidates must be an array', 'invalid_input');
  if (candidates.length < 1) throw new NanoBrainError('candidates must not be empty', 'invalid_input');
  if (candidates.length > MAX_CANDIDATES) {
    throw new NanoBrainError(`candidates must contain at most ${MAX_CANDIDATES} items`, 'invalid_input');
  }
  return candidates.map(normalizeCandidate);
}

export async function saveFactCandidates(ctx: UserContext, input: SaveFactCandidatesInput): Promise<FactSubmission> {
  if (!ctx.isAdmin) {
    throw new NanoBrainPermissionError('Only admins can save structured fact candidates');
  }
  const submission = await getFactSubmission(ctx, input.submissionId);
  if (submission.status === 'approved' || submission.status === 'rejected') {
    throw new NanoBrainError('Candidates cannot be changed once a submission has been reviewed', 'invalid_input');
  }

  const candidates = normalizeFactCandidates(input.candidates);
  const pool = getNanoBrainPool();
  await pool.query(
    `
      UPDATE fact_submissions
      SET normalized_candidates = $2::jsonb,
          updated_at = now()
      WHERE id = $1
    `,
    [submission.id, JSON.stringify(candidates)],
  );

  return getFactSubmission(ctx, submission.id);
}
