import { AdminMonitoringPage } from "../../../components/admin/admin-monitoring";
import { requirePageSession } from "../../../lib/server/auth-guards";
import { userToStoreUser } from "../../../lib/server/auth-store";
import {
  getMonitoringOverview,
  listMonitoringTraces,
  getMonitoringTrends,
  getMonitoringFormPanels
} from "../../../lib/server/platform-store";

export const dynamic = "force-dynamic";

export default async function AdminMonitoringRoute() {
  const user = await requirePageSession({ nextPath: "/admin/monitoring", requireAdmin: true });
  const storeUser = userToStoreUser(user);
  const [overview, traces, trends, formPanels] = await Promise.all([
    getMonitoringOverview(storeUser),
    listMonitoringTraces(storeUser, { limit: 200 }),
    getMonitoringTrends(storeUser),
    getMonitoringFormPanels(storeUser)
  ]);
  return <AdminMonitoringPage overview={overview} traces={traces} trends={trends} formPanels={formPanels} />;
}
