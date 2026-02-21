"use client";

import { useEffect } from "react";
import { useTurboStore } from "@/components/store/use-turbo-store";

export default function TurboIndicator() {
  const { status, initialize } = useTurboStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div
      className="p-2 text-sm flex items-center gap-2 cursor-default"
      title={`Turbo Server is ${status}`}
    >
      {status === "checking" && (
        <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
      )}
      {status === "offline" && (
        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
      )}
      {status === "online" && (
        <div className="h-2 w-2 bg-green-500 rounded-full" />
      )}
      <span className="text-muted-foreground text-xs hidden sm:inline-block">
        Turbo
      </span>
    </div>
  );
}
