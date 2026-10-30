import type { HealthResponse, ModuleId } from "@ff/contracts";

export type SecretConfigStatus = {
  envName: string;
  configured: boolean;
  fingerprint: string | null;
};

export type DatabaseConfigStatus = {
  id: string;
  label: string;
  envName: string;
  configured: boolean;
  host: string | null;
  port: string | null;
  database: string | null;
  username: string | null;
};

export type ProviderConfigStatus = {
  id: string;
  label: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  dimensions?: number | null;
  secrets: SecretConfigStatus[];
  controls: string[];
};

export type ParserConfigStatus = {
  id: string;
  label: string;
  baseUrl: string | null;
  modelVersion: string | null;
  language: string | null;
  options: string[];
  secrets: SecretConfigStatus[];
};

export type ModuleServiceConfigStatus = {
  id: ModuleId;
  label: string;
  baseUrl: string;
  status: "ok" | "error" | "unknown";
  service: string;
  requiredEnv: string[];
  role: string;
};

export type RuntimePolicyConfigStatus = {
  label: string;
  value: string;
  impact: string;
};

export type AdminIntegrationSettings = {
  checkedAt: string;
  overallStatus: "ready" | "degraded" | "blocked";
  providers: ProviderConfigStatus[];
  parsers: ParserConfigStatus[];
  modules: ModuleServiceConfigStatus[];
  databases: DatabaseConfigStatus[];
  runtimePolicies: RuntimePolicyConfigStatus[];
};

type BuildAdminIntegrationSettingsInput = {
  env?: NodeJS.ProcessEnv;
  moduleHealth?: Partial<Record<ModuleId, HealthResponse>>;
  checkedAt?: Date;
};

const moduleHttpUrlEnv: Record<ModuleId, string> = {
  "nano-brain": "NANO_BRAIN_HTTP_URL",
  "traditional-rag": "TRADITIONAL_RAG_HTTP_URL",
  "graph-rag": "GRAPH_RAG_HTTP_URL"
};

const moduleDefaultHttpUrl: Record<ModuleId, string> = {
  "nano-brain": "http://127.0.0.1:8100",
  "traditional-rag": "http://127.0.0.1:8101",
  "graph-rag": "http://127.0.0.1:8102"
};

const moduleLabels: Record<ModuleId, string> = {
  "nano-brain": "Knowledge wiki service",
  "traditional-rag": "Document evidence service",
  "graph-rag": "Relationship graph service"
};

export function buildAdminIntegrationSettings(input: BuildAdminIntegrationSettingsInput = {}): AdminIntegrationSettings {
  const env = input.env ?? process.env;
  const providers: ProviderConfigStatus[] = [
    {
      id: "agent",
      label: "Answer model",
      provider: env.AGENT_PROVIDER ?? "openai-compatible",
      baseUrl: emptyToNull(env.AGENT_BASE_URL),
      model: emptyToNull(env.AGENT_MODEL),
      secrets: [secretStatus("AGENT_API_KEY", env.AGENT_API_KEY)],
      controls: [
        `Temperature ${env.AGENT_TEMPERATURE ?? "0"}`,
        env.AGENT_STREAM_USAGE === "true" ? "Record streaming usage" : "Do not record streaming usage"
      ]
    },
    {
      id: "embedding",
      label: "Embedding model",
      provider: env.EMBEDDING_PROVIDER ?? "openai-compatible",
      baseUrl: emptyToNull(env.EMBEDDING_BASE_URL),
      model: emptyToNull(env.EMBEDDING_MODEL),
      dimensions: numberOrNull(env.EMBEDDING_DIMENSIONS),
      secrets: [secretStatus("EMBEDDING_API_KEY", env.EMBEDDING_API_KEY)],
      controls: ["Used for document chunking, graph retrieval, and company-wide recall"]
    }
  ];

  const parsers: ParserConfigStatus[] = [
    {
      id: "mineru",
      label: "PDF parser service",
      baseUrl: emptyToNull(env.MINERU_BASE_URL ?? "https://mineru.net"),
      modelVersion: emptyToNull(env.MINERU_MODEL_VERSION ?? "vlm"),
      language: emptyToNull(env.MINERU_LANGUAGE ?? "ch"),
      options: [
        env.MINERU_ENABLE_TABLE === "false" ? "Skip tables" : "Extract tables",
        env.MINERU_ENABLE_FORMULA === "false" ? "Skip formulas" : "Extract formulas",
        env.MINERU_IS_OCR === "true" ? "Enable OCR" : "Prefer embedded document text"
      ],
      secrets: [secretStatus("MINERU_API_KEY", env.MINERU_API_KEY)]
    }
  ];

  const modules = (Object.keys(moduleLabels) as ModuleId[]).map((id): ModuleServiceConfigStatus => {
    const health = input.moduleHealth?.[id];
    return {
      id,
      label: moduleLabels[id],
      baseUrl: env[moduleHttpUrlEnv[id]] ?? moduleDefaultHttpUrl[id],
      status: health?.status ?? "unknown",
      service: health?.service ?? id,
      requiredEnv: ["RAG_INTERNAL_TOKEN", moduleHttpUrlEnv[id]],
      role: moduleRole(id)
    };
  });

  const databases = [
    databaseStatus("postgres-admin", "PostgreSQL admin connection", "POSTGRES_ADMIN_URL", env.POSTGRES_ADMIN_URL),
    databaseStatus("identity", "Accounts and permissions", "IDENTITY_DATABASE_URL", env.IDENTITY_DATABASE_URL),
    databaseStatus("nano-brain", "Knowledge wiki database", "NANO_BRAIN_DATABASE_URL", env.NANO_BRAIN_DATABASE_URL),
    databaseStatus("traditional-rag", "Document evidence database", "TRADITIONAL_RAG_DATABASE_URL", env.TRADITIONAL_RAG_DATABASE_URL),
    databaseStatus("graph-rag", "Relationship graph database", "GRAPH_RAG_DATABASE_URL", env.GRAPH_RAG_DATABASE_URL),
    databaseStatus("agent", "Sessions and tasks", "AGENT_DATABASE_URL", env.AGENT_DATABASE_URL)
  ];

  const runtimePolicies: RuntimePolicyConfigStatus[] = [
    {
      label: "Internal call token",
      value: secretStatus("RAG_INTERNAL_TOKEN", env.RAG_INTERNAL_TOKEN).configured ? "Configured" : "Not configured",
      impact: "Required when the unified API calls a RAG module"
    },
    {
      label: "Agent checkpoint schema",
      value: env.AGENT_CHECKPOINT_SCHEMA ?? "langgraph",
      impact: "Controls where LangGraph session state is stored"
    },
    {
      label: "Document storage directory",
      value: env.TRADITIONAL_RAG_STORAGE_DIR ?? ".traditional-rag-storage",
      impact: "Stores uploaded files, MinerU results, and extracted images"
    },
    {
      label: "Graph working directory",
      value: env.GRAPH_RAG_WORKING_DIR ?? ".graph-rag-workdir",
      impact: "Stores the LightRAG runtime index and working files"
    }
  ];

  return {
    checkedAt: (input.checkedAt ?? new Date()).toISOString(),
    overallStatus: summarizeStatus({ providers, parsers, modules, databases }),
    providers,
    parsers,
    modules,
    databases,
    runtimePolicies
  };
}

function secretStatus(envName: string, value: string | undefined): SecretConfigStatus {
  const normalized = value?.trim() ?? "";
  return {
    envName,
    configured: normalized.length > 0,
    fingerprint: normalized ? `...${normalized.slice(-4)}` : null
  };
}

function databaseStatus(id: string, label: string, envName: string, value: string | undefined): DatabaseConfigStatus {
  const parsed = parseDatabaseUrl(value);
  return {
    id,
    label,
    envName,
    configured: Boolean(value?.trim()),
    host: parsed?.host ?? null,
    port: parsed?.port ?? null,
    database: parsed?.database ?? null,
    username: parsed?.username ?? null
  };
}

function parseDatabaseUrl(value: string | undefined): { host: string; port: string | null; database: string; username: string | null } | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, ""),
      username: url.username || null
    };
  } catch {
    return null;
  }
}

function summarizeStatus(input: Pick<AdminIntegrationSettings, "providers" | "parsers" | "modules" | "databases">): AdminIntegrationSettings["overallStatus"] {
  const missingProviderSecret = input.providers.some((provider) => provider.secrets.some((secret) => !secret.configured));
  const missingParserSecret = input.parsers.some((parser) => parser.secrets.some((secret) => !secret.configured));
  const missingDatabase = input.databases.some((database) => !database.configured);
  if (missingProviderSecret || missingParserSecret || missingDatabase) return "blocked";
  if (input.modules.some((module) => module.status !== "ok")) return "degraded";
  return "ready";
}

function moduleRole(id: ModuleId): string {
  if (id === "nano-brain") return "Personal wiki, knowledge navigation, fact capture";
  if (id === "traditional-rag") return "PDF, spreadsheet, policy, and evidence-based Q&A";
  return "Customer profiles, relationship risk, and multi-hop graph retrieval";
}

function emptyToNull(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
