"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReturnToDashboardButton() {
  const router = useRouter();

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
