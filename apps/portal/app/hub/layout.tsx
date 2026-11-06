import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/nav/BottomNav';
import { getAccessibleDepartmentNames } from '@/lib/hub-departments';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user?.id) {
    redirect('/login');
  }

  const accessibleDepartments = await getAccessibleDepartmentNames(user.id);

  return (
    <div className="min-h-[calc(100vh-28px)] text-[var(--text-heading)]">
      <div className="relative z-10">
        {/* Full-width responsive Hub Content Container */}
        <div className="w-full px-md pt-sm pb-20 sm:px-lg md:pb-3xl lg:px-xl xl:px-3xl 2xl:px-4xl">
          {children}
        </div>

        {/* Mobile bottom navigation (hidden on md+) */}
        <BottomNav accessibleDepartments={accessibleDepartments} />
      </div>
    </div>
  );
}
