"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getRuntimes } from "@/actions/student/exams/code-actions";

export interface Runtime {
  language: string;
  version: string;
}

export function useCodeRuntime() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("java");
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

        // Auto-select version for default language (java)
        const javaRuntime = result.runtimes.find((r) => r.language === "java");
        if (javaRuntime) {
          setSelectedVersion(javaRuntime.version);
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
        setSelectedVersion(languageRuntimes[0].version);
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
