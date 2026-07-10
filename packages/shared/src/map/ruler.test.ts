import { describe, expect, it } from 'vitest';
import { measureRuler } from './ruler.js';

describe('measureRuler', () => {
  const cellSize = 70;

  it('measures a straight horizontal line in squares and feet', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 210, y: 0 }, cellSize);
    expect(result.squares).toBe(3);
    expect(result.feet).toBe(15);
  });

  it('uses Chebyshev distance — a diagonal counts as one square, not two', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 140, y: 140 }, cellSize);
    expect(result.squares).toBe(2);
    expect(result.feet).toBe(10);
  });

  it('respects a custom feet-per-square', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 70, y: 0 }, cellSize, 10);
    expect(result.feet).toBe(10);
  });
});
