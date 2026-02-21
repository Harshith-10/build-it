import { create } from "zustand";

interface ProblemState {
  allowedLanguages: string[];
  driverCodeMap: Record<string, string>;
  setAllowedLanguages: (languages: string[]) => void;
  toggleAllowedLanguage: (language: string) => void;
  setDriverCode: (language: string, code: string) => void;
  setDriverCodeMap: (map: Record<string, string>) => void;
  initialize: (
    allowedLanguages: string[],
    driverCodeMap: Record<string, string>,
  ) => void;
}

const defaultDriverCode = `// Write your driver code here\n// This code will wrap the user's solution\n`;

export const useProblemStore = create<ProblemState>((set) => ({
  allowedLanguages: ["java"],
  driverCodeMap: { java: defaultDriverCode },
  setAllowedLanguages: (languages) => set({ allowedLanguages: languages }),
  toggleAllowedLanguage: (language) =>
    set((state) => {
      const isAllowed = state.allowedLanguages.includes(language);
      const newLanguages = isAllowed
        ? state.allowedLanguages.filter((l) => l !== language)
        : [...state.allowedLanguages, language];

      const newDriverCodeMap = { ...state.driverCodeMap };
      if (!isAllowed && !newDriverCodeMap[language]) {
        newDriverCodeMap[language] = defaultDriverCode;
      }

      return {
        allowedLanguages: newLanguages,
        driverCodeMap: newDriverCodeMap,
      };
    }),
  setDriverCode: (language, code) =>
    set((state) => ({
      driverCodeMap: { ...state.driverCodeMap, [language]: code },
    })),
  setDriverCodeMap: (map) => set({ driverCodeMap: map }),
  initialize: (allowedLanguages, driverCodeMap) =>
    set({ allowedLanguages, driverCodeMap }),
}));
