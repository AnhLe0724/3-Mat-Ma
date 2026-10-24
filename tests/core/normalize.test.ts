import { describe, it, expect } from 'vitest';
import { cleanQuery, normalizeWord } from '../../src/core/normalize';

describe('Normalize Module', () => {
  it('normalizes to NFC composition', () => {
    // Decomposed form: o + combining grave accent \u0300
    const decomposed = 'ho\u0300a';
    const composed = 'hòa';
    expect(normalizeWord(decomposed)).toBe(composed);
  });

  it('converts to lowercase', () => {
    expect(normalizeWord('CHÓ')).toBe('chó');
    expect(normalizeWord('HỌC SINH')).toBe('học sinh');
  });

  it('collapses multiple whitespace characters and trims', () => {
    expect(normalizeWord('   bầu    trời   ')).toBe('bầu trời');
    expect(normalizeWord('\tthời \n gian\t')).toBe('thời gian');
  });

  it('trims leading/trailing punctuation in cleanQuery', () => {
    expect(cleanQuery(' "chó" ')).toBe('chó');
    expect(cleanQuery('...mèo!...')).toBe('mèo');
  });
});
