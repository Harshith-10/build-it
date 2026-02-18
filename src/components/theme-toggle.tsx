"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const iconSizeMap = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  default: "h-[1.2rem] w-[1.2rem]",
  lg: "h-5 w-5",
  "icon-sm": "h-3.5 w-3.5",
  icon: "h-[1.2rem] w-[1.2rem]",
  "icon-lg": "h-5 w-5",
} as const;

type ThemeToggleSize = keyof typeof iconSizeMap;

interface ThemeToggleProps {
  size?: ThemeToggleSize;
  variant?: "ghost" | "outline" | "default" | "secondary";
  className?: string;
}

export function ThemeToggle({
  size = "icon",
  variant = "ghost",
  className,
}: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconClass = iconSizeMap[size];

  if (!mounted) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn("opacity-50 cursor-not-allowed", className)}
      >
        <Sun className={iconClass} />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn(
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        className,
      )}
    >
      <Sun
        className={cn(
          iconClass,
          "rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0",
        )}
      />
      <Moon
        className={cn(
          "absolute",
          iconClass,
          "rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100",
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function SidebarThemeToggle() {
  const { setTheme, theme } = useTheme();
  const { state } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isCollapsed = state === "collapsed";
  const isDark = theme === "dark";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={
          mounted
            ? isDark
              ? "Switch to Light"
              : "Switch to Dark"
            : "Toggle theme"
        }
        onClick={() => {
          if (mounted) setTheme(isDark ? "light" : "dark");
        }}
        className={cn(!mounted && "opacity-50 cursor-not-allowed")}
      >
        {mounted ? (
          <>
            <Sun
              className={cn(
                "h-4 w-4 shrink-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0",
              )}
            />
            <Moon
              className={cn(
                "absolute h-4 w-4 shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100",
                isCollapsed && "relative",
              )}
            />
          </>
        ) : (
          <Sun className="h-4 w-4 shrink-0" />
        )}
        <span>
          {mounted ? (isDark ? "Light Mode" : "Dark Mode") : "Toggle theme"}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
