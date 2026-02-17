import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "../theme-toggle";
import { UserDropdown } from "./user-dropdown";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 mx-auto max-w-screen-2xl items-center justify-between px-4">
        <Link href="/exams" className="mr-6 flex items-center space-x-2">
          <div className="bg-primary/10 p-1 rounded-md">
            <Image src="/buildit-logo.png" alt="Logo" width={25} height={25} />
          </div>
          <span className="hidden font-bold sm:inline-block text-xl">
            BuildIT
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <ThemeToggle />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
