import type { CalibrationPoint } from './types';

// Default monotonic calibration anchors if external config is not yet loaded
const DEFAULT_ANCHORS: CalibrationPoint[] = [
  { raw: -0.30, calibrated: 10 },
  { raw: -0.10, calibrated: 25 },
  { raw:  0.05, calibrated: 45 },
  { raw:  0.15, calibrated: 60 },
  { raw:  0.25, calibrated: 74 },
  { raw:  0.35, calibrated: 84 },
  { raw:  0.50, calibrated: 92 },
  { raw:  0.65, calibrated: 97 },
  { raw:  0.80, calibrated: 99 },
];

/**
 * Piecewise linear monotonic calibration:
 * Maps raw cosine/CSLS score to human-calibrated percentage (1% to 99%).
 */
export function calibrateScore(
  rawScore: number,
  anchors: CalibrationPoint[] = DEFAULT_ANCHORS
): number {
  if (!anchors || anchors.length === 0) {
    // fallback linear
    return Math.round(Math.min(99, Math.max(1, (rawScore + 1) * 50)));
  }

  // Clamped below first anchor
  if (rawScore <= anchors[0].raw) {
    return anchors[0].calibrated;
  }

  // Clamped above last anchor
  const last = anchors[anchors.length - 1];
  if (rawScore >= last.raw) {
    return last.calibrated;
  }

  // Interpolate between two anchors
  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (rawScore >= a1.raw && rawScore <= a2.raw) {
      const t = (rawScore - a1.raw) / (a2.raw - a1.raw);
      const val = a1.calibrated + t * (a2.calibrated - a1.calibrated);
      return Math.round(Math.min(99, Math.max(1, val)));
    }
  }

  return last.calibrated;
}

/**
 * Computes softmax probabilities over an array of scores with temperature T.
 */
export function computeSoftmax(scores: number[], temperature = 0.85): number[] {
  if (scores.length === 0) return [];
  const T = Math.max(0.01, temperature);
  
  // Numerical stability: subtract max score
  const maxScore = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - maxScore) / T));
  const sumExps = exps.reduce((a, b) => a + b, 0);

  if (sumExps === 0) {
    return scores.map(() => 1 / scores.length);
  }

  return exps.map((e) => e / sumExps);
}
