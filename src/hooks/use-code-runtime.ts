"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getRuntimes } from "@/actions/student/exams/code-actions";
import { getPreferredRuntime } from "@/lib/runtime-utils";

export interface Runtime {
  language: string;
  version: string;
}

export function useCodeRuntime() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchRuntimes() {
      const result = await getRuntimes();
      if (!mounted) return;

      setIsLoading(false);

      if (result.success && result.runtimes) {
        setRuntimes(result.runtimes);

        if (result.runtimes.length > 0) {
          // Prefer java if available, otherwise use the first available language
          const defaultRuntime =
            getPreferredRuntime(result.runtimes, "java") ??
            getPreferredRuntime(result.runtimes);

          if (!defaultRuntime) {
            return;
          }

          setSelectedLanguage(defaultRuntime.language);
          setSelectedVersion(defaultRuntime.version);
        }
      } else {
        toast.error(result.error || "Failed to load runtimes");
      }
    }

    fetchRuntimes();
    return () => {
      mounted = false;
    };
  }, []);

  // Update version when language changes
  useEffect(() => {
    const languageRuntimes = runtimes.filter(
      (r) => r.language === selectedLanguage,
    );
    if (languageRuntimes.length > 0) {
      if (!languageRuntimes.find((r) => r.version === selectedVersion)) {
        setSelectedVersion(getPreferredRuntime(languageRuntimes)?.version);
      }
    } else {
      setSelectedVersion(undefined);
    }
  }, [selectedLanguage, selectedVersion, runtimes]);

  return {
    runtimes,
    selectedLanguage,
    setSelectedLanguage,
    selectedVersion,
    setSelectedVersion,
    isLoading,
  };
}
