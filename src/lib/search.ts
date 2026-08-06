import type { Tool } from "../components/Sidebar";

export interface Feature {
  icon: any;
  title: string;
  tag: string;
  tool: Tool;
  sub?: string;
  keywords: string;
}

export interface Section {
  label: string;
  icon: any;
  features: Feature[];
}

export interface ScoredFeature extends Feature {
  score: number;
}

export interface ScoredSection {
  label: string;
  icon: any;
  features: ScoredFeature[];
}

/**
 * Calculates the Damerau-Levenshtein distance between two strings.
 * Measure of edits (insertions, deletions, substitutions, transpositions)
 * required to change string `a` to string `b`.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Create (aLen + 2) x (bLen + 2) matrix
  const d: number[][] = Array.from({ length: aLen + 2 }, () => new Array(bLen + 2).fill(0));

  const maxDist = aLen + bLen;
  d[0][0] = maxDist;

  for (let i = 0; i <= aLen; i++) {
    d[i + 1][1] = i;
    d[i + 1][0] = maxDist;
  }
  for (let j = 0; j <= bLen; j++) {
    d[1][j + 1] = j;
    d[0][j + 1] = maxDist;
  }

  const da: { [char: string]: number } = {};

  for (let i = 1; i <= aLen; i++) {
    let db = 0;
    const aChar = a[i - 1];
    for (let j = 1; j <= bLen; j++) {
      const bChar = b[j - 1];
      const k = da[bChar] || 0;
      const l = db;

      let cost = 0;
      if (aChar === bChar) {
        cost = 0;
        db = j;
      } else {
        cost = 1;
      }

      d[i + 1][j + 1] = Math.min(
        d[i][j] + cost, // substitution
        d[i + 1][j] + 1, // insertion
        d[i][j + 1] + 1, // deletion
        d[k][l] + (i - k - 1) + 1 + (j - l - 1) // transposition
      );
    }
    da[aChar] = i;
  }

  return d[aLen + 1][bLen + 1];
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_/\.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(str: string): string[] {
  return normalizeString(str).split(" ").filter((t) => t.length > 0);
}

function stripWhitespace(str: string): string {
  return str.toLowerCase().replace(/[\s-_/\.,]/g, "");
}

/**
 * Calculates a match score for a feature against a query string.
 * Returns 0 if there is no match.
 */
export function scoreFeature(feature: Feature, query: string): number {
  const cleanQuery = normalizeString(query);
  if (!cleanQuery) return 0;

  const queryTokens = getTokens(query);
  const strippedQuery = stripWhitespace(query);

  const strippedTitle = stripWhitespace(feature.title);
  const titleTokens = getTokens(feature.title);

  const strippedTag = stripWhitespace(feature.tag);
  const tagTokens = getTokens(feature.tag);

  const strippedKeywords = stripWhitespace(feature.keywords);
  const keywordsTokens = getTokens(feature.keywords);

  let score = 0;

  // 1. Exact full match or substring match on stripped (space-insensitive) title
  if (strippedTitle === strippedQuery) {
    score += 1000;
  } else if (strippedTitle.includes(strippedQuery)) {
    score += 500;
  }

  // 2. Exact match in tag
  if (strippedTag === strippedQuery) {
    score += 300;
  }

  // 3. Token-by-token scoring
  for (const qToken of queryTokens) {
    let bestTokenScore = 0;

    // Check Title tokens
    for (const tToken of titleTokens) {
      if (tToken === qToken) {
        bestTokenScore = Math.max(bestTokenScore, 200);
      } else if (tToken.startsWith(qToken)) {
        bestTokenScore = Math.max(bestTokenScore, 100);
      } else if (tToken.includes(qToken)) {
        bestTokenScore = Math.max(bestTokenScore, 50);
      } else {
        // Fuzzy match on title tokens
        const distance = damerauLevenshtein(qToken, tToken);
        const maxLen = Math.max(qToken.length, tToken.length);
        const similarity = 1 - distance / maxLen;

        let maxAllowedDistance = 0;
        if (qToken.length >= 6) {
          maxAllowedDistance = 2;
        } else if (qToken.length >= 3) {
          maxAllowedDistance = 1;
        }

        if (distance <= maxAllowedDistance && similarity >= 0.6) {
          bestTokenScore = Math.max(bestTokenScore, Math.round(150 * similarity));
        }
      }
    }

    // Check Tag tokens
    for (const tgToken of tagTokens) {
      if (tgToken === qToken) {
        bestTokenScore = Math.max(bestTokenScore, 80);
      } else if (tgToken.startsWith(qToken)) {
        bestTokenScore = Math.max(bestTokenScore, 40);
      } else {
        // Fuzzy match on tag tokens
        const distance = damerauLevenshtein(qToken, tgToken);
        const maxLen = Math.max(qToken.length, tgToken.length);
        const similarity = 1 - distance / maxLen;

        let maxAllowedDistance = 0;
        if (qToken.length >= 6) {
          maxAllowedDistance = 2;
        } else if (qToken.length >= 3) {
          maxAllowedDistance = 1;
        }

        if (distance <= maxAllowedDistance && similarity >= 0.6) {
          bestTokenScore = Math.max(bestTokenScore, Math.round(60 * similarity));
        }
      }
    }

    // Check Keywords tokens
    for (const kwToken of keywordsTokens) {
      if (kwToken === qToken) {
        bestTokenScore = Math.max(bestTokenScore, 40);
      } else if (kwToken.startsWith(qToken)) {
        bestTokenScore = Math.max(bestTokenScore, 20);
      } else {
        // Fuzzy match on keyword tokens
        const distance = damerauLevenshtein(qToken, kwToken);
        const maxLen = Math.max(qToken.length, kwToken.length);
        const similarity = 1 - distance / maxLen;

        let maxAllowedDistance = 0;
        if (qToken.length >= 6) {
          maxAllowedDistance = 2;
        } else if (qToken.length >= 3) {
          maxAllowedDistance = 1;
        }

        if (distance <= maxAllowedDistance && similarity >= 0.6) {
          bestTokenScore = Math.max(bestTokenScore, Math.round(30 * similarity));
        }
      }
    }

    // Check if the query token is contained anywhere in the stripped fields
    if (bestTokenScore === 0) {
      if (strippedTitle.includes(qToken)) {
        bestTokenScore = 50;
      } else if (strippedTag.includes(qToken)) {
        bestTokenScore = 25;
      } else if (strippedKeywords.includes(qToken)) {
        bestTokenScore = 15;
      }
    }

    score += bestTokenScore;
  }

  return score;
}

/**
 * Searches sections of tools and returns filtered and ranked sections.
 */
export function searchFeatures(query: string, sectionsList: Section[]): ScoredSection[] {
  if (!query.trim()) {
    return sectionsList.map((section) => ({
      ...section,
      features: section.features.map((f) => ({ ...f, score: 0 })),
    }));
  }

  const scoredSections: ScoredSection[] = [];

  for (const section of sectionsList) {
    const scoredFeatures: ScoredFeature[] = [];

    for (const feature of section.features) {
      const score = scoreFeature(feature, query);
      if (score > 0) {
        scoredFeatures.push({
          ...feature,
          score,
        });
      }
    }

    if (scoredFeatures.length > 0) {
      // Sort features inside the section by score descending
      scoredFeatures.sort((a, b) => b.score - a.score);
      scoredSections.push({
        ...section,
        features: scoredFeatures,
      });
    }
  }

  // Sort sections by the highest feature score in each section descending
  scoredSections.sort((a, b) => {
    const maxA = Math.max(...a.features.map((f) => f.score));
    const maxB = Math.max(...b.features.map((f) => f.score));
    return maxB - maxA;
  });

  return scoredSections;
}
