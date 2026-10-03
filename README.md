# BuildIT — Laboratory & Examination Evaluation Platform

BuildIT is a modern web platform designed for computer science and engineering laboratories, hands-on programming coursework, automated code execution, and structured evaluation.

---

## 🚀 Key Features & Recent Updates (`feature/labs-submissions`)

### 1. 🖥️ Exam-Style Laboratory UI & Workspace
- **Standardized Exam Interface**: Aligned the laboratory workspace directly with the platform's Exam UI for a consistent, distraction-free environment.
- **"End Laboratory" Workflow**: Replaced the generic submit button with a prominent **End Laboratory** action and modal confirmation that clearly warns students if problems remain unsolved.
- **Problem Run & Submit Controls**: Integrated dual **Run** (for sandbox test verification) and **Submit** (for code persistence and evaluation) actions with execution cooldowns.
- **Editor Controls & Reset**: Added code reset with confirmation dialog, custom input testing, and dynamic theme switching.
- **Concise Compilation Diagnostics**: Compilation errors are sanitized to highlight relevant syntax/type errors without exposing internal server stack traces.
- **Workspace Locking & Cache Cleanup**: Automatically saves any pending Viva answers, locks the exercise upon submission, and purges localStorage cache to prevent cross-session code leakage.

---

### 2. 📄 Lab Record & PDF Report Generation
- **A4 Multi-Page Layout**: Formatted for standard A4 printing and export, featuring structured borders, institutional headers, student metadata (Roll No., Branch, Section, Course Code, Faculty), and dynamic page footers (`Page X of Y`).
- **Smart Code Splitting**: Intelligent multi-page code chunking ensures programs with long source code transition smoothly across pages with continuous line numbering and no orphan whitespace.
- **Execution Status Tagging**: Every problem displays an automated execution status tag:
  - 🟢 **`Executed`**: All test cases passed successfully.
  - 🟡 **`Partially Executed`**: At least one test case passed.
  - 🔴 **`Not Executed`**: Program compiled/attempted, but 0 test cases passed or compilation error occurred.
  - ⚪ **`Not Attempted`**: No code submitted for this program.
- **Visible Test Cases**: Sample test case inputs, expected outputs, and actual execution outputs (or friendly compilation errors) are cleanly presented inside the generated work book.
- **Paginated Viva-Voce**: Formatted 2-questions-per-page A4 sheets with sanitized student answers and proper spacing.

---

### 3. 📝 Faculty Award Marks & Grading Workflow
- **Rubric-Based Marking**:
  - **Implementation Marks (Max 12)**: Auto-calculated in real time based on passed problems.
  - **Write-Up (0–4)**: Natural integer inputs for manual evaluation.
  - **Viva-Voce (0–4)**: Natural integer inputs for oral evaluation.
  - **Total Marks (Max 20)**: Composite final grade.
- **Keyboard Navigation**: Pressing `Enter` automatically advances focus from Write-Up to Viva, and from student to student for rapid grading.
- **Local Draft Recovery**: Unsaved marks are stored in local storage and prompt faculty if closing with unsaved changes.
- **Batch Cloud Save**: Save all grades across a section in one click.
- **Reset Section Marks**: Ability to reset awarded marks back to unawarded while preserving code submissions.
- **Download Excel**: Instant section-wide grade exports in spreadsheet format.

---

### 4. 🎓 Student Experience & Results
- **Dynamic Results Dashboard**:
  - Displays **`Evaluation Pending`** until faculty grades Write-Up and Viva-Voce.
  - Unreviewed fields display as **`Not Evaluated`** (in amber) instead of premature `0 / 4`.
  - Once evaluated, transitions to **`Graded`** with composite scores.
- **Submission Protection**: Prevents duplicate submissions and locks workspace once submitted.
- **Cache Management**: Automatic post-submission storage clearing prevents stale code state.

---

### 5. 🔒 Compatibility & Stability
- **Zero Schema Migrations**: Fully backwards-compatible with existing PostgreSQL databases and `origin/main`.
- **Legacy Submissions Support**: Dynamically loads past submissions from `main` without breaking existing student records.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Database / ORM**: PostgreSQL, [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: TailwindCSS, Radix UI primitives, Lucide Icons
- **Code Execution**: Jet Execution Engine
- **Reports**: Native Print-to-PDF engine with custom print CSS

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- pnpm (`corepack enable pnpm`)
- PostgreSQL instance

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Harshith-10/build-it.git
   cd build-it
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env` file based on `.env.example`:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/buildit
   BETTER_AUTH_SECRET=your_auth_secret
   ```

4. Run the development server:
   ```bash
   pnpm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.
