import fs from "node:fs";
import path from "node:path";
import select from "@inquirer/select";
import { desc, eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import {
  examAssignments,
  malpracticeEvents,
  submissions,
} from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import { exams } from "@/db/schema/exams";
import { questions } from "@/db/schema/questions";

async function exportAllExamLogs() {
  console.log(
    "📊 Export Complete Exam Logs (Attempts, Malpractice & Submissions)\n",
  );

  // 1. Fetch all exams
  const allExams = await db.select().from(exams).orderBy(desc(exams.createdAt));

  if (allExams.length === 0) {
    console.log("❌ No exams found in the database.");
    return;
  }

  const getStatus = (e: typeof exams.$inferSelect) => {
    const now = new Date();
    if (now < e.startTime) return "upcoming";
    if (now > e.endTime) return "ended";
    return "active";
  };

  const selectedExamId = await select({
    message: "Select an exam to export all logs for:",
    choices: allExams.map((e: any) => ({
      name: `${e.title} (${getStatus(e)}) - ${e.startTime?.toLocaleDateString()}`,
      value: e.id,
    })),
    pageSize: 15,
  });

  const selectedExam = allExams.find((e: any) => e.id === selectedExamId);
  if (!selectedExam) {
    throw new Error("Selected exam not found.");
  }

  console.log(`\n📝 Fetching data for: ${selectedExam.title}...`);

  // 2. Fetch all assignments (exam_assignments) joined with user
  const assignmentsData = await db
    .select({
      assignment: examAssignments,
      user: user,
    })
    .from(examAssignments)
    .innerJoin(user, eq(examAssignments.userId, user.id))
    .where(eq(examAssignments.examId, selectedExamId));

  if (assignmentsData.length === 0) {
    console.log("❌ No student attempts found for this exam.");
    return;
  }

  const assignmentIds = assignmentsData.map((a: any) => a.assignment.id);

  // 3. Fetch all malpractice events (malpractice_events)
  const eventsData = await db
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

  // 4. Fetch all code submissions (submissions) joined with question details
  const submissionsData = await db
    .select({
      submission: submissions,
      question: questions,
      assignment: examAssignments,
      user: user,
    })
    .from(submissions)
    .innerJoin(
      examAssignments,
      eq(submissions.assignmentId, examAssignments.id),
    )
    .innerJoin(user, eq(examAssignments.userId, user.id))
    .innerJoin(questions, eq(submissions.questionId, questions.id))
    .where(inArray(submissions.assignmentId, assignmentIds))
    .orderBy(submissions.createdAt);

  console.log(
    `📋 Found ${assignmentsData.length} overall attempt logs (exam_assignments).`,
  );
  console.log(
    `🚨 Found ${eventsData.length} violation logs (malpractice_events).`,
  );
  console.log(
    `💻 Found ${submissionsData.length} code execution logs (submissions).`,
  );

  // 5. Pre-fetch question metadata to calculate category-wise (Easy/Medium/Hard) marks
  const allAssignedQuestionIds = Array.from(
    new Set(
      assignmentsData.flatMap(
        (a: any) => (a.assignment.assignedQuestionIds as string[]) || [],
      ),
    ),
  );

  const allAssignedQuestions =
    allAssignedQuestionIds.length > 0
      ? await db.query.questions.findMany({
          where: inArray(questions.id, allAssignedQuestionIds),
        })
      : [];

  const questionMap = new Map<string, typeof questions.$inferSelect>();
  for (const q of allAssignedQuestions) {
    questionMap.set(q.id, q);
  }

  const gradingStrategy = selectedExam.gradingStrategy;
  const gradingConfig = selectedExam.gradingConfig as
    | Record<string, number>
    | undefined;

  const getQuestionMarkValue = (q?: typeof questions.$inferSelect): number => {
    if (!q) return 0;
    if (gradingStrategy === "difficulty_based") {
      const difficulty = q.difficulty || "medium";
      if (difficulty === "easy") return gradingConfig?.easyWeight ?? 5;
      if (difficulty === "medium") return gradingConfig?.mediumWeight ?? 10;
      if (difficulty === "hard") return gradingConfig?.hardWeight ?? 20;
    } else if (gradingStrategy === "linear") {
      return gradingConfig?.totalMarks ?? 0;
    } else if (gradingStrategy === "count_based") {
      return 1;
    }
    return 1;
  };

  const submissionsByAssignment = new Map<
    string,
    Array<(typeof submissionsData)[number]>
  >();
  for (const s of submissionsData) {
    const list = submissionsByAssignment.get(s.submission.assignmentId) || [];
    list.push(s);
    submissionsByAssignment.set(s.submission.assignmentId, list);
  }

  let maxEasyCount = 0;
  let maxMediumCount = 0;
  let maxHardCount = 0;

  for (const record of assignmentsData) {
    const assignedQIds =
      (record.assignment.assignedQuestionIds as string[]) || [];
    let eCount = 0;
    let mCount = 0;
    let hCount = 0;
    for (const qId of assignedQIds) {
      const q = questionMap.get(qId);
      const diff = q?.difficulty || "medium";
      if (diff === "easy") eCount++;
      else if (diff === "hard") hCount++;
      else mCount++;
    }
    if (eCount > maxEasyCount) maxEasyCount = eCount;
    if (mCount > maxMediumCount) maxMediumCount = mCount;
    if (hCount > maxHardCount) maxHardCount = hCount;
  }

  let totalExamEasyEarned = 0;
  let totalExamMediumEarned = 0;
  let totalExamHardEarned = 0;

  console.log(`\nCreating Excel file...\n`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildIT Admin";
  workbook.created = new Date();

  // ================= 1. Exam Summary Sheet =================
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Value", key: "value", width: 45 },
  ];
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF333F48" },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // ================= 2. Attempt Logs Sheet (exam_assignments) =================
  const attemptsSheet = workbook.addWorksheet("Attempt Logs");
  const attemptColumns: Array<{ header: string; key: string; width: number }> =
    [
      { header: "Assignment ID", key: "id", width: 36 },
      { header: "Roll Number", key: "rollNumber", width: 18 },
      { header: "Name", key: "name", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Final Score", key: "score", width: 12 },
    ];

  for (let i = 1; i <= maxEasyCount; i++) {
    attemptColumns.push({
      header: `Easy ${i}`,
      key: `easy_${i}`,
      width: 12,
    });
  }
  attemptColumns.push({
    header: "Total Easy Category Marks",
    key: "easyCategoryMarks",
    width: 24,
  });

  for (let i = 1; i <= maxMediumCount; i++) {
    attemptColumns.push({
      header: `Med ${i}`,
      key: `medium_${i}`,
      width: 12,
    });
  }
  attemptColumns.push({
    header: "Total Medium Category Marks",
    key: "mediumCategoryMarks",
    width: 26,
  });

  for (let i = 1; i <= maxHardCount; i++) {
    attemptColumns.push({
      header: `Hard ${i}`,
      key: `hard_${i}`,
      width: 12,
    });
  }
  attemptColumns.push({
    header: "Total Hard Category Marks",
    key: "hardCategoryMarks",
    width: 24,
  });
  attemptColumns.push({
    header: "Total Category Marks",
    key: "totalCategoryMarks",
    width: 24,
  });

  attemptColumns.push(
    { header: "Started At", key: "startedAt", width: 22 },
    { header: "Completed At", key: "completedAt", width: 22 },
    { header: "Malpractice Count", key: "malpracticeCount", width: 18 },
    { header: "Terminated", key: "isTerminated", width: 12 },
  );

  attemptsSheet.columns = attemptColumns;
  attemptsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // Blue
  };
  attemptsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // ================= 3. Category Marks & Malpractice Sheet =================
  const categorySheet = workbook.addWorksheet("Category Marks & Malpractice");
  const categoryColumns: Array<{ header: string; key: string; width: number }> =
    [
      { header: "S.No", key: "sNo", width: 10 },
      { header: "Roll Number", key: "rollNumber", width: 18 },
      { header: "Name", key: "name", width: 25 },
    ];

  for (let i = 1; i <= maxEasyCount; i++) {
    categoryColumns.push({
      header: `Easy ${i}`,
      key: `easy_${i}`,
      width: 12,
    });
  }
  categoryColumns.push({
    header: "Total Easy Category Marks",
    key: "easyCategoryMarks",
    width: 24,
  });

  for (let i = 1; i <= maxMediumCount; i++) {
    categoryColumns.push({
      header: `Med ${i}`,
      key: `medium_${i}`,
      width: 12,
    });
  }
  categoryColumns.push({
    header: "Total Medium Category Marks",
    key: "mediumCategoryMarks",
    width: 26,
  });

  for (let i = 1; i <= maxHardCount; i++) {
    categoryColumns.push({
      header: `Hard ${i}`,
      key: `hard_${i}`,
      width: 12,
    });
  }
  categoryColumns.push({
    header: "Total Hard Category Marks",
    key: "hardCategoryMarks",
    width: 24,
  });
  categoryColumns.push({
    header: "Total Category Marks",
    key: "totalCategoryMarks",
    width: 24,
  });

  categoryColumns.push({
    header: "Malpractice Count",
    key: "malpracticeCount",
    width: 18,
  });

  categorySheet.columns = categoryColumns;
  categorySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7C3AED" }, // Purple
  };
  categorySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (let idx = 0; idx < assignmentsData.length; idx++) {
    const record = assignmentsData[idx];
    const assignedQIds = new Set(
      (record.assignment.assignedQuestionIds as string[]) || [],
    );
    const studentSubs = submissionsByAssignment.get(record.assignment.id) || [];

    const assignedEasyQs: typeof allAssignedQuestions = [];
    const assignedMediumQs: typeof allAssignedQuestions = [];
    const assignedHardQs: typeof allAssignedQuestions = [];

    for (const qId of assignedQIds) {
      const q = questionMap.get(qId);
      if (q) {
        const diff = q.difficulty || "medium";
        if (diff === "easy") assignedEasyQs.push(q);
        else if (diff === "hard") assignedHardQs.push(q);
        else assignedMediumQs.push(q);
      }
    }

    assignedEasyQs.sort((a: any, b: any) => a.title.localeCompare(b.title));
    assignedMediumQs.sort((a: any, b: any) => a.title.localeCompare(b.title));
    assignedHardQs.sort((a: any, b: any) => a.title.localeCompare(b.title));

    const rowData: Record<string, string | number> = {
      id: record.assignment.id,
      rollNumber: record.user.username || "N/A",
      name: record.user.name,
      status: record.assignment.status,
      score: record.assignment.score ?? 0,
      startedAt: record.assignment.startedAt?.toLocaleString() || "Not Started",
      completedAt: record.assignment.completedAt?.toLocaleString() || "N/A",
      malpracticeCount: record.assignment.malpracticeCount,
      isTerminated: record.assignment.isTerminated ? "Yes" : "No",
    };

    const easyScores: number[] = [];
    for (let i = 1; i <= maxEasyCount; i++) {
      const q = assignedEasyQs[i - 1];
      if (!q) {
        rowData[`easy_${i}`] = "-";
      } else {
        const markVal = getQuestionMarkValue(q);
        const qSubs = studentSubs.filter(
          (s) => s.submission.questionId === q.id,
        );
        let ratio = 0;
        if (qSubs.some((s) => s.submission.verdict === "passed")) {
          ratio = 1;
        } else {
          for (const s of qSubs) {
            if (
              s.submission.totalTestCases &&
              s.submission.totalTestCases > 0
            ) {
              const r =
                (s.submission.testCasesPassed ?? 0) /
                s.submission.totalTestCases;
              if (r > ratio) ratio = r;
            }
          }
        }
        const earned = Math.round(ratio * markVal * 100) / 100;
        easyScores.push(earned);
        rowData[`easy_${i}`] = earned;
      }
    }
    const easyCategoryMarks =
      easyScores.length > 0 ? Math.max(...easyScores) : 0;
    rowData.easyCategoryMarks = easyCategoryMarks;

    const mediumScores: number[] = [];
    for (let i = 1; i <= maxMediumCount; i++) {
      const q = assignedMediumQs[i - 1];
      if (!q) {
        rowData[`medium_${i}`] = "-";
      } else {
        const markVal = getQuestionMarkValue(q);
        const qSubs = studentSubs.filter(
          (s) => s.submission.questionId === q.id,
        );
        let ratio = 0;
        if (qSubs.some((s) => s.submission.verdict === "passed")) {
          ratio = 1;
        } else {
          for (const s of qSubs) {
            if (
              s.submission.totalTestCases &&
              s.submission.totalTestCases > 0
            ) {
              const r =
                (s.submission.testCasesPassed ?? 0) /
                s.submission.totalTestCases;
              if (r > ratio) ratio = r;
            }
          }
        }
        const earned = Math.round(ratio * markVal * 100) / 100;
        mediumScores.push(earned);
        rowData[`medium_${i}`] = earned;
      }
    }
    const mediumCategoryMarks =
      mediumScores.length > 0 ? Math.max(...mediumScores) : 0;
    rowData.mediumCategoryMarks = mediumCategoryMarks;

    const hardScores: number[] = [];
    for (let i = 1; i <= maxHardCount; i++) {
      const q = assignedHardQs[i - 1];
      if (!q) {
        rowData[`hard_${i}`] = "-";
      } else {
        const markVal = getQuestionMarkValue(q);
        const qSubs = studentSubs.filter(
          (s) => s.submission.questionId === q.id,
        );
        let ratio = 0;
        if (qSubs.some((s) => s.submission.verdict === "passed")) {
          ratio = 1;
        } else {
          for (const s of qSubs) {
            if (
              s.submission.totalTestCases &&
              s.submission.totalTestCases > 0
            ) {
              const r =
                (s.submission.testCasesPassed ?? 0) /
                s.submission.totalTestCases;
              if (r > ratio) ratio = r;
            }
          }
        }
        const earned = Math.round(ratio * markVal * 100) / 100;
        hardScores.push(earned);
        rowData[`hard_${i}`] = earned;
      }
    }
    const hardCategoryMarks =
      hardScores.length > 0 ? Math.max(...hardScores) : 0;
    rowData.hardCategoryMarks = hardCategoryMarks;

    const totalCategoryMarks =
      Math.round(
        (easyCategoryMarks + mediumCategoryMarks + hardCategoryMarks) * 100,
      ) / 100;
    rowData.totalCategoryMarks = totalCategoryMarks;

    totalExamEasyEarned += easyCategoryMarks;
    totalExamMediumEarned += mediumCategoryMarks;
    totalExamHardEarned += hardCategoryMarks;

    const row = attemptsSheet.addRow(rowData);

    if (record.assignment.isTerminated) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC7CE" },
        };
      });
    }

    categorySheet.addRow({
      ...rowData,
      sNo: idx + 1,
    });
  }

  totalExamEasyEarned = Math.round(totalExamEasyEarned * 100) / 100;
  totalExamMediumEarned = Math.round(totalExamMediumEarned * 100) / 100;
  totalExamHardEarned = Math.round(totalExamHardEarned * 100) / 100;

  summarySheet.addRows([
    { property: "Exam ID", value: selectedExam.id },
    { property: "Title", value: selectedExam.title },
    { property: "Duration (minutes)", value: selectedExam.durationMinutes },
    { property: "Total Participants", value: assignmentsData.length },
    {
      property: "Completed Attempts",
      value: assignmentsData.filter(
        (a: any) => a.assignment.status === "completed",
      ).length,
    },
    {
      property: "Terminated Attempts",
      value: assignmentsData.filter((a: any) => a.assignment.isTerminated)
        .length,
    },
    { property: "Total Malpractice Events", value: eventsData.length },
    { property: "Total Code Submissions", value: submissionsData.length },
    {
      property: "Total Easy Marks Awarded Across All Students",
      value: totalExamEasyEarned,
    },
    {
      property: "Total Medium Marks Awarded Across All Students",
      value: totalExamMediumEarned,
    },
    {
      property: "Total Hard Marks Awarded Across All Students",
      value: totalExamHardEarned,
    },
    { property: "Exported At", value: new Date().toLocaleString() },
  ]);
  attemptsSheet.views = [{ state: "frozen", ySplit: 1 }];
  categorySheet.views = [{ state: "frozen", ySplit: 1 }];

  // ================= 3. Malpractice Logs Sheet (malpractice_events) =================
  const malpracticeSheet = workbook.addWorksheet("Malpractice Logs");
  malpracticeSheet.columns = [
    { header: "Event ID", key: "id", width: 36 },
    { header: "Assignment ID", key: "assignmentId", width: 36 },
    { header: "Roll Number", key: "rollNumber", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Event Type", key: "type", width: 22 },
    { header: "Details", key: "details", width: 45 },
    { header: "Created At", key: "createdAt", width: 22 },
  ];
  malpracticeSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDC2626" }, // Red
  };
  malpracticeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  eventsData.forEach((record: any) => {
    const row = malpracticeSheet.addRow({
      id: record.event.id,
      assignmentId: record.event.assignmentId,
      rollNumber: record.user.username || "N/A",
      name: record.user.name,
      type: record.event.type,
      details: record.event.details || "N/A",
      createdAt: record.event.createdAt?.toLocaleString() || "N/A",
    });
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFE4E6" },
      };
    });
  });
  malpracticeSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ================= 4. Execution Logs Sheet (submissions) =================
  const submissionsSheet = workbook.addWorksheet("Submission Logs");
  submissionsSheet.columns = [
    { header: "Submission ID", key: "id", width: 36 },
    { header: "Roll Number", key: "rollNumber", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Question Title", key: "questionTitle", width: 30 },
    { header: "Difficulty", key: "difficulty", width: 14 },
    { header: "Marks Awarded", key: "marksAwarded", width: 16 },
    { header: "Language", key: "language", width: 15 },
    { header: "Verdict", key: "verdict", width: 18 },
    { header: "Test Cases Passed", key: "testCases", width: 18 },
    { header: "Submitted Code", key: "code", width: 60 },
    { header: "Submitted At", key: "createdAt", width: 22 },
  ];
  submissionsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF059669" }, // Green
  };
  submissionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  submissionsData.forEach((record: any) => {
    const q = record.question;
    const diff = q?.difficulty || "medium";
    const markVal = getQuestionMarkValue(q);
    let ratio = 0;
    if (record.submission.verdict === "passed") {
      ratio = 1;
    } else if (
      record.submission.totalTestCases &&
      record.submission.totalTestCases > 0
    ) {
      ratio =
        (record.submission.testCasesPassed ?? 0) /
        record.submission.totalTestCases;
    }
    const marksAwarded = Math.round(ratio * markVal * 100) / 100;

    const row = submissionsSheet.addRow({
      id: record.submission.id,
      rollNumber: record.user.username || "N/A",
      name: record.user.name,
      questionTitle: record.question.title,
      difficulty: diff.toUpperCase(),
      marksAwarded,
      language: record.submission.language,
      verdict: record.submission.verdict,
      testCases: `${record.submission.testCasesPassed ?? 0} / ${record.submission.totalTestCases ?? 0}`,
      code: record.submission.code,
      createdAt: record.submission.createdAt?.toLocaleString() || "N/A",
    });

    if (record.submission.verdict === "passed") {
      row.getCell("verdict").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD1FAE5" },
      };
    } else {
      row.getCell("verdict").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
    }
  });
  submissionsSheet.views = [{ state: "frozen", ySplit: 1 }];

  // Write Excel file
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const safeTitle = selectedExam.title.replace(/[^a-zA-Z0-9]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${safeTitle}_Full_Logs_${timestamp}.xlsx`;
  const filePath = path.join(exportDir, filename);

  await workbook.xlsx.writeFile(filePath);

  console.log(`✅ Complete Exam Logs exported successfully!`);
  console.log(`📁 File saved at: ${filePath}`);
}

exportAllExamLogs()
  .catch(console.error)
  .finally(() => process.exit(0));
