import { getExam } from "@/actions/admin/exams";
import { SubmissionsTable } from "@/components/admin/exams/submissions-table";
import { PageHeader } from "@/components/admin/page-header";
import { notFound } from "next/navigation";
import { use } from "react";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function SubmissionsPage({ params }: PageProps) {
    const { id } = use(params);
    const examPromise = getExam(id);
    const exam = use(examPromise);

    if (!exam) {
        notFound();
    }

    return (
        <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
            <PageHeader
                title={`${exam.title} - Submissions`}
                description="View and manage student attempts"
            />
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                <SubmissionsTable examId={id} />
            </div>
        </div>
    );
}
