import type { ModuleId } from '@ff/contracts';
import { getRegisteredModules } from '@ff/gateway';

export type ModuleMcpDescriptor = {
  moduleId: ModuleId;
  command: string;
  envTokenName: string;
};

export function getModuleMcpDescriptors(): ModuleMcpDescriptor[] {
  return getRegisteredModules()
    .filter((module): module is typeof module & { mcpCommand: string; mcpEnvTokenName: string } =>
      Boolean(module.mcpCommand && module.mcpEnvTokenName),
    )
    .map((module) => ({
      moduleId: module.id,
      command: module.mcpCommand,
      envTokenName: module.mcpEnvTokenName,
    }));
}

export function getModuleMcpDescriptor(moduleId: ModuleId): ModuleMcpDescriptor {
  const descriptor = getModuleMcpDescriptors().find((item) => item.moduleId === moduleId);
  if (!descriptor) throw new Error(`Module ${moduleId} has no registered MCP server`);
  return descriptor;
}
