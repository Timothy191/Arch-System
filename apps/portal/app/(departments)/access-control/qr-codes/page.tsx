import { getBadgesInventory, getEntityOptions } from "./actions";
import { QrManagementStudio } from "./qr-management-studio";

export const dynamic = "force-dynamic";

export default async function QrCodesPage() {
  const [badges, options] = await Promise.all([getBadgesInventory("all"), getEntityOptions()]);

  return <QrManagementStudio initialBadges={badges} options={options} />;
}
