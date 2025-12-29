import search from "@inquirer/search";
import { ilike, or } from "drizzle-orm";
import { db } from "../../src/db";
import { user } from "../../src/db/schema/auth";
import { exams } from "../../src/db/schema/exams";
import { userGroups } from "../../src/db/schema/groups";
import { questionCollections } from "../../src/db/schema/question-collections";
import { questions } from "../../src/db/schema/questions";

// Helper to clear screen and show banner
export function clearScreen(title?: string) {
  console.clear();
  if (title) {
    console.log("\n" + "=".repeat(50));
    console.log(`  ${title}`);
    console.log("=".repeat(50) + "\n");
  }
}

// Generic search select helper
export async function searchSelect<T>(
  message: string,
  fetcher: (term: string) => Promise<T[]>,
  mapper: (item: T) => { name: string; value: any; description?: string },
): Promise<any> {
  // Inquirer Search Prompt
  return search({
    message,
    source: async (term) => {
      const items = await fetcher(term || "");
      return items.map(mapper);
    },
  });
}

// Specific Selectors

export async function selectUser() {
  return searchSelect(
    "Select a User:",
    async (term) => {
      if (!term) return db.query.user.findMany({ limit: 10 });
      return db.query.user.findMany({
        where: or(
          ilike(user.name, `%${term}%`),
          ilike(user.email, `%${term}%`),
        ),
        limit: 20,
      });
    },
    (u) => ({
      name: `${u.name} (${u.email})`,
      value: u,
      description: `Role: ${u.role} | ID: ${u.id}`,
    }),
  );
}

export async function selectExam() {
  return searchSelect(
    "Select an Exam:",
    async (term) => {
      if (!term) return db.query.exams.findMany({ limit: 10 });
      return db.query.exams.findMany({
        where: ilike(exams.title, `%${term}%`),
        limit: 20,
      });
    },
    (e) => ({
      name: e.title,
      value: e,
      description: `Status: ${e.status} | ID: ${e.id}`,
    }),
  );
}

export async function selectProblem() {
  return searchSelect(
    "Select a Problem:",
    async (term) => {
      if (!term) return db.query.questions.findMany({ limit: 10 });
      return db.query.questions.findMany({
        where: ilike(questions.title, `%${term}%`),
        limit: 20,
      });
    },
    (q) => ({
      name: `${q.title} [${q.difficulty}]`,
      value: q,
      description: `ID: ${q.id}`,
    }),
  );
}

export async function selectGroup() {
  return searchSelect(
    "Select a Group:",
    async (term) => {
      if (!term) return db.query.userGroups.findMany({ limit: 10 });
      return db.query.userGroups.findMany({
        where: ilike(userGroups.name, `%${term}%`),
        limit: 20,
      });
    },
    (g) => ({
      name: g.name,
      value: g,
      description: `ID: ${g.id}`,
    }),
  );
}

export async function selectCollection() {
  return searchSelect(
    "Select a Collection:",
    async (term) => {
      if (!term) return db.query.questionCollections.findMany({ limit: 10 });
      return db.query.questionCollections.findMany({
        where: ilike(questionCollections.title, `%${term}%`),
        limit: 20,
      });
    },
    (c) => ({
      name: c.title,
      value: c,
      description: `ID: ${c.id}`,
    }),
  );
}
