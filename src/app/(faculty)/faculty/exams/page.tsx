"use client";

import { useEffect, useState } from "react";
import { ExamsTableForPath } from "@/components/admin/exams/exams-table";
import { PageHeader } from "@/components/admin/page-header";

export default function FacultyExamsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
        <PageHeader
          title="Exams"
          description="View and manage your private exams"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Examinations"
        description="View and manage your private exams"
      />
      <ExamsTableForPath basePath="/faculty" />
    </div>
  );
}
