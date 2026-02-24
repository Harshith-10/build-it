"use client";

import { GraduationCap } from "lucide-react";
import { Suspense } from "react";
import { deleteExamSubmission, getExamSubmissions } from "@/actions/admin/exams";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig, FetchParams } from "@/hooks/use-entity-table-vm";
import { createColumns, type Submission } from "./submissions-columns";

interface SubmissionsTableProps {
    examId: string;
}

export function SubmissionsTableContent({ examId }: SubmissionsTableProps) {
    const submissionsConfig: EntityTableConfig<Submission> = {
        entityName: "Submission",
        searchKey: "user.name",
        searchPlaceholder: "Search students...",
        deleteDescription:
            "This will permanently delete this exam submission. This action cannot be undone.",
        fetchFn: async (params: FetchParams) => {
            const result = await getExamSubmissions({
                ...params,
                examId,
                limit: 10, // Force limit to 10 as requested
            });
            return {
                data: result.submissions as unknown as Submission[],
                total: result.total
            };
        },
        deleteFn: deleteExamSubmission,
    };

    return (
        <AdminEntityTable
            config={submissionsConfig}
            createColumns={(onDelete, page, pageSize) =>
                createColumns(onDelete, page, pageSize)
            }
            emptyState={
                <div className="flex flex-col items-center gap-2">
                    <GraduationCap className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No submissions yet</p>
                    <p className="text-sm text-muted-foreground">
                        No students have attempted this exam yet.
                    </p>
                </div>
            }
        />
    );
}

export function SubmissionsTable({ examId }: SubmissionsTableProps) {
    return (
        <Suspense fallback={<div>Loading submissions...</div>}>
            <SubmissionsTableContent examId={examId} />
        </Suspense>
    );
}
