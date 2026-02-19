"use client";

import { usePathname } from "next/navigation";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  problems: "Problems",
  playground: "Playground",
  exams: "Exams",
  settings: "Settings",
  u: "User",
  me: "Profile",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    // Use a generic label for long segments (likely IDs), otherwise look up in map or capitalize
    const label =
      labelMap[seg] ||
      (seg.length > 8 ? "Details" : seg.charAt(0).toUpperCase() + seg.slice(1));
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <header className="sticky top-0 z-50 flex shrink-0 items-center border-b bg-background">
      <SidebarTrigger className="m-2 mr-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
