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
}

export function LabSidebar({
  exerciseTitle,
  exerciseNo,
  programs,
  activeId,
  onSelect,
  solvedIds,
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
                const isActive = activeId === p.id;
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
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}