import { DashboardHeader } from "@/components/layouts/dashboard-header";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <DashboardHeader />
      <main className="flex-1 h-full space-y-4 p-4 md:p-8 pt-6">{children}</main>
    </div>
  );
}
