"use client";

import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addExamModerators, removeExamModerator } from "@/actions/admin/exams";
import {
  type FacultyCandidate,
  ModeratorSelectionDialog,
} from "@/components/admin/exams/moderator-selection-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ExamModeratorSummary = {
  id: string;
  name: string;
  email: string;
  username: string | null;
};

interface ModeratorsPanelProps {
  examId?: string;
  ownerId: string | null | undefined;
  moderators: ExamModeratorSummary[];
  onModeratorsChange: (moderators: ExamModeratorSummary[]) => void;
}

export function ModeratorsPanel({
  examId,
  ownerId,
  moderators,
  onModeratorsChange,
}: ModeratorsPanelProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const moderatorIds = moderators.map((entry) => entry.id);

  const persistModerators = async (nextModerators: ExamModeratorSummary[]) => {
    onModeratorsChange(nextModerators);
  };

  const handleAdd = (users: FacultyCandidate[]) => {
    if (users.length === 0) return;

    const nextModerators = [
      ...moderators,
      ...users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
      })),
    ].filter(
      (entry, index, array) =>
        array.findIndex((candidate) => candidate.id === entry.id) === index,
    );

    if (!examId) {
      persistModerators(nextModerators);
      toast.success("Moderators staged for save");
      return;
    }

    startTransition(async () => {
      const result = await addExamModerators({
        examId,
        userIds: users.map((entry) => entry.id),
      });

      if (!result.success) {
        toast.error(result.error || "Failed to add moderators");
        return;
      }

      await persistModerators(result.moderators || []);
      toast.success("Moderators updated");
    });
  };

  const handleRemove = (userId: string) => {
    const nextModerators = moderators.filter((entry) => entry.id !== userId);

    if (!examId) {
      persistModerators(nextModerators);
      toast.success("Moderator removed from draft");
      return;
    }

    startTransition(async () => {
      const result = await removeExamModerator({ examId, userId });
      if (!result.success) {
        toast.error(result.error || "Failed to remove moderator");
        return;
      }

      await persistModerators(result.moderators || []);
      toast.success("Moderator removed");
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Moderators</CardTitle>
          <CardDescription>
            Moderators can view exam details and download submissions, but
            cannot edit exam settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!examId && (
            <div className="text-sm text-muted-foreground">
              These moderators are part of the draft and will be saved with the
              exam.
            </div>
          )}

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Moderators
            </Button>
          </div>

          {moderators.length === 0 ? (
            <div className="border border-dashed rounded-md p-6 text-sm text-center text-muted-foreground">
              No moderators added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {moderators.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-md px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{entry.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Moderator
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.email}
                    </span>
                    {entry.username && (
                      <span className="text-xs text-muted-foreground truncate">
                        @{entry.username}
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => handleRemove(entry.id)}
                    disabled={isPending}
                    aria-label={`Remove ${entry.name} from moderators`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ModeratorSelectionDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={handleAdd}
        existingModeratorIds={moderatorIds}
        ownerId={ownerId}
      />
    </>
  );
}
