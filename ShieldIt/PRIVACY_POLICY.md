# ShieldIt &mdash; Privacy Policy

**Platform:** BuildIt Educational Assessment Ecosystem  
**Effective Date:** September 2026  
**Web Version:** Hosted at `/shieldit-privacy.html`

---

## 1. Overview & Purpose
**ShieldIt** is an academic assessment integrity and lockdown browser extension designed for candidates taking exams, technical quizzes, and coding assessments on the **BuildIt** platform.

ShieldIt operates strictly within the candidate's local browser session during scheduled exams. It does not harvest, profile, or monetize personal information.

---

## 2. Permissions & Data Access

| Permission | Scope & Purpose | Privacy Safeguard |
| :--- | :--- | :--- |
| **`management`** | Temporarily pauses active third-party extensions (AI copilots, solvers, translation tools) during active exams. | Memorizes only extension IDs locally; automatically restores all extensions on exam submit. Never transmits extension lists to external servers. |
| **`tabs`** | Monitors focus loss or tab switching away from the active exam. | Does NOT collect browsing history or inspect other open tabs' contents. |
| **`system.display`** | Checks display count to verify single-screen compliance. | Only queries display count locally; no device identifiers are recorded. |
| **`storage`** | Stores the pre-exam extension snapshot on the local machine. | Data remains strictly inside `chrome.storage.local` on the student's machine. |

---

## 3. Data Protection Commitments
* **Zero Personal Data Collection:** No names, passwords, keystroke logs, or camera/audio feeds are recorded by the extension.
* **No Analytics or Trackers:** Contains zero third-party ads, tracking pixels, or data brokers.
* **No Monetization:** Data is never sold, shared, or rented.

---

## 4. Contact
For questions or inquiries regarding ShieldIt privacy compliance, contact the BuildIt administrator or examination coordinator.
