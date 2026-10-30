import type { UserContext } from '@ff/contracts';
import { getNanoBrainPool } from '../db';
import { insertAuditLog, type AuditLog } from './audit';
import { insertApprovedFact, normalizeApprovedFact, type ApprovedFactInput, type NanoFact } from './facts';
import { getFactSubmission, type FactSubmission, type FactSubmissionStatus } from './fact-submissions';
import { NanoBrainPermissionError } from './permissions';
import { NanoBrainError } from './sources';

export type FactReviewAction = 'approve' | 'reject' | 'request_changes';

export type ReviewFactSubmissionInput = {
  submissionId: string;
  action: FactReviewAction;
  approvedFact?: unknown;
  reviewComment?: string | null;
};

export type FactReviewResult = {
  submission: FactSubmission;
  fact: NanoFact | null;
  auditLog: AuditLog;
};

const MAX_REVIEW_COMMENT_LENGTH = 4000;

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapFactSubmission(row: any): FactSubmission {
  return {
    id: row.id,
    targetSourceId: row.target_source_id,
    submittedBy: row.submitted_by,
    rawClaim: row.raw_claim,
    rawEvidenceText: row.raw_evidence_text,
    rawEvidenceUrl: row.raw_evidence_url,
    rawContext: row.raw_context,
    warnings: parseJsonArray(row.warnings) as any,
    status: row.status,
    normalizedCandidates: parseJsonArray(row.normalized_candidates),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAction(value: unknown): FactReviewAction {
  if (value === 'approve' || value === 'reject' || value === 'request_changes') return value;
  throw new NanoBrainError('Review action is invalid', 'invalid_input');
}

function normalizeReviewComment(value: unknown, action: FactReviewAction): string | null {
  if (value === undefined || value === null) {
    if (action === 'reject' || action === 'request_changes') {
      throw new NanoBrainError('A review comment is required when rejecting or requesting changes', 'invalid_input');
    }
    return null;
  }
  if (typeof value !== 'string') throw new NanoBrainError('Review comment must be a string', 'invalid_input');
  const trimmed = value.trim();
  if (!trimmed) {
    if (action === 'reject' || action === 'request_changes') {
      throw new NanoBrainError('A review comment is required when rejecting or requesting changes', 'invalid_input');
    }
    return null;
  }
  if (trimmed.length > MAX_REVIEW_COMMENT_LENGTH) {
    throw new NanoBrainError(`Review comment must be at most ${MAX_REVIEW_COMMENT_LENGTH} characters`, 'invalid_input');
  }
  return trimmed;
}

function nextStatusForAction(action: FactReviewAction): FactSubmissionStatus {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return 'needs_changes';
}

function auditActionForReview(action: FactReviewAction) {
  if (action === 'approve') return 'fact_submission.approve' as const;
  if (action === 'reject') return 'fact_submission.reject' as const;
  return 'fact_submission.request_changes' as const;
}

function toRawSubmissionPayload(submission: FactSubmission) {
  return {
    id: submission.id,
    target_source_id: submission.targetSourceId,
    submitted_by: submission.submittedBy,
    raw_claim: submission.rawClaim,
    raw_evidence_text: submission.rawEvidenceText,
    raw_evidence_url: submission.rawEvidenceUrl,
    raw_context: submission.rawContext,
    warnings: submission.warnings,
    status: submission.status,
    created_at: submission.createdAt,
    updated_at: submission.updatedAt,
  };
}

function toApprovedPayload(approvedFact: ApprovedFactInput | null) {
  if (!approvedFact) return null;
  return {
    entity_slug: approvedFact.entitySlug,
    fact: approvedFact.fact,
    kind: approvedFact.kind,
    confidence: approvedFact.confidence,
    notability: approvedFact.notability,
    context: approvedFact.context,
    valid_from: approvedFact.validFrom,
    valid_until: approvedFact.validUntil,
    claim_metric: approvedFact.claimMetric,
    claim_value: approvedFact.claimValue,
    claim_unit: approvedFact.claimUnit,
    claim_period: approvedFact.claimPeriod,
    evidence_url: approvedFact.evidenceUrl,
    evidence_quote: approvedFact.evidenceQuote,
  };
}

async function getSubmissionForUpdate(client: any, submissionId: string): Promise<FactSubmission> {
  const result = await client.query(
    `
      SELECT id, target_source_id, submitted_by, raw_claim, raw_evidence_text, raw_evidence_url, raw_context,
        warnings, status, normalized_candidates, created_at, updated_at
      FROM fact_submissions
      WHERE id = $1
      FOR UPDATE
    `,
    [submissionId],
  );
  if (!result.rows[0]) throw new NanoBrainError('Fact submission not found', 'not_found');
  return mapFactSubmission(result.rows[0]);
}

export async function reviewFactSubmission(ctx: UserContext, input: ReviewFactSubmissionInput): Promise<FactReviewResult> {
  if (!ctx.isAdmin) {
    throw new NanoBrainPermissionError('Only admins can review fact submissions');
  }
  if (!input.submissionId?.trim()) throw new NanoBrainError('submission id must not be empty', 'invalid_input');

  const action = normalizeAction(input.action);
  const reviewComment = normalizeReviewComment(input.reviewComment, action);
  const approvedFact = action === 'approve' ? normalizeApprovedFact(input.approvedFact) : null;

  const pool = getNanoBrainPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const submission = await getSubmissionForUpdate(client, input.submissionId.trim());
    if (submission.status === 'approved' || submission.status === 'rejected') {
      throw new NanoBrainError('A submission that has already been reviewed cannot be reviewed again', 'invalid_input');
    }

    let fact: NanoFact | null = null;
    const nextStatus = nextStatusForAction(action);
    if (approvedFact) {
      fact = await insertApprovedFact(client, { actorUserId: ctx.userId, submission, approvedFact });
    }

    await client.query(
      `
        UPDATE fact_submissions
        SET status = $2,
            updated_at = now()
        WHERE id = $1
      `,
      [submission.id, nextStatus],
    );

    const auditLog = await insertAuditLog(client, {
      actorUserId: ctx.userId,
      action: auditActionForReview(action),
      targetType: 'fact_submission',
      targetId: submission.id,
      previousStatus: submission.status,
      nextStatus,
      reviewComment,
      payload: {
        raw_submission: toRawSubmissionPayload(submission),
        normalized_candidates: submission.normalizedCandidates,
        approved_payload: toApprovedPayload(approvedFact),
        fact_id: fact?.id ?? null,
      },
    });

    await client.query('COMMIT');
    const updatedSubmission = await getFactSubmission(ctx, submission.id);
    return { submission: updatedSubmission, fact, auditLog };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
