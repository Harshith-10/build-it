import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMarkdown(text?: string | null): string {
  if (!text) return "";
  
  // 1. Replace escaped newlines (e.g. \\n) with actual newlines
  let formatted = text.replaceAll('\\n', '\n');

  // 2. Replace common LaTeX math constructs with clean unicode
  formatted = formatted
    .replaceAll('\\le', '≤')
    .replaceAll('\\leq', '≤')
    .replaceAll('\\ge', '≥')
    .replaceAll('\\geq', '≥')
    .replaceAll('\\times', '×')
    .replaceAll('\\dots', '…')
    .replaceAll('\\ne', '≠')
    .replaceAll('\\neq', '≠')
    .replaceAll('\\approx', '≈')
    .replaceAll('\\pm', '±')
    .replaceAll('\\cdot', '·')
    .replaceAll('\\in', '∈')
    .replaceAll('\\notin', '∉');

  // 3. Remove standard LaTeX $ delimiters around formulas
  formatted = formatted.replace(/\$([^\$]+)\$/g, '$1');

  return formatted;
}
