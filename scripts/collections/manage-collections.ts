import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import {
  collectionQuestions,
  examCollections,
  questionCollections,
} from "../../src/db/schema";
import {
  clearScreen,
  selectCollection,
  selectExam,
  selectProblem,
} from "../lib/ui";

async function main() {
  clearScreen("Question Collections Management");

  while (true) {
    console.log("\n"); // Spacing
    const action = await select({
      message: "Question Collections Management",
      choices: [
        {
          name: "Manage Collections (List/View/Edit)",
          value: "Manage Collections",
        },
        { name: "Create Collection", value: "Create Collection" },
        {
          name: "Add Questions to Collection",
          value: "Add Questions to Collection",
        },
        {
          name: "Link Collection to Exam",
          value: "Link Collection to Exam",
        },
        {
          name: "Remove Questions from Collection",
          value: "Remove Questions from Collection",
        },
        {
          name: "Delete Collection",
          value: "Delete Collection",
        },
        { name: "Exit", value: "Exit" },
      ],
    });

    if (action === "Exit") break;

    try {
      if (action.includes("Manage Collections")) {
        await manageCollections();
      } else if (action.includes("Create Collection")) {
        await createCollection();
      } else if (action.includes("Add Questions to Collection")) {
        await addQuestions();
      } else if (action.includes("Link Collection to Exam")) {
        await linkCollection();
      } else if (action.includes("Remove Questions from Collection")) {
        await removeQuestions();
      } else if (action.includes("Delete Collection")) {
        await deleteCollection();
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }
}

async function manageCollections() {
  const collection = await selectCollection();
  if (!collection) return;

  // View Details
  const items = await db.query.collectionQuestions.findMany({
    where: (cq, { eq }) => eq(cq.collectionId, collection.id),
    with: {
      question: true,
    },
  });

  console.log(`\nCollection: ${collection.title}`);
  console.log(`Description: ${collection.description || "N/A"}`);
  console.log(`Tags: ${collection.tags?.join(", ")}`);
  console.log(`Total Questions: ${items.length}`);
  console.log("Questions:");
  items.forEach((item, idx) => {
    console.log(
      `${idx + 1}. ${item.question.title} [${item.question.difficulty}]`,
    );
  });
}

async function createCollection() {
  const title = await input({ message: "Collection Title:" });
  const description = await input({ message: "Description (optional):" });
  const tagsInput = await input({
    message: "Tags (comma separated, optional):",
  });

  const tags = tagsInput
    ? tagsInput
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const [newCollection] = await db
    .insert(questionCollections)
    .values({
      title,
      description,
      tags,
    })
    .returning();

  console.log("Collection created successfully!");
  console.log("ID:", newCollection.id);
}

async function addQuestions() {
  // 1. Select Collection
  const collection = await selectCollection();
  if (!collection) return;

  console.log(`Selected Collection: ${collection.title}`);

  // Fetch all questions to allow multi-select
  // In a large production app, this might need pagination or a different approach,
  // but for a CLI tool with reasonable dataset, this provides the best UX.
  const allQuestions = await db.query.questions.findMany({
    orderBy: (questions, { asc }) => [asc(questions.title)],
  });

  if (allQuestions.length === 0) {
    console.log("No questions available to add.");
    return;
  }

  // Pre-fetch existing to exclude or mark
  const existingLinks = await db.query.collectionQuestions.findMany({
    where: (cq, { eq }) => eq(cq.collectionId, collection.id),
  });
  const existingIds = new Set(existingLinks.map((l) => l.questionId));

  const questionsToAdd = await checkbox({
    message: "Select questions to add (Space to select, Enter to confirm):",
    choices: allQuestions.map((q) => {
      const isAdded = existingIds.has(q.id);
      return {
        name: `${isAdded ? "[Existing] " : ""}${q.title} [${q.difficulty}]`,
        value: q.id,
        disabled: isAdded ? "Already added" : false,
      };
    }),
    pageSize: 20,
  });

  if (questionsToAdd.length === 0) {
    console.log("No questions selected.");
    return;
  }

  console.log(`Adding ${questionsToAdd.length} questions...`);

  await db.insert(collectionQuestions).values(
    questionsToAdd.map((qid) => ({
      collectionId: collection.id,
      questionId: qid,
    })),
  );

  console.log("✅ Questions added successfully.");
}

async function linkCollection() {
  // 1. Select Exam
  const exam = await selectExam();
  if (!exam) return;

  // 2. Select Collection
  const collection = await selectCollection();
  if (!collection) return;

  // Check unique?
  const existing = await db.query.examCollections.findFirst({
    where: (ec, { and, eq }) =>
      and(eq(ec.examId, exam.id), eq(ec.collectionId, collection.id)),
  });

  if (existing) {
    console.log("⚠️ Collection already linked to this exam.");
    return;
  }

  await db.insert(examCollections).values({
    examId: exam.id,
    collectionId: collection.id,
  });

  console.log(
    `✅ Collection "${collection.title}" linked to exam "${exam.title}".`,
  );
}

async function removeQuestions() {
  // 1. Select Collection
  const collection = await selectCollection();
  if (!collection) return;

  // 2. Fetch existing questions in collection
  const existingQuestions = await db.query.collectionQuestions.findMany({
    where: (cq, { eq }) => eq(cq.collectionId, collection.id),
    with: {
      question: true,
    },
  });

  if (existingQuestions.length === 0) {
    console.log("No questions in this collection.");
    return;
  }

  // 3. Select questions to remove
  const selectedQuestionIds = await checkbox({
    message: "Select questions to remove (Space to select, Enter to confirm):",
    choices: existingQuestions.map((eq) => ({
      name: `${eq.question.title} [${eq.question.difficulty}]`,
      value: eq.questionId,
    })),
    pageSize: 20,
  });

  if (selectedQuestionIds.length === 0) {
    console.log("No questions selected.");
    return;
  }

  const confirmDelete = await confirm({
    message: `Are you sure you want to remove ${selectedQuestionIds.length} questions from "${collection.title}"?`,
    default: false,
  });

  if (confirmDelete) {
    await db
      .delete(collectionQuestions)
      .where(
        and(
          eq(collectionQuestions.collectionId, collection.id),
          inArray(collectionQuestions.questionId, selectedQuestionIds),
        ),
      );
    console.log("✅ Questions removed successfully.");
  }
}

async function deleteCollection() {
  const collection = await selectCollection();
  if (!collection) return;

  const confirmDelete = await confirm({
    message: `Are you sure you want to DELETE collection "${collection.title}"? This will unlink it from all exams and remove all question associations.`,
    default: false,
  });

  if (confirmDelete) {
    await db
      .delete(questionCollections)
      .where(eq(questionCollections.id, collection.id));
    console.log(`✅ Collection "${collection.title}" deleted.`);
  }
}

main().catch(console.error);
