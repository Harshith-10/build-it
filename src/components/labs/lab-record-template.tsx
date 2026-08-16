"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExerciseReportData } from "@/actions/student/labs/report";

export type ProgramSolution = {
  id: string;
  programNo: number;
  title: string;
  problemStatement: string;
  code: string;
  language: string;
};

interface LabRecordTemplateProps {
  data: ExerciseReportData;
  solutions: ProgramSolution[];
}

function chunkCode(code: string, firstPageLines = 24, subPageLines = 38): string[] {
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

  const normalizedBranch = (student.branch || "CSE").toUpperCase();
  const normalizedSection = (student.section || "A").toUpperCase();
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
  };

  const programPages: ProgramPageItem[] = [];

  solutions.forEach((prog, progIdx) => {
    const firstLimit = prog.problemStatement ? 24 : 32;
    const chunks = chunkCode(prog.code, firstLimit, 38);
    chunks.forEach((chunk, partIdx) => {
      programPages.push({
        prog,
        progIndex: progIdx,
        partIndex: partIdx,
        totalParts: chunks.length,
        codeChunk: chunk,
        isFirstPart: partIdx === 0,
      });
    });
  });

  const totalPages = programPages.length + 1;

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
                  src="/iare-logo-light.png"
                  alt="IARE Logo"
                  className="w-36 h-36 object-contain shrink-0"
                  style={{ width: "135px", height: "135px", minWidth: "135px", minHeight: "135px", objectFit: "contain" }}
                />
                <div>
                  <h1 className="text-xl font-black text-blue-950 tracking-wider uppercase leading-tight">
                    IARE
                  </h1>
                  <h2 className="text-sm font-bold text-gray-900 leading-tight">
                    INSTITUTE OF AERONAUTICAL ENGINEERING
                  </h2>
                  <p className="text-[10px] text-gray-700 font-medium">
                    (An Autonomous Institute affiliated to JNTUH, Hyderabad)
                  </p>
                  <p className="text-[10px] text-gray-700 font-medium">
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
                  <span className="font-bold text-xs uppercase">Roll Number</span>
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
                    {normalizedBranch} - Sec {normalizedSection}
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
                  <span className="font-bold">Exercise Number :</span>
                  <span className="font-bold border-b border-black flex-1 px-1">
                    {exercise.exerciseNo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Week Number :</span>
                  <span className="font-semibold border-b border-black flex-1 px-1">
                    {exercise.exerciseNo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Date :</span>
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
                  <th rowSpan={2} className="border border-black px-1 py-1 w-8">
                    S. No
                  </th>
                  <th rowSpan={2} className="border border-black px-1 py-1 w-12">
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
                  const ev = data.evaluations?.find((e) => e.exerciseNo === sNo);
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
                      <td className="border border-black py-1">{sNo}</td>
                      <td className="border border-black py-1">{ev ? ev.exerciseNo : ""}</td>
                      <td className="border border-black text-left px-2 truncate max-w-[180px] py-1">
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
          const { prog, partIndex, totalParts, codeChunk, isFirstPart } = pageItem;
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
                  <div className="bg-gray-100 p-2.5 rounded border border-gray-300 mb-4 flex items-center justify-between">
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
                        Program {prog.programNo}: {prog.title} {totalParts > 1 ? `(Contd. Part ${partIndex + 1})` : ""}
                      </h5>
                      <span className="text-[10px] font-mono bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-semibold uppercase">
                        Language: {prog.language || "Code"}
                      </span>
                    </div>

                    {/* Problem Statement (Only on Part 1 of the program) */}
                    {isFirstPart && prog.problemStatement && (
                      <div className="text-[11px] text-gray-800 bg-gray-50 p-3 rounded border border-gray-200">
                        <span className="font-bold text-gray-900 block mb-1">
                          Problem Statement:
                        </span>
                        <div className="prose prose-xs max-w-none text-gray-800 leading-relaxed font-sans">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {prog.problemStatement}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Submitted Code Solution Chunk */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-xs text-gray-900 block">
                        Submitted Code Solution {totalParts > 1 ? `(Part ${partIndex + 1} of ${totalParts})` : ""}:
                      </span>
                      {codeChunk ? (
                        <pre className="bg-gray-900 text-gray-100 p-3.5 rounded text-[11px] font-mono whitespace-pre-wrap word-break break-words overflow-x-auto border border-gray-800 leading-relaxed">
                          <code>{codeChunk}</code>
                        </pre>
                      ) : (
                        <div className="p-3 border border-dashed border-gray-300 rounded text-center text-gray-500 text-xs italic bg-gray-50">
                          No code submission saved in browser local storage for this program.
                        </div>
                      )}
                    </div>
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
