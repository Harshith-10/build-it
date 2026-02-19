import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/layouts/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 h-full space-y-4 p-4 md:p-8 pt-6 overflow-hidden min-h-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
