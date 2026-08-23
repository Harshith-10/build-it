export const STANDARD_BRANCHES = [
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
  "IT",
  "CSM",
  "CSD",
  "AERO",
] as const;

export type StandardBranch = (typeof STANDARD_BRANCHES)[number];

const BRANCH_MAP: Record<string, StandardBranch> = {
  // CSE variations
  CSE: "CSE",
  "C.S.E.": "CSE",
  "C.S.E": "CSE",
  CS: "CSE",
  "COMPUTER SCIENCE": "CSE",
  "COMPUTER SCIENCE ENGINEERING": "CSE",
  "COMPUTER SCIENCE AND ENGINEERING": "CSE",
  "COMPUTER SCIENCE & ENGINEERING": "CSE",

  // ECE variations
  ECE: "ECE",
  "E.C.E.": "ECE",
  "E.C.E": "ECE",
  "ELECTRONICS AND COMMUNICATION": "ECE",
  "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
  "ELECTRONICS & COMMUNICATION ENGINEERING": "ECE",
  "ELECTRONICS AND COMMUNICATIONS ENGINEERING": "ECE",
  "ELECTRONICS & COMMUNICATIONS ENGINEERING": "ECE",

  // EEE variations
  EEE: "EEE",
  "E.E.E.": "EEE",
  "E.E.E": "EEE",
  "ELECTRICAL AND ELECTRONICS": "EEE",
  "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
  "ELECTRICAL & ELECTRONICS ENGINEERING": "EEE",

  // MECH variations
  MECH: "MECH",
  ME: "MECH",
  "M.E.": "MECH",
  "M.E": "MECH",
  MECHANICAL: "MECH",
  "MECHANICAL ENGINEERING": "MECH",

  // CIVIL variations
  CIVIL: "CIVIL",
  CE: "CIVIL",
  "C.E.": "CIVIL",
  "C.E": "CIVIL",
  "CIVIL ENGINEERING": "CIVIL",

  // IT variations
  IT: "IT",
  "I.T.": "IT",
  "I.T": "IT",
  "INFORMATION TECHNOLOGY": "IT",

  // CSM (AI & ML) variations
  CSM: "CSM",
  AIML: "CSM",
  "AI & ML": "CSM",
  "AI/ML": "CSM",
  "CSE (AI & ML)": "CSM",
  "CSE (AIML)": "CSM",
  "CSE(AI&ML)": "CSM",
  "CSE(AIML)": "CSM",
  "CSE-AIML": "CSM",
  "CSE - AIML": "CSM",
  "COMPUTER SCIENCE AND ENGINEERING (ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING)": "CSM",
  "COMPUTER SCIENCE AND ENGINEERING (AI & ML)": "CSM",
  "COMPUTER SCIENCE AND ENGINEERING (AIML)": "CSM",

  // CSD (Data Science) variations
  CSD: "CSD",
  "DATA SCIENCE": "CSD",
  "CSE (DATA SCIENCE)": "CSD",
  "CSE(DATA SCIENCE)": "CSD",
  "CSE (DS)": "CSD",
  "CSE(DS)": "CSD",
  "CSE-DS": "CSD",
  "CSE - DS": "CSD",
  "COMPUTER SCIENCE AND ENGINEERING (DATA SCIENCE)": "CSD",

  // AERO variations
  AERO: "AERO",
  AE: "AERO",
  "A.E.": "AERO",
  "A.E": "AERO",
  "AERONAUTICAL ENGINEERING": "AERO",
  "AEROSPACE ENGINEERING": "AERO",
};

/**
 * Normalizes a raw branch string (e.g. "Computer Science Engineering") to a standard branch code ("CSE").
 * Returns upper-case trimmed string if no mapping is found.
 */
export function normalizeBranch(input?: string | null): string {
  if (!input) return "CSE";
  const trimmedUpper = input.trim().toUpperCase();
  if (BRANCH_MAP[trimmedUpper]) {
    return BRANCH_MAP[trimmedUpper];
  }
  // Try substring fallback matching
  if (trimmedUpper.includes("COMPUTER SCIENCE") && trimmedUpper.includes("AI")) return "CSM";
  if (trimmedUpper.includes("COMPUTER SCIENCE") && trimmedUpper.includes("DATA")) return "CSD";
  if (trimmedUpper.includes("COMPUTER SCIENCE")) return "CSE";
  if (trimmedUpper.includes("ELECTRONIC")) return "ECE";
  if (trimmedUpper.includes("ELECTRICAL")) return "EEE";
  if (trimmedUpper.includes("MECHANICAL")) return "MECH";
  if (trimmedUpper.includes("CIVIL")) return "CIVIL";
  if (trimmedUpper.includes("INFORMATION")) return "IT";
  if (trimmedUpper.includes("AERO")) return "AERO";

  return trimmedUpper;
}

/**
 * Checks if the branch input is already one of the standard branch codes.
 */
export function isStandardBranch(input?: string | null): boolean {
  if (!input) return false;
  const trimmedUpper = input.trim().toUpperCase();
  return STANDARD_BRANCHES.includes(trimmedUpper as StandardBranch);
}

/**
 * Returns an array of equivalent branch representation strings (including raw and normalized)
 * to ensure database queries match across all string formats.
 */
export function getBranchVariants(input?: string | null): string[] {
  if (!input) return ["CSE"];
  const trimmedUpper = input.trim().toUpperCase();
  const normalized = normalizeBranch(input);

  const variants = new Set<string>();
  variants.add(input.trim());
  variants.add(trimmedUpper);
  variants.add(normalized);

  // Add all aliases matching this normalized branch
  for (const [key, val] of Object.entries(BRANCH_MAP)) {
    if (val === normalized) {
      variants.add(key);
    }
  }

  return Array.from(variants);
}
