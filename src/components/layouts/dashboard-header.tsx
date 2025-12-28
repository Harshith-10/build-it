import { Zap } from "lucide-react";
import Link from "next/link";
import { UserDropdown } from "./user-dropdown";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        <Link href="/exams" className="mr-6 flex items-center space-x-2">
          <div className="bg-primary/10 p-1 rounded-md">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <span className="hidden font-bold sm:inline-block">
            BuildIt Platform
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
