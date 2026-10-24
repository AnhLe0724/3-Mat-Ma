import { describe, it, expect } from 'vitest';
import { calibrateScore, computeSoftmax } from '../../src/core/calibrate';

describe('Calibrate Module', () => {
  it('maps scores monotonically to [1, 99]% range', () => {
    const rawScores = [-0.5, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const calibs = rawScores.map((s) => calibrateScore(s));

    for (let i = 1; i < calibs.length; i++) {
      expect(calibs[i]).toBeGreaterThanOrEqual(calibs[i - 1]);
      expect(calibs[i]).toBeGreaterThanOrEqual(1);
      expect(calibs[i]).toBeLessThanOrEqual(99);
    }
  });

  it('clamps extreme low and extreme high values appropriately', () => {
    expect(calibrateScore(-10.0)).toBeGreaterThanOrEqual(1);
    expect(calibrateScore(10.0)).toBeLessThanOrEqual(99);
  });

  it('computes softmax probabilities that sum to 1.0', () => {
    const scores = [0.8, 0.6, 0.4, 0.2, 0.1];
    const probs = computeSoftmax(scores, 0.85);

    expect(probs).toHaveLength(scores.length);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);

    // Higher score should have higher probability
    expect(probs[0]).toBeGreaterThan(probs[1]);
    expect(probs[1]).toBeGreaterThan(probs[2]);
  });
});
