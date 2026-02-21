"use client";

import {
  Cog,
  FileQuestion,
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
    title: "Exams",
    url: "/admin/exams",
    icon: GraduationCap,
  },
];

const studentNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Problems",
    url: "/problems",
    icon: FileQuestion,
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
];

const navAccount = [
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
  isAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & { isAdmin: boolean }) {
  const pathname = usePathname();

  const navMain = isAdmin ? adminNavMain : studentNavMain;

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
            <span className="truncate text-xs">
              {isAdmin ? "Admin Portal" : "Student Portal"}
            </span>
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
                    isActive={
                      item.url === "/admin" || item.url === "/dashboard"
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
        <div className="mx-2 h-px bg-sidebar-border" />
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
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
