import { cookies } from "next/headers";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { requireAdmin } from "@/lib/auth-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const isAdmin = session?.user?.role === "admin";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
      <AppSidebar isAdmin={isAdmin} />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
