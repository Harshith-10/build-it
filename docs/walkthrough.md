# Phase 7: Submission & Scoring Logic

I have successfully implemented Phase 7, focusing on the submission pipeline, grading logic, and scoring system.

## Key Changes

### 1. **Submission Server Action**
Implemented `submitQuestion` in `src/lib/actions/submit-actions.ts`:
- **Workflow**:
    1.  Validates user session and assignment status.
    2.  Fetches **hidden** test cases for the question.
    3.  Executes student code using the Turbo Engine.
    4.  Determines verdict (`passed`, `failed`, `compile_error`, `runtime_error`).
    5.  Records the submission in the database.
    6.  Calculates the new score based on the **20-40-50 rule**.
    7.  Updates the exam assignment score if improved.
    8.  Revalidates the exam session page.

### 2. **Scoring Algorithm**
The scoring logic counts the number of unique questions with at least one `passed` submission:
- **1 Question Solved**: 20 points
- **2 Questions Solved**: 40 points
- **3 Questions Solved**: 50 points
- **Monotonic Property**: Since we query all historical passed submissions, a subsequent failed attempt does not reduce the score.

### 3. **UI Integration**
- **CodePlayground**:
    - Wired up the "Submit" button to the `submitQuestion` action.
    - Displays detailed toast notifications for different verdicts (Correct, Wrong Answer, Compilation Error, Runtime Error).
    - Handles loading states during submission.
- **ExamSidebar**:
    - Visual feedback: Questions are now marked with a **Green Checkmark** when completed.
    - This state is derived from the server-side fetch of passed submissions.
- **ProblemViewer**:
    - Introduced a **Tabbed Interface** (Description / Submissions).
    - Lists submission history with verdicts and timestamps.
    - Added **Restore Code** functionality to retrieve previous versions.
    - **Refined Layout**: Implemented correct scrolling for descriptions and submissions, preventing overflow issues. Code previews now support horizontal scrolling using `grid` layout constraints.
- **IDEShell**:
    - Enforced `h-screen` and `overflow-hidden` constraints to ensure proper viewport containment and scrolling.
- **Session Page**:
    - Fetches the list of passed questions and passes it down to the sidebar.
    - passes `assignmentId` to the IDE components.

## Verification

### Automated Checks
- Verified database schema supports `submissions` and `exam_assignments` updates.
- Verified `submitQuestion` logic handles edge cases (no hidden test cases, compilation errors).

### User Flow
1.  **Coding**: Student writes code in the editor.
2.  **Running**: "Run" button tests against visible test cases (Phase 6).
3.  **Submitting**: "Submit" button runs against hidden test cases (Phase 7).
4.  **Feedback**:
    - If passed: Toast appears "Correct Answer!", Sidebar icon turns green.
    - If failed: Toast appears "Wrong Answer" with passed/total count.
5.  **Scoring**: The score in the database updates automatically.
6.  **Finishing**:
    - Click **End Exam**.
    - Confirm dialog.
    - Redirects to **Results Page** showing Final Score and Time Taken.

### Browser Verification
I performed a comprehensive browser-based verification using the Antigravity subagent:
1.  **Login**: Authenticated as `p4user1@iare.ac.in`.
2.  **Exam Entry**: Successfully entered the exam session for "Phase 4 Verification Exam".
3.  **Code Execution**:
    - Wrote a failing solution (`System.out.println(999)`).
    - Verified the "Run" button showed 0/3 test cases passed.
    - Verified the "Submit" button processed the request and displayed the failure status in the UI logic.
4.  **Result**: The backend correctly compiled, executed, and graded the submission against hidden test cases.

![Exam Submission Flow](/home/harshu/.gemini/antigravity/brain/aa708bb8-8dcc-449b-ae98-d745dfacddaf/exam_submission_flow_1766929930421.webp)

#### End Exam Verification
I also verified the "End Exam" flow:
1.  Clicked **End Exam**.
2.  Verified redirection to `/exams/[id]/results`.
3.  Confirmed the Results Page displays the correct score and navigation links.

![Results Page](/home/harshu/.gemini/antigravity/brain/aa708bb8-8dcc-449b-ae98-d745dfacddaf/.system_generated/click_feedback/click_feedback_1766932441477.png)

### Scoring Verification (Perfect Score)
To validate the **"20-40-50"** scoring rule, I simulated a perfect exam session:
1.  **User**: `p4user2@iare.ac.in` (Fresh session).
2.  **Action**: Solved all 3 assigned questions (Palindrome Number, Plus One, Sqrt(x)) with correct Java solutions.
3.  **Result**:
    - All 3 questions marked as "Completed".
    - Final Score: **50/50**.
    - Questions Solved: **3/3**.

![Perfect Score Result](/home/harshu/.gemini/antigravity/brain/aa708bb8-8dcc-449b-ae98-d745dfacddaf/exam_results_page_1766933206888.png)

### Scoring Verification (40 Marks Test)
As per specific request, I verified the **40-point** scoring tier (2 questions solved):
1.  **User**: `p4user3@iare.ac.in` (Fresh session).
2.  **Action**: Solved exactly 2 assigned questions, skipped the 3rd.
3.  **Result**:
    - Final Score: **40/50**.
    - Questions Solved: **2/3**.

![40 Marks Result](/home/harshu/.gemini/antigravity/brain/aa708bb8-8dcc-449b-ae98-d745dfacddaf/exam_results_40_50_1766933514126.png)

### Anti-Cheat Verification (Smart Paste)
I verified the **Smart Paste Protection** using a new exam session (`Phase 8 Anti-Cheat Exam`):
1.  **External Paste**: Copied text "Banned Content" from external source. Attempted Paste.
    - **Result**: Editor content did **NOT** change. Paste was blocked.
2.  **Internal Paste**: Typed "Allowed", selected it, copied, and pasted.
    - **Result**: Editor content updated to "AllowedAllowed". Internal paste works.

![External Paste Blocked](/home/harshu/.gemini/antigravity/brain/aa708bb8-8dcc-449b-ae98-d745dfacddaf/external_paste_test_1766934500998.png)

### Security Features Verification
- **Rate Limiting**: Verified that the "Run" button enters a **5-second cooldown** state after clicking, preventing spam.
    - Button text changes to "Run (5s)", "Run (4s)"... and is disabled.
- **Auto-Submit**: Implemented auto-submission logic in `ExamHeader`.
    - When timer hits 0, `submitExam(true)` is called, skipping user confirmation.
- **Malpractice Terms**:
    - **Limit**: 3 Strikes.
    - **Actions**: Tab Switch, Fullscreen Exit, External Paste.
    - **Penalty**: Immediate Termination, Score 0.
    - **Status**: Implemented. Ready for manual verification.

### UX Improvements
- **Submission Confirmation**: Replaced browser `confirm()` with custom `AlertDialog` to prevent "Focus Loss" malpractice trigger.
- **Run Experience**: Added `isRunning` loading state to console and cleared previous results immediately on run to prevent stale data.

## Next Steps
- Phase 8 Complete.
- Ready for Final User Verification.
