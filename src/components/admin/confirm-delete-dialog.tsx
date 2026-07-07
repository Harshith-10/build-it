"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteDialogProps {
  entityName: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Shared confirmation dialog for delete actions across all admin entities.
 * Previously duplicated identically in 5 table wrappers.
 */
export function ConfirmDeleteDialog({
  entityName,
  description,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="overflow-hidden border-b border-destructive/30 p-0 shadow-2xl sm:max-w-md">
        <div className="px-6 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/15">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogHeader className="flex-1 gap-1 text-left sm:text-left">
              <AlertDialogTitle className="text-xl">
                Delete {entityName}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6">
                {description}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
        </div>

        <div className="bg-muted/20 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              This action is permanent.
            </p>
            <AlertDialogFooter className="sm:gap-3">
              <AlertDialogCancel className="w-full sm:w-auto">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className="w-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 sm:w-auto"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
