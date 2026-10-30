export const DREAM_TARGET_TYPES = ['user_source', 'public_source', 'review_queue'] as const;
export type DreamTargetType = (typeof DREAM_TARGET_TYPES)[number];

export const DREAM_PHASES = ['extract_links', 'refresh_embeddings', 'health_check', 'review_queue_summary'] as const;
export type DreamPhase = (typeof DREAM_PHASES)[number];

export const DREAM_TRIGGER_TYPES = ['user', 'admin', 'system'] as const;
export type DreamTriggerType = (typeof DREAM_TRIGGER_TYPES)[number];

export const DREAM_RUN_STATUSES = ['pending', 'running', 'clean', 'ok', 'partial', 'skipped', 'failed'] as const;
export type DreamRunStatus = (typeof DREAM_RUN_STATUSES)[number];

export const DREAM_PHASE_STATUSES = ['pending', 'running', 'clean', 'ok', 'skipped', 'failed'] as const;
export type DreamPhaseStatus = (typeof DREAM_PHASE_STATUSES)[number];

export type UserSourceDreamTarget = {
  type: 'user_source';
  sourceId: string;
  userId: string;
};

export type PublicSourceDreamTarget = {
  type: 'public_source';
  sourceId: string;
};

export type ReviewQueueDreamTarget = {
  type: 'review_queue';
  targetSourceId?: string;
};

export type DreamTarget = UserSourceDreamTarget | PublicSourceDreamTarget | ReviewQueueDreamTarget;

export type DreamRun = {
  id: string;
  target: DreamTarget;
  triggeredBy: DreamTriggerType;
  triggeredByUserId: string | null;
  dryRun: boolean;
  status: DreamRunStatus;
  requestedPhases: DreamPhase[];
  totals: Record<string, unknown>;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type DreamPhaseRun = {
  id: string;
  runId: string;
  phase: DreamPhase;
  status: DreamPhaseStatus;
  durationMs: number | null;
  summary: string | null;
  details: Record<string, unknown>;
  error: Record<string, unknown> | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type DreamPhaseResult = {
  phase: DreamPhase;
  status: Exclude<DreamPhaseStatus, 'pending' | 'running'>;
  durationMs: number;
  summary: string;
  details?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

export type DreamReport = {
  schemaVersion: '1';
  runId: string;
  target: DreamTarget;
  // G1：后台化后 report 可反映运行中状态（running/pending），不再伪装成 partial。
  status: DreamRunStatus;
  dryRun: boolean;
  requestedPhases: DreamPhase[];
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  phases: DreamPhaseResult[];
  totals: Record<string, unknown>;
};

export type PageDreamState = {
  sourceId: string;
  pageId: string;
  phase: DreamPhase;
  phaseVersion: string;
  contentHash: string;
  processedAt: Date;
  details: Record<string, unknown>;
};

export type DreamLock = {
  id: string;
  targetType: DreamTargetType;
  targetSourceId: string | null;
  targetUserId: string | null;
  holderId: string;
  holderHost: string | null;
  acquiredAt: Date;
  ttlExpiresAt: Date;
};

export function isDreamTargetType(value: string): value is DreamTargetType {
  return (DREAM_TARGET_TYPES as readonly string[]).includes(value);
}

export function isDreamPhase(value: string): value is DreamPhase {
  return (DREAM_PHASES as readonly string[]).includes(value);
}

export function isDreamRunStatus(value: string): value is DreamRunStatus {
  return (DREAM_RUN_STATUSES as readonly string[]).includes(value);
}

export function isDreamPhaseStatus(value: string): value is DreamPhaseStatus {
  return (DREAM_PHASE_STATUSES as readonly string[]).includes(value);
}
