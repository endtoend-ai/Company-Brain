import pg from 'pg';
import { migrateIdentityDatabase, closeIdentityPool } from '@ff/identity';
import { migrateNanoBrainDatabase, closeNanoBrainPool } from '@ff/nano-brain';
import { closeAgentPostgresSaver, getAgentPostgresSaver } from '../apps/agent-gateway/src/agent/checkpointer';
import { closeAgentGatewayPool } from '../apps/agent-gateway/src/db';
import { migrateAgentGatewayDatabase } from '../apps/agent-gateway/src/migrations';

const { Client } = pg;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function databaseNameFromUrl(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name) throw new Error(`Cannot infer database name from ${url}`);
  return name;
}

async function databaseExists(client: pg.Client, databaseName: string): Promise<boolean> {
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  return (result.rowCount ?? 0) > 0;
}

async function createDatabaseIfMissing(client: pg.Client, databaseName: string): Promise<void> {
  if (await databaseExists(client, databaseName)) {
    console.log(`database exists: ${databaseName}`);
    return;
  }
  const safeName = '"' + databaseName.replaceAll('"', '""') + '"';
  await client.query(`CREATE DATABASE ${safeName}`);
  console.log(`created database: ${databaseName}`);
}

async function main() {
  const adminUrl = getRequiredEnv('POSTGRES_ADMIN_URL');
  const identityUrl = getRequiredEnv('IDENTITY_DATABASE_URL');
  const nanoBrainUrl = getRequiredEnv('NANO_BRAIN_DATABASE_URL');
  const agentUrl = getRequiredEnv('AGENT_DATABASE_URL');
  const traditionalRagUrl = getRequiredEnv('TRADITIONAL_RAG_DATABASE_URL');
  const graphRagUrl = getRequiredEnv('GRAPH_RAG_DATABASE_URL');
  const identityDatabaseName = databaseNameFromUrl(identityUrl);
  const nanoBrainDatabaseName = databaseNameFromUrl(nanoBrainUrl);
  const agentDatabaseName = databaseNameFromUrl(agentUrl);
  const traditionalRagDatabaseName = databaseNameFromUrl(traditionalRagUrl);
  const graphRagDatabaseName = databaseNameFromUrl(graphRagUrl);

  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  await createDatabaseIfMissing(adminClient, identityDatabaseName);
  await createDatabaseIfMissing(adminClient, nanoBrainDatabaseName);
  await createDatabaseIfMissing(adminClient, agentDatabaseName);
  await createDatabaseIfMissing(adminClient, traditionalRagDatabaseName);
  await createDatabaseIfMissing(adminClient, graphRagDatabaseName);
  await adminClient.end();

  await migrateIdentityDatabase();
  await closeIdentityPool();
  console.log('identity database migrated');

  await migrateNanoBrainDatabase();
  await closeNanoBrainPool();
  console.log('nano brain database migrated');

  await migrateAgentGatewayDatabase();
  await getAgentPostgresSaver();
  await closeAgentPostgresSaver();
  await closeAgentGatewayPool();
  console.log('agent gateway database migrated');

  const traditionalMigration = Bun.spawn(
    ['uv', 'run', '--project', 'modules/traditional-rag', 'python', '-m', 'traditional_rag.db.migrations'],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const traditionalExitCode = await traditionalMigration.exited;
  if (traditionalExitCode !== 0) {
    throw new Error(`traditional rag database migration failed with exit code ${traditionalExitCode}`);
  }
  console.log('traditional rag database migrated');

  const graphMigration = Bun.spawn(
    ['uv', 'run', '--project', 'modules/graph-rag', 'python', '-m', 'graph_rag.db.migrations'],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const graphExitCode = await graphMigration.exited;
  if (graphExitCode !== 0) {
    throw new Error(`graph rag database migration failed with exit code ${graphExitCode}`);
  }
  console.log('graph rag database migrated');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
