import { AdminGraphCurationWorkbench } from "../../../components/admin/admin-graph-curation";
import { requirePageSession } from "../../../lib/server/auth-guards";
import { userToStoreUser } from "../../../lib/server/auth-store";
import { listGraphCurationSources } from "../../../lib/server/platform-store";

export const dynamic = "force-dynamic";

export default async function AdminGraphRoute() {
  const user = await requirePageSession({ nextPath: "/admin/graph", requireAdmin: true });
  const sources = await listGraphCurationSources(userToStoreUser(user));
  return <AdminGraphCurationWorkbench sources={sources} />;
}
