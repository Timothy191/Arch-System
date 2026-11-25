import { redirect } from 'next/navigation';

export default function LegacyExpiredBadgesRedirectPage() {
  redirect('/access-control/expired');
}
