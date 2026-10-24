/**
 * Vietnamese Text Normalizer
 * Ensures NFC composition, uniform casing, space collapse, and tone consistency.
 */

export function normalizeWord(text: string): string {
  if (!text) return '';
  
  // 1. Unicode NFC normalization
  let normalized = text.normalize('NFC').trim().toLowerCase();

  // 2. Replace multiple spaces / tabs / newlines with single space
  normalized = normalized.replace(/\s+/g, ' ');

  // 3. Remove leading/trailing non-alphanumeric punctuation
  normalized = normalized.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

  return normalized;
}

/**
 * Remove Vietnamese accents / diacritics for unaccented keyboard matching
 * e.g. "cà phê" -> "ca phe", "biển" -> "bien"
 */
export function removeDiacritics(text: string): string {
  if (!text) return '';
  const nfkd = text.normalize('NFKD').toLowerCase();
  const withoutCombining = nfkd.replace(/[\u0300-\u036f]/g, '');
  return withoutCombining.replace(/đ/g, 'd').replace(/Đ/g, 'd');
}

/**
 * Clean query input from user
 */
export function cleanQuery(query: string): string {
  if (!query) return '';
  const cleaned = normalizeWord(query);
  return cleaned;
}

/**
 * Check if a word begins with a specified letter (handling Vietnamese characters like Đ/d, NFC)
 */
export function matchFirstLetter(word: string, letter: string): boolean {
  if (!word || !letter) return false;
  const wNorm = normalizeWord(word);
  const lNorm = letter.normalize('NFC').trim().toLowerCase();
  if (wNorm.startsWith(lNorm)) return true;
  return false;
}

/**
 * Restore unaccented input into a list of candidate hypotheses (with compound words support)
 */
export function restoreUnaccentedHypotheses(
  text: string,
  unaccentedMap?: Record<string, string[]>,
  word2idx?: Map<string, number>,
  graph?: Record<string, Record<string, number>>
): string[] {
  const norm = normalizeWord(text);
  if (!norm) return [];
  if (!unaccentedMap) return [norm];

  // Prioritize exact compound phrase from unaccentedMap (e.g. 'quan su' -> 'quân sự')
  if (unaccentedMap[norm] && unaccentedMap[norm].length > 0) {
    return [norm, ...unaccentedMap[norm].filter((c) => c !== norm)];
  }

  const syllables = norm.split(/\s+/);
  if (syllables.length === 1) {
    const cands = unaccentedMap[syllables[0]];
    return cands && cands.length > 0 ? [norm, ...cands.filter((c) => c !== norm)] : [norm];
  }

  const sylCands = syllables.map((s) => unaccentedMap[s] || [s]);
  let combos = [''];
  for (const cList of sylCands) {
    const next: string[] = [];
    for (const prefix of combos) {
      for (const cand of cList.slice(0, 8)) {
        next.push(prefix ? prefix + ' ' + cand : cand);
      }
    }
    combos = next.slice(0, 40);
  }

  const sorted = combos.sort((a, b) => {
    const aScore = (graph && graph[a] ? 2 : 0) + (word2idx && word2idx.has(a) ? 1 : 0);
    const bScore = (graph && graph[b] ? 2 : 0) + (word2idx && word2idx.has(b) ? 1 : 0);
    return bScore - aScore;
  });

  return [norm, ...sorted.filter((c) => c !== norm).slice(0, 10)];
}
