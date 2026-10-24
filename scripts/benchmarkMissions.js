import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vocab = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/vocab.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/graph.json'), 'utf8'));
const unaccentedMap = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/unaccented_map.json'), 'utf8'));
const word2idx = new Map(vocab.map((v, i) => [v.w, i]));
const BOUND_SYLLABLES = new Set([
  'cà', 'kho', 'mặt', 'hoa', 'tàu', 'vương', 'đồng', 'bác', 'ngân', 'bánh', 'sư', 'ngọn', 'bình', 'người',
  'bản', 'cơ', 'thể', 'tính', 'học', 'những', 'các', 'thì', 'mà', 'là', 'bị', 'được', 'do', 'với', 'cho',
  'về', 'trong', 'ngoài', 'tại', 'ở', 'từ', 'lại', 'qua', 'ra', 'vào', 'lên', 'xuống', 'rất', 'quá', 'lắm'
]);

function decodeFloat16(uint16) {
  const sign = (uint16 & 0x8000) >> 15;
  const exponent = (uint16 & 0x7c00) >> 10;
  const fraction = uint16 & 0x03ff;
  if (exponent === 0) return (sign ? -1 : 1) * Math.pow(2, -14) * (fraction / 1024);
  if (exponent === 0x1f) return fraction ? NaN : sign ? -Infinity : Infinity;
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

const vBytes = fs.readFileSync(path.join(rootDir, 'public/data/vectors.bin'));
const u16 = new Uint16Array(vBytes.buffer, vBytes.byteOffset, vBytes.byteLength / 2);
const dim = 300;
const vectors = new Float32Array(vocab.length * dim);
for (let i = 0; i < u16.length; i++) vectors[i] = decodeFloat16(u16[i]);

const maxLogFreq = Math.log1p(2223);

function restoreAccents(text) {
  const norm = text.toLowerCase().trim();
  if (unaccentedMap[norm] && unaccentedMap[norm].length > 0) {
    return [norm, ...unaccentedMap[norm].filter((c) => c !== norm)];
  }
  const syllables = norm.split(/\s+/);
  const sylCands = syllables.map((s) => unaccentedMap[s] || [s]);
  let combos = [''];
  for (const cList of sylCands) {
    const next = [];
    for (const prefix of combos) {
      for (const cand of cList.slice(0, 8)) {
        next.push(prefix ? prefix + ' ' + cand : cand);
      }
    }
    combos = next.slice(0, 40);
  }
  const sorted = combos.sort((a, b) => {
    const aScore = (graph[a] ? 2 : 0) + (word2idx.has(a) ? 1 : 0);
    const bScore = (graph[b] ? 2 : 0) + (word2idx.has(b) ? 1 : 0);
    return bScore - aScore;
  });
  return [norm, ...sorted.slice(0, 10)];
}

function getVec(w) {
  const out = new Float32Array(dim);
  if (word2idx.has(w)) {
    const idx = word2idx.get(w);
    out.set(vectors.subarray(idx * dim, (idx + 1) * dim));
    return out;
  }
  const syl = w.split(' ');
  let cnt = 0;
  for (const s of syl) {
    if (word2idx.has(s)) {
      const idx = word2idx.get(s);
      for (let d = 0; d < dim; d++) out[d] += vectors[idx * dim + d];
      cnt++;
    }
  }
  if (cnt > 0) {
    let norm = 0;
    for (let d = 0; d < dim; d++) norm += out[d] * out[d];
    norm = Math.sqrt(norm);
    if (norm > 1e-6) for (let d = 0; d < dim; d++) out[d] /= norm;
  }
  return out;
}

function softmin(vals, beta = 3.0) {
  const exps = vals.map((v) => Math.exp(-beta * v));
  const avgExp = exps.reduce((a, b) => a + b, 0) / vals.length;
  return -Math.log(avgExp) / beta;
}

function matchLetter(w, l) {
  return w.toLowerCase().startsWith(l.toLowerCase());
}

function getClueGraphScore(hyp, candidate) {
  let direct = graph[hyp]?.[candidate] || 0;
  let reverse = graph[candidate]?.[hyp] || 0;

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

  if (reverse === 0 && graph[candidate]) {
    for (const [neighbor, weight] of Object.entries(graph[candidate])) {
      if (neighbor.startsWith(hyp + ' ') || neighbor.endsWith(' ' + hyp)) {
        reverse = Math.max(reverse, weight * 0.9);
      }
    }
  }

  return Math.max(direct, reverse);
}

const missions = [
  { secret: 'cà phê', letter: 'C', clues: ['hạt', 'nâu', 'thức khuya'], unacc: ['hat', 'nau', 'thuc khuya'] },
  { secret: 'kho báu', letter: 'K', clues: ['vàng', 'rương', 'hải tặc'], unacc: ['vang', 'ruong', 'hai tac'] },
  { secret: 'mặt trời', letter: 'M', clues: ['nắng', 'ngày', 'chiếu sáng'], unacc: ['nang', 'ngay', 'chieu sang'] },
  { secret: 'hoa hồng', letter: 'H', clues: ['gai', 'đỏ', 'tình yêu'], unacc: ['gai', 'do', 'tinh yeu'] },
  { secret: 'tàu ngầm', letter: 'T', clues: ['biển', 'lặn', 'quân sự'], unacc: ['bien', 'lan', 'quan su'] },
  { secret: 'vương miện', letter: 'V', clues: ['vua', 'vàng', 'hoàng gia'], unacc: ['vua', 'vang', 'hoang gia'] },
  { secret: 'đồng hồ', letter: 'Đ', clues: ['kim', 'giờ', 'thời gian'], unacc: ['kim', 'gio', 'thoi gian'] },
  { secret: 'kim cương', letter: 'K', clues: ['cứng', 'nhẫn', 'lấp lánh'], unacc: ['cung', 'nhan', 'lap lanh'] },
  { secret: 'bác sĩ', letter: 'B', clues: ['bệnh viện', 'thuốc', 'khám'], unacc: ['benh vien', 'thuoc', 'kham'] },
  { secret: 'ngân hàng', letter: 'N', clues: ['tiền', 'két sắt', 'gửi'], unacc: ['tien', 'ket sat', 'gui'] },
  { secret: 'bánh mì', letter: 'B', clues: ['kẹp', 'thịt', 'giòn'], unacc: ['kep', 'thit', 'gion'] },
  { secret: 'sư tử', letter: 'S', clues: ['bờm', 'thảo nguyên', 'châu phi'], unacc: ['bom', 'thao nguyen', 'chau phi'] },
  { secret: 'ngọn hải đăng', letter: 'N', clues: ['tháp', 'đèn', 'soi biển'], unacc: ['thap', 'den', 'soi bien'] },
  { secret: 'bình minh', letter: 'B', clues: ['sáng', 'mặt trời', 'chân trời'], unacc: ['sang', 'mat troi', 'chan troi'] },
  { secret: 'người tuyết', letter: 'N', clues: ['mùa đông', 'mũ len', 'cà rốt'], unacc: ['mua dong', 'mu len', 'ca rot'] },
];

function runBenchmark(useUnaccented = false) {
  console.log(`\n========================================`);
  console.log(`BENCHMARK ${useUnaccented ? 'KHÔNG DẤU (UNACCENTED)' : 'CÓ DẤU (ACCENTED)'} (15 NHIỆM VỤ)`);
  console.log(`========================================`);

  let top1Count = 0;
  let top3Count = 0;
  let mrrSum = 0;

  for (const m of missions) {
    const rawClues = useUnaccented ? m.unacc : m.clues;
    const clueHypotheses = rawClues.map((c) => restoreAccents(c));
    const clueVecs = clueHypotheses.map((hypList) => hypList.map((h) => ({ h, vec: getVec(h) })));
    const allHypotheses = new Set();
    clueHypotheses.forEach((list) => list.forEach((h) => allHypotheses.add(h)));

    const candidates = [];

    for (let i = 0; i < vocab.length; i++) {
      const w = vocab[i].w;
      if (allHypotheses.has(w)) continue;
      if (!matchLetter(w, m.letter)) continue;
      if (BOUND_SYLLABLES.has(w)) continue;

      const syllables = w.split(' ').length;
      if (syllables > 3) continue;

      const freq = vocab[i].freq || 1;
      const hasGraph = graph[w] && Object.keys(graph[w]).length > 0;
      if (freq < 45 && !hasGraph) continue;

      const off = i * dim;
      const deg = graph[w] ? Object.keys(graph[w]).length : 0;
      const degNorm = 1.0 / Math.log(2 + Math.min(deg, 100));

      const s = [0, 0, 0];
      const g = [0, 0, 0];

      for (let c = 0; c < 3; c++) {
        let bestAffinity = -999;
        let bestG = 0;

        for (const hyp of clueVecs[c]) {
          let dot = 0;
          for (let j = 0; j < dim; j++) dot += hyp.vec[j] * vectors[off + j];

          const gRaw = getClueGraphScore(hyp.h, w);
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
      const gPair = g[0] * g[1] + g[1] * g[2] + g[0] * g[2];
      const gTriple = g[0] * g[1] * g[2];
      const synergy = 1.2 * gPair + 3.0 * gTriple;

      const fam = Math.log1p(freq) / maxLogFreq;
      const famBonus = 0.08 * fam;

      const lenBonus = syllables === 2 ? 0.15 : (syllables === 1 ? 0.08 : 0.02);
      const score = avgS + 1.2 * sMin + synergy + famBonus + lenBonus;

      candidates.push({ w, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const rank = candidates.findIndex((c) => c.w === m.secret || c.w === m.secret.replace(/-/g, ' ')) + 1;
    const top1 = candidates[0].w;
    const top1Score = candidates[0].score.toFixed(3);

    if (rank === 1) top1Count++;
    if (rank > 0 && rank <= 3) top3Count++;
    if (rank > 0) mrrSum += 1.0 / rank;

    const status = rank === 1 ? 'PASS (#1)' : `FAIL (#${rank})`;
    console.log(`${m.secret.padEnd(16)} | Top 1: ${top1.padEnd(16)} (${top1Score}) | ${status}`);
  }

  const n = missions.length;
  console.log(`----------------------------------------`);
  console.log(`Top-1 Accuracy: ${(top1Count / n * 100).toFixed(1)}% (${top1Count}/${n})`);
  console.log(`Top-3 Accuracy: ${(top3Count / n * 100).toFixed(1)}% (${top3Count}/${n})`);
  console.log(`MRR: ${(mrrSum / n).toFixed(3)}`);
}

runBenchmark(false);
runBenchmark(true);
