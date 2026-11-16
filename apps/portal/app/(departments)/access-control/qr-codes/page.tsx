import { connection } from 'next/server';
import { getBadgesInventory, getEntityOptions } from './actions';
import { QrManagementStudio } from './qr-management-studio';

export default async function QrCodesPage() {
  await connection();
  const [badges, options] = await Promise.all([getBadgesInventory('all'), getEntityOptions()]);

  return <QrManagementStudio initialBadges={badges} options={options} />;
}
