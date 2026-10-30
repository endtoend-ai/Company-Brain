import { Pool } from 'pg';

let pool: Pool | null = null;

function getAgentDatabaseUrl(): string {
  const url = process.env.AGENT_DATABASE_URL;
  if (!url) {
    throw new Error('AGENT_DATABASE_URL is not configured; cannot connect to the Agent Gateway database');
  }
  return url;
}

export function getAgentGatewayPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getAgentDatabaseUrl() });
  }
  return pool;
}

export async function closeAgentGatewayPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
