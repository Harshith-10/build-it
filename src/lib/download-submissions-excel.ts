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
  username?: string | null;
  solvedProgramIds: string[];
  marks: number | null;
  implementationMarks?: number | null;
  writeUpMarks?: number | null;
  vivaMarks?: number | null;
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
    "Roll No.",
    "Student Name",
    "Email",
    ...programs.map((p) => `P${p.programNo}: ${p.title}`),
    "Solved",
    "Total Programs",
    "Implementation Marks",
    "Write-Up Marks",
    "Viva-Voce Marks",
    "Total Marks",
  ];

  // Build data rows
  const rows = students.map((student) => [
    student.username ?? "",
    student.name,
    student.email,
    ...programs.map((p) =>
      student.solvedProgramIds.includes(p.id) ? "✓" : "✗"
    ),
    student.solvedProgramIds.length,
    programs.length,
    student.implementationMarks !== null && student.implementationMarks !== undefined ? student.implementationMarks : "",
    student.writeUpMarks !== null && student.writeUpMarks !== undefined ? student.writeUpMarks : "",
    student.vivaMarks !== null && student.vivaMarks !== undefined ? student.vivaMarks : "",
    student.marks !== null ? student.marks : "",
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 15 }, // Roll No.
    { wch: 25 }, // Student Name
    { wch: 30 }, // Email
    ...programs.map(() => ({ wch: 20 })), // Program columns
    { wch: 8 },  // Solved
    { wch: 14 }, // Total Programs
    { wch: 20 }, // Implementation Marks
    { wch: 15 }, // Write-Up Marks
    { wch: 15 }, // Viva-Voce Marks
    { wch: 12 }, // Total Marks
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

export function downloadAttendanceExcel({
  exerciseNo,
  exerciseTitle,
  students,
}: {
  exerciseNo: number;
  exerciseTitle: string;
  students: { id: string; name: string; email: string; username?: string | null; present: boolean }[];
}) {
  const headers = ["Roll No.", "Student Name", "Email", "Attendance Status"];
  const rows = students.map((student) => [
    student.username ? student.username.toUpperCase() : "",
    student.name,
    student.email,
    student.present ? "Present" : "Absent",
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 18 }, // Roll No.
    { wch: 25 }, // Student Name
    { wch: 30 }, // Email
    { wch: 20 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Exercise ${exerciseNo} Attendance`);

  const filename = `Exercise_${exerciseNo}_${exerciseTitle.replace(/[^a-z0-9]/gi, "_")}_Attendance.xlsx`;
  XLSX.writeFile(wb, filename);
}