import * as XLSX from "xlsx";

interface Program {
  id: string;
  programNo: number;
  title: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  solvedProgramIds: string[];
  marks: number | null;
}

export function downloadSubmissionsExcel({
  exerciseNo,
  exerciseTitle,
  programs,
  students,
}: {
  exerciseNo: number;
  exerciseTitle: string;
  programs: Program[];
  students: Student[];
}) {
  // Build header row
  const headers = [
    "Student Name",
    "Email",
    ...programs.map((p) => `P${p.programNo}: ${p.title}`),
    "Solved",
    "Total Programs",
    "Marks",
  ];

  // Build data rows
  const rows = students.map((student) => [
    student.name,
    student.email,
    ...programs.map((p) =>
      student.solvedProgramIds.includes(p.id) ? "✓" : "✗"
    ),
    student.solvedProgramIds.length,
    programs.length,
    student.marks !== null ? student.marks : "",
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 25 }, // Student Name
    { wch: 30 }, // Email
    ...programs.map(() => ({ wch: 20 })), // Program columns
    { wch: 8 },  // Solved
    { wch: 14 }, // Total Programs
    { wch: 8 },  // Marks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    `Exercise ${exerciseNo}`
  );

  const filename = `Exercise_${exerciseNo}_${exerciseTitle.replace(/[^a-z0-9]/gi, "_")}_Submissions.xlsx`;
  XLSX.writeFile(wb, filename);
}