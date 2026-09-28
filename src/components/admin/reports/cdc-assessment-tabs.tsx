"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const SEMESTERS = ["Year I", "Year II", "Year III", "Year IV"];

export function CDCAssessmentTabs() {
  const searchParams = useSearchParams();
  const activeSem = searchParams.get("sem") || "Year I";

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto pb-2">
        <div className="inline-flex min-w-max h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {SEMESTERS.map(sem => {
            const isActive = activeSem === sem;
            return (
              <Link 
                key={sem} 
                href={`/admin/reports/assessments/cdc?sem=${encodeURIComponent(sem)}`}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-6 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive 
                    ? "bg-background text-foreground shadow-sm" 
                    : "hover:bg-muted-foreground/10"
                )}
              >
                {sem}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
