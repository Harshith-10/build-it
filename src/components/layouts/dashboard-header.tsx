"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { SidebarTrigger } from "@/components/animate-ui/components/radix/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import JetIndicator from "../jet-indicator";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  problems: "Problems",
  playground: "Playground",
  exams: "Exams",
  settings: "Settings",
  u: "User",
  me: "Profile",
  labs: "Labs",
  code365: "Code365",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    let label = labelMap[seg];
    if (!label) {
      if (seg.match(/^[0-9a-f-]{36}$/)) {
        label = idx === 1 ? "Exercises" : "Workspace";
      } else {
        label = seg.charAt(0).toUpperCase() + seg.slice(1);
      }
    }
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <header className="sticky top-0 py-1 pr-4 z-50 flex shrink-0 items-center border-b bg-background">
      <SidebarTrigger className="m-2 mr-4" />
      <Breadcrumb className="flex-1">
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
      <JetIndicator />
    </header>
  );
}
