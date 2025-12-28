"use client";

import { format } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface ExamCardActionProps {
  examId: string;
  status: "upcoming" | "active" | "ended";
  effectiveStart: Date;
}

export function ExamCardAction({
  examId,
  status: initialStatus,
  effectiveStart,
}: ExamCardActionProps) {
  const [status, setStatus] = useState(initialStatus);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // If already active or ended, do nothing
    if (status !== "upcoming") return;

    const targetTime = new Date(effectiveStart).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        // Time to start!
        setStatus("active");
        setTimeLeft(null);
        router.refresh(); // Refresh server data to ensure consistency
        return;
      }

      // Check if within 15 minutes (15 * 60 * 1000 = 900000 ms)
      if (diff <= 900000) {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`,
        );
      } else {
        setTimeLeft(null);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [status, effectiveStart, router]);

  if (status === "active") {
    return (
      <Button className="w-full group" asChild>
        <Link href={`/exams/${examId}/onboarding`}>
          Start Exam
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
    );
  }

  if (status === "ended") {
    return (
      <Button variant="secondary" className="w-full" asChild disabled>
        <span className="text-muted-foreground">Exam Ended</span>
      </Button>
    );
  }

  // UPCOMING
  if (timeLeft) {
    return (
      <Button
        variant="outline"
        className="w-full font-mono font-medium"
        disabled
      >
        Opens in {timeLeft}
      </Button>
    );
  }

  return (
    <Button variant="outline" className="w-full" disabled>
      Opens {format(effectiveStart, "MMM d, HH:mm")}
    </Button>
  );
}
