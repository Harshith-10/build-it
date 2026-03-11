import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/20 dark:bg-muted/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/buildit-logo.png"
                alt="BuildIT"
                width={22}
                height={22}
              />
              <span className="text-sm font-semibold tracking-tight">
                BuildIT
              </span>
            </Link>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <span className="hidden sm:block text-xs text-muted-foreground">
              Precision-engineered assessment platform
            </span>
          </div>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground font-mono tracking-wide">
            &copy; {new Date().getFullYear()} BuildIT. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
