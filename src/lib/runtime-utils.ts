export interface RuntimeOption {
  language: string;
  version: string;
}

const PRE_RELEASE_RANK: Record<string, number> = {
  rc: 5,
  beta: 4,
  b: 4,
  alpha: 3,
  a: 3,
  preview: 2,
  pre: 2,
  dev: 1,
};

function splitVersion(version: string): {
  core: number[];
  suffix: string;
} {
  const trimmed = version.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)*)(.*)$/);

  if (!match) {
    return {
      core: [],
      suffix: trimmed,
    };
  }

  return {
    core: match[1].split(".").map((part) => Number.parseInt(part, 10)),
    suffix: match[2].replace(/^[._+-]+/, "").trim(),
  };
}

function tokenizePreRelease(suffix: string): string[] {
  return suffix.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
}

function comparePreReleaseDesc(aSuffix: string, bSuffix: string): number {
  const aTokens = tokenizePreRelease(aSuffix);
  const bTokens = tokenizePreRelease(bSuffix);
  const maxLength = Math.max(aTokens.length, bTokens.length);

  for (let i = 0; i < maxLength; i++) {
    const aToken = aTokens[i];
    const bToken = bTokens[i];

    if (aToken === bToken) {
      continue;
    }

    if (aToken === undefined) {
      return 1;
    }

    if (bToken === undefined) {
      return -1;
    }

    const aIsNumber = /^\d+$/.test(aToken);
    const bIsNumber = /^\d+$/.test(bToken);

    if (aIsNumber && bIsNumber) {
      return Number.parseInt(bToken, 10) - Number.parseInt(aToken, 10);
    }

    if (!aIsNumber && !bIsNumber) {
      const aRank = PRE_RELEASE_RANK[aToken] ?? 0;
      const bRank = PRE_RELEASE_RANK[bToken] ?? 0;

      if (aRank !== bRank) {
        return bRank - aRank;
      }

      return bToken.localeCompare(aToken);
    }

    return aIsNumber ? 1 : -1;
  }

  return 0;
}

export function isStableVersion(version: string): boolean {
  return splitVersion(version).suffix.length === 0;
}

export function compareVersionsDesc(a: string, b: string): number {
  const aVersion = splitVersion(a);
  const bVersion = splitVersion(b);
  const maxLength = Math.max(aVersion.core.length, bVersion.core.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aVersion.core[i] ?? 0;
    const bPart = bVersion.core[i] ?? 0;

    if (aPart !== bPart) {
      return bPart - aPart;
    }
  }

  if (aVersion.suffix.length === 0 && bVersion.suffix.length > 0) {
    return -1;
  }

  if (aVersion.suffix.length > 0 && bVersion.suffix.length === 0) {
    return 1;
  }

  return comparePreReleaseDesc(aVersion.suffix, bVersion.suffix);
}

export function sortRuntimes<T extends RuntimeOption>(runtimes: T[]): T[] {
  return runtimes.slice().sort((a, b) => {
    const languageComparison = a.language.localeCompare(b.language);
    if (languageComparison !== 0) {
      return languageComparison;
    }

    return compareVersionsDesc(a.version, b.version);
  });
}

export function getPreferredRuntime<T extends RuntimeOption>(
  runtimes: T[],
  language?: string,
): T | undefined {
  const candidates = sortRuntimes(
    language
      ? runtimes.filter((runtime) => runtime.language === language)
      : runtimes,
  );

  return (
    candidates.find((runtime) => isStableVersion(runtime.version)) ??
    candidates[0]
  );
}
