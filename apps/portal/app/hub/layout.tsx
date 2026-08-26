import { BottomNav } from "@/components/nav/BottomNav";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { redirect } from "next/navigation";
import { getAccessibleDepartmentNames } from "@/lib/hub-departments";
import { cookies } from "next/headers";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user || !user.id) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();
  const accessibleDepartments = await getAccessibleDepartmentNames(user.id, cookieList);

  return (
    <div className="min-h-[calc(100vh-28px)] text-[var(--text-heading)]">
      <div className="relative z-10">
        {/* Full-width responsive Hub Content Container */}
        <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-2 pb-20 md:pb-12">
          {children}
        </main>

        {/* Mobile bottom navigation (hidden on md+) */}
        <BottomNav accessibleDepartments={accessibleDepartments} />
      </div>
    </div>
  );
}
