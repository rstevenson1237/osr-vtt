import { describe, expect, it, vi } from 'vitest';
import { hexLinePreview, latticeThreshold } from './view-helpers';

describe('latticeThreshold', () => {
  it('divides by the cell size alone before the engine exists', () => {
    expect(latticeThreshold(10, null, 50)).toBe(0.2);
  });

  it('shrinks with zoom so the pick radius stays constant on screen', () => {
    expect(latticeThreshold(10, 1, 50)).toBe(0.2);
    expect(latticeThreshold(10, 2, 50)).toBe(0.1);
  });
});

describe('hexLinePreview', () => {
  const at = (q: number, r: number) => ({ q, r });
  const pointFor = vi.fn(() => at(2, 0));

  it('is null for any other tool or a square map, without resolving the pointer', () => {
    pointFor.mockClear();
    expect(hexLinePreview('select', true, { x: 1, y: 1 }, [at(0, 0)], pointFor, 0)).toBeNull();
    expect(hexLinePreview('road', false, { x: 1, y: 1 }, [at(0, 0)], pointFor, 0)).toBeNull();
    expect(pointFor).not.toHaveBeenCalled();
  });

  it('is null while the run is too short to commit', () => {
    expect(hexLinePreview('road', true, null, [at(0, 0)], pointFor, 1)).toBeNull();
  });

  it('previews the collected points plus the hover point, with the width as the shade', () => {
    const out = hexLinePreview('river', true, { x: 1, y: 1 }, [at(0, 0)], pointFor, 2);
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('river');
    expect(out!.points).toEqual([at(0, 0), at(2, 0)]);
    expect(out!.shade).toBe(2);
    expect(out!.width).toBe(2);
    expect(['round', 'miter', 'bevel']).toContain(out!.join);
  });
});
