"use client";

import { useEffect, useState } from "react";
import { getStudentBranchStatus, updateStudentBranch } from "@/actions/student/branch";
import { STANDARD_BRANCHES, StandardBranch } from "@/lib/branch-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function BranchConfirmDialog() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [rawBranch, setRawBranch] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await getStudentBranchStatus();
        if (!isMounted) return;

        if (res.success && res.data) {
          setUserId(res.data.userId);
          setRawBranch(res.data.rawBranch);
          // Keep unselected by default so placeholder "Select your branch" displays
          setSelectedBranch("");

          // Open dialog on login if not yet confirmed in this session
          const sessionConfirmed = sessionStorage.getItem(`branch_session_confirmed_${res.data.userId}`);
          if (!sessionConfirmed) {
            setOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch branch status:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirm = async () => {
    if (!selectedBranch) return;
    setIsSubmitting(true);
    try {
      const res = await updateStudentBranch(selectedBranch);
      if (res.success) {
        if (userId) {
          sessionStorage.setItem(`branch_session_confirmed_${userId}`, "true");
          localStorage.setItem(`branch_confirmed_${userId}`, "true");
        }
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save branch:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
            <GraduationCap className="h-4 w-4" />
            <span>Department Setup</span>
          </div>
          <DialogTitle className="text-xl">Select Your Department / Branch</DialogTitle>
          <DialogDescription>
            Please select your official academic branch from the list below to access your assigned labs and exercises.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Academic Department / Branch
            </label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your branch" />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button onClick={handleConfirm} disabled={isSubmitting || !selectedBranch} className="w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
