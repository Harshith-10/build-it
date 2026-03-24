"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { generateProblemFromIdea } from "@/actions/admin/problem-generation";
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
import { Textarea } from "@/components/ui/textarea";
import { useProblemStore } from "./use-problem-store";

export function GenerateProblemDialog() {
  const router = useRouter();
  const setGeneratedDraft = useProblemStore((state) => state.setGeneratedDraft);

  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    const trimmedIdea = idea.trim();
    if (!trimmedIdea) {
      toast.error("Please enter a problem idea before generating.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateProblemFromIdea(trimmedIdea);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setGeneratedDraft(result.problem);
      setOpen(false);
      setIdea("");
      toast.success("Problem generated. Review and save it on the next page.");
      router.push("/admin/problems/new?generated=1");
    } catch {
      toast.error("Failed to generate problem. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" /> Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Generate Problem With AI</DialogTitle>
          <DialogDescription>
            Describe the idea, constraints, and edge cases. We will generate a
            complete draft with statement, driver code, and test cases.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            className="min-h-72 resize-y"
            placeholder="Example: Create a medium difficulty array problem where students find the first equilibrium index. Include negative numbers and duplicate values in test cases."
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
