// diffWords.ts - Word-level diff utility using LCS algorithm

export type WordState = "unchanged" | "added";

export interface DiffWord {
  text: string;
  state: WordState;
}

/**
 * Find Longest Common Subsequence of two word arrays
 */
function findLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m,
    j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Compute word-level diff between old and new text
 * Returns array of words with their state (unchanged or added)
 */
export function diffWords(oldText: string, newText: string): DiffWord[] {
  const oldWords = oldText.split(/\s+/).filter((w) => w);
  const newWords = newText.split(/\s+/).filter((w) => w);

  // If no old text, all words are new
  if (oldWords.length === 0) {
    return newWords.map((text) => ({ text, state: "added" as const }));
  }

  const lcs = findLCS(oldWords, newWords);

  // Track which positions in newWords are part of LCS
  let lcsIdx = 0;
  const lcsPositions = new Set<number>();

  for (let i = 0; i < newWords.length && lcsIdx < lcs.length; i++) {
    if (newWords[i] === lcs[lcsIdx]) {
      lcsPositions.add(i);
      lcsIdx++;
    }
  }

  // Build result
  return newWords.map((text, i) => ({
    text,
    state: lcsPositions.has(i) ? ("unchanged" as const) : ("added" as const),
  }));
}
