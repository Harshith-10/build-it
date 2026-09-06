"use client";

import {
  Activity,
  BarChart2,
  Code,
  Cog,
  FileQuestion,
  FlaskConical,
  GraduationCap,
  Group,
  LayoutDashboard,
  Library,
  Terminal,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/animate-ui/components/radix/sidebar";
import { UserMenu } from "@/components/user-menu";

const adminNavMain = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Groups",
    url: "/admin/groups",
    icon: Group,
  },
  {
    title: "Problems",
    url: "/admin/problems",
    icon: FileQuestion,
  },
  {
    title: "Collections",
    url: "/admin/collections",
    icon: Library,
  },
  {
    title: "Examinations",
    url: "/admin/exams",
    icon: GraduationCap,
  },
  {
    title: "Laboratory",
    url: "/admin/labs",
    icon: FlaskConical,
  },
  {
    title: "Jet Stats",
    url: "/admin/jet-stats",
    icon: Activity,
  },
];

const studentNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  // {
  //   title: "Problems",
  //   url: "/problems",
  //   icon: FileQuestion,
  // },
  {
    title: "Playground",
    url: "/playground",
    icon: Terminal,
  },
  {
    title: "Examinations",
    url: "/exams",
    icon: GraduationCap,
  },
  {
    title: "Laboratory",
    url: "/labs",
    icon: FlaskConical,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart2,
  },
];

const facultyNavMain = [
  {
    title: "Dashboard",
    url: "/faculty",
    icon: LayoutDashboard,
  },
  {
    title: "Problems",
    url: "/faculty/problems",
    icon: FileQuestion,
  },
  {
    title: "Collections",
    url: "/faculty/collections",
    icon: Library,
  },
  {
    title: "Examinations",
    url: "/faculty/exams",
    icon: GraduationCap,
  },
  {
    title: "Labs",
    url: "/faculty/labs",
    icon: FlaskConical,
  },
];

const _navAccount = [
  {
    title: "Profile",
    url: "/u/me",
    icon: User,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Cog,
  },
];

export function AppSidebar({
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: "admin" | "faculty" | "student";
}) {
  const pathname = usePathname();
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [showWindowsInstaller, setShowWindowsInstaller] = useState(false);
  const [downloadTutorialOpen, setDownloadTutorialOpen] = useState(false);

  useEffect(() => {
    const isWindows =
      /windows/i.test(navigator.platform) || /windows/i.test(navigator.userAgent);

    setShowWindowsInstaller(isWindows);
  }, []);

  const handleInstallerDownload = () => {
    downloadLinkRef.current?.click();
    setDownloadTutorialOpen(true);
  };

  const navMain =
    role === "admin"
      ? adminNavMain
      : role === "faculty"
        ? facultyNavMain
        : studentNavMain;

  const roleLabel =
    role === "admin"
      ? "Admin Portal"
      : role === "faculty"
        ? "Faculty Portal"
        : "Student Portal";

  return (
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0 transition-all">
          <div className="flex aspect-square size-8 items-center justify-center rounded-full">
            <Image
              src={"/buildit-logo.png"}
              alt="Logo"
              width={25}
              height={25}
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">BuildIT</span>
            <span className="truncate text-xs">{roleLabel}</span>
          </div>
        </div>
      </SidebarHeader>
      <div className="-mt-[5.4px] mb-2 border-b border-sidebar-border" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    value={item.url}
                    isActive={
                      item.url === "/admin" || item.url === "/dashboard"
                        ? pathname === item.url
                        : item.url === "/faculty"
                          ? pathname === item.url
                          : pathname.startsWith(item.url)
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* <div className="mx-2 h-px bg-sidebar-border" />
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAccount.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup> */}
      </SidebarContent>
      <SidebarFooter>
        {showWindowsInstaller && (
          <>
            <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 p-3 shadow-sm group-data-[collapsible=icon]:hidden">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-sidebar-foreground shadow-sm">
                  <Code className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-sidebar-foreground">
                      Cryo OS Installer for Windows
                    </p>
                    <p className="text-xs text-sidebar-foreground/70">
                      Download the Windows installer and keep the file using the
                      Edge download prompt.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                    onClick={handleInstallerDownload}
                  >
                    Download installer
                  </Button>
                </div>
              </div>
              <a
                ref={downloadLinkRef}
                href="/cryo-win.exe"
                download="Cryo OS Installer for Windows.exe"
                tabIndex={-1}
                className="hidden"
              >
                Download Cryo OS Installer for Windows
              </a>
            </div>
            <Dialog
              open={downloadTutorialOpen}
              onOpenChange={setDownloadTutorialOpen}
            >
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Keep the downloaded installer in Edge</DialogTitle>
                  <DialogDescription>
                    If Microsoft Edge asks what to do with the file, choose Keep so
                    the Cryo OS installer stays on your computer.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  <Image
                    src="/download-tut-edge.png"
                    alt="Tutorial showing how to keep the downloaded file in Microsoft Edge"
                    width={1600}
                    height={900}
                    className="h-auto w-full object-contain"
                    priority
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => setDownloadTutorialOpen(false)}
                  >
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
