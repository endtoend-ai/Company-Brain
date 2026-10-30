import { getAgentGatewayPool } from './db';

export async function migrateAgentGatewayDatabase(): Promise<void> {
  const pool = getAgentGatewayPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      active_module TEXT NOT NULL CHECK (active_module IN ('nano-brain', 'traditional-rag', 'graph-rag')),
      title TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      thread_id TEXT NOT NULL UNIQUE,
      latest_checkpoint_id TEXT,
      checkpoint_bootstrapped_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (jsonb_typeof(metadata) = 'object')
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_created
    ON agent_conversations (user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_active_module
    ON agent_conversations (active_module, created_at DESC);
  `);

  // 第四阶段采用折中设计：消息正文以 LangGraph checkpointer 为唯一来源，
  // Agent Gateway 自有表只保存会话索引、run 与 tool call 审计。
  // 若早期 M25 本地库创建过 agent_messages，这里主动移除，避免双写来源。
  await pool.query(`DROP TABLE IF EXISTS agent_messages CASCADE;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      provider TEXT,
      model TEXT,
      active_module TEXT NOT NULL CHECK (active_module IN ('nano-brain', 'traditional-rag', 'graph-rag')),
      input_message_id TEXT,
      output_message_id TEXT,
      langsmith_run_id TEXT,
      langsmith_trace_id TEXT,
      run_name TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      stream_protocol TEXT,
      stream_version TEXT,
      last_event_seq INTEGER NOT NULL DEFAULT 0,
      latest_checkpoint_id TEXT,
      token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
      error JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (last_event_seq >= 0),
      CHECK (jsonb_typeof(tags) = 'array'),
      CHECK (jsonb_typeof(token_usage) = 'object'),
      CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
      CHECK (jsonb_typeof(metadata) = 'object')
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation_created
    ON agent_runs (conversation_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created
    ON agent_runs (user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_runs_status_created
    ON agent_runs (status, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
      result_summary TEXT,
      result JSONB,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      error JSONB,
      sequence INTEGER NOT NULL,
      langchain_tool_call_id TEXT,
      node_name TEXT,
      namespace TEXT,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (sequence >= 0),
      CHECK (jsonb_typeof(arguments) = 'object'),
      CHECK (result IS NULL OR jsonb_typeof(result) IN ('object', 'array')),
      CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
      UNIQUE (run_id, sequence)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run_sequence
    ON agent_tool_calls (run_id, sequence ASC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_conversation_created
    ON agent_tool_calls (conversation_id, created_at DESC);
  `);
}
