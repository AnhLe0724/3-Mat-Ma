import { describe, it, expect } from 'vitest';
import { rankCandidates, SearchContext } from '../../src/core/ranking';

describe('Ranking Module', () => {
  // Mock a mini search context with 4 words and 3 dimensions
  const dim = 3;
  const nWords = 4;
  const vocab = [
    { w: 'chó', freq: 100 },
    { w: 'mèo', freq: 90 },
    { w: 'cún', freq: 80 },
    { w: 'người', freq: 500 }, // Hub word
  ];

  const word2idx = new Map<string, number>([
    ['chó', 0],
    ['mèo', 1],
    ['cún', 2],
    ['người', 3],
  ]);

  // Normalized 3D vectors
  // chó is [1, 0, 0]
  // mèo is [0.95, 0.31, 0] (very close to chó)
  // cún is [0.9, 0.43, 0] (close to chó)
  // người is [0.7, 0.7, 0.14] (hub)
  const vectors = new Float32Array([
    1.0, 0.0, 0.0,          // chó
    0.95, 0.312, 0.0,       // mèo
    0.894, 0.447, 0.0,      // cún
    0.707, 0.707, 0.0,      // người
  ]);

  const hubScores = new Float32Array([0.5, 0.6, 0.6, 0.85]); // 'người' has high hubness
  const logFreqsNorm = new Float32Array([0.0, 0.0, 0.0, 1.5]);
  const variants: Record<string, string[]> = {
    chó: ['chó'],
  };
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
      { raw: 0.0, calibrated: 40 },
      { raw: 0.5, calibrated: 75 },
      { raw: 1.0, calibrated: 98 },
    ],
  };

  it('excludes the query word itself from candidates', () => {
    const queryVec = new Float32Array([1.0, 0.0, 0.0]); // 'chó' vector
    const results = rankCandidates('chó', queryVec, ctx);

    const resultWords = results.map((r) => r.word);
    expect(resultWords).not.toContain('chó');
  });

  it('ranks closest semantic terms at the top', () => {
    const queryVec = new Float32Array([1.0, 0.0, 0.0]); // 'chó' vector
    const results = rankCandidates('chó', queryVec, ctx);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].word).toBe('mèo');
    expect(results[0].rank).toBe(1);
    expect(results[0].similarity).toBeGreaterThan(50);
  });

  it('respects blocklist exclusions', () => {
    const blockedCtx: SearchContext = {
      ...ctx,
      blocklist: new Set(['mèo']),
    };
    const queryVec = new Float32Array([1.0, 0.0, 0.0]);
    const results = rankCandidates('chó', queryVec, blockedCtx);

    const resultWords = results.map((r) => r.word);
    expect(resultWords).not.toContain('mèo');
    expect(resultWords[0]).toBe('cún');
  });

  it('boosts candidates with explicit Knowledge Graph associations', () => {
    const graphCtx: SearchContext = {
      ...ctx,
      graph: {
        chó: {
          cún: 1.0, // Strongest association
        },
      },
    };
    const queryVec = new Float32Array([1.0, 0.0, 0.0]);
    const results = rankCandidates('chó', queryVec, graphCtx);

    // cún should now be #1 due to knowledge graph association
    expect(results[0].word).toBe('cún');
  });
});
