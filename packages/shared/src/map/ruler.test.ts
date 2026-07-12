import { describe, expect, it } from 'vitest';
import { measureRuler } from './ruler.js';

describe('measureRuler', () => {
  const cellSize = 70;

  it('measures a straight horizontal line in squares and the configured distance unit (default 10/square)', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 210, y: 0 }, cellSize);
    expect(result.squares).toBe(3);
    expect(result.distance).toBe(30);
  });

  it('uses Chebyshev distance — a diagonal counts as one square, not two', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 140, y: 140 }, cellSize);
    expect(result.squares).toBe(2);
    expect(result.distance).toBe(20);
  });

  it('respects a custom per-square distance (Master Plan v2, R9.3 room.settings.measure)', () => {
    const result = measureRuler({ x: 0, y: 0 }, { x: 140, y: 0 }, cellSize, 3);
    expect(result.squares).toBe(2);
    expect(result.distance).toBe(6);
  });
});
