import { create } from "zustand";
import { checkJetHealth } from "@/actions/student/exams/code-actions";

type Status = "checking" | "online" | "offline";

interface JetState {
  status: Status;
  isOnline: boolean;
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
  _initialized: boolean;
  initialize: () => void;
}

export const useJetStore = create<JetState>((set, get) => ({
  status: "checking",
  isOnline: false,
  lastChecked: null,
  _initialized: false,

  checkHealth: async () => {
    try {
      const res = await checkJetHealth();
      set({
        status: res.success ? "online" : "offline",
        isOnline: res.success,
        lastChecked: new Date(),
      });
    } catch {
      set({
        status: "offline",
        isOnline: false,
        lastChecked: new Date(),
      });
    }
  },

  initialize: () => {
    if (get()._initialized) return;

    set({ _initialized: true });

    get().checkHealth();

    setInterval(() => {
      get().checkHealth();
    }, 30000);
  },
}));
