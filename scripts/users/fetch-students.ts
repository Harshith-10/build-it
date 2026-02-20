import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";

const CSV_FILE_PATH = path.join(__dirname, "students_data.csv");
// Remember to update this cookie if your session expires!
const COOKIE = "PHPSESSID=<REDACTED>";

// Helper function to safely escape strings for CSV formats
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to pause execution
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchAndAppendData(secid: string): Promise<boolean> {
  console.log(`\nFetching data for secid: ${secid}...`);

  try {
    const response = await fetch(
      "https://samvidha.iare.ac.in/pages/admin/reports/ajax/nominalrolls.php",
      {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Cookie: COOKIE,
        },
        body: `secid=${secid}&action=getstuddetails`,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    const data: Record<string, any>[] = jsonResponse.data;

    if (!data || data.length === 0) {
      console.log(`No student data found for secid ${secid}. Skipping.`);
      return false;
    }

    console.log(
      `Successfully fetched ${data.length} records for secid ${secid}.`,
    );

    const headers = Object.keys(data[0]);
    const fileExists = fs.existsSync(CSV_FILE_PATH);
    const isFileEmpty = fileExists
      ? fs.statSync(CSV_FILE_PATH).size === 0
      : true;

    let csvContent = "";

    if (!fileExists || isFileEmpty) {
      csvContent += `${headers.map(escapeCsvValue).join(",")}\n`;
    }

    for (const row of data) {
      const rowString = headers
        .map((header) => escapeCsvValue(row[header]))
        .join(",");
      csvContent += `${rowString}\n`;
    }

    fs.appendFileSync(CSV_FILE_PATH, csvContent, "utf8");
    console.log(`Appended data successfully to ${CSV_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error(
      `An error occurred while fetching or processing secid ${secid}:`,
      error,
    );
    return false;
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const input = await rl.question(
      "Enter secids separated by commas or ranges (e.g., 150, 151, 1-500): ",
    );

    // Split by comma, trim whitespace
    const parts = input.split(",").map((p) => p.trim());
    const secids: string[] = [];

    for (const part of parts) {
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          for (let i = start; i <= end; i++) {
            secids.push(i.toString());
          }
        }
      } else if (part.length > 0) {
        secids.push(part);
      }
    }

    if (secids.length === 0) {
      console.log("No valid secids provided. Exiting.");
      return;
    }

    console.log(`Queueing ${secids.length} secids for processing...`);

    // Loop through the array sequentially
    for (let i = 0; i < secids.length; i++) {
      const dataFound = await fetchAndAppendData(secids[i]);

      // Add a 500ms delay between requests if it's not the final one AND data was found
      if (i < secids.length - 1 && dataFound) {
        console.log("Waiting 500ms before the next request...");
        await delay(500);
      }
    }

    console.log("\nAll done!");
  } finally {
    rl.close();
  }
}

main();
