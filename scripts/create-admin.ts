import { closeIdentityPool, createUser, IdentityError, migrateIdentityDatabase } from '@ff/identity';
import { closeNanoBrainPool, ensureDefaultPrivateSource, migrateNanoBrainDatabase } from '@ff/nano-brain';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const username = getArg('username') ?? process.env.ADMIN_USERNAME;
  const password = getArg('password') ?? process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required, or pass --username=... --password=...');
  }

  await migrateIdentityDatabase();
  await migrateNanoBrainDatabase();

  try {
    const user = await createUser({ username, password, isAdmin: true });
    await ensureDefaultPrivateSource({ userId: user.id, username: user.username });
    console.log(`created admin: ${user.username} (${user.id})`);
  } catch (error) {
    if (error instanceof IdentityError && error.code === 'username_taken') {
      console.error(`admin username already exists: ${username}`);
      process.exit(2);
    }
    throw error;
  } finally {
    await closeIdentityPool();
    await closeNanoBrainPool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
