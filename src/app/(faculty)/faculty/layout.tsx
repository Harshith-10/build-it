import { cookies } from "next/headers";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/layouts/dashboard-header";
import { requireFacultyOrAdmin } from "@/lib/auth-access";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireFacultyOrAdmin();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const role =
    session.user.role === "admin"
      ? "admin"
      : session.user.role === "faculty"
        ? "faculty"
        : "student";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
      <AppSidebar role={role} />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 min-h-0 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
