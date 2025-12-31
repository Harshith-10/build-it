import select from "@inquirer/select";
import { eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { examAssignments, malpracticeEvents } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import { exams } from "@/db/schema/exams";

async function exportExamData() {
  console.log("📊 Export Exam Data to Excel\n");

  // Fetch all exams
  const allExams = await db.select().from(exams).orderBy(exams.createdAt);

  if (allExams.length === 0) {
    console.log("❌ No exams found in the database.");
    return;
  }

  // Let user select an exam
  const selectedExamId = await select({
    message: "Select an exam to export:",
    choices: allExams.map((e) => ({
      name: `${e.title} (${e.status}) - ${e.startTime?.toLocaleDateString()}`,
      value: e.id,
    })),
    pageSize: 15,
  });

  const selectedExam = allExams.find((e) => e.id === selectedExamId)!;

  console.log(`\n📝 Fetching data for: ${selectedExam.title}...`);

  // Fetch all assignments for this exam with user details
  const assignments = await db
    .select({
      assignment: examAssignments,
      user: user,
    })
    .from(examAssignments)
    .innerJoin(user, eq(examAssignments.userId, user.id))
    .where(eq(examAssignments.examId, selectedExamId));

  if (assignments.length === 0) {
    console.log("❌ No assignments found for this exam.");
    return;
  }

  console.log(`📋 Found ${assignments.length} assignments.`);

  // Get terminated assignments and their malpractice events
  const terminatedAssignments = assignments.filter(
    (a) => a.assignment.isTerminated || a.assignment.malpracticeCount > 0,
  );
  const assignmentIds = terminatedAssignments.map((a) => a.assignment.id);

  let allMalpracticeEvents: Array<{
    event: typeof malpracticeEvents.$inferSelect;
    user: typeof user.$inferSelect;
    assignment: typeof examAssignments.$inferSelect;
  }> = [];

  if (assignmentIds.length > 0) {
    // Fetch all malpractice events for these assignments
    const events = await db
      .select({
        event: malpracticeEvents,
        assignment: examAssignments,
        user: user,
      })
      .from(malpracticeEvents)
      .innerJoin(
        examAssignments,
        eq(malpracticeEvents.assignmentId, examAssignments.id),
      )
      .innerJoin(user, eq(examAssignments.userId, user.id))
      .where(inArray(malpracticeEvents.assignmentId, assignmentIds));

    allMalpracticeEvents = events;
    console.log(`🚨 Found ${allMalpracticeEvents.length} malpractice events.`);
  }

  console.log(`\nCreating Excel file...\n`);

  // Create workbook and worksheets
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildIT Dashboard";
  workbook.created = new Date();

  // ============ Exam Summary Sheet ============
  const summarySheet = workbook.addWorksheet("Exam Summary");

  summarySheet.columns = [
    { header: "Property", key: "property", width: 25 },
    { header: "Value", key: "value", width: 50 },
  ];

  // Style header row
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  summarySheet.addRows([
    { property: "Exam ID", value: selectedExam.id },
    { property: "Title", value: selectedExam.title },
    { property: "Description", value: selectedExam.description || "N/A" },
    { property: "Status", value: selectedExam.status },
    {
      property: "Start Time",
      value: selectedExam.startTime?.toLocaleString() || "N/A",
    },
    {
      property: "End Time",
      value: selectedExam.endTime?.toLocaleString() || "N/A",
    },
    { property: "Duration (minutes)", value: selectedExam.durationMinutes },
    { property: "Strategy Type", value: selectedExam.strategyType },
    { property: "Grading Strategy", value: selectedExam.gradingStrategy },
    { property: "Total Participants", value: assignments.length },
    {
      property: "Completed",
      value: assignments.filter((a) => a.assignment.status === "completed")
        .length,
    },
    {
      property: "In Progress",
      value: assignments.filter((a) => a.assignment.status === "in_progress")
        .length,
    },
    {
      property: "Not Started",
      value: assignments.filter((a) => a.assignment.status === "not_started")
        .length,
    },
    {
      property: "Terminated (Malpractice)",
      value: assignments.filter((a) => a.assignment.isTerminated).length,
    },
    {
      property: "Total Malpractice Events",
      value: allMalpracticeEvents.length,
    },
    { property: "Exported At", value: new Date().toLocaleString() },
  ]);

  // ============ Student Results Sheet ============
  const resultsSheet = workbook.addWorksheet("Student Results");

  resultsSheet.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Roll Number", key: "rollNumber", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 35 },
    { header: "Branch", key: "branch", width: 15 },
    { header: "Semester", key: "semester", width: 12 },
    { header: "Section", key: "section", width: 12 },
    { header: "Status", key: "status", width: 15 },
    { header: "Score", key: "score", width: 10 },
    { header: "Started At", key: "startedAt", width: 22 },
    { header: "Completed At", key: "completedAt", width: 22 },
    { header: "Malpractice Count", key: "malpracticeCount", width: 18 },
    { header: "Terminated", key: "isTerminated", width: 12 },
  ];

  // Style header row
  resultsSheet.getRow(1).font = { bold: true };
  resultsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  resultsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Add data rows
  assignments.forEach((record, index) => {
    const row = resultsSheet.addRow({
      sno: index + 1,
      rollNumber: record.user.username || "N/A",
      name: record.user.name,
      email: record.user.email,
      branch: record.user.branch || "N/A",
      semester: record.user.semester || "N/A",
      section: record.user.section || "N/A",
      status: record.assignment.status,
      score: record.assignment.score ?? 0,
      startedAt: record.assignment.startedAt?.toLocaleString() || "Not Started",
      completedAt: record.assignment.completedAt?.toLocaleString() || "N/A",
      malpracticeCount: record.assignment.malpracticeCount,
      isTerminated: record.assignment.isTerminated ? "Yes" : "No",
    });

    // Highlight terminated students in red
    if (record.assignment.isTerminated) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC7CE" },
        };
      });
    }
    // Highlight completed students in green
    else if (record.assignment.status === "completed") {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC6EFCE" },
        };
      });
    }
  });

  // Add filters to the results sheet
  resultsSheet.autoFilter = {
    from: "A1",
    to: `M${assignments.length + 1}`,
  };

  // Freeze the header row
  resultsSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ============ Malpractice Details Sheet ============
  const malpracticeSheet = workbook.addWorksheet("Malpractice Details");

  malpracticeSheet.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Roll Number", key: "rollNumber", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Branch", key: "branch", width: 12 },
    { header: "Section", key: "section", width: 10 },
    { header: "Event Type", key: "eventType", width: 20 },
    { header: "Details", key: "details", width: 40 },
    { header: "Event Time", key: "eventTime", width: 22 },
    { header: "Total Violations", key: "totalViolations", width: 15 },
    { header: "Terminated", key: "isTerminated", width: 12 },
  ];

  // Style header row
  malpracticeSheet.getRow(1).font = { bold: true };
  malpracticeSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" }, // Dark red for malpractice sheet
  };
  malpracticeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Add malpractice event rows
  allMalpracticeEvents.forEach((record, index) => {
    const row = malpracticeSheet.addRow({
      sno: index + 1,
      rollNumber: record.user.username || "N/A",
      name: record.user.name,
      branch: record.user.branch || "N/A",
      section: record.user.section || "N/A",
      eventType: record.event.type,
      details: record.event.details || "N/A",
      eventTime: record.event.createdAt?.toLocaleString() || "N/A",
      totalViolations: record.assignment.malpracticeCount,
      isTerminated: record.assignment.isTerminated ? "Yes" : "No",
    });

    // Light red background for all malpractice rows
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC7CE" },
      };
    });
  });

  // Add filters to the malpractice sheet
  if (allMalpracticeEvents.length > 0) {
    malpracticeSheet.autoFilter = {
      from: "A1",
      to: `J${allMalpracticeEvents.length + 1}`,
    };
  }

  // Freeze the header row
  malpracticeSheet.views = [{ state: "frozen", ySplit: 1 }];

  // Create exports directory if it doesn't exist
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Generate filename with exam title and timestamp
  const safeTitle = selectedExam.title.replace(/[^a-zA-Z0-9]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${safeTitle}_${timestamp}.xlsx`;
  const filePath = path.join(exportDir, filename);

  // Write to file
  await workbook.xlsx.writeFile(filePath);

  console.log(`✅ Excel file exported successfully!`);
  console.log(`📁 Location: ${filePath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total Participants: ${assignments.length}`);
  console.log(
    `   - Completed: ${assignments.filter((a) => a.assignment.status === "completed").length}`,
  );
  console.log(
    `   - Terminated: ${assignments.filter((a) => a.assignment.isTerminated).length}`,
  );
  console.log(`   - Malpractice Events: ${allMalpracticeEvents.length}`);
}

exportExamData()
  .catch(console.error)
  .finally(() => process.exit(0));
