import { config } from "dotenv";
import { executeCode, getPackages, type TurboTestCase } from "../src/lib/turbo";

// Load environment variables
config();

async function verifyPythonExecution() {
  console.log("Starting Python Verification...");
  console.log(`API URL: ${process.env.TURBO_API_BASE_URL}`);

  try {
    console.log("Checking available packages...");
    const packages = await getPackages();
    console.log("Available Packages:", JSON.stringify(packages, null, 2));
  } catch (err) {
    console.error("Failed to fetch packages:", err);
  }

  const code = `
import sys

def main():
    # Read all input from stdin
    input_data = sys.stdin.read()
    # Print it back with a prefix
    print(f"Echo: {input_data.strip()}")

if __name__ == "__main__":
    main()
`;

  const testCases: TurboTestCase[] = [
    {
      id: "tc1",
      input: "Hello World",
      expected_output: "Echo: Hello World",
    },
    {
      id: "tc2",
      input: "Python Rockz",
      expected_output: "Echo: Python Rockz",
    },
  ];

  try {
    console.log("Executing Python code with testcases...");
    const result = await executeCode(
      code,
      "python",
      testCases,
      undefined,
      "3.14.2",
    );

    console.log("Execution Result:", JSON.stringify(result, null, 2));

    if (result.run && result.run.status !== "SUCCESS") {
      console.error("Run failed:", result.run.status);
      console.error("Stderr:", result.run.stderr);
    }

    if (result.compile && result.compile.status !== "SUCCESS") {
      console.error("Compile failed:", result.compile.status);
      console.error("Stderr:", result.compile.stderr);
    }

    if (!result.testcases) {
      console.error("❌ No testcases returned in result.");
      return;
    }

    const allPassed = result.testcases.every((tc) => tc.passed);
    if (allPassed) {
      console.log("✅ Verification SUCCESS: All test cases passed.");
    } else {
      console.error("❌ Verification FAILED: Some test cases failed.");
      result.testcases.forEach((tc) => {
        if (!tc.passed) {
          console.log(
            `Failed TC ${tc.id}: Expected '${tc.expected_output}', Got '${tc.actual_output}'`,
          );
        }
      });
    }
  } catch (error) {
    console.error("❌ Verification FAILED with exception:", error);
  }
}

verifyPythonExecution();
