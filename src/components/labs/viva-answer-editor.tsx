"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Edit3, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveVivaAnswerAction, type AssignedVivaQuestion } from "@/actions/student/labs/viva";

interface VivaAnswerEditorProps {
  exerciseId: string;
  question: AssignedVivaQuestion;
  isQuestionSubmitted?: boolean;
  onAnswerSubmitted?: (vivaQuestionId: string, answerText: string) => void;
  onAnswerTextChange?: (vivaQuestionId: string, answerText: string) => void;
}

const MAX_WORD_LIMIT = 150;

export function VivaAnswerEditor({
  exerciseId,
  question,
  isQuestionSubmitted = false,
  onAnswerSubmitted,
  onAnswerTextChange,
}: VivaAnswerEditorProps) {
  const [answerText, setAnswerText] = useState(question.answerText || "");
  const [isSubmitted, setIsSubmitted] = useState(isQuestionSubmitted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when active question changes
  useEffect(() => {
    setAnswerText(question.answerText || "");
    setIsSubmitted(isQuestionSubmitted);
  }, [question.vivaQuestionId, question.answerText, isQuestionSubmitted]);

  // Word count calculation
  const words = answerText.trim() ? answerText.trim().split(/\s+/) : [];
  const wordCount = words.length;
  const isOverLimit = wordCount > MAX_WORD_LIMIT;

  const handleChange = (val: string) => {
    // Check if new value exceeds word limit
    const newWords = val.trim() ? val.trim().split(/\s+/) : [];
    if (newWords.length > MAX_WORD_LIMIT && val.length > answerText.length) {
      toast.error(`Maximum word limit of ${MAX_WORD_LIMIT} words reached!`);
    }

    setAnswerText(val);
    // If student edits text, set isSubmitted to false until they click Submit Answer again
    setIsSubmitted(false);

    onAnswerTextChange?.(question.vivaQuestionId, val);

    // Auto-save draft in background so unsubmitted text is preserved if student forgets to submit
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      if (val.trim()) {
        try {
          await saveVivaAnswerAction({
            exerciseId,
            vivaQuestionId: question.vivaQuestionId,
            answerText: val,
          });
        } catch (err) {
          console.error("Background draft auto-save error:", err);
        }
      }
    }, 1000);
  };

  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      toast.error("Please type your answer before submitting.");
      return;
    }

    if (isOverLimit) {
      toast.error(`Your answer exceeds the ${MAX_WORD_LIMIT} words limit. Please shorten your response.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveVivaAnswerAction({
        exerciseId,
        vivaQuestionId: question.vivaQuestionId,
        answerText,
      });

      if (res.success) {
        setIsSubmitted(true);
        onAnswerSubmitted?.(question.vivaQuestionId, answerText);
        toast.success(`Answer submitted for Viva Question ${question.questionNo}!`);
      } else {
        toast.error(res.error || "Failed to submit answer");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background p-4">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-foreground">
            Answer Editor (Q{question.questionNo})
          </span>
        </div>

        {/* Header Right: Individual Submit Button */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSubmitAnswer}
            disabled={isSubmitting || isOverLimit || !answerText.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-8 text-xs font-semibold"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit Answer
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <Textarea
          value={answerText}
          onChange={(e) => handleChange(e.target.value)}
          onClick={(e) => {
            const target = e.currentTarget;
            if (target.selectionStart === target.selectionEnd) {
              const caretPos = target.selectionStart;
              target.setSelectionRange(caretPos, caretPos);
            }
          }}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape"].includes(e.key)) {
              const target = e.currentTarget;
              if (target.selectionStart === target.selectionEnd) {
                const caretPos = target.selectionStart;
                target.setSelectionRange(caretPos, caretPos);
              }
            }
          }}
          placeholder="Type your concise explanation here (Max 150 words)..."
          className="flex-1 resize-none font-sans text-sm p-4 leading-relaxed focus-visible:ring-purple-500 selection:bg-blue-500/25 selection:text-foreground"
        />

        {/* Footer Word Counter */}
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground shrink-0">
          <span>Max limit: {MAX_WORD_LIMIT} words</span>
          <span className={`font-mono font-medium ${isOverLimit ? "text-rose-500 font-bold" : "text-purple-600 dark:text-purple-400"}`}>
            {wordCount} / {MAX_WORD_LIMIT} words
          </span>
        </div>
      </div>
    </div>
  );
}
