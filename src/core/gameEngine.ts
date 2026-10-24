import type { CourierDeduction, FriendDeduction, GameEvaluationResult, SearchResult } from './types';
import type { SearchContext } from './ranking';
import { calibrateScore, computeSoftmax } from './calibrate';
import { matchFirstLetter, normalizeWord, restoreUnaccentedHypotheses } from './normalize';
import { resolveQueryWord } from './ranking';

export interface GameMission {
  id: string;
  secretWord: string;
  firstLetter: string;
  category: string;
  hint: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Thách thức';
}

export const PRESET_MISSIONS: GameMission[] = [
  {
    id: 'm1',
    secretWord: 'cà phê',
    firstLetter: 'C',
    category: 'Thức uống',
    hint: 'Thức uống màu nâu đắng, giúp khởi đầu ngày mới tỉnh táo.',
    difficulty: 'Dễ',
  },
  {
    id: 'm2',
    secretWord: 'kho báu',
    firstLetter: 'K',
    category: 'Kho tàng',
    hint: 'Rương chứa vàng ngọc của thuyền trưởng hải tặc chôn giấu.',
    difficulty: 'Dễ',
  },
  {
    id: 'm3',
    secretWord: 'mặt trời',
    firstLetter: 'M',
    category: 'Vũ trụ & Thiên nhiên',
    hint: 'Ngôi sao rực rỡ ban phát ánh sáng và sự sống vào ban ngày.',
    difficulty: 'Dễ',
  },
  {
    id: 'm4',
    secretWord: 'hoa hồng',
    firstLetter: 'H',
    category: 'Thực vật',
    hint: 'Nữ hoàng của các loài hoa với cánh thơm quyến rũ và thân có gai.',
    difficulty: 'Dễ',
  },
  {
    id: 'm5',
    secretWord: 'tàu ngầm',
    firstLetter: 'T',
    category: 'Phương tiện quân sự',
    hint: 'Phương tiện bí mật di chuyển dưới đáy đại dương sâu thẳm.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm6',
    secretWord: 'vương miện',
    firstLetter: 'V',
    category: 'Bảo vật',
    hint: 'Mũ quý đính đầy đá quý biểu trưng cho quyền lực tối cao của hoàng gia.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm7',
    secretWord: 'đồng hồ',
    firstLetter: 'Đ',
    category: 'Đồ vật đời sống',
    hint: 'Vật dụng đo đếm từng giây từng phút trôi qua của cuộc đời.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm8',
    secretWord: 'kim cương',
    firstLetter: 'K',
    category: 'Đá quý',
    hint: 'Khoáng vật lấp lánh cứng nhất hành tinh, biểu tượng của sự vĩnh cửu.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm9',
    secretWord: 'bác sĩ',
    firstLetter: 'B',
    category: 'Nghề nghiệp',
    hint: 'Người mặc áo blouse trắng chữa lành vết thương và cứu sống bệnh nhân.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm10',
    secretWord: 'ngân hàng',
    firstLetter: 'N',
    category: 'Tài chính',
    hint: 'Nơi cất giữ tiền tệ và két sắt an toàn hàng đầu thế giới.',
    difficulty: 'Trung bình',
  },
  {
    id: 'm11',
    secretWord: 'bánh mì',
    firstLetter: 'B',
    category: 'Ẩm thực Việt Nam',
    hint: 'Món ăn đường phố kẹp thịt giòn rụm vang danh khắp năm châu.',
    difficulty: 'Dễ',
  },
  {
    id: 'm12',
    secretWord: 'sư tử',
    firstLetter: 'S',
    category: 'Động vật hoang dã',
    hint: 'Chúa sơn lâm bờm vàng dũng mãnh ngự trị thảo nguyên châu Phi.',
    difficulty: 'Thách thức',
  },
  {
    id: 'm13',
    secretWord: 'ngọn hải đăng',
    firstLetter: 'N',
    category: 'Công trình hàng hải',
    hint: 'Tháp đèn kiên cường soi đường cho tàu thuyền cập bến trong đêm giông bão.',
    difficulty: 'Thách thức',
  },
  {
    id: 'm14',
    secretWord: 'bình minh',
    firstLetter: 'B',
    category: 'Thời khắc',
    hint: 'Khoảnh khắc rực rỡ khi tia nắng đầu tiên ló dạng ở chân trời phía đông.',
    difficulty: 'Thách thức',
  },
  {
    id: 'm15',
    secretWord: 'người tuyết',
    firstLetter: 'N',
    category: 'Mùa đông',
    hint: 'Hình nộm tròn xoe đội mũ len mũi cà rốt trong mùa đông lạnh giá.',
    difficulty: 'Thách thức',
  },
];

/**
 * Get normalized vector for a word (using word2idx, syllables fallback, or unaccented map)
 */
export function getVectorForWord(word: string, ctx: SearchContext): Float32Array {
  const { word2idx, vectors, dim } = ctx;
  const resolved = resolveQueryWord(word, ctx);
  const out = new Float32Array(dim);

  if (word2idx.has(resolved)) {
    const idx = word2idx.get(resolved)!;
    out.set(vectors.subarray(idx * dim, (idx + 1) * dim));
    return out;
  }

  // Compound syllables fallback
  const syllables = resolved.split(' ');
  const validSyllables: Float32Array[] = [];
  for (const s of syllables) {
    if (word2idx.has(s)) {
      const idx = word2idx.get(s)!;
      validSyllables.push(vectors.subarray(idx * dim, (idx + 1) * dim));
    }
  }

  if (validSyllables.length > 0) {
    for (const v of validSyllables) {
      for (let d = 0; d < dim; d++) out[d] += v[d];
    }
    let norm = 0.0;
    for (let d = 0; d < dim; d++) norm += out[d] * out[d];
    norm = Math.sqrt(norm);
    if (norm > 1e-6) {
      for (let d = 0; d < dim; d++) out[d] /= norm;
    }
    return out;
  }

  // Fallback non-zero vector
  let norm = 0.0;
  for (let d = 0; d < dim; d++) {
    out[d] = Math.sin(word.charCodeAt(d % word.length) + d);
    norm += out[d] * out[d];
  }
  norm = Math.sqrt(norm);
  if (norm > 1e-6) {
    for (let d = 0; d < dim; d++) out[d] /= norm;
  }
  return out;
}

export function softmin(vals: number[], beta = 3.0): number {
  if (vals.length === 0) return 0;
  let sumExp = 0;
  for (let i = 0; i < vals.length; i++) {
    sumExp += Math.exp(-beta * vals[i]);
  }
  const avgExp = sumExp / vals.length;
  return -Math.log(Math.max(avgExp, 1e-12)) / beta;
}

export function isTargetMatch(word: string, target: string, ctx: SearchContext): boolean {
  if (word === target) return true;
  if (ctx.variants?.[word]?.includes(target)) return true;
  if (ctx.variants?.[target]?.includes(word)) return true;
  return false;
}

// Set of bound syllables & functional particles that cannot be secret treasure words by themselves (N7)
export const BOUND_SYLLABLES = new Set([
  'cà', 'kho', 'mặt', 'hoa', 'tàu', 'vương', 'đồng', 'bác', 'ngân', 'bánh', 'sư', 'ngọn', 'bình', 'người',
  'bản', 'cơ', 'thể', 'tính', 'học', 'những', 'các', 'thì', 'mà', 'là', 'bị', 'được', 'do', 'với', 'cho',
  'về', 'trong', 'ngoài', 'tại', 'ở', 'từ', 'lại', 'qua', 'ra', 'vào', 'lên', 'xuống', 'rất', 'quá', 'lắm',
  'ấy', 'này', 'kia', 'nọ', 'đâu', 'đó', 'sao', 'ai', 'gì', 'nào'
]);

/**
 * Robust graph association resolution:
 * Resolves direct and reverse edges, plus sub-phrase token relations for compound clues (N3)
 */
export function getClueGraphScore(
  hyp: string,
  candidate: string,
  graph?: Record<string, Record<string, number>>
): number {
  if (!graph) return 0;
  let direct = graph[hyp]?.[candidate] || 0;
  let reverse = graph[candidate]?.[hyp] || 0;

  // Clue sub-token (e.g. 'thức uống' -> 'uống', 'khám bệnh' -> 'khám')
  const hypTokens = hyp.split(/\s+/);
  if (hypTokens.length > 1) {
    for (const token of hypTokens) {
      if (token.length > 1) {
        const d = graph[token]?.[candidate] || 0;
        const r = graph[candidate]?.[token] || 0;
        if (d * 0.85 > direct) direct = d * 0.85;
        if (r * 0.85 > reverse) reverse = r * 0.85;
      }
    }
  }

  // Reverse compound neighbor on candidate (e.g. 'đồng hồ' has 'kim giây' -> matches 'kim')
  if (reverse === 0 && graph[candidate]) {
    for (const [neighbor, weight] of Object.entries(graph[candidate])) {
      if (neighbor.startsWith(hyp + ' ') || neighbor.endsWith(' ' + hyp)) {
        reverse = Math.max(reverse, weight * 0.9);
      }
    }
  }

  return Math.max(direct, reverse);
}

/**
 * Courier deduction:
 * The courier knows ONLY the public first letter + their single clue letter.
 * Each courier produces strictly ONE single foremost deduction.
 */
export function deduceCourier(
  firstLetter: string,
  clue: string,
  secretWord: string,
  ctx: SearchContext
): CourierDeduction {
  const sNorm = normalizeWord(secretWord);
  const { vocab, vectors, dim, nWords, graph, unaccentedMap, word2idx, hubScores, calibrationAnchors } = ctx;

  // Restore hypotheses for unaccented keyboard input
  const hypotheses = restoreUnaccentedHypotheses(clue, unaccentedMap, word2idx, graph);
  const clueVecs = hypotheses.map((h) => ({ h, vec: getVectorForWord(h, ctx) }));
  const clueTokens = new Set(clue.toLowerCase().trim().split(/\s+/));
  const maxLogFreq = Math.log1p(2223);

  const candidates: { word: string; score: number }[] = [];

  for (let i = 0; i < nWords; i++) {
    const w = vocab[i].w;
    if (hypotheses.includes(w)) continue;

    if (!matchFirstLetter(w, firstLetter)) {
      continue;
    }

    // Filter out bound morphemes / function particles (N7)
    if (BOUND_SYLLABLES.has(w)) continue;

    // Reject long idioms / 4+ syllables
    const syllables = w.split(' ').length;
    if (syllables > 3) continue;

    // Whitelist T1/T2: reject T3 obscure low-frequency words unless in graph (N2)
    const freq = vocab[i].freq || 1;
    const hasGraph = graph?.[w] && Object.keys(graph[w]).length > 0;
    if (freq < 45 && !hasGraph) continue;

    const off = i * dim;
    const hub = hubScores ? hubScores[i] : 0.0;
    const deg = graph?.[w] ? Object.keys(graph[w]).length : 0;
    const degNorm = 1.0 / Math.log(2 + Math.min(deg, 100));

    let bestAffinity = -999;
    for (const hyp of clueVecs) {
      let dot = 0.0;
      for (let j = 0; j < dim; j++) {
        dot += hyp.vec[j] * vectors[off + j];
      }
      // N1: Capped hubness penalty to avoid favoring rare isolated words
      dot -= 0.12 * hub;

      const gRaw = getClueGraphScore(hyp.h, w, graph);
      const gNorm = gRaw * degNorm * 1.4;

      const aff = dot + 1.2 * gNorm;
      if (aff > bestAffinity) {
        bestAffinity = aff;
      }
    }

    // Familiarity feature (N2): log frequency normalized bonus
    const fam = Math.log1p(freq) / maxLogFreq;
    const famBonus = 0.08 * fam;

    // Echo penalty: avoid echo collocations (e.g. clue 'vàng' -> 'khố vàng')
    let echoPenalty = 0.0;
    const wTokens = w.split(/\s+/);
    for (const t of wTokens) {
      if (clueTokens.has(t) && w !== clue) {
        echoPenalty = 0.25;
        break;
      }
    }

    // Syllable length prior
    const lenBonus = syllables === 2 ? 0.15 : (syllables === 1 ? 0.08 : 0.02);
    const score = Math.max(bestAffinity, 0.0) + famBonus + lenBonus - echoPenalty;

    candidates.push({ word: w, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Each courier guesses ONLY 1 single word
  const topSlice = candidates.slice(0, 1);
  const topRawScores = topSlice.map((c) => c.score);
  const probabilities = computeSoftmax(topRawScores, 0.85);

  const inferredWords: SearchResult[] = topSlice.map((c, idx) => ({
    rank: idx + 1,
    word: c.word,
    similarity: calibrateScore(c.score, calibrationAnchors),
    rawScore: c.score,
    probability: probabilities[idx] ?? 1.0,
  }));

  // Target rank among all candidates
  const targetIndex = candidates.findIndex((c) => isTargetMatch(c.word, sNorm, ctx));
  const targetRank = targetIndex >= 0 ? targetIndex + 1 : undefined;

  // Courier leaks if their single guess (#1 rank) is the secret word
  const leaked = targetRank === 1;

  // Confidence assessment (N5)
  const top1Raw = topRawScores[0] ?? 0;
  const top2Raw = candidates[1]?.score ?? 0;
  const margin = top1Raw - top2Raw;
  const confidence: 'Cao' | 'Trung bình' | 'Thấp' =
    top1Raw >= 0.70 && margin >= 0.08 ? 'Cao' : top1Raw >= 0.40 ? 'Trung bình' : 'Thấp';

  return {
    courierIndex: 1, // Will be overridden by caller
    clue,
    inferredWords,
    leaked,
    targetRank,
    confidence,
  };
}

/**
 * Friend deduction:
 * The friend receives ALL THREE letters + the public first letter.
 * Evaluates candidate using continuous multi-cue softmin & degree-normalized synergy.
 * Produces strictly ONE single foremost deduction.
 */
export function deduceFriend(
  firstLetter: string,
  clues: [string, string, string],
  secretWord: string,
  ctx: SearchContext
): FriendDeduction {
  const sNorm = normalizeWord(secretWord);
  const { vocab, vectors, dim, nWords, graph, unaccentedMap, word2idx, hubScores, calibrationAnchors } = ctx;

  // Restore hypotheses for each of the 3 clues
  const clueHypotheses = clues.map((c) => restoreUnaccentedHypotheses(c, unaccentedMap, word2idx, graph));
  const clueVecs = clueHypotheses.map((hypList) => hypList.map((h) => ({ h, vec: getVectorForWord(h, ctx) })));

  const allHypothesesSet = new Set<string>();
  clueHypotheses.forEach((list) => list.forEach((h) => allHypothesesSet.add(h)));
  const maxLogFreq = Math.log1p(2223);

  const candidates: { word: string; score: number }[] = [];

  for (let i = 0; i < nWords; i++) {
    const w = vocab[i].w;
    if (allHypothesesSet.has(w)) continue;

    if (!matchFirstLetter(w, firstLetter)) {
      continue;
    }

    // Filter out bound morphemes / function particles (N7)
    if (BOUND_SYLLABLES.has(w)) continue;

    // Reject long idioms / 4+ syllables
    const syllables = w.split(' ').length;
    if (syllables > 3) continue;

    // Whitelist T1/T2: reject T3 obscure low-frequency words unless in graph (N2)
    const freq = vocab[i].freq || 1;
    const hasGraph = graph?.[w] && Object.keys(graph[w]).length > 0;
    if (freq < 45 && !hasGraph) continue;

    const off = i * dim;
    const hub = hubScores ? hubScores[i] : 0.0;
    const deg = graph?.[w] ? Object.keys(graph[w]).length : 0;
    const degNorm = 1.0 / Math.log(2 + Math.min(deg, 100));

    const s = [0.0, 0.0, 0.0];
    const g = [0.0, 0.0, 0.0];

    for (let c = 0; c < 3; c++) {
      let bestAffinity = -999;
      let bestG = 0.0;

      for (const hyp of clueVecs[c]) {
        let dot = 0.0;
        for (let j = 0; j < dim; j++) {
          dot += hyp.vec[j] * vectors[off + j];
        }
        // N1: Capped hubness penalty
        dot -= 0.12 * hub;

        const gRaw = getClueGraphScore(hyp.h, w, graph);
        const gNorm = gRaw * degNorm * 1.4;

        const aff = dot + 1.2 * gNorm;
        if (aff > bestAffinity) {
          bestAffinity = aff;
          bestG = gNorm;
        }
      }

      s[c] = Math.max(bestAffinity, 0.0);
      g[c] = bestG;
    }

    const avgS = (s[0] + s[1] + s[2]) / 3;
    const sMin = softmin(s, 3.0);

    // Continuous pairwise and triple synergy (No binary cliffs)
    const gPair = g[0] * g[1] + g[1] * g[2] + g[0] * g[2];
    const gTriple = g[0] * g[1] * g[2];
    const synergy = 1.2 * gPair + 3.0 * gTriple;

    // Familiarity feature (N2): log frequency normalized bonus
    const fam = Math.log1p(freq) / maxLogFreq;
    const famBonus = 0.08 * fam;

    const lenBonus = syllables === 2 ? 0.15 : (syllables === 1 ? 0.08 : 0.02);
    const score = avgS + 1.2 * sMin + synergy + famBonus + lenBonus;

    candidates.push({ word: w, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Friend guesses ONLY 1 single word
  const topSlice = candidates.slice(0, 1);
  const topRawScores = topSlice.map((c) => c.score);
  const probabilities = computeSoftmax(topRawScores, 0.85);

  const inferredWords: SearchResult[] = topSlice.map((c, idx) => ({
    rank: idx + 1,
    word: c.word,
    similarity: calibrateScore(c.score, calibrationAnchors),
    rawScore: c.score,
    probability: probabilities[idx] ?? 1.0,
  }));

  const targetIndex = candidates.findIndex((c) => isTargetMatch(c.word, sNorm, ctx));
  const targetRank = targetIndex >= 0 ? targetIndex + 1 : undefined;

  // Friend succeeds only if their single guess (#1 rank) is the secret word
  const success = targetRank === 1;

  // Confidence assessment (N5)
  const top1Raw = topRawScores[0] ?? 0;
  const top2Raw = candidates[1]?.score ?? 0;
  const margin = top1Raw - top2Raw;
  const confidence: 'Cao' | 'Trung bình' | 'Thấp' =
    top1Raw >= 0.70 && margin >= 0.08 ? 'Cao' : top1Raw >= 0.40 ? 'Trung bình' : 'Thấp';

  return {
    clues,
    inferredWords,
    success,
    targetRank,
    confidence,
  };
}

/**
 * Evaluate the entire game of 3 Secret Letters:
 */
export function evaluateGame(
  secretWord: string,
  firstLetter: string,
  clues: [string, string, string],
  ctx: SearchContext
): GameEvaluationResult {
  const c1 = deduceCourier(firstLetter, clues[0], secretWord, ctx);
  c1.courierIndex = 1;

  const c2 = deduceCourier(firstLetter, clues[1], secretWord, ctx);
  c2.courierIndex = 2;

  const c3 = deduceCourier(firstLetter, clues[2], secretWord, ctx);
  c3.courierIndex = 3;

  const friend = deduceFriend(firstLetter, clues, secretWord, ctx);

  const leakedCouriers = [c1, c2, c3].filter((c) => c.leaked);
  const isVictory = leakedCouriers.length === 0 && friend.success;

  let reason = '';
  if (leakedCouriers.length > 0) {
    const courierNames = leakedCouriers.map((c) => `Người giao thư ${c.courierIndex} (manh mối: "${c.clue}")`).join(', ');
    reason = `THẤT BẠI! ${courierNames} đã đoán đúng từ khóa bí mật "${secretWord}" ngay từ bức thư của mình. Két sắt đã bị gián điệp mở trộm!`;
  } else if (!friend.success) {
    const friendTop = friend.inferredWords.length > 0 ? `"${friend.inferredWords[0].word}"` : 'không rõ';
    reason = `THẤT BẠI! Cả 3 người giao thư đều an toàn, nhưng các manh mối chưa đủ rõ ràng khiến người bạn phương xa đoán nhầm thành ${friendTop} thay vì "${secretWord}".`;
  } else {
    reason = `CHIẾN THẮNG HUY HOÀNG! Cả 3 người giao thư đều bị đánh lừa, trong khi người bạn phương xa đã kết hợp chính xác cả 3 bức thư để đoán đúng "${secretWord}" và mở kho báu thành công!`;
  }

  return {
    secretWord,
    firstLetter,
    couriers: [c1, c2, c3],
    friend,
    isVictory,
    reason,
  };
}
