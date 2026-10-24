import type { CalibrationPoint, RankingConfig, SearchResult, VocabItem } from './types';
import { calibrateScore, computeSoftmax } from './calibrate';
import { normalizeWord, removeDiacritics } from './normalize';

export const DEFAULT_CONFIG: RankingConfig = {
  alpha: 0.65,
  beta: 0.35,
  gamma: 0.1,
  delta: 0.05,
  temperature: 0.85,
  useCSLS: true,
  kNeighbors: 10,
};

export interface SearchContext {
  vocab: VocabItem[];
  word2idx: Map<string, number>;
  vectors: Float32Array; // Flattened N x DIM matrix
  dim: number;
  nWords: number;
  hubScores: Float32Array; // N elements
  logFreqsNorm: Float32Array; // N elements
  variants: Record<string, string[]>;
  blocklist: Set<string>;
  calibrationAnchors: CalibrationPoint[];
  graph?: Record<string, Record<string, number>>;
  unaccentedMap?: Record<string, string[]>;
}

export function resolveQueryWord(query: string, ctx: SearchContext): string {
  const qNorm = normalizeWord(query);
  const { graph, word2idx, unaccentedMap } = ctx;

  // 1. If already has graph associations, keep it
  if (graph && graph[qNorm] && Object.keys(graph[qNorm]).length > 0) {
    return qNorm;
  }

  // 2. Check unaccented map
  if (unaccentedMap) {
    const unacc = removeDiacritics(qNorm);
    const candidates = unaccentedMap[unacc];
    if (candidates && candidates.length > 0) {
      // Prioritize candidate with graph associations
      const withGraph = candidates.find((c) => graph && graph[c] && Object.keys(graph[c]).length > 0);
      if (withGraph) return withGraph;

      // Prioritize candidate present in word2idx
      const inVocab = candidates.find((c) => word2idx.has(c));
      if (inVocab) return inVocab;

      return candidates[0];
    }
  }

  return qNorm;
}

/**
 * Perform hybrid semantic association search:
 * 1. Association Knowledge Graph (RelatedWords / ConceptNet method)
 * 2. CSLS Vector dot product
 * 3. Frequency & diversity filtering
 */
export function rankCandidates(
  query: string,
  queryVec: Float32Array,
  ctx: SearchContext,
  config: RankingConfig = DEFAULT_CONFIG,
  topK = 5
): SearchResult[] {
  const { vocab, vectors, dim, nWords, hubScores, logFreqsNorm, variants, blocklist, calibrationAnchors, graph } = ctx;
  const qNorm = resolveQueryWord(query, ctx);

  // 1. Gather Knowledge Graph association scores for query
  const graphWeights = new Map<string, number>();
  if (graph) {
    // Exact query relations
    if (graph[qNorm]) {
      for (const [target, score] of Object.entries(graph[qNorm])) {
        graphWeights.set(normalizeWord(target), score);
      }
    }
    // Sub-phrase relations for compound words (e.g. "học sinh" -> "học", "sinh")
    const tokens = qNorm.split(' ');
    if (tokens.length > 1) {
      for (const token of tokens) {
        if (graph[token]) {
          for (const [target, score] of Object.entries(graph[token])) {
            const tNorm = normalizeWord(target);
            const current = graphWeights.get(tNorm) || 0;
            graphWeights.set(tNorm, Math.max(current, score * 0.7));
          }
        }
      }
    }
  }

  // 2. Dot product with all candidates: cos_i = queryVec . candVec_i
  const rawCosines = new Float32Array(nWords);
  for (let i = 0; i < nWords; i++) {
    let dot = 0.0;
    const offset = i * dim;
    for (let d = 0; d < dim; d++) {
      dot += queryVec[d] * vectors[offset + d];
    }
    rawCosines[i] = dot;
  }

  // 3. Compute r_q (mean of top-k cosines for query)
  let r_q = 0.0;
  if (config.useCSLS) {
    const k = config.kNeighbors;
    const topCos = Array.from(rawCosines).sort((a, b) => b - a).slice(1, k + 1);
    r_q = topCos.length > 0 ? topCos.reduce((a, b) => a + b, 0) / topCos.length : 0.0;
  }

  // 4. Combined scoring
  const scores = new Float32Array(nWords);
  const qVariants = new Set<string>(variants[qNorm] || []);
  qVariants.add(qNorm);

  for (let i = 0; i < nWords; i++) {
    const w = vocab[i].w;

    // Filter query itself or exact variant
    if (qVariants.has(w) || w === qNorm || blocklist.has(w)) {
      scores[i] = -9999.0;
      continue;
    }

    // Do not show candidate if it trivially is identical root causing repetitive loop
    if (w.length > 3 && qNorm.length > 3 && (w === qNorm || w.startsWith(qNorm + ' ') || qNorm.startsWith(w + ' '))) {
      scores[i] = -9999.0;
      continue;
    }

    const cos = rawCosines[i];
    let vecScore = cos;
    if (config.useCSLS) {
      vecScore = 2.0 * cos - hubScores[i] - r_q;
    }

    // Knowledge graph association boost
    const gScore = graphWeights.get(w) || 0;

    // Hybrid formula:
    // If graph association exists: strong primary weight
    // Vector score provides fine-grained contextual alignment
    let finalScore = 0.0;
    if (gScore > 0) {
      finalScore = 0.65 * gScore + 0.25 * vecScore + 0.05 * logFreqsNorm[i];
    } else {
      finalScore = 0.50 * vecScore + 0.05 * logFreqsNorm[i];
    }

    scores[i] = finalScore;
  }

  // 5. Candidate collection & sorting
  const candidateIndices: number[] = [];
  for (let i = 0; i < nWords; i++) {
    if (scores[i] > -100.0) {
      candidateIndices.push(i);
    }
  }

  candidateIndices.sort((a, b) => scores[b] - scores[a]);

  // 6. Deduplicate variants & select topK
  const finalCandidates: number[] = [];
  const selectedWords = new Set<string>();
  const selectedRoots = new Set<string>();

  for (const idx of candidateIndices) {
    const w = vocab[idx].w;
    
    // Check if variant already selected
    const itemVariants = variants[w] || [];
    const hasVariantSelected = itemVariants.some((v) => selectedWords.has(v));
    if (hasVariantSelected || selectedWords.has(w)) {
      continue;
    }

    // Root deduplication (e.g. avoid 'con mèo' if 'mèo' is already selected)
    const words = w.split(' ');
    const mainWord = words[words.length - 1];
    if (words.length > 1 && selectedRoots.has(mainWord)) {
      continue;
    }

    finalCandidates.push(idx);
    selectedWords.add(w);
    if (words.length > 1) {
      selectedRoots.add(mainWord);
    }

    if (finalCandidates.length >= topK) {
      break;
    }
  }

  // 7. Softmax probabilities
  const topForSoftmax = candidateIndices.slice(0, 30).map((idx) => scores[idx]);
  const softmaxProbs = computeSoftmax(topForSoftmax, config.temperature);

  // 8. Assemble results
  const results: SearchResult[] = finalCandidates.map((idx, rankIdx) => {
    const w = vocab[idx].w;
    const rawScore = scores[idx];
    const similarity = calibrateScore(rawScore, calibrationAnchors);
    const prob = rankIdx < softmaxProbs.length ? softmaxProbs[rankIdx] : 0.01;

    return {
      rank: rankIdx + 1,
      word: w,
      similarity,
      rawScore: Math.round(rawScore * 1000) / 1000,
      probability: Math.round(prob * 1000) / 1000,
      isApprox: false,
    };
  });

  return results;
}
