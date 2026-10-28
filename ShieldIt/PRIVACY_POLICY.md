# ShieldIt &mdash; Official Privacy Policy

**Institution:** Institute of Aeronautical Engineering (IARE), Dundigal, Hyderabad, India  
**Platform:** BuildIt Assessment Ecosystem ([https://buildit.iare.ac.in](https://buildit.iare.ac.in))  
**Effective Date:** September 2026  
**Web Version (Hosted):** [https://buildit.iare.ac.in/shieldit-privacy.html](https://buildit.iare.ac.in/shieldit-privacy.html)

---

## 1. Overview & Purpose
**ShieldIt** is an academic assessment integrity and lockdown browser extension designed exclusively for students and candidates participating in evaluations, technical assessments, and laboratory challenges conducted at the **Institute of Aeronautical Engineering (IARE)** on the **BuildIt** platform.

ShieldIt operates strictly within the candidate's local browser session during scheduled exams. It does not harvest, profile, monetize, or transmit personal information.

---

## 2. Permissions & Data Access Specification

| Permission | Scope & Purpose | Privacy Safeguard |
| :--- | :--- | :--- |
| **`management`** | Temporarily pauses active third-party extensions (e.g. AI copilots, solvers, translation tools) during active examinations. | Memorizes only extension IDs locally; **automatically restores all extensions** upon exam submission. Never transmits extension lists to external servers. |
| **`tabs`** | Monitors focus loss or tab switching away from the active exam tab. | **Zero browsing history access.** Does NOT collect or inspect browsing history or other tabs' content. |
| **`system.display`** | Checks display count to verify single-screen compliance. | Only queries active display count locally; no device identifiers or serial numbers are collected. |
| **`storage`** | Retains the pre-exam extension snapshot on the local machine (`chrome.storage.local`). | Data remains strictly on the candidate's machine and is cleared upon restoration. |

---

## 3. Data Protection Commitments
* **Zero Personal Data Collection:** No names, roll numbers, credentials, keystroke transcripts, or media feeds are recorded by the extension.
* **No Analytics or Trackers:** Contains zero third-party ads, tracking pixels, or telemetry brokers.
* **No Data Monetization:** Personal data is never sold, leased, or transferred.
* **Cryptographic Scoping:** Operates solely on verified IARE assessment URLs (`https://buildit.iare.ac.in`).

---

## 4. Institutional Governance & Contact
ShieldIt is governed under the **Examination Cell** in coordination with the **Department of Computer Science & Engineering** at the **Institute of Aeronautical Engineering (IARE)**.

* **Institution:** Institute of Aeronautical Engineering (IARE), Dundigal, Hyderabad - 500043, Telangana, India
* **Portal:** [https://buildit.iare.ac.in](https://buildit.iare.ac.in)
* **Inquiries:** `support@iare.ac.in` / `buildit@iare.ac.in`
