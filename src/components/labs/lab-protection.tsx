"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Maximize2, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function LabProtection() {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Track internal clipboard content for smart copy-paste
  const internalClipboard = useRef<string>("");

  const checkFullscreen = useCallback(() => {
    const active = typeof document !== "undefined" && !!document.fullscreenElement;
    setIsFullscreen(active);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    // Check initial status on mount
    checkFullscreen();

    const handleFullscreenChange = () => {
      checkFullscreen();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsFullscreen(false);
      }
    };

    // Smart Copy / Cut tracking
    const handleCopy = () => {
      const selection = window.getSelection();
      if (selection) {
        internalClipboard.current = selection.toString();
      }
    };

    const handleCut = () => {
      const selection = window.getSelection();
      if (selection) {
        internalClipboard.current = selection.toString();
      }
    };

    // Block pasting from external sources
    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text") || "";
      if (
        pastedText &&
        pastedText.trim() !== internalClipboard.current.trim()
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        toast.error("External Paste Blocked", {
          description: "Pasting code from outside the lab workspace is disabled.",
        });
      }
    };

    // Prevent context menu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Prevent Drag & Drop insertion of text / code files
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "none";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toast.error("Drag and Drop Blocked", {
        description: "Dragging external text or files into the workspace is disabled.",
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("drop", handleDrop, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, [checkFullscreen]);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
      toast.error("Could not enter full-screen mode. Please click and try again.");
    }
  };

  if (!isMounted) return null;

  return (
    <AlertDialog open={!isFullscreen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5 text-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Maximize2 className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              Full-Screen Mode Required
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm leading-relaxed text-muted-foreground">
              <div>
                Lab exercises must be conducted in full-screen mode. Please remain in full-screen and keep the window focused while working on your programs.
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/60 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  Exiting full-screen or switching windows will pause your workspace until you return. External copy-paste and drag-and-drop are disabled.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogAction
            onClick={requestFullscreen}
            className="w-full gap-2 bg-primary font-medium hover:bg-primary/90"
          >
            <Maximize2 className="h-4 w-4" />
            Enter Full-Screen to Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
