"use client";

import { useEffect, useState } from "react";
import { deleteExamSubmission, getExamSubmissions } from "@/actions/admin/exams";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmissionsResponse = Awaited<ReturnType<typeof getExamSubmissions>>["submissions"][number];

interface ViewSubmissionsDialogProps {
    examId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewSubmissionsDialog({
    examId,
    open,
    onOpenChange,
}: ViewSubmissionsDialogProps) {
    const [submissions, setSubmissions] = useState<SubmissionsResponse[]>([]);
    const [loading, setLoading] = useState(false);

    const handleDelete = async (id: string) => {
        try {
            const res = await deleteExamSubmission(id);
            if (res.success) {
                toast.success("Submission deleted successfully");
                setSubmissions(current => current.filter(cur => cur.id !== id));
            } else {
                toast.error(res.error || "Failed to delete submission");
            }
        } catch (error) {
            toast.error("Failed to delete submission");
        }
    };

    useEffect(() => {
        if (open && examId) {
            setLoading(true);
            getExamSubmissions({examId})
                .then(({submissions})=>setSubmissions(submissions))
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            setSubmissions([]);
        }
    }, [examId, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="min-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Exam Submissions</DialogTitle>
                    <DialogDescription>
                        View all students who have attempted this exam and their statuses.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto mt-4">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No submissions found for this exam.
                        </div>
                    ) : (
                        <Table className="border-separate">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Score</TableHead>
                                    <TableHead className="text-right">Malpractice</TableHead>
                                    <TableHead>Delete</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {submissions.map((sub) => (
                                    <TableRow key={sub.id}>
                                        <TableCell className="font-medium">
                                            {sub.user?.name || "Unknown"}
                                        </TableCell>
                                        <TableCell>{sub.user?.username || "-"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                className="capitalize"
                                                variant={
                                                    sub.status === "completed"
                                                        ? "default"
                                                        : sub.status === "in_progress"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                            >
                                                {sub.status.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {sub.score ?? 0}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {sub.malpracticeCount}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleDelete(sub.id)}
                                                className="text-destructive hover:text-white bg-destructive/10 hover:bg-destructive/50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
