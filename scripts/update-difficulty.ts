import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { questions } from "../src/db/schema";

const DATA_DIR = path.join(process.cwd(), "data/leetcode");

const EASY_PROBLEMS = [
  "Two Sum",
  "Valid Parentheses",
  "Merge Two Sorted Lists",
  "Best Time to Buy and Sell Stock",
  "Valid Palindrome",
  "Invert Binary Tree",
  "Valid Anagram",
  "Binary Search",
  "Flood Fill",
  "Lowest Common Ancestor of a BST",
  "Balanced Binary Tree",
  "Linked List Cycle",
  "Implement Queue using Stacks",
  "First Bad Version",
  "Ransom Note",
  "Climbing Stairs",
  "Longest Palindrome",
  "Reverse Linked List",
  "Majority Element",
  "Add Binary",
  "Diameter of Binary Tree",
  "Middle of the Linked List",
  "Maximum Depth of Binary Tree",
  "Contains Duplicate",
  "Missing Number",
  "Same Tree",
  "Number of 1 Bits",
  "Longest Common Prefix",
  "Single Number",
  "Palindrome Number",
];

const MEDIUM_PROBLEMS = [
  "Group Anagrams",
  "Top K Frequent Elements",
  "Product of Array Except Self",
  "Valid Sudoku",
  "Longest Consecutive Sequence",
  "3Sum",
  "Container With Most Water",
  "Longest Substring Without Repeating Characters",
  "Permutation in String",
  "Rotate Image",
  "Spiral Matrix",
  "Set Matrix Zeroes",
  "Search a 2D Matrix",
  "Koko Eating Bananas",
  "Find Minimum in Rotated Sorted Array",
  "Search in Rotated Sorted Array",
  "Remove Nth Node From End of List",
  "Reorder List",
  "Add Two Numbers",
  "Daily Temperatures",
];

async function updateDifficulty() {
  console.log("🛠️ Starting Difficulty Update & JSON Cleanup...");

  // 1. Update Database
  console.log("\n📦 Updating Database Difficulties...");
  let dbUpdates = 0;

  // Since we already normalized titles in DB, we can match directly
  for (const title of EASY_PROBLEMS) {
    const res = await db
      .update(questions)
      .set({ difficulty: "easy" })
      .where(eq(questions.title, title))
      .returning();
    if (res.length > 0) dbUpdates++;
  }

  for (const title of MEDIUM_PROBLEMS) {
    const res = await db
      .update(questions)
      .set({ difficulty: "medium" })
      .where(eq(questions.title, title))
      .returning();
    if (res.length > 0) dbUpdates++;
  }

  console.log(`Updated ${dbUpdates} questions in DB.`);

  // 2. Update JSON Files
  console.log("\n📄 Updating JSON Seed Files...");
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json") && file.startsWith("batch_"));

  let totalJsonUpdates = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const problems = JSON.parse(content);
    let fileModified = false;

    problems.forEach((p: any) => {
      // 1. Clean Title (remove numbering if exists)
      const titleMatch = p.title.match(/^\d+\.\s+(.*)$/);
      let cleanTitle = p.title;
      if (titleMatch) {
        cleanTitle = titleMatch[1];
        p.title = cleanTitle; // Update title in JSON
        fileModified = true;
      }

      // 2. Set Difficulty based on Clean Title
      let difficulty = "medium"; // Default
      if (EASY_PROBLEMS.includes(cleanTitle)) {
        difficulty = "easy";
      } else if (MEDIUM_PROBLEMS.includes(cleanTitle)) {
        difficulty = "medium";
      }

      // Update/Add difficulty field
      if (p.difficulty !== difficulty) {
        p.difficulty = difficulty;
        fileModified = true;
      }
    });

    if (fileModified) {
      fs.writeFileSync(filePath, JSON.stringify(problems, null, 2));
      console.log(`  Updated ${file}`);
      totalJsonUpdates++;
    }
  }

  console.log(`\n✅ Update Complete!`);
  console.log(`Files Modified: ${totalJsonUpdates}`);
  process.exit(0);
}

updateDifficulty().catch((err) => {
  console.error("❌ Update failed:", err);
  process.exit(1);
});
