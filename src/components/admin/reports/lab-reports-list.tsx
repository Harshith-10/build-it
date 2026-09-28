"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Code2, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface LabReportsListProps {
  labs: any[];
}

export function LabReportsList({ labs }: LabReportsListProps) {
  // Only provide Semesters 1, 2, 3 as options per request
  const semesters = ["1", "2", "3"];

  // Default to Semester 1
  const [selectedSem, setSelectedSem] = useState<string>("1");

  // Filter labs based on selected semester
  const filteredLabs = useMemo(() => {
    if (!selectedSem || selectedSem === "all") return labs;
    return labs.filter(lab => String(lab.semester) === selectedSem);
  }, [labs, selectedSem]);

  const renderLabCard = (lab: any) => (
    <Link key={lab.id} href={`/admin/reports/labs/${lab.id}`}>
      <Card className="hover:shadow-md hover:border-cyan-400/50 transition-all cursor-pointer group border h-full flex flex-col bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-lg bg-cyan-500/10 p-2 group-hover:bg-cyan-500/20 transition-colors">
              <Code2 className="h-5 w-5 text-cyan-600" />
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              Sem {lab.semester}
            </Badge>
          </div>
          <CardTitle className="text-base mt-2 line-clamp-2">{lab.name}</CardTitle>
          {lab.code && (
            <p className="text-xs text-muted-foreground">{lab.code}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0 mt-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4">
            <span>{lab.exercises?.length || 0} week{(lab.exercises?.length || 0) !== 1 ? "s" : ""}</span>
            <span className="text-cyan-600 font-medium group-hover:underline">View Report →</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-muted/30 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-cyan-600" />
          <h2 className="text-lg font-semibold">Lab Subjects</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Semester:</span>
          <Select value={selectedSem} onValueChange={setSelectedSem}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Select Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesters.map(sem => (
                <SelectItem key={sem} value={sem}>
                  Semester {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredLabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
          <FlaskConical className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No lab subjects found for the selected semester.</p>
        </div>
      ) : selectedSem === "all" ? (
        <div className="space-y-8">
          {semesters.map(sem => {
            const semsLabs = filteredLabs.filter(lab => String(lab.semester) === sem);
            if (semsLabs.length === 0) return null;
            return (
              <div key={sem} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold tracking-tight">Semester {sem}</h3>
                  <Separator className="flex-1" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {semsLabs.map(renderLabCard)}
                </div>
              </div>
            );
          })}
          {/* Also render labs that don't match 1,2,3 just in case they exist */}
          {filteredLabs.filter(lab => !semesters.includes(String(lab.semester))).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold tracking-tight">Other Semesters</h3>
                <Separator className="flex-1" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredLabs.filter(lab => !semesters.includes(String(lab.semester))).map(renderLabCard)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLabs.map(renderLabCard)}
        </div>
      )}
    </div>
  );
}
