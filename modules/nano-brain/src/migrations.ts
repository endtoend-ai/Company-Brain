import { getNanoBrainPool } from './db';

export async function migrateNanoBrainDatabase(): Promise<void> {
  const pool = getNanoBrainPool();

  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('private', 'public')),
      owner_user_id TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (
        (kind = 'private' AND owner_user_id IS NOT NULL)
        OR
        (kind = 'public' AND owner_user_id IS NULL)
      )
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_private_owner_name
    ON sources (owner_user_id, name)
    WHERE kind = 'private';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_public_name
    ON sources (name)
    WHERE kind = 'public';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources (kind);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sources_owner_user_id ON sources (owner_user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_id, slug)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pages_source_id ON pages (source_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pages_content_hash ON pages (content_hash);
  `);

  await pool.query(`
    ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
  `);

  await pool.query(`
    ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS archived_by TEXT;
  `);

  await pool.query(`
    ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pages_archived_at ON pages (archived_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pages_metadata_gin ON pages USING GIN (metadata);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      embedding vector NOT NULL,
      embedding_model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (page_id, chunk_index)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_page_id ON chunks (page_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_source_slug ON chunks (source_id, slug);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON chunks (content_hash);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      from_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      from_slug TEXT NOT NULL,
      to_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
      to_slug TEXT NOT NULL,
      link_type TEXT NOT NULL DEFAULT 'mentions',
      context TEXT,
      confidence REAL NOT NULL DEFAULT 1.0,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_id, from_slug, to_slug, link_type)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_links_source_from ON links (source_id, from_slug);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_links_to_slug ON links (to_slug);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_links_link_type ON links (link_type);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fact_submissions (
      id TEXT PRIMARY KEY,
      target_source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
      submitted_by TEXT NOT NULL,
      raw_claim TEXT NOT NULL,
      raw_evidence_text TEXT,
      raw_evidence_url TEXT,
      raw_context TEXT,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'needs_changes', 'approved', 'rejected')),
      normalized_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_submissions_submitted_by
    ON fact_submissions (submitted_by, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_submissions_status
    ON fact_submissions (status, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_submissions_target_source
    ON fact_submissions (target_source_id, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
      submission_id TEXT NOT NULL UNIQUE REFERENCES fact_submissions(id) ON DELETE RESTRICT,
      entity_slug TEXT,
      fact TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('fact', 'event', 'preference', 'commitment', 'belief')),
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      notability TEXT NOT NULL CHECK (notability IN ('high', 'medium', 'low')),
      context TEXT,
      valid_from DATE,
      valid_until DATE,
      claim_metric TEXT,
      claim_value DOUBLE PRECISION,
      claim_unit TEXT,
      claim_period TEXT,
      evidence_url TEXT,
      evidence_quote TEXT,
      approved_by TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_facts_source_id
    ON facts (source_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_facts_entity_slug
    ON facts (entity_slug, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_facts_approved_by
    ON facts (approved_by, approved_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      previous_status TEXT,
      next_status TEXT,
      review_comment TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target
    ON audit_logs (target_type, target_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs (actor_user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dream_locks (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('user_source', 'public_source', 'review_queue')),
      target_source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
      target_user_id TEXT,
      holder_id TEXT NOT NULL,
      holder_host TEXT,
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ttl_expires_at TIMESTAMPTZ NOT NULL,
      CHECK (
        (target_type = 'user_source' AND target_source_id IS NOT NULL AND target_user_id IS NOT NULL)
        OR
        (target_type = 'public_source' AND target_source_id IS NOT NULL AND target_user_id IS NULL)
        OR
        (target_type = 'review_queue' AND target_user_id IS NULL)
      )
    );
  `);

  await pool.query(`
    ALTER TABLE dream_locks
    DROP CONSTRAINT IF EXISTS dream_locks_target_shape;
  `);

  await pool.query(`
    ALTER TABLE dream_locks
    ADD CONSTRAINT dream_locks_target_shape CHECK (
      (target_type = 'user_source' AND target_source_id IS NOT NULL AND target_user_id IS NOT NULL)
      OR
      (target_type = 'public_source' AND target_source_id IS NOT NULL AND target_user_id IS NULL)
      OR
      (target_type = 'review_queue' AND target_user_id IS NULL)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_locks_ttl_expires_at
    ON dream_locks (ttl_expires_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_locks_target
    ON dream_locks (target_type, target_source_id, target_user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dream_runs (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('user_source', 'public_source', 'review_queue')),
      target_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
      target_user_id TEXT,
      target JSONB NOT NULL DEFAULT '{}'::jsonb,
      triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'admin', 'system')),
      triggered_by_user_id TEXT,
      dry_run BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'clean', 'ok', 'partial', 'skipped', 'failed')),
      requested_phases JSONB NOT NULL DEFAULT '[]'::jsonb,
      totals JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(target) = 'object'),
      CHECK (jsonb_typeof(requested_phases) = 'array'),
      CHECK (jsonb_typeof(totals) = 'object'),
      CHECK (
        (target_type = 'user_source' AND target_source_id IS NOT NULL AND target_user_id IS NOT NULL)
        OR
        (target_type = 'public_source' AND target_source_id IS NOT NULL AND target_user_id IS NULL)
        OR
        (target_type = 'review_queue' AND target_user_id IS NULL)
      )
    );
  `);

  await pool.query(`
    ALTER TABLE dream_runs
    DROP CONSTRAINT IF EXISTS dream_runs_target_shape;
  `);

  await pool.query(`
    ALTER TABLE dream_runs
    ADD CONSTRAINT dream_runs_target_shape CHECK (
      (target_type = 'user_source' AND target_source_id IS NOT NULL AND target_user_id IS NOT NULL)
      OR
      (target_type = 'public_source' AND target_source_id IS NOT NULL AND target_user_id IS NULL)
      OR
      (target_type = 'review_queue' AND target_user_id IS NULL)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_runs_target_created
    ON dream_runs (target_type, target_source_id, target_user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_runs_status_created
    ON dream_runs (status, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dream_phase_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES dream_runs(id) ON DELETE CASCADE,
      phase TEXT NOT NULL CHECK (phase IN ('extract_links', 'refresh_embeddings', 'health_check', 'review_queue_summary')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'clean', 'ok', 'skipped', 'failed')),
      duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
      summary TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      error JSONB,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(details) = 'object'),
      CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
      UNIQUE (run_id, phase)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_phase_runs_run
    ON dream_phase_runs (run_id, created_at ASC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dream_phase_runs_phase_status
    ON dream_phase_runs (phase, status, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_dream_state (
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      phase TEXT NOT NULL CHECK (phase IN ('extract_links', 'refresh_embeddings', 'health_check', 'review_queue_summary')),
      phase_version TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (page_id, phase),
      CHECK (jsonb_typeof(details) = 'object')
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_page_dream_state_source_phase
    ON page_dream_state (source_id, phase, processed_at DESC);
  `);
}
