import type { CalibrationPoint, LogEntry, LogLevel, LogSource, RankingConfig, SearchResult, VocabItem, WorkerRequest, WorkerResponse } from '../core/types';
import { cleanQuery, removeDiacritics } from '../core/normalize';
import { DEFAULT_CONFIG, rankCandidates, resolveQueryWord } from '../core/ranking';
import type { SearchContext } from '../core/ranking';
import { deduceCourier, deduceFriend, evaluateGame } from '../core/gameEngine';

let ctx: SearchContext | null = null;
let currentConfig: RankingConfig = { ...DEFAULT_CONFIG };

function sendLog(level: LogLevel, source: LogSource, message: string, durationMs?: number) {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  const d = new Date();
  const timestamp = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  
  const entry: LogEntry = {
    id: `worker-log-${Date.now()}-${Math.random()}`,
    timestamp,
    level,
    source,
    message,
    durationMs,
  };
  self.postMessage({ type: 'LOG', entry } as WorkerResponse);
}

// Float16 to Float32 conversion helper
function decodeFloat16(uint16: number): number {
  const sign = (uint16 & 0x8000) >> 15;
  const exponent = (uint16 & 0x7c00) >> 10;
  const fraction = uint16 & 0x03ff;

  if (exponent === 0) {
    return (sign ? -1 : 1) * Math.pow(2, -14) * (fraction / 1024);
  } else if (exponent === 0x1f) {
    return fraction ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

async function loadData(dataDir: string) {
  const startTime = performance.now();
  sendLog('INFO', 'Loader', 'Bắt đầu nạp dữ liệu offline...');

  try {
    // Step 1: Vocab
    self.postMessage({
      type: 'LOAD_PROGRESS',
      progress: { step: 'Đang nạp từ điển (vocab.json)...', progress: 15 },
    } as WorkerResponse);

    const t0 = performance.now();
    const vocabRes = await fetch(`${dataDir}/data/vocab.json`);
    if (!vocabRes.ok) throw new Error(`Không thể nạp vocab.json (${vocabRes.status})`);
    const vocab: VocabItem[] = await vocabRes.json();
    sendLog('INFO', 'Loader', `Nạp xong vocab.json (${vocab.length.toLocaleString()} từ)`, Math.round(performance.now() - t0));

    // Step 2: Vectors binary
    self.postMessage({
      type: 'LOAD_PROGRESS',
      progress: { step: 'Đang nạp ma trận vector nhị phân (vectors.bin)...', progress: 40 },
    } as WorkerResponse);

    const t1 = performance.now();
    const vecRes = await fetch(`${dataDir}/data/vectors.bin`);
    if (!vecRes.ok) throw new Error(`Không thể nạp vectors.bin (${vecRes.status})`);
    const vecBuffer = await vecRes.arrayBuffer();
    const u16View = new Uint16Array(vecBuffer);

    const dim = 300;
    const nWords = vocab.length;
    const vectors = new Float32Array(nWords * dim);

    // Convert float16 to float32
    for (let i = 0; i < u16View.length; i++) {
      vectors[i] = decodeFloat16(u16View[i]);
    }
    sendLog('INFO', 'Loader', `Giải mã ma trận vector float16 (${(vecBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`, Math.round(performance.now() - t1));

    // Step 3: Hubness
    self.postMessage({
      type: 'LOAD_PROGRESS',
      progress: { step: 'Đang nạp điểm Hubness CSLS (hub.bin)...', progress: 65 },
    } as WorkerResponse);

    const t2 = performance.now();
    const hubRes = await fetch(`${dataDir}/data/hub.bin`);
    let hubScores = new Float32Array(nWords);
    if (hubRes.ok) {
      const hubBuffer = await hubRes.arrayBuffer();
      hubScores = new Float32Array(hubBuffer);
      sendLog('INFO', 'Loader', 'Nạp xong hub.bin', Math.round(performance.now() - t2));
    } else {
      sendLog('WARN', 'Loader', 'hub.bin không tìm thấy, sử dụng CSLS fallback');
    }

    // Step 4: Variants & Blocklist & Calibration
    self.postMessage({
      type: 'LOAD_PROGRESS',
      progress: { step: 'Đang nạp bảng biến thể và hiệu chỉnh...', progress: 85 },
    } as WorkerResponse);

    let variants: Record<string, string[]> = {};
    try {
      const varRes = await fetch(`${dataDir}/data/variants.json`);
      if (varRes.ok) variants = await varRes.json();
    } catch {
      // ignore
    }

    let blocklist = new Set<string>();
    try {
      const blRes = await fetch(`${dataDir}/../data_raw/blocklist.txt`);
      if (blRes.ok) {
        const text = await blRes.text();
        blocklist = new Set(
          text
            .split('\n')
            .map((l) => l.trim().toLowerCase())
            .filter((l) => l && !l.startsWith('#'))
        );
      }
    } catch {
      // ignore
    }

    let calibrationAnchors: CalibrationPoint[] = [];
    try {
      const calibRes = await fetch(`${dataDir}/../config/calibration.json`);
      if (calibRes.ok) {
        const calibData = await calibRes.json();
        calibrationAnchors = calibData.anchors || [];
      }
    } catch {
      // ignore
    }

    let graph: Record<string, Record<string, number>> = {};
    try {
      const graphRes = await fetch(`${dataDir}/data/graph.json`);
      if (graphRes.ok) {
        graph = await graphRes.json();
        sendLog('INFO', 'Loader', `Nạp xong mạng lưới liên tưởng graph.json (${Object.keys(graph).length.toLocaleString()} mục)`);
      }
    } catch (e: any) {
      sendLog('WARN', 'Loader', `Không thể nạp graph.json: ${e.message}`);
    }

    let unaccentedMap: Record<string, string[]> = {};
    try {
      const unaccRes = await fetch(`${dataDir}/data/unaccented_map.json`);
      if (unaccRes.ok) {
        unaccentedMap = await unaccRes.json();
        sendLog('INFO', 'Loader', `Nạp xong bảng khôi phục dấu tiếng Việt unaccented_map.json (${Object.keys(unaccentedMap).length.toLocaleString()} mục)`);
      }
    } catch {
      // ignore
    }

    // Precalculate word2idx and logFreqsNorm
    const word2idx = new Map<string, number>();
    const logFreqs = new Float32Array(nWords);
    let sumLog = 0.0;

    for (let i = 0; i < nWords; i++) {
      word2idx.set(vocab[i].w, i);
      const lf = Math.log1p(vocab[i].freq || 1);
      logFreqs[i] = lf;
      sumLog += lf;
    }

    const meanLog = sumLog / nWords;
    let sumSq = 0.0;
    for (let i = 0; i < nWords; i++) {
      sumSq += (logFreqs[i] - meanLog) ** 2;
    }
    const stdLog = Math.sqrt(sumSq / nWords) + 1e-6;

    const logFreqsNorm = new Float32Array(nWords);
    for (let i = 0; i < nWords; i++) {
      logFreqsNorm[i] = (logFreqs[i] - meanLog) / stdLog;
    }

    ctx = {
      vocab,
      word2idx,
      vectors,
      dim,
      nWords,
      hubScores,
      logFreqsNorm,
      variants,
      blocklist,
      calibrationAnchors,
      graph,
      unaccentedMap,
    };

    const totalTime = Math.round(performance.now() - startTime);
    sendLog('INFO', 'Loader', `Hoàn tất khởi tạo toàn bộ dữ liệu local! (${totalTime} ms)`);

    self.postMessage({
      type: 'LOAD_PROGRESS',
      progress: { step: 'Sẵn sàng!', progress: 100 },
    } as WorkerResponse);

    self.postMessage({
      type: 'LOAD_SUCCESS',
      nWords,
    } as WorkerResponse);
  } catch (err: any) {
    sendLog('ERROR', 'Loader', `Lỗi khi nạp dữ liệu: ${err.message}`);
    self.postMessage({
      type: 'LOAD_ERROR',
      error: err.message,
    } as WorkerResponse);
  }
}

function getQueryVector(query: string, searchCtx: SearchContext): { vec: Float32Array; isOOV: boolean } {
  const { word2idx, vectors, dim } = searchCtx;
  const qNorm = cleanQuery(query);

  // Exact lookup
  if (word2idx.has(qNorm)) {
    const idx = word2idx.get(qNorm)!;
    const vec = new Float32Array(dim);
    vec.set(vectors.subarray(idx * dim, (idx + 1) * dim));
    return { vec, isOOV: false };
  }

  // Check unaccented map auto-restoration (e.g. "ca phe" -> "cà phê", "bien" -> "biển")
  if (searchCtx.unaccentedMap) {
    const unacc = removeDiacritics(qNorm);
    const candidates = searchCtx.unaccentedMap[unacc];
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        if (word2idx.has(cand)) {
          const idx = word2idx.get(cand)!;
          const vec = new Float32Array(dim);
          vec.set(vectors.subarray(idx * dim, (idx + 1) * dim));
          return { vec, isOOV: false };
        }
      }
    }
  }

  // Compound fallback: average syllables
  const syllables = qNorm.split(' ');
  if (syllables.length > 1) {
    const validVecs: Float32Array[] = [];
    for (const s of syllables) {
      if (word2idx.has(s)) {
        const sIdx = word2idx.get(s)!;
        validVecs.push(vectors.subarray(sIdx * dim, (sIdx + 1) * dim));
      }
    }

    if (validVecs.length > 0) {
      const avgVec = new Float32Array(dim);
      for (const v of validVecs) {
        for (let d = 0; d < dim; d++) {
          avgVec[d] += v[d];
        }
      }
      // Normalize L2
      let norm = 0.0;
      for (let d = 0; d < dim; d++) norm += avgVec[d] * avgVec[d];
      norm = Math.sqrt(norm);
      if (norm > 1e-6) {
        for (let d = 0; d < dim; d++) avgVec[d] /= norm;
      }
      return { vec: avgVec, isOOV: true };
    }
  }

  // Full OOV: pseudo-random normalized vector
  sendLog('WARN', 'Search', `Từ OOV hoàn toàn: "${query}" - sử dụng vector xấp xỉ`);
  const randVec = new Float32Array(dim);
  let norm = 0.0;
  for (let d = 0; d < dim; d++) {
    randVec[d] = Math.sin(query.charCodeAt(d % query.length) + d);
    norm += randVec[d] * randVec[d];
  }
  norm = Math.sqrt(norm);
  for (let d = 0; d < dim; d++) randVec[d] /= norm;

  return { vec: randVec, isOOV: true };
}

function handleQuery(word: string, customConfig?: Partial<RankingConfig>) {
  if (!ctx) {
    self.postMessage({
      type: 'QUERY_ERROR',
      query: word,
      error: 'Dữ liệu chưa nạp xong.',
    } as WorkerResponse);
    return;
  }

  const startTime = performance.now();
  const qClean = cleanQuery(word);
  const resolved = resolveQueryWord(qClean, ctx);

  if (resolved !== qClean) {
    sendLog('INFO', 'Search', `Khôi phục dấu tiếng Việt: "${qClean}" ➜ "${resolved}"`);
  } else {
    sendLog('INFO', 'Search', `Bắt đầu tìm kiếm từ liên tưởng cho: "${resolved}"`);
  }

  const config = { ...currentConfig, ...customConfig };
  const { vec, isOOV } = getQueryVector(resolved, ctx);

  if (isOOV) {
    sendLog('WARN', 'Search', `Từ không có trong kho gốc ("${resolved}"), dùng phân rã âm tiết`);
  }

  const results: SearchResult[] = rankCandidates(resolved, vec, ctx, config, 5);
  const durationMs = Math.round(performance.now() - startTime);

  const topWord = results.length > 0 ? results[0].word : 'không có';
  const topSim = results.length > 0 ? results[0].similarity : 0;
  sendLog('INFO', 'Search', `Tìm xong Top-5! Từ chính: "${topWord}" (${topSim}%)`, durationMs);

  self.postMessage({
    type: 'QUERY_SUCCESS',
    query: word,
    results,
    durationMs,
    isOOV,
  } as WorkerResponse);
}

function handleEvaluateCourier(
  courierIndex: number,
  clue: string,
  firstLetter: string,
  secretWord: string
) {
  if (!ctx) {
    self.postMessage({
      type: 'GAME_EVALUATION_ERROR',
      error: 'Dữ liệu chưa nạp xong.',
    } as WorkerResponse);
    return;
  }

  const startTime = performance.now();
  sendLog('INFO', 'Search', `Thẩm vấn Người giao thư ${courierIndex} với manh mối: "${clue}" (chữ cái đầu: "${firstLetter}")`);

  const deduction = deduceCourier(firstLetter, clue, secretWord, ctx);
  deduction.courierIndex = courierIndex;
  const durationMs = Math.round(performance.now() - startTime);

  const topGuess = deduction.inferredWords.length > 0 ? deduction.inferredWords[0].word : 'không rõ';
  if (deduction.leaked) {
    sendLog('WARN', 'Search', `💥 Người giao thư ${courierIndex} ĐÃ ĐOÁN ĐÚNG "${secretWord}"! (Két sắt bị lộ!)`, durationMs);
  } else {
    sendLog('INFO', 'Search', `🛡️ Người giao thư ${courierIndex} an toàn (đoán là "${topGuess}")`, durationMs);
  }

  self.postMessage({
    type: 'COURIER_EVALUATION_SUCCESS',
    deduction,
  } as WorkerResponse);
}

function handleEvaluateFriend(
  firstLetter: string,
  clues: [string, string, string],
  secretWord: string
) {
  if (!ctx) {
    self.postMessage({
      type: 'GAME_EVALUATION_ERROR',
      error: 'Dữ liệu chưa nạp xong.',
    } as WorkerResponse);
    return;
  }

  const startTime = performance.now();
  sendLog('INFO', 'Search', `Đồng đội phương xa tiếp nhận 3 thư: ["${clues[0]}", "${clues[1]}", "${clues[2]}"] + Chữ cái "${firstLetter}"`);

  const deduction = deduceFriend(firstLetter, clues, secretWord, ctx);
  const durationMs = Math.round(performance.now() - startTime);

  const topGuess = deduction.inferredWords.length > 0 ? deduction.inferredWords[0].word : 'không rõ';
  if (deduction.success) {
    sendLog('INFO', 'Search', `🎉 Đồng đội phương xa đã đoán chính xác "${topGuess}"! Mở kho báu thành công!`, durationMs);
  } else {
    sendLog('WARN', 'Search', `💥 Đồng đội phương xa đoán nhầm thành "${topGuess}" (thay vì "${secretWord}").`, durationMs);
  }

  self.postMessage({
    type: 'FRIEND_EVALUATION_SUCCESS',
    deduction,
  } as WorkerResponse);
}

function handleEvaluateGame(secretWord: string, firstLetter: string, clues: [string, string, string]) {
  if (!ctx) {
    self.postMessage({
      type: 'GAME_EVALUATION_ERROR',
      error: 'Dữ liệu chưa nạp xong.',
    } as WorkerResponse);
    return;
  }

  const startTime = performance.now();
  sendLog('INFO', 'Search', `Thẩm vấn 3 Bức Thư Mật: "${secretWord}" (chữ cái đầu: "${firstLetter}")`);
  sendLog('INFO', 'Search', `3 bức thư: [1: "${clues[0]}", 2: "${clues[1]}", 3: "${clues[2]}"]`);

  const result = evaluateGame(secretWord, firstLetter, clues, ctx);
  const durationMs = Math.round(performance.now() - startTime);

  for (const c of result.couriers) {
    if (c.leaked) {
      sendLog('WARN', 'Search', `Người ${c.courierIndex} (manh mối: "${c.clue}") ĐÃ ĐOÁN RA "${secretWord}"! (Bị lộ)`);
    } else {
      const topGuess = c.inferredWords.length > 0 ? c.inferredWords[0].word : 'không rõ';
      sendLog('INFO', 'Search', `Người ${c.courierIndex} an toàn (đoán: "${topGuess}")`);
    }
  }

  if (result.friend.success) {
    sendLog('INFO', 'Search', `Người bạn phương xa đã kết hợp thành công 3 bức thư và đoán trúng "${secretWord}"!`, durationMs);
  } else {
    sendLog('WARN', 'Search', `Người bạn phương xa không thể đoán ra từ khóa.`, durationMs);
  }

  self.postMessage({
    type: 'GAME_EVALUATION_SUCCESS',
    result,
  } as WorkerResponse);
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type === 'LOAD') {
    loadData(req.dataDir);
  } else if (req.type === 'QUERY') {
    handleQuery(req.word, req.config);
  } else if (req.type === 'EVALUATE_COURIER') {
    handleEvaluateCourier(req.courierIndex, req.clue, req.firstLetter, req.secretWord);
  } else if (req.type === 'EVALUATE_FRIEND') {
    handleEvaluateFriend(req.firstLetter, req.clues, req.secretWord);
  } else if (req.type === 'EVALUATE_GAME') {
    handleEvaluateGame(req.secretWord, req.firstLetter, req.clues);
  }
};
