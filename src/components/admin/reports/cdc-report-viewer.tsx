"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search, AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type StudentRow = {
  userId: string;
  roll: string;
  name: string;
  branch: string;
  section: string;
  totalScore: number;
  scores: Record<string, number>;
};

type CDCExam = {
  id: string;
  title: string;
  totalMarks: number | null;
};

interface CDCReportViewerProps {
  semester: string;
  exams: CDCExam[];
  studentRows: StudentRow[];
}

type BatchMapping = Record<string, string[]>;
const YEAR_BATCH_MAPPINGS: Record<string, BatchMapping> = {
  "Year II": {
    "SU1 (SkillUp 1)": ["CSE"],
    "SU2 (SkillUp 2)": ["CSE", "CSE (AI&ML)", "CSE (DS)", "ECE"],
    "SU3 (SkillUp 3)": ["AERO", "CSE", "CSE (AI&ML)", "IT", "MECH"],
  },
  "Year III": {
    "SU1 (SkillUp 1)": ["CSE", "CSE (AI&ML)", "CSE (DS)", "ECE", "IT"],
    "SN1": ["CSE", "CSE (AI&ML)", "CSE (DS)", "ECE"],
    "SN2": ["CSE (DS)", "ECE", "IT"],
    "SB1": ["CSE"],
    "SB2": ["CSE"],
    "SB3": ["CSE", "EEE"],
    "SB4": ["CSE (AI&ML)"],
    "SB5": ["CSE (AI&ML)", "CSE (DS)"],
    "SB6": ["CSE (AI&ML)", "CSE (DS)", "ECE", "IT"],
  }
};

export function CDCReportViewer({
  semester,
  exams,
  studentRows,
}: CDCReportViewerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);

  const validSemester = YEAR_BATCH_MAPPINGS[semester] ? semester : "Year III";
  
  const [localYear, setLocalYear] = useState<string>(validSemester);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (YEAR_BATCH_MAPPINGS[semester] && localYear !== semester) {
      setLocalYear(semester);
      setSelectedBatch("");
      setSelectedBranch("");
    }
  }, [semester]);

  const currentMapping = YEAR_BATCH_MAPPINGS[localYear] || {};
  const availableBatches = Object.keys(currentMapping);
  
  const availableBranches = useMemo(() => {
    if (selectedBatch === "all") {
      const allB = new Set<string>();
      Object.values(currentMapping).forEach(branches => branches.forEach(b => allB.add(b)));
      return Array.from(allB).sort();
    }
    return currentMapping[selectedBatch] || [];
  }, [selectedBatch, currentMapping]);

  return (
    <div className="flex flex-col gap-4">
      {/* ?? Main Filter Bar ?? */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border print:hidden">
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select 
            value={localYear} 
            onValueChange={(val) => {
              setSelectedBatch("");
              setSelectedBranch("");
              setLocalYear(val);
              router.push("/admin/reports/assessments/cdc?sem=" + encodeURIComponent(val));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
            <SelectContent>
              {Object.keys(YEAR_BATCH_MAPPINGS).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">Batch</label>
          <Select value={selectedBatch} onValueChange={(val) => {
            setSelectedBatch(val);
            setSelectedBranch(""); 
          }}>
            <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
            <SelectContent>
              {availableBatches.length > 0 ? availableBatches.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              )) : <SelectItem value="none" disabled>No batches for this year</SelectItem>}
              {availableBatches.length > 0 && <SelectItem value="all">All Batches</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Branch
          </label>
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            disabled={!selectedBatch}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {availableBranches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
              {availableBranches.length > 0 && <SelectItem value="all">All Branches</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-medium text-muted-foreground">
            Search Exam
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Exam name..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ?? Exams List Area ?? */}
      <div className="mt-4">
        {(!selectedBatch || selectedBatch === "" || selectedBatch === "none") ? (
          <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
            <h3 className="text-lg font-medium">Select a Batch</h3>
            <p className="text-sm text-muted-foreground mt-1">Please select a batch to view the exams conducted.</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="py-20 text-center border rounded-lg bg-muted/10 flex flex-col items-center">
            <h3 className="text-lg font-medium">No Exams Found</h3>
            <p className="text-sm text-muted-foreground mt-1">No exams have been conducted for this batch yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <div key={exam.id} onClick={() => router.push(`/admin/reports/assessments/cdc/${exam.id}`)} className="p-5 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors shadow-sm flex flex-col gap-2 group">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-base group-hover:text-primary transition-colors">{exam.title}</h4>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">Batch: {selectedBatch === 'all' ? 'Multiple' : selectedBatch}</span>
                  {selectedBranch && selectedBranch !== 'all' && <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">Branch: {selectedBranch}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

