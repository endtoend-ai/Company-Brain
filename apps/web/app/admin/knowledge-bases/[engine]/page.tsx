import { notFound } from "next/navigation";

import { AdminKnowledgeEnginePage } from "../../../../components/admin/admin-pages";
import { requirePageSession } from "../../../../lib/server/auth-guards";
import { userToStoreUser } from "../../../../lib/server/auth-store";
import { listAdminKnowledgeAssetDetails, type AdminRagEngine } from "../../../../lib/server/platform-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ engine: string }>;
};

const engineBySlug: Record<string, AdminRagEngine> = {
  gbrain: "Gbrain",
  naive: "Naive RAG",
  graph: "GraphRAG"
};

export default async function AdminKnowledgeEngineRoute({ params }: RouteContext) {
  const { engine: slug } = await params;
  const engine = engineBySlug[slug];
  if (!engine) notFound();

  const user = await requirePageSession({ nextPath: `/admin/knowledge-bases/${slug}`, requireAdmin: true });
  const assets = await listAdminKnowledgeAssetDetails(userToStoreUser(user), { engine });
  return <AdminKnowledgeEnginePage engine={engine} initialAssets={assets} />;
}
