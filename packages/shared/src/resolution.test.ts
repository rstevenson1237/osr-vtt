import { describe, expect, it } from 'vitest';
import { resolveSeparate } from './resolution.js';

describe('resolveSeparate', () => {
  it('classifies 4-6 as success', () => {
    expect(resolveSeparate(4)).toBe('success');
    expect(resolveSeparate(5)).toBe('success');
    expect(resolveSeparate(6)).toBe('success');
  });

  it('classifies 2-3 as complication', () => {
    expect(resolveSeparate(2)).toBe('complication');
    expect(resolveSeparate(3)).toBe('complication');
  });

  it('classifies 1 as failure', () => {
    expect(resolveSeparate(1)).toBe('failure');
  });

  it('rejects non-integer input', () => {
    expect(() => resolveSeparate(2.5)).toThrow(RangeError);
  });
});
