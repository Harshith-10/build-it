import { cookies } from "next/headers";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/layouts/dashboard-header";
import { requireUser } from "@/lib/auth-access";
import { BranchConfirmDialog } from "@/components/student/branch-confirm-dialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await requireUser();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const role =
    session?.user?.role === "admin"
      ? "admin"
      : session?.user?.role === "faculty"
        ? "faculty"
        : "student";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh" suppressHydrationWarning>
      <AppSidebar role={role} />
      <SidebarInset className="overflow-hidden min-h-0">
        <DashboardHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 min-h-0 overflow-y-auto">
          {role === "student" && <BranchConfirmDialog />}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

