"use client";
import { Badge } from "@/components/ui/badge";

import { CheckCircle2, Circle, Code2 } from "lucide-react";
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
import type { Question } from "./ide-shell";

interface ExamSidebarProps {
  examTitle: string;
  questions: Question[];
  activeId: string | null;
  onSelect: (id: string) => void;
  completedQuestionIds: string[];
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "medium":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "hard":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export function ExamSidebar({
  examTitle,
  questions,
  activeId,
  onSelect,
  completedQuestionIds,
}: ExamSidebarProps) {
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
                <Code2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{examTitle}</span>
                <span className="truncate text-xs">Powered by BuildIT</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Questions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {questions.map((q, idx) => {
                const isActive = activeId === q.id;
                const isCompleted = completedQuestionIds.includes(q.id);

                return (
                  <SidebarMenuItem key={q.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(q.id)}
                      tooltip={q.title}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <Circle className="text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">
                        {idx + 1}. {q.title}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`capitalize text-[10px] leading-none py-0.5 px-1.5 ml-2 mt-0.5 ${getDifficultyColor(q.difficulty)}`}
                      >
                        {q.difficulty}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
