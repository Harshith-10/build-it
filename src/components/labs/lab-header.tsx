"use client";

import { ArrowLeft, CheckCircle2, Circle, Loader2 } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/animate-ui/components/radix/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface LabHeaderProps {
  user: { name: string; image?: string };
  exerciseTitle: string;
  labId: string;
  exerciseId: string;
  onSubmit: () => void;
}

export function LabHeader({
  user,
  exerciseTitle,
  labId,
  exerciseId,
  onSubmit,
}: LabHeaderProps) {
  return (
    <header className="relative flex w-full items-center justify-between border-b bg-background px-4 py-2 shrink-0 transition-all duration-200 ease-in-out">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="transition-all duration-200 ease-in-out">
          <SidebarTrigger />
        </div>
        <div className="h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2"
        >
          <Link
            href={`/labs/${labId}`}
            onClick={async () => {
              if (typeof document !== "undefined" && document.fullscreenElement) {
                await document.exitFullscreen().catch(() => {});
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Back</span>
          </Link>
        </Button>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <h1 className="text-sm font-semibold hidden sm:block truncate max-w-xs">
          {exerciseTitle}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* ✅ Submit Exercise Button */}
        <Button
          size="sm"
          onClick={onSubmit}
          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Submit Exercise
        </Button>

        <div className="h-5 w-px bg-border" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground">Student</p>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}