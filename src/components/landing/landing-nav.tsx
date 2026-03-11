"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#platform", label: "Platform" },
  { href: "#process", label: "Process" },
];

export function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 lg:px-8 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/buildit-logo.png" alt="BuildIT" width={28} height={28} />
          <span className="text-lg font-bold tracking-tight">BuildIT</span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle size="icon" variant="ghost" />

          {isAuthenticated ? (
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/redirect">
                Dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/auth/sign-in">
                Get Started <ArrowRight />
              </Link>
            </Button>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-6 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border flex gap-2">
              {isAuthenticated ? (
                <Button size="sm" asChild className="w-full">
                  <Link href="/redirect">
                    Dashboard <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" asChild className="flex-1">
                  <Link href="/auth/sign-in">Get Started</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
