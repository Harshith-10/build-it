import { create } from "zustand";
import { checkTurboHealth } from "@/actions/student/exams/code-actions";

type Status = "checking" | "online" | "offline";

interface TurboState {
  status: Status;
  isOnline: boolean;
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
  _initialized: boolean;
  initialize: () => void;
}

export const useTurboStore = create<TurboState>((set, get) => ({
  status: "checking",
  isOnline: false,
  lastChecked: null,
  _initialized: false,

  checkHealth: async () => {
    try {
      const res = await checkTurboHealth();
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
    // Only initialize once
    if (get()._initialized) return;

    set({ _initialized: true });

    // Initial check
    get().checkHealth();

    // Set polling every 30 seconds
    setInterval(() => {
      get().checkHealth();
    }, 30000); // 30 seconds
  },
}));
