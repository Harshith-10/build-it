"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Skip dynamic segments like UUIDs
    if (segment.match(/^[0-9a-f]{8}-/i)) continue;

    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const label = segment.charAt(0).toUpperCase() + segment.slice(1);

    crumbs.push({
      label,
      href: i < segments.length - 1 ? href : undefined,
    });
  }

  return crumbs;
}

export function PageHeader({
  title,
  description,
  backHref,
  actions,
}: PageHeaderProps) {
  const pathname = usePathname();
  const _breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <div className="space-y-1">
      {/* Breadcrumbs */}
      {/* {breadcrumbs.length > 1 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {index > 0 && <span className="text-muted-foreground/50">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )} */}

      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <Separator />
    </div>
  );
}
