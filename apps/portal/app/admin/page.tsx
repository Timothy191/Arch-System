import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  getUserSafely,
} from "@repo/supabase/server";
import { AdminTabsClient } from "~/features/admin/components/AdminTabsClient";
import { UsersTab } from "~/features/admin/tabs/UsersTab";
import { DepartmentsTab } from "~/features/admin/tabs/DepartmentsTab";
import { FleetTab } from "~/features/admin/tabs/FleetTab";
import { SitesTab } from "~/features/admin/tabs/SitesTab";
import { WebhooksTab } from "~/features/admin/tabs/WebhooksTab";
import { AuditLogsTab } from "~/features/admin/tabs/AuditLogsTab";
import { SettingsTab } from "~/features/admin/tabs/SettingsTab";

const TABS = [
  "users",
  "departments",
  "fleet",
  "sites",
  "webhooks",
  "audit-logs",
  "settings",
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (employee?.role !== "admin") {
    redirect("/");
  }

  const { tab: rawTab } = await searchParams;
  const activeTab =
    typeof rawTab === "string" && TABS.includes(rawTab) ? rawTab : "users";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-heading)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-lg font-medium text-[var(--text-heading)]">
            Admin Dashboard
          </span>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <AdminTabsClient activeTab={activeTab}>
          {activeTab === "users" && <UsersTab />}
          {activeTab === "departments" && <DepartmentsTab />}
          {activeTab === "fleet" && <FleetTab />}
          {activeTab === "sites" && <SitesTab />}
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "audit-logs" && <AuditLogsTab />}
          {activeTab === "settings" && <SettingsTab />}
        </AdminTabsClient>
      </main>
    </div>
  );
}
