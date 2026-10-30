import type { UserContext } from '@ff/contracts';
import type { NanoSource } from './sources';

export class NanoBrainPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NanoBrainPermissionError';
  }
}

export function canReadSource(ctx: UserContext, source: NanoSource): boolean {
  if (ctx.isAdmin) return true;
  if (source.kind === 'public') return true;
  return source.ownerUserId === ctx.userId;
}

export function canWriteSource(ctx: UserContext, source: NanoSource): boolean {
  if (ctx.isAdmin) return true;
  if (source.kind === 'public') return false;
  return source.ownerUserId === ctx.userId;
}

export function canManageSource(ctx: UserContext, source: NanoSource): boolean {
  if (ctx.isAdmin) return true;
  if (source.kind === 'public') return false;
  return source.ownerUserId === ctx.userId;
}

export function assertCanReadSource(ctx: UserContext, source: NanoSource): void {
  if (!canReadSource(ctx, source)) {
    throw new NanoBrainPermissionError('You do not have permission to read this source');
  }
}

export function assertCanWriteSource(ctx: UserContext, source: NanoSource): void {
  if (!canWriteSource(ctx, source)) {
    throw new NanoBrainPermissionError('You do not have permission to write to this source');
  }
}

export function assertCanManageSource(ctx: UserContext, source: NanoSource): void {
  if (!canManageSource(ctx, source)) {
    throw new NanoBrainPermissionError('You do not have permission to manage this source');
  }
}
