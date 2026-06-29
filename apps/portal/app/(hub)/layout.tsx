import { BottomNav } from "@/components/nav/BottomNav";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { redirect } from "next/navigation";

async function getAccessibleDepartmentNames(userId: string): Promise<string[]> {
  const db = await createReadReplicaClient();
  const { data: empData } = await db
    .from("employees")
    .select("accessible_departments")
    .eq("auth_id", userId)
    .single();

  const accessibleDeptIds = (empData?.accessible_departments ?? []) as string[];
  if (accessibleDeptIds.length === 0) return [];

  const { data: deptData } = await db
    .from("departments")
    .select("name")
    .in("id", accessibleDeptIds);

  return (deptData ?? []).map((d) => d.name);
}

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user || !user.id) {
    redirect("/login");
  }

  const accessibleDepartments = await getAccessibleDepartmentNames(user.id);

  return (
    <div className="min-h-[calc(100vh-28px)] text-[var(--text-heading)]">
      <div className="relative z-10">
        {/* Content */}
        <div>
          <main className="w-full px-4 pt-0 pb-6 sm:px-8 sm:pt-0 sm:pb-8 pb-20 md:pb-8 -mt-4">
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation (hidden on md+) */}
        <BottomNav accessibleDepartments={accessibleDepartments} />
      </div>
    </div>
  );
}
