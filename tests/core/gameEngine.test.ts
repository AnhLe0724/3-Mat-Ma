import { describe, it, expect } from 'vitest';
import { deduceCourier, evaluateGame } from '../../src/core/gameEngine';
import type { SearchContext } from '../../src/core/ranking';

describe('Game Engine - 3 Bức Thư Mật', () => {
  const dim = 3;
  const vocab = [
    { w: 'cà', freq: 100 },
    { w: 'cà phê', freq: 90 },
    { w: 'cà chua', freq: 85 },
    { w: 'cà rốt', freq: 80 },
    { w: 'cà tím', freq: 75 },
    { w: 'cà bát', freq: 70 },
    { w: 'hạt', freq: 65 },
    { w: 'nâu', freq: 60 },
    { w: 'thức khuya', freq: 50 },
    { w: 'đen đá', freq: 45 },
  ];
  const nWords = vocab.length;

  const word2idx = new Map<string, number>(vocab.map((item, idx) => [item.w, idx]));

  // 3D vector mock
  const vectors = new Float32Array([
    1.0, 0.0, 0.0,       // 0: cà
    0.5, 0.5, 0.5,       // 1: cà phê (balanced across dimensions)
    0.3, 0.1, 0.9,       // 2: cà chua (matches hạt)
    0.7, 0.1, 0.7,       // 3: cà rốt
    0.6, 0.7, 0.1,       // 4: cà tím (matches nâu)
    0.8, 0.8, 0.1,       // 5: cà bát (matches thức khuya)
    0.3, 0.1, 0.9,       // 6: hạt
    0.6, 0.7, 0.1,       // 7: nâu
    0.7, 0.7, 0.1,       // 8: thức khuya
    0.5, 0.5, 0.5,       // 9: đen đá (identical to cà phê)
  ]);

  const hubScores = new Float32Array(nWords);
  const logFreqsNorm = new Float32Array(nWords);
  const variants: Record<string, string[]> = {};
  const blocklist = new Set<string>();

  const ctx: SearchContext = {
    vocab,
    word2idx,
    vectors,
    dim,
    nWords,
    hubScores,
    logFreqsNorm,
    variants,
    blocklist,
    calibrationAnchors: [
      { raw: 0.0, calibrated: 20 },
      { raw: 0.5, calibrated: 60 },
      { raw: 1.0, calibrated: 95 },
    ],
    graph: {
      'đen đá': { 'cà phê': 1.0 },
      'hạt': { 'cà phê': 0.45, 'cà chua': 0.9, 'cà rốt': 0.85, 'cà bát': 0.8 },
      'nâu': { 'cà tím': 0.95, 'cà phê': 0.45 },
      'thức khuya': { 'cà bát': 0.3, 'cà phê': 0.45 },
    },
  };

  it('detects leak when a courier clue is too direct', () => {
    // Clue "đen đá" with letter "C" immediately leaks "cà phê"
    const courier = deduceCourier('C', 'đen đá', 'cà phê', ctx);
    expect(courier.inferredWords.length).toBeGreaterThan(0);
    const topWords = courier.inferredWords.map((w) => w.word);
    expect(topWords).toContain('cà phê');
    expect(courier.leaked).toBe(true);
  });

  it('keeps courier safe when clue is subtle', () => {
    // Clue "hạt" with letter "C" points to "cà chua", "cà rốt", "cà bát", not "cà phê"
    const courier = deduceCourier('C', 'hạt', 'cà phê', ctx);
    expect(courier.leaked).toBe(false);
  });

  it('evaluates game victory when couriers are safe and friend decodes target', () => {
    // With 3 clues, friend combines associations and decodes cà phê
    const res = evaluateGame('cà phê', 'C', ['hạt', 'nâu', 'thức khuya'], ctx);
    expect(res.couriers[0].leaked).toBe(false);
    expect(res.couriers[1].leaked).toBe(false);
    expect(res.couriers[2].leaked).toBe(false);
    expect(res.friend.success).toBe(true);
    expect(res.isVictory).toBe(true);
  });

  it('evaluates game defeat when at least one courier leaks the secret', () => {
    const res = evaluateGame('cà phê', 'C', ['hạt', 'đen đá', 'thức khuya'], ctx);
    expect(res.couriers[1].leaked).toBe(true);
    expect(res.isVictory).toBe(false);
    expect(res.reason).toContain('Người giao thư 2');
  });
});
