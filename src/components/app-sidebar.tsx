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
import React, { useState, useEffect } from "react"; // <-- 1. Added useState and useEffect
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
    title: "Code365",
    url: "/admin/code365",
    icon: Code,
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
    title: "Exams",
    url: "/admin/exams",
    icon: GraduationCap,
  },
  {
    title: "Labs",
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
  {
    title: "Playground",
    url: "/playground",
    icon: Terminal,
  },
  {
    title: "Exams",
    url: "/exams",
    icon: GraduationCap,
  },
  {
    title: "Code365",
    url: "/code365",
    icon: Code
  },
  {
    title: "Labs",
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
    title: "Code365",
    url: "/faculty/code365",
    icon: Code,
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
    title: "Exams",
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

  // 2. Add a mounted state to track when the client has loaded
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
                    // 3. THE FIX: Only attach the tooltip after hydration is complete!
                    tooltip={mounted ? item.title : undefined}
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
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}