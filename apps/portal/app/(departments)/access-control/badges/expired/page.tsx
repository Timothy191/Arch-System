import { redirect } from 'next/navigation';

export default async function LegacyExpiredBadgesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.filter) qs.set('filter', params.filter);
  if (params.page) qs.set('page', params.page);
  if (params.pageSize) qs.set('pageSize', params.pageSize);
  const queryString = qs.toString();
  redirect(queryString ? `/access-control/expired?${queryString}` : '/access-control/expired');
}
