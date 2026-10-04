"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExerciseReportData } from "@/actions/student/labs/report";
import { normalizeBranch } from "@/lib/branch-utils";

export type VisibleTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  userOutput?: string;
  passed?: boolean;
};

export type ProgramSolution = {
  id: string;
  programNo: number;
  title: string;
  problemStatement: string;
  code: string;
  language: string;
  testCases?: VisibleTestCase[];
};

interface LabRecordTemplateProps {
  data: ExerciseReportData;
  solutions: ProgramSolution[];
}

export type ProgramExecutionStatus = "Executed" | "Partially Executed" | "Not Executed" | "Not Attempted";

export function getProgramStatus(prog: ProgramSolution): ProgramExecutionStatus {
  if (!prog.code || !prog.code.trim()) {
    return "Not Attempted";
  }

  const isAttempted = prog.language?.includes(":attempted");
  const testCases = prog.testCases ?? [];

  if (testCases.length > 0) {
    const passedCount = testCases.filter((tc) => tc.passed).length;
    if (passedCount === testCases.length && !isAttempted) {
      return "Executed";
    }
    if (passedCount > 0) {
      return "Partially Executed";
    }
    return "Not Executed";
  }

  return isAttempted ? "Not Executed" : "Executed";
}

function formatUserOutput(output?: string): string {
  if (!output || !output.trim()) return "(no output)";
  const trimmed = output.trim();
  if (
    trimmed.includes("Compilation Error") ||
    trimmed.includes("COMPILATION_ERROR") ||
    trimmed.includes("error: class, interface") ||
    (trimmed.includes(".java:") && trimmed.includes("error:")) ||
    trimmed.startsWith("Main.java:")
  ) {
    return "Compilation Error";
  }
  return trimmed;
}

function chunkCode(code: string, firstPageLines = 36, subPageLines = 46): string[] {
  if (!code || !code.trim()) return [""];
  const lines = code.split("\n");
  if (lines.length <= firstPageLines) return [code];

  const chunks: string[] = [];
  chunks.push(lines.slice(0, firstPageLines).join("\n"));

  let offset = firstPageLines;
  while (offset < lines.length) {
    chunks.push(lines.slice(offset, offset + subPageLines).join("\n"));
    offset += subPageLines;
  }
  return chunks;
}

function highlightCode(code: string): React.ReactNode {
  if (!code) return null;
  const lines = code.split("\n");

  const keywords = new Set([
    "public", "private", "protected", "class", "interface", "extends", "implements",
    "static", "final", "void", "int", "double", "float", "long", "short", "byte",
    "char", "boolean", "bool", "string", "String", "if", "else", "for", "while",
    "do", "return", "new", "import", "package", "try", "catch", "finally", "throw",
    "throws", "def", "lambda", "elif", "True", "False", "None", "self", "struct",
    "typedef", "include", "#include", "#define", "#ifndef", "#endif", "using",
    "namespace", "std", "cout", "cin", "endl", "printf", "scanf", "const", "let", "var", "function"
  ]);

  return (
    <>
      {lines.map((line, lineIdx) => {
        const commentIdx =
          line.indexOf("//") !== -1
            ? line.indexOf("//")
            : line.trim().startsWith("#") && !line.trim().startsWith("#include")
            ? line.indexOf("#")
            : -1;

        let codePart = line;
        let commentPart = "";

        if (commentIdx !== -1) {
          codePart = line.slice(0, commentIdx);
          commentPart = line.slice(commentIdx);
        }

        const tokenRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[^\sA-Za-z0-9_]+|\s+)/g;
        const tokens = codePart.match(tokenRegex) || [codePart];

        return (
          <div key={lineIdx} className="leading-snug min-h-[1.1rem]">
            {tokens.map((token, tokIdx) => {
              if (token.startsWith('"') || token.startsWith("'")) {
                return (
                  <span key={tokIdx} className="text-emerald-700 font-medium">
                    {token}
                  </span>
                );
              }
              if (/^\d+(\.\d+)?$/.test(token)) {
                return (
                  <span key={tokIdx} className="text-amber-700 font-semibold">
                    {token}
                  </span>
                );
              }
              if (keywords.has(token)) {
                return (
                  <span key={tokIdx} className="text-blue-700 font-bold">
                    {token}
                  </span>
                );
              }
              if (/^[A-Z][A-Za-z0-9_]*$/.test(token)) {
                return (
                  <span key={tokIdx} className="text-purple-800 font-semibold">
                    {token}
                  </span>
                );
              }
              return <span key={tokIdx}>{token}</span>;
            })}
            {commentPart && (
              <span className="text-slate-500 italic font-normal">
                {commentPart}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function getDivision(branch?: string | null, section?: string | null): string | null {
  const normBranch = normalizeBranch(branch);
  const normSection = (section || "").trim().toUpperCase();

  if (normBranch === "CSE") {
    if (["A", "B", "C"].includes(normSection)) {
      return "Division-1";
    }
    if (["D", "E", "F"].includes(normSection)) {
      return "Division-2";
    }
    // Remaining sections of CSE come under Division-3
    if (normSection) {
      return "Division-3";
    }
    return "Division-1";
  }

  if (normBranch === "CSM") {
    if (["A", "B"].includes(normSection)) {
      return "Division-1";
    }
    if (["C", "D"].includes(normSection)) {
      return "Division-2";
    }
    if (normSection) {
      return "Division-2";
    }
    return "Division-1";
  }

  return null;
}

export function LabRecordTemplate({ data, solutions }: LabRecordTemplateProps) {
  const { student, course, exercise, faculty } = data;
  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Roll number normalized to uppercase and split into individual character boxes
  const normalizedRoll = (student.rollNumber || "—").toUpperCase();
  const rollChars = normalizedRoll.padEnd(10, " ").slice(0, 10).split("");

  const normalizedBranch = normalizeBranch(student.branch || "CSE");
  const normalizedSection = (student.section || "A").toUpperCase();
  const division = getDivision(student.branch, student.section);
  const normalizedCourseCode = (course.courseCode || "CS301").toUpperCase();
  const normalizedFacultyId = (faculty?.facultyId || "").toUpperCase();

  // Flatten solution programs into discrete A4 page sheets if code overflows
  type ProgramPageItem = {
    prog: ProgramSolution;
    progIndex: number;
    partIndex: number;
    totalParts: number;
    codeChunk: string;
    isFirstPart: boolean;
    showTestCases: boolean;
    isTestCasesOnlyPage?: boolean;
    testCasesChunk?: VisibleTestCase[];
    tcPartIndex?: number;
    totalTcParts?: number;
    tcStartIndex?: number;
  };

  const programPages: ProgramPageItem[] = [];

  // Usable vertical content height (px) inside page border (excluding top header and bottom footer)
  const USABLE_PAGE_HEIGHT = 790;
  const MAX_TCS_PER_PAGE = 4;

  const estimatePsHeight = (ps?: string | null): number => {
    if (!ps || !ps.trim()) return 0;
    const lines = ps.trim().split("\n");
    let lineCount = 0;
    for (const l of lines) {
      lineCount += Math.max(1, Math.ceil(l.length / 80));
    }
    // Container padding/header (36px) + compact line height (16px per line) + margin (12px)
    return 48 + lineCount * 16;
  };

  const estimateTcHeight = (testCases?: VisibleTestCase[] | null): number => {
    if (!testCases || testCases.length === 0) return 0;
    let h = 45; // Section header + divider + margin
    for (const tc of testCases) {
      const inLines = Math.max(1, (tc.input || "").trim().split("\n").filter(Boolean).length);
      const expLines = Math.max(1, (tc.expectedOutput || "").trim().split("\n").filter(Boolean).length);
      const outLines = Math.max(1, (tc.userOutput || "").trim().split("\n").filter(Boolean).length);
      const maxBoxLines = Math.min(5, Math.max(inLines, expLines, outLines));
      // Card header (24px) + column labels (14px) + pre box (12px + lines * 15px) + card padding (16px) + margin (6px)
      h += 72 + maxBoxLines * 15;
    }
    return h;
  };

  const estimateCodeHeight = (lineCount: number): number => {
    if (lineCount === 0) return 60; // "No submitted code solution found" box
    return 55 + lineCount * 18.5; // Header + container padding + line height + margin
  };

  solutions.forEach((prog, progIdx) => {
    const allTCs = prog.testCases || [];
    const hasTCs = allTCs.length > 0;
    const codeLines = prog.code && prog.code.trim() ? prog.code.split("\n") : [];
    const codeCount = codeLines.length;

    // Chunk test cases into groups of at most MAX_TCS_PER_PAGE (4)
    const tcChunks: VisibleTestCase[][] = [];
    if (hasTCs) {
      for (let i = 0; i < allTCs.length; i += MAX_TCS_PER_PAGE) {
        tcChunks.push(allTCs.slice(i, i + MAX_TCS_PER_PAGE));
      }
    }

    const psHeight = estimatePsHeight(prog.problemStatement);
    const tcHeight = hasTCs ? estimateTcHeight(allTCs) : 0;
    const fullCodeHeight = estimateCodeHeight(codeCount);

    // ─── Case 1: Everything fits on a single page! ───
    // Only if at most 2 test cases, and total height is strictly within budget
    if (
      allTCs.length <= 2 &&
      psHeight + fullCodeHeight + tcHeight <= USABLE_PAGE_HEIGHT
    ) {
      programPages.push({
        prog,
        progIndex: progIdx,
        partIndex: 0,
        totalParts: 1,
        codeChunk: prog.code || "",
        isFirstPart: true,
        showTestCases: hasTCs,
        testCasesChunk: allTCs,
        tcPartIndex: 0,
        totalTcParts: 1,
        tcStartIndex: 0,
      });
      return;
    }

    // ─── Case 2: Problem statement + entire code fit on Page 1, but Test Cases need their own page(s) ───
    if (hasTCs && psHeight + fullCodeHeight <= USABLE_PAGE_HEIGHT) {
      const totalParts = 1 + tcChunks.length;
      // Page 1: Code only
      programPages.push({
        prog,
        progIndex: progIdx,
        partIndex: 0,
        totalParts,
        codeChunk: prog.code || "",
        isFirstPart: true,
        showTestCases: false,
      });
      // Page 2+: Dedicated Test Case page(s)
      tcChunks.forEach((chunk, chunkIdx) => {
        programPages.push({
          prog,
          progIndex: progIdx,
          partIndex: 1 + chunkIdx,
          totalParts,
          codeChunk: "",
          isFirstPart: false,
          showTestCases: true,
          isTestCasesOnlyPage: true,
          testCasesChunk: chunk,
          tcPartIndex: chunkIdx,
          totalTcParts: tcChunks.length,
          tcStartIndex: chunkIdx * MAX_TCS_PER_PAGE,
        });
      });
      return;
    }

    // ─── Case 3: Code is long and needs to be split across pages ───
    const page1AvailForCode = Math.max(120, USABLE_PAGE_HEIGHT - psHeight - 40);
    const page1MaxLines = Math.max(10, Math.floor(page1AvailForCode / 18.5));
    const subPageMaxLines = 38;

    let chunks = chunkCode(prog.code || "", page1MaxLines, subPageMaxLines);

    // Rebalance if the last chunk has fewer than 7 lines to avoid awkward orphan endings
    if (chunks.length > 1) {
      const lastLines = chunks[chunks.length - 1].split("\n").length;
      if (lastLines < 7) {
        const prevChunkLines = chunks[chunks.length - 2].split("\n");
        if (prevChunkLines.length > 16) {
          const moveCount = Math.min(8, prevChunkLines.length - 12);
          const moved = prevChunkLines.slice(prevChunkLines.length - moveCount);
          chunks[chunks.length - 2] = prevChunkLines.slice(0, prevChunkLines.length - moveCount).join("\n");
          chunks[chunks.length - 1] = [...moved, ...chunks[chunks.length - 1].split("\n")].join("\n");
        }
      }
    }

    const lastChunkLinesCount = chunks[chunks.length - 1].split("\n").length;
    const lastChunkHeight = estimateCodeHeight(lastChunkLinesCount);

    // Test cases can ONLY be placed on the last chunk if:
    // 1. There are at most 2 test cases (allTCs.length <= 2)
    // 2. tcChunks.length === 1
    // 3. Combined height is <= 660px (leaving 130px+ safety cushion)
    const canFitTestCasesOnLastChunk =
      hasTCs &&
      allTCs.length <= 2 &&
      tcChunks.length === 1 &&
      lastChunkHeight + tcHeight <= 660;

    if (!hasTCs) {
      chunks.forEach((chunk, partIdx) => {
        programPages.push({
          prog,
          progIndex: progIdx,
          partIndex: partIdx,
          totalParts: chunks.length,
          codeChunk: chunk,
          isFirstPart: partIdx === 0,
          showTestCases: false,
        });
      });
    } else if (canFitTestCasesOnLastChunk) {
      chunks.forEach((chunk, partIdx) => {
        const isLast = partIdx === chunks.length - 1;
        programPages.push({
          prog,
          progIndex: progIdx,
          partIndex: partIdx,
          totalParts: chunks.length,
          codeChunk: chunk,
          isFirstPart: partIdx === 0,
          showTestCases: isLast,
          testCasesChunk: isLast ? allTCs : undefined,
          tcPartIndex: 0,
          totalTcParts: 1,
          tcStartIndex: 0,
        });
      });
    } else {
      // Test cases need dedicated Execution Output page(s)
      const totalParts = chunks.length + tcChunks.length;
      chunks.forEach((chunk, partIdx) => {
        programPages.push({
          prog,
          progIndex: progIdx,
          partIndex: partIdx,
          totalParts,
          codeChunk: chunk,
          isFirstPart: partIdx === 0,
          showTestCases: false,
        });
      });

      tcChunks.forEach((chunk, chunkIdx) => {
        programPages.push({
          prog,
          progIndex: progIdx,
          partIndex: chunks.length + chunkIdx,
          totalParts,
          codeChunk: "",
          isFirstPart: false,
          showTestCases: true,
          isTestCasesOnlyPage: true,
          testCasesChunk: chunk,
          tcPartIndex: chunkIdx,
          totalTcParts: tcChunks.length,
          tcStartIndex: chunkIdx * MAX_TCS_PER_PAGE,
        });
      });
    }
  });

  // Helper to sanitize viva answers: collapse empty lines
  const cleanVivaAnswer = (text?: string | null): string => {
    if (!text) return "";
    return text
      .replace(/\r\n/g, "\n")
      // Collapse multiple consecutive newlines (including blank lines with spaces) into a single newline
      .replace(/\n\s*\n+/g, "\n")
      .trim();
  };

  // Group Viva questions into discrete A4 page sheets based on question and answer heights
  type VivaQuestionItem = NonNullable<typeof data.vivaQuestions>[0];
  const vivaPages: VivaQuestionItem[][] = [];

  if (data.vivaQuestions && data.vivaQuestions.length > 0) {
    // Usable height inside inner border (1034px - 70px header - 35px footer - 40px safety = 889px)
    const MAX_VIVA_PAGE_HEIGHT = 860;

    const calcVivaCardHeight = (vq: VivaQuestionItem): number => {
      const cleanAns = cleanVivaAnswer(vq.answerText);
      const qLen = (vq.questionText || "").length;
      // Question title wrapped to ~80 chars per line (text-xs font-bold)
      const qLines = Math.max(1, Math.ceil(qLen / 80));
      const qHeight = qLines * 16;

      let ansHeight = 24; // fallback for no answer
      if (cleanAns) {
        const lines = cleanAns.split("\n");
        // Each visual line wraps around 85 characters
        const visualLines = lines.reduce(
          (acc, l) => acc + Math.max(1, Math.ceil(l.length / 85)),
          0
        );
        // "Student Answer:" label (16px) + visual lines * 17px
        ansHeight = 16 + visualLines * 17;
      }

      // Card padding (p-2.5 = 20px) + border (2px) + gap between title & answer (6px) + space-y margin (10px) = 38px
      return qHeight + ansHeight + 38;
    };

    let currentPage: VivaQuestionItem[] = [];
    let currentHeight = 0;

    for (const vq of data.vivaQuestions) {
      const cardH = calcVivaCardHeight(vq);

      // If adding this question exceeds the page height AND the page already has at least one question:
      if (currentPage.length > 0 && currentHeight + cardH > MAX_VIVA_PAGE_HEIGHT) {
        vivaPages.push(currentPage);
        currentPage = [vq];
        currentHeight = cardH;
      } else {
        currentPage.push(vq);
        currentHeight += cardH;
      }
    }

    if (currentPage.length > 0) {
      vivaPages.push(currentPage);
    }
  }

  const totalPages = programPages.length + 1 + vivaPages.length;

  return (
    <div id="printable-lab-record" className="lab-record-document bg-white text-black font-sans w-[210mm] max-w-full mx-auto p-0 border border-gray-200 shadow-lg print:shadow-none print:w-full print:border-none">
      {/* ─── PAGE 1: COVER & EVALUATION SHEET ─────────────────────────────── */}
      <div className="page-sheet page-sheet-cover h-[297mm] max-h-[297mm] p-6 flex flex-col justify-between box-border overflow-hidden border-b print:border-none print:break-after-page">
        <div className="flex flex-col flex-1 min-h-0 justify-between">
          <div>
            {/* Top Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-3">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/iare-shield-crest.png"
                  alt="IARE Logo"
                  className="h-24 w-auto object-contain shrink-0"
                  style={{ height: "92px", width: "auto", objectFit: "contain" }}
                />
                <div>
                  <h1 className="text-2xl font-black text-[#0f3c7e] tracking-wider uppercase leading-tight">
                    IARE
                  </h1>
                  <h2 className="text-sm font-bold text-gray-900 leading-tight tracking-wide">
                    INSTITUTE OF AERONAUTICAL ENGINEERING
                  </h2>
                  <p className="text-[11px] text-gray-700 font-medium leading-snug">
                    (An Autonomous Institute affiliated to JNTUH, Hyderabad)
                  </p>
                  <p className="text-[11px] text-gray-700 font-medium leading-snug">
                    Dundigal, Hyderabad - 500 043
                  </p>
                </div>
              </div>
            </div>

            {/* Title Banner */}
            <div className="text-center my-3">
              <h2 className="text-lg font-black tracking-widest uppercase border-b-2 border-black inline-block px-6 pb-0.5">
                LABORATORY WORK BOOK
              </h2>
            </div>

            {/* Student & Course Header Fields */}
            <div className="space-y-2 text-xs font-medium my-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <span className="whitespace-nowrap font-bold">Name of the Student :</span>
                  <span className="font-bold border-b border-black flex-1 px-1 truncate">
                    {student.name}
                  </span>
                </div>

                {/* Roll Number Box Grid */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-xs">Roll Number :</span>
                  <div className="flex border-2 border-black divide-x-2 divide-black bg-gray-50">
                    {rollChars.map((char, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-6 flex items-center justify-center font-mono font-bold text-sm"
                      >
                        {char.trim()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Class :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {normalizedBranch}-{normalizedSection}{division ? ` ${division}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Semester :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {student.semester}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Course Code :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {normalizedCourseCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Course Name :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {course.courseName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold">Name of the Course Faculty :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {faculty?.name || ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold">Faculty ID :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {normalizedFacultyId}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold">No. of Programs :</span>
                  <span className="font-bold border-b border-black flex-1 px-1">
                    {solutions.length || data.programs?.length || 1}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold">Week Number :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {exercise.exerciseNo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold">Date :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {todayStr}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MARKS AWARDED Table (Fills height down to signatures) */}
          <div className="mt-3 flex-1 flex flex-col justify-between">
            <table className="w-full h-full border-collapse border-2 border-black text-[10px] text-center">
              <thead>
                <tr className="bg-gray-100 font-bold border-b-2 border-black">
                  <th rowSpan={2} className="border border-black px-1 py-1 w-16">
                    Exercise Number
                  </th>
                  <th rowSpan={2} className="border border-black px-2 py-1 text-left">
                    EXERCISE NAME
                  </th>
                  <th colSpan={6} className="border border-black px-1 py-1">
                    MARKS AWARDED
                  </th>
                </tr>
                <tr className="bg-gray-100 font-semibold border-b-2 border-black text-[8px]">
                  <th className="border border-black p-1 w-16">
                    Aim / Preparation
                    <div className="font-bold text-xs mt-0.5">4</div>
                  </th>
                  <th className="border border-black p-1 w-24">
                    Algorithm / Procedure
                    <div className="text-[7px] font-normal">Performance in Lab</div>
                    <div className="font-bold text-xs mt-0.5">4</div>
                  </th>
                  <th className="border border-black p-1 w-24">
                    Source Code
                    <div className="text-[7px] font-normal">Calculations & Graphs</div>
                    <div className="font-bold text-xs mt-0.5">4</div>
                  </th>
                  <th className="border border-black p-1 w-28">
                    Program Execution
                    <div className="text-[7px] font-normal">Results & Error Analysis</div>
                    <div className="font-bold text-xs mt-0.5">4</div>
                  </th>
                  <th className="border border-black p-1 w-16">
                    Viva - Voce
                    <div className="font-bold text-xs mt-0.5">4</div>
                  </th>
                  <th className="border border-black p-1 w-12 font-bold bg-gray-200">
                    Total
                    <div className="font-bold text-xs mt-0.5">20</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 14 }).map((_, index) => {
                  const sNo = index + 1;
                  const isFuture = sNo > exercise.exerciseNo;
                  const ev = !isFuture ? data.evaluations?.find((e) => e.exerciseNo === sNo) : null;
                  const m = ev ? ev.marks : null;
                  const fmt = (v: number | null | undefined) =>
                    v !== null && v !== undefined && !isNaN(v)
                      ? v % 1 === 0
                        ? v.toString()
                        : v.toFixed(1)
                      : "";

                  return (
                    <tr
                      key={sNo}
                      className="h-6"
                    >
                      <td className="border border-black py-1 font-semibold">{sNo}</td>
                      <td className="border border-black text-left px-2 truncate max-w-[200px] py-1">
                        {ev ? ev.title : ""}
                      </td>
                      <td className="border border-black py-1">{m ? fmt(m.aim) : ""}</td>
                      <td className="border border-black py-1">{m ? fmt(m.algorithm) : ""}</td>
                      <td className="border border-black py-1">{m ? fmt(m.sourceCode) : ""}</td>
                      <td className="border border-black py-1">{m ? fmt(m.execution) : ""}</td>
                      <td className="border border-black py-1">{m ? fmt(m.viva) : ""}</td>
                      <td className="border border-black bg-gray-50/50 py-1 font-bold">{m ? fmt(m.total) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Signatures */}
        <div className="pt-4 mt-auto">
          <div className="flex justify-between items-end text-xs font-bold px-2">
            <div className="flex flex-col items-center">
              {/* Signature Gap Space */}
              <div className="h-14"></div>
              <div className="border-t-2 border-black w-48 text-center pt-1">
                Signature of the Student
              </div>
            </div>

            <div className="text-[10px] text-gray-600 font-mono font-bold pb-1">
              Page 1 of {totalPages}
            </div>

            <div className="flex flex-col items-center">
              {/* Signature Gap Space */}
              <div className="h-14"></div>
              <div className="border-t-2 border-black w-48 text-center pt-1">
                Signature of the Faculty
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PAGE 2+: EXERCISE SOLUTIONS (DISCRETE A4 PAGE SHEETS) ───── */}
      {programPages.length === 0 ? (
        <div className="page-sheet page-sheet-program h-[297mm] max-h-[297mm] p-6 flex flex-col justify-between box-border overflow-hidden border-b print:border-none print:break-after-page">
          <div className="border border-black p-5 h-full flex flex-col justify-between">
            <div>
              <div className="text-center border-b border-black pb-2 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  START WRITING FROM HERE
                </h3>
              </div>
              <div className="bg-gray-100 p-3 rounded border border-gray-300 mb-5">
                <h4 className="text-base font-bold text-gray-900">
                  Exercise {exercise.exerciseNo}: {exercise.title}
                </h4>
              </div>
              <div className="p-4 border border-dashed border-gray-400 rounded text-center text-gray-500 text-xs">
                No programs found or submitted for this exercise yet.
              </div>
            </div>
            <div className="pt-4 mt-6 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-mono font-bold">
              <span>
                {student.name} ({normalizedRoll})
              </span>
              <span>Page 2 of 2</span>
              <span>Laboratory Work Book</span>
            </div>
          </div>
        </div>
      ) : (
        programPages.map((pageItem, pageIdx) => {
          const {
            prog,
            partIndex,
            totalParts,
            codeChunk,
            isFirstPart,
            showTestCases,
            isTestCasesOnlyPage,
            testCasesChunk,
            tcPartIndex,
            totalTcParts,
            tcStartIndex,
          } = pageItem;
          const pageNo = pageIdx + 2;

          return (
            <div
              key={`${prog.id}-${partIndex}`}
              className="page-sheet page-sheet-program h-[297mm] max-h-[297mm] p-6 flex flex-col justify-between box-border overflow-hidden border-b print:border-none print:break-after-page"
            >
              <div className="border border-black p-5 h-full flex flex-col justify-between flex-1">
                <div>
                  {/* Page Header Line - Page 2 of Document Only */}
                  {pageIdx === 0 && (
                    <div className="text-center border-b border-black pb-2 mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        START WRITING FROM HERE
                      </h3>
                    </div>
                  )}

                  {/* Exercise Header */}
                  <div className="bg-gray-100 p-2.5 rounded border border-gray-300 mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Exercise {exercise.exerciseNo}: {exercise.title}
                      </h4>
                      {exercise.description && (
                        <p className="text-[11px] text-gray-700 mt-0.5">{exercise.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-semibold uppercase">
                      Program {prog.programNo} of {solutions.length} {totalParts > 1 ? `(Part ${partIndex + 1}/${totalParts})` : ""}
                    </span>
                  </div>

                  {/* Program Details */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-300 pb-2">
                      <h5 className="font-bold text-xs text-gray-900">
                        Program {prog.programNo}: {prog.title}{" "}
                        {isTestCasesOnlyPage
                          ? `(Execution Output${totalTcParts && totalTcParts > 1 ? ` Part ${tcPartIndex! + 1}/${totalTcParts}` : ""})`
                          : totalParts > 1 && partIndex > 0
                          ? `(Contd. Part ${partIndex + 1})`
                          : ""}
                      </h5>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const status = getProgramStatus(prog);
                          return (
                            <span
                              className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                status === "Executed"
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : status === "Partially Executed"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : status === "Not Executed"
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-gray-100 text-gray-600 border-gray-300"
                              }`}
                            >
                              {status}
                            </span>
                          );
                        })()}
                        <span className="text-[10px] font-mono bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-semibold uppercase">
                          Language: {prog.language ? prog.language.split(":")[0] : "Code"}
                        </span>
                      </div>
                    </div>

                    {/* Problem Statement (Only on Part 1 of the program) */}
                    {isFirstPart && prog.problemStatement && (
                      <div className="text-[11px] text-gray-800 bg-gray-50 p-2.5 rounded border border-gray-200">
                        <span className="font-bold text-gray-900 block mb-1">
                          Problem Statement:
                        </span>
                        <div className="prose prose-xs max-w-none text-gray-800 leading-snug font-sans prose-p:my-0.5 prose-pre:my-1 prose-headings:my-1 prose-ul:my-0.5 prose-li:my-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {prog.problemStatement}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Submitted Code Solution Chunk (if not a dedicated test cases page) */}
                    {!isTestCasesOnlyPage && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-xs text-gray-900 block">
                          Submitted Code Solution {totalParts > 1 ? `(Part ${partIndex + 1} of ${totalParts})` : ""}:
                        </span>
                        {codeChunk ? (
                          <pre className="bg-slate-50 text-slate-900 p-3 rounded text-[11px] font-mono whitespace-pre-wrap word-break break-words overflow-x-auto border border-slate-300 leading-relaxed shadow-sm">
                            <code>{highlightCode(codeChunk)}</code>
                          </pre>
                        ) : (
                          <div className="p-3 border border-dashed border-gray-300 rounded text-center text-gray-500 text-xs italic bg-gray-50">
                            No submitted code solution found for this program.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visible Test Cases and Program Execution Output */}
                    {showTestCases && (testCasesChunk || prog.testCases) && (testCasesChunk || prog.testCases)!.length > 0 && (() => {
                      const casesToRender = testCasesChunk || prog.testCases || [];
                      const tcStartIdx = tcStartIndex ?? 0;
                      const isNotAttempted = !prog.code || !prog.code.trim();
                      const passedCount = (prog.testCases || []).filter((t) => t.passed).length;
                      const totalCasesCount = (prog.testCases || []).length;
                      return (
                        <div className={`space-y-1.5 ${isTestCasesOnlyPage ? "mt-3" : "mt-2 pt-2 border-t border-gray-300"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full inline-block ${
                                  isNotAttempted
                                    ? "bg-gray-400"
                                    : passedCount === totalCasesCount
                                    ? "bg-green-600"
                                    : passedCount > 0
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                              />
                              Visible Test Cases & Execution Output:
                            </span>
                            <span className="text-[10px] text-gray-600 font-mono font-semibold">
                              {isNotAttempted
                                ? "Not Attempted"
                                : `${passedCount}/${totalCasesCount} Passed`}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {casesToRender.map((tc, tcIdx) => {
                              const globalTcIndex = tcStartIdx + tcIdx;
                              const tcPassed = Boolean(tc.passed);
                              return (
                                <div
                                  key={tc.id || globalTcIndex}
                                  className="rounded border border-gray-300 bg-gray-50/70 p-2 text-[10px] font-mono leading-snug"
                                >
                                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
                                    <span className="font-bold text-gray-800 text-[10.5px]">
                                      Test Case #{globalTcIndex + 1}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                        isNotAttempted
                                          ? "bg-gray-100 text-gray-600 border border-gray-300"
                                          : tcPassed
                                          ? "bg-green-100 text-green-800 border border-green-300"
                                          : "bg-red-100 text-red-800 border border-red-300"
                                      }`}
                                    >
                                      {isNotAttempted ? "Not Attempted" : tcPassed ? "Passed" : "Not Executed"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <span className="text-[8.5px] font-bold text-gray-600 uppercase block mb-0.5">
                                        Input:
                                      </span>
                                      <pre className="bg-white border border-gray-200 rounded p-1 whitespace-pre-wrap break-all text-[9px] text-gray-800 min-h-[22px] max-h-[70px] overflow-hidden">
                                        {tc.input && tc.input.trim() ? tc.input.trim() : "(no input)"}
                                      </pre>
                                    </div>

                                    <div>
                                      <span className="text-[8.5px] font-bold text-gray-600 uppercase block mb-0.5">
                                        Expected Output:
                                      </span>
                                      <pre className="bg-white border border-gray-200 rounded p-1 whitespace-pre-wrap break-all text-[9px] text-gray-800 min-h-[22px] max-h-[70px] overflow-hidden">
                                        {tc.expectedOutput && tc.expectedOutput.trim() ? tc.expectedOutput.trim() : "(empty)"}
                                      </pre>
                                    </div>

                                    <div>
                                      <span className="text-[8.5px] font-bold text-gray-600 uppercase block mb-0.5">
                                        User Output:
                                      </span>
                                      <pre
                                        className={`bg-white border rounded p-1 whitespace-pre-wrap break-all text-[9px] min-h-[22px] max-h-[70px] overflow-hidden ${
                                          isNotAttempted
                                            ? "border-gray-200 text-gray-500 italic bg-gray-50"
                                            : tcPassed
                                            ? "border-green-300 text-green-900"
                                            : "border-red-300 text-red-900"
                                        }`}
                                      >
                                        {isNotAttempted ? "(No code submitted)" : formatUserOutput(tc.userOutput)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Page Footer */}
                <div className="pt-4 mt-auto border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-mono font-bold">
                  <span>
                    {student.name} ({normalizedRoll})
                  </span>
                  <span>
                    Page {pageNo} of {totalPages}
                  </span>
                  <span>Laboratory Work Book</span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* ─── Viva Voce Section ──────────────────────────────────────────────── */}
      {vivaPages.length > 0 &&
        vivaPages.map((pageQuestions, vivaIdx) => {
          const vivaPageNo = programPages.length + 1 + vivaIdx + 1;
          const totalVivaPages = vivaPages.length;

          return (
            <div
              key={`viva-page-${vivaIdx}`}
              className="page-sheet page-sheet-viva h-[297mm] max-h-[297mm] p-6 flex flex-col justify-between box-border overflow-hidden border-b print:border-none print:break-after-page"
            >
              <div className="border border-black p-5 h-full flex flex-col justify-between flex-1">
                <div>
                  {/* Header Box */}
                  <div className="bg-gray-100 p-2.5 rounded border border-gray-300 mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Viva Voce Examination & Evaluation
                        {totalVivaPages > 1 ? ` (Part ${vivaIdx + 1}/${totalVivaPages})` : ""}
                      </h4>
                      <p className="text-[11px] text-gray-700 mt-0.5">
                        Exercise {exercise.exerciseNo}: {exercise.title}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-semibold uppercase">
                      {data.vivaQuestions?.length || 0} Questions Assigned
                    </span>
                  </div>

                  {/* Questions & Answers */}
                  <div className="space-y-2.5">
                    {pageQuestions.map((vq) => {
                      const cleanAns = cleanVivaAnswer(vq.answerText);
                      return (
                        <div
                          key={vq.questionNo}
                          className="border border-gray-300 rounded p-2.5 bg-gray-50/60 space-y-1"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-xs text-blue-950">
                              Q{vq.questionNo}. {vq.questionText}
                            </span>
                          </div>
                          <div className="pl-3 border-l-2 border-purple-600">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                              Student Answer:
                            </span>
                            {cleanAns ? (
                              <p className="text-xs text-gray-900 leading-normal whitespace-pre-wrap font-sans">
                                {cleanAns}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 italic">
                                No answer submitted for this Viva question.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Page Footer */}
                <div className="pt-4 mt-auto border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-mono font-bold">
                  <span>
                    {student.name} ({normalizedRoll})
                  </span>
                  <span>
                    Page {vivaPageNo} of {totalPages}
                  </span>
                  <span>Laboratory Work Book</span>
                </div>
              </div>
            </div>
          );
        })}

      {/* CSS rules for printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .lab-record-document,
          .lab-record-document * {
            visibility: visible;
          }
          .lab-record-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .page-sheet {
            page-break-after: always;
            margin: 0 !important;
            min-height: 100vh !important;
          }
          pre, code {
            white-space: pre-wrap !important;
            word-break: break-word !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
