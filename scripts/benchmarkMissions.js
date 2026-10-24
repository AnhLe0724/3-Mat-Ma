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
const vBytes = fs.readFileSync(path.join(rootDir, 'public/data/vectors.bin'));
const vectors = new Float32Array(vBytes.buffer, vBytes.byteOffset, vBytes.byteLength / 4);
const dim = 128;

function restoreAccents(text) {
  const norm = text.toLowerCase().trim();
  const syllables = norm.split(/\s+/);
  if (syllables.length === 1) {
    const cands = unaccentedMap[syllables[0]];
    return cands ? [norm, ...cands.filter((c) => c !== norm)] : [norm];
  }
  const sylCands = syllables.map((s) => unaccentedMap[s] || [s]);
  let combos = [''];
  for (const cList of sylCands) {
    const next = [];
    for (const prefix of combos) {
      for (const cand of cList.slice(0, 5)) {
        next.push(prefix ? prefix + ' ' + cand : cand);
      }
    }
    combos = next.slice(0, 30);
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
    const candidates = [];

    for (let i = 0; i < vocab.length; i++) {
      const w = vocab[i].w;
      if (!matchLetter(w, m.letter)) continue;
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
          const gRaw = Math.max(graph[hyp.h]?.[w] || 0, graph[w]?.[hyp.h] || 0);
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

      const syl = w.split(' ').length;
      const lenBonus = syl <= 2 ? 0.12 : (syl === 3 ? 0.03 : -0.20);
      const score = avgS + 1.2 * sMin + synergy + lenBonus;

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
