import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import { eq } from "drizzle-orm";
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

  while (true) {
    // 2. Find Questions
    const problem = await selectProblem();
    if (!problem) break;

    // Confirm Add
    const isConfirmed = await confirm({
      message: `Add "${problem.title}" to collection "${collection.title}"?`,
      default: true,
    });

    if (isConfirmed) {
      // Check if exists
      const existing = await db.query.collectionQuestions.findFirst({
        where: (cq, { and, eq }) =>
          and(
            eq(cq.collectionId, collection.id),
            eq(cq.questionId, problem.id),
          ),
      });

      if (existing) {
        console.log("⚠️ Question already in collection.");
      } else {
        await db.insert(collectionQuestions).values({
          collectionId: collection.id,
          questionId: problem.id,
        });
        console.log("✅ Added.");
      }
    }

    const addMore = await confirm({
      message: "Add another question?",
      default: true,
    });

    if (!addMore) break;
  }
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

main().catch(console.error);
