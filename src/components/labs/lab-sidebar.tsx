"use client";

import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/animate-ui/components/radix/sidebar";
import type { LabProgram } from "./lab-ide-shell";

interface LabSidebarProps {
  exerciseTitle: string;
  exerciseNo: number;
  programs: LabProgram[];
  activeId: string | null;
  onSelect: (id: string) => void;
  solvedIds: string[];
  vivaQuestionsCount?: number;
  activeVivaIndex?: number | null;
  onSelectViva?: (index: number) => void;
  vivaAnsweredCount?: number;
  vivaAnsweredIndices?: number[];
}

export function LabSidebar({
  exerciseTitle,
  exerciseNo,
  programs,
  activeId,
  onSelect,
  solvedIds,
  vivaQuestionsCount = 0,
  activeVivaIndex = null,
  onSelectViva,
  vivaAnsweredCount = 0,
  vivaAnsweredIndices = [],
}: LabSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FlaskConical className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  Exercise {exerciseNo}
                </span>
                <span className="truncate text-xs">{exerciseTitle}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Programs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {programs.map((p) => {
                const isActive = activeId === p.id && activeVivaIndex === null;
                const isSolved = solvedIds.includes(p.id);

                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(p.id)}
                      tooltip={p.title}
                    >
                      {isSolved ? (
                        <CheckCircle2 className="text-green-500 shrink-0" />
                      ) : (
                        <Circle className="text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {p.programNo}. {p.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {vivaQuestionsCount > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Viva Voce</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                {vivaAnsweredCount}/{vivaQuestionsCount}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: vivaQuestionsCount }).map((_, idx) => {
                  const isActive = activeVivaIndex === idx;
                  const isAnswered = vivaAnsweredIndices.includes(idx);

                  return (
                    <SidebarMenuItem key={`viva-${idx}`}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => onSelectViva?.(idx)}
                        tooltip={`Viva Question ${idx + 1}`}
                        className={
                          isActive
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-medium"
                            : ""
                        }
                      >
                        {isAnswered ? (
                          <CheckCircle2 className="text-green-500 shrink-0 size-3.5" />
                        ) : (
                          <Circle className="text-purple-500/70 shrink-0 size-3.5" />
                        )}
                        <span className="flex-1 truncate">
                          Viva Question {idx + 1}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}