# Development Journal

## 2025-12-28: Phase 1 & User Seeding

### Phase 1: Core Infrastructure & Database
**Goal**: Establish the foundation for the Secure Coding Exam Platform.

**Completed Actions**:
1.  **UI Setup**:
    - Installed `shadcn/ui` components: `button`, `card`, `dialog`.
    - Replaced `toast` with `sonner` (richer toast notifications).
2.  **Database Schema Implementation**:
    - **Auth**: Extended `user` table in `src/db/schema/auth.ts` with academic fields (`gender`, `branch`, `semester`, `section`, `dob`, `regulation`).
    - **Groups**: Defined `user_groups` and `user_group_members` in `src/db/schema/groups.ts` for batching users.
    - **Exams**: Defined `exams` (including strategy configuration) and `exam_groups` in `src/db/schema/exams.ts`.
    - **Questions**: Defined `questions` and `test_cases` in `src/db/schema/questions.ts`.
    - **Assignments**: Defined `exam_assignments` and `submissions` in `src/db/schema/assignments.ts`.
    - exported all schemas in `src/db/schema/index.ts`.
3.  **Database Synchronization**:
    - Ran `pnpm drizzle-kit push` to apply schema changes to the PostgreSQL database (handling existing auth tables gracefully).

### Phase 2: User Seeding
**Goal**: Populate the database with student data from CSV records.

**Completed Actions**:
1.  **Auth Configuration**:
    - Updated `src/lib/auth.ts` to explicitly accept and persist additional user fields (gender, branch, etc.) using `user.additionalFields`.
2.  **Seeding Script**:
    - Created `scripts/seed-users.ts`.
    - **Logic**:
        - Parses CSV files from `data/users`.
        - Maps CSV columns to user schema.
        - **Password**: Defaults to DOB in `ddMMyyyy` format (e.g., `03082005`).
        - **Email**: Defaults to `RollNo@iare.ac.in`.
        - Uses `p-limit` ensures concurrency control (limit: 10).
3.  **Execution & Verification**:
    - Executed script successfully.
    - **Stats**: Processed 22 CSV files.
    - **Result**: Seeded **1315** unique users.
    - Verified data integrity to ensure no duplicates were created and logic persisted correct counts.

### Phase 2: Admin Tools & Question Seeding
**Goal**: Enable role-based access and populate the question bank.

**Completed Actions**:
1.  **Role-Based Authentication**:
    - Schema: Added `role` column to `user` table (default: "student").
    - Config: Updated `better-auth` config to persist `role`.
2.  **Admin CLI**:
    - Created `scripts/create-user.ts` using `inquirer`.
    - Functionality: Interactive prompt to create Admin/Student users safely via API.
3.  **Question Bank Seeding**:
    - Created `scripts/seed-questions.ts`.
    - **Schema Update**: Added `driverCode` (JSONB) to `questions` table.
    - **Data**: created `data/questions/batch1.json` and `batch2.json` (10 LeetCode Easy questions).
    - **Format**:
        - `driverCode` includes `// region boilerplate` for hidden logical wrapping.
        - `testCases` use raw string inputs (e.g., `"1,2,3\n4"`) for simpler parsing.
    - **Verification**: Seeded 10 questions with 10 test cases each (3 public, 7 hidden).
4.  **Enhanced Admin Tools**:
    - Created `scripts/update-user.ts`: Update name, role, and password (via API).
    - Created `scripts/delete-user.ts`: Permanently delete users.
    - Created `scripts/manage-groups.ts`: Full CRUD for User Groups and Member management.

### Phase 3: Dashboard & Route Security
**Goal**: Implement the user-facing Dashboard, Login flow, and ensure secure access to exam routes.

**Completed Actions**:
1.  **Authentication UI**:
    - Implemented `/auth/sign-in` page using `shadcn/ui` components (Cards, Inputs, Buttons).
    - Integrated `better-auth` client with `zod` schema validation for email/password.
2.  **Dashboard Architecture**:
    - Created `(dashboard)` layout with a persistent Header.
    - Implemented `UserDropdown` with avatar and Sign Out functionality.
3.  **Exam Listing Page**:
    - Built `/exams` page fetching real data from the `exams` table.
    - Added visual status badges (Upcoming, Active, Ended).
4.  **Security & Routing**:
    - **Middleware**: Implemented `src/middleware.ts` to block unauthorized access to `/exams` and `/dashboard`.
    - **API Route**: Added `src/app/api/auth/[...all]/route.ts` to handle auth requests (Fixed 404 error during development).
5.  **Fixes & Polish**:
    - Resolved TypeScript errors in legacy scripts (`seed-users.ts`, `update-user.ts`).
    - Verified full login flow with test user `test@iare.ac.in`.

### Next Steps
- Begin Phase 4: Session Logic & Randomization.
- Implement Onboarding UI & Fullscreen triggers.
- Build the "Randomizer" Engine (Server Actions).

### Phase 4: Session Logic & Randomization
**Goal**: Implement the secure "Start Exam" flow, randomization, and group-specific access control.

**Completed Actions**:
1.  **Group Slots**:
    - **Schema**: Updated `exam_groups` with `start_time` and `end_time` columns.
    - **Logic**: Implemented validation to ensure users can only access exams during their specific group's assigned time slot.
2.  **Server Actions**:
    - Created `initializeExamSession` action.
    - Handles **Idempotency**: Resumes existing sessions if found.
    - Handles **Randomization**: Assigns 3 random questions from the bank to new sessions.
3.  **UI Implementation**:
    - **Onboarding Page**: Created `/exams/[id]/onboarding` displaying rules.
    - **Fullscreen Enforcement**: Implemented logic to require fullscreen before starting the session.
    - **Malpractice Detection**: Created `MalpracticeMonitor` component to detect/alert on Tab Switching, Window Blur, and Fullscreen Exit.
    - **Live Countdown**: Added `ExamCardAction` to the dashboard to show a live countdown for slots opening within 15 minutes.
4.  **Verification Scripts**:
    - `scripts/phase4-seed.ts`: Generates verify exam, group, and users.
    - `scripts/reset-session.ts`: Allows manual deletion of sessions for testing.
    - `scripts/test-group-b.ts`: Moves a user to a restricted future slot for testing access denial.
    - `scripts/test-countdown.ts`: Sets a slot 2 minutes in the future to test the live timer.

### Phase 5: The IDE Interface
**Goal**: Implement the exam IDE with 3-panel layout, code editor, and question navigation.

**Completed Actions**:
1.  **Dependencies**:
    - Installed `react-resizable-panels`, `@uiw/react-codemirror`, `nuqs`, `zustand`, `react-markdown`.
    - Added Shadcn `sidebar` component (`npx shadcn@latest add sidebar`).
2.  **Layout Implementation**:
    - Refactored `IDEShell` to use `SidebarProvider` and `SidebarInset`.
    - Structure: [Collapsible Sidebar] -> [Header] -> [Resizable Problem/Editor].
3.  **Components**:
    - **ExamSidebar**: Replaced basic navigation with Shadcn Sidebar (Collapsible, Mobile-friendly).
    - **ExamHeader**: Refactored to center the clock absolutely and display the exam title on the left.
    - **Code Editor**: `CodePlayground` with `CodeMirror` (Java) persistence.
    - **Problem Viewer**: Renders markdown content.
4.  **State Management**:
    - `exam-store.ts` (Zustand) for code persistence.
    - `nuqs` for URL-based question navigation.


### Phase 6: Console & Code Execution (In Progress)
**Goal**: Implement test case visualization and code execution pipeline.

**Completed Actions**:
1.  **Dependencies**:
    - Added Shadcn `tabs`, `scroll-area`, `textarea` components.
2.  **Components**:
    - Created `src/types/problem.ts` with `TestCase` and `TestcaseResult` types.
    - Created `src/components/exam/test-case-console.tsx` implementing 3-tab console (Test Cases, Results, Custom I/O).
    - Updated `CodePlayground` to integrate console and add Run/Submit buttons.
3.  **Data Flow**:
    - Updated `session/page.tsx` to fetch public test cases (non-hidden) with questions.
    - Updated `Question` type in `ide-shell.tsx` to include `testCases`.

### Next Steps
- Implement backend Server Action for code execution (connect to Turbo Engine).
- Handle submission logic and scoring.
