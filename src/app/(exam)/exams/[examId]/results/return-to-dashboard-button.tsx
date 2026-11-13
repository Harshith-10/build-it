"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { stopShieldItLockdown } from "@/lib/shieldit/shieldit-client";

export function ReturnToDashboardButton() {
  const router = useRouter();

  // Ensure extensions are unlocked once on results screen
  useEffect(() => {
    stopShieldItLockdown().catch(() => {});
  }, []);

  const handleReturn = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch((err) => {
        console.error(
          `Error attempting to exit full-screen mode: ${err.message} (${err.name})`,
        );
      });
    }
    router.push("/exams");
  };

  return <Button onClick={handleReturn}>Return to Dashboard</Button>;
}
