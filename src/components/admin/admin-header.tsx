"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import React from "react";

const labelMap: Record<string, string> = {
  admin: "Admin",
  problems: "Problems",
  exams: "Exams",
  groups: "Groups",
  collections: "Collections",
  users: "Users",
  new: "Create",
};

export function AdminHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // segments: ["admin"] or ["admin", "problems"] or ["admin", "problems", "new"] etc.

  const crumbs = segments.map((seg, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    const label = labelMap[seg] || (seg.length > 8 ? "Edit" : seg);
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <header className="sticky top-0 z-50 flex shrink-0 items-center border-b bg-background">
      <SidebarTrigger className="m-2" />
      <Separator orientation="vertical" className="mr-4 h-full" />
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
