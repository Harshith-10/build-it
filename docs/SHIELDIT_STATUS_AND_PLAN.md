# ShieldIt Extension Integration - Status & Implementation

> **Branch:** `feature/shieldit-extension`  
> **Target:** `main`  
> **Status:** Up to date with `main`, Option 1 (Dual-Layer) implemented & tested, ready for merge.

---

## 1. Extension Publishing Details
* **Extension Name:** ShieldIt - Exam & Lab Lockdown
* **Official Extension ID:** `opjkppmncihahojoofiohhhlhdjpikfg`
* **Chrome Web Store URL:** `https://chromewebstore.google.com/detail/shieldit-exam-lab-lockdow/opjkppmncihahojoofiohhhlhdjpikfg?authuser=0&hl=en-GB`
* **Restore Bug Fixed:** Removed the blanket fallback scan in `ShieldIt/background.js`. ShieldIt strictly restores **only** extensions that were paused before/during the exam, and never enables extensions that the student had disabled before the exam.
* **Source Code Secret Status:** Production HMAC secret is replaced with `__SHIELDIT_ATTEST_KEY_PLACEHOLDER__` in Git.

---

## 2. Recent Sync with `main`
* **Merged:** `origin/main` (all 23 commits: Analytics, Lab Submissions, Assessments & Tickets, Viva Voce) merged cleanly into `feature/shieldit-extension`.
* **Testing:** `npm run test:shieldit-security` passed 8/8 tests.
* **TypeCheck:** `pnpm exec tsc --noEmit` passed with 0 errors.

---

## 3. Option 1 Dual-Layer Implementation Completed
1. **Database Schema:** Added `requireShieldIt: boolean("require_shieldit").default(true).notNull()` to `src/db/schema/exams.ts` and executed migration on the live database.
2. **Admin & Faculty Forms:** Added toggle switch for "Require ShieldIt Extension Proctoring" in `BasicDetails` form and wired into `examSchema` and `upsertExam`.
3. **Emergency Master Switch:** Added `NEXT_PUBLIC_ENABLE_SHIELDIT` (default `true`) master env circuit-breaker.
4. **Student Flow Integration:**
   - Onboarding (`onboarding-client.tsx` & `use-exam-onboarding.ts`) checks `isShieldItRequired`: if false, bypasses the extension check and allows standard browsers.
   - Exam Session (`ide-shell.tsx` & `session/page.tsx`) checks `isShieldItRequired`: if false, does not lock coding or show the freeze overlay.
   - Server Action (`initializeExamSession` in `exam-actions.ts`) only requires HMAC signature when `isShieldItRequired` is true.
5. **Timeout Bumped:** Increased attestation signature handshake timeout to 4000ms in `shieldit-client.ts`.
6. **Environment Template:** Added `.env.example` documenting all environment variables, and updated `.gitignore` to track `.env.example`.
