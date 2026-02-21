import { cookies } from "next/headers";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/layouts/dashboard-header";
import { requireUser } from "@/lib/auth-access";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await requireUser();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const isAdmin = session?.user?.role === "admin";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
      <AppSidebar isAdmin={isAdmin} />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 h-full space-y-4 p-6 overflow-hidden min-h-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
