"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, CheckCircle2, Eye, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { importVivaQuestionsAction, getCollectionVivaQuestionsAction } from "@/actions/admin/labs/viva";

interface ImportVivaDialogProps {
  collectionId?: string;
  initialCount?: number;
  onQuestionsImported?: (count: number) => void;
}

export function ImportVivaDialog({
  collectionId,
  initialCount = 0,
  onQuestionsImported,
}: ImportVivaDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [vivaCount, setVivaCount] = useState(initialCount);

  // Fetch existing imported questions from database on mount & dialog open
  useEffect(() => {
    if (!collectionId) return;
    setIsLoading(true);
    getCollectionVivaQuestionsAction(collectionId)
      .then((res) => {
        if (res.success && res.questions) {
          setVivaCount(res.questions.length);
          if (res.questions.length > 0) {
            setParsedQuestions(res.questions.map((q) => q.questionText));
            setFileName(`Saved PDF (${res.questions.length} Questions)`);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, [collectionId, open]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // Parse lines cleanly from uploaded file
        const lines = content
          .split("\n")
          .map((l) => l.trim().replace(/^(\d+[\.\)]|\-|\*)\s*/, "")) // Clean numbering
          .filter((l) => l.length > 0);

        setParsedQuestions(lines);
        toast.success(`Successfully parsed ${lines.length} Viva questions from "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!collectionId) {
      toast.error("Please save the collection first before importing Viva questions.");
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error("Please select a Viva PDF or text file first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await importVivaQuestionsAction(collectionId, parsedQuestions);
      if (res.success) {
        toast.success(`Successfully saved ${res.count} Viva questions to collection!`);
        setVivaCount(res.count);
        onQuestionsImported?.(res.count);
        setOpen(false);
      } else {
        toast.error(res.error || "Failed to import Viva questions");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-semibold"
        >
          <FileText className="h-4 w-4 text-purple-600" />
          {vivaCount > 0 ? `📄 Viva PDF Uploaded (${vivaCount})` : "Import Viva PDF"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-purple-600" />
            Upload Viva Voce PDF
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select the week's Viva PDF / document. The system will automatically parse out the 50 questions for random student assignments.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body Area */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4">
          {/* File Upload Dropzone */}
          <div className="border-2 border-dashed border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-6 text-center hover:border-purple-500/60 transition-all cursor-pointer">
            <input
              type="file"
              accept=".pdf,.txt,.json,.csv"
              className="hidden"
              id="viva-file-upload-input"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="viva-file-upload-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-full">
                <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  {fileName ? `File Selected: ${fileName}` : "Click to select Viva PDF / Text file"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Supports .pdf, .txt files (50 Viva Questions per week)
                </span>
              </div>
            </label>
          </div>

          {/* Parsed Questions Scroll Container (Clean Preview) */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4" />
                  Parsed Questions Preview
                </span>
                <Badge variant="secondary" className="text-[11px] font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {parsedQuestions.length} Questions Detected
                </Badge>
              </div>

              {/* Scrollable List with max height */}
              <div className="max-h-[220px] overflow-y-auto rounded-md border bg-background p-3 space-y-2 text-xs divide-y divide-muted">
                {parsedQuestions.map((qText, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex items-start gap-2 leading-relaxed">
                    <span className="font-mono font-bold text-purple-600 shrink-0">
                      Q{idx + 1}.
                    </span>
                    <span className="text-foreground">{qText}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — Fixed at Bottom */}
        <DialogFooter className="shrink-0 pt-3 border-t gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitting || parsedQuestions.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Save Viva PDF ({parsedQuestions.length} Questions)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
