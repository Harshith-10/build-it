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
import TurboIndicator from "../turbo-indicator";

const labelMap: Record<string, string> = {
  admin: "Admin",
  problems: "Problems",
  exams: "Exams",
  edit: "Edit",
  submissions: "Submissions",
  groups: "Groups",
  collections: "Collections",
  users: "Users",
  new: "Create",
};

export function AdminHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // segments: ["admin"] or ["admin", "problems"] or ["admin", "problems", "new"] etc.

  const rawCrumbs = segments.map((seg, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    const label = labelMap[seg] || (seg.length > 8 ? "" : seg);
    return { href, label };
  });

  const visibleCrumbs = rawCrumbs.filter((crumb) => crumb.label !== "");
  const crumbs = visibleCrumbs.map((crumb, idx) => ({
    ...crumb,
    isLast: idx === visibleCrumbs.length - 1,
  }));

  return (
    <header className="sticky top-0 z-50 flex shrink-0 items-center pt-2 pr-4 border-b bg-background">
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
      <TurboIndicator />
    </header>
  );
}
