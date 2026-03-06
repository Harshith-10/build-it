"use client";

import { useEffect } from "react";
import { useJetStore } from "@/components/store/use-jet-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export default function JetIndicator() {
  const { status, initialize } = useJetStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="p-2 text-sm flex items-center gap-2 cursor-default">
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
            Jet
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        <div className="">
          <p className="text-sm">
            Jet Server is{" "}
            <span
              className={`capitalize ${status === "online" ? "text-green-500" : status === "offline" ? "text-red-500" : "text-yellow-500"}`}
            >
              {status}
            </span>
          </p>
          {status === "offline" && (
            <p className="text-xs text-muted-foreground">
              You cannot execute programs while the server is down
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
