import { vectorMap } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { carveKind, type MapToolId } from './map-tool-controller.svelte';

describe('carveKind (MapToolId -> shared vectorMap.ToolKind)', () => {
  it('maps the ngon tool to the shared "regular" kind', () => {
    expect(carveKind('ngon')).toBe('regular');
  });

  it('passes the other carve-tool ids through unchanged', () => {
    const identity: MapToolId[] = ['room', 'corridor', 'path', 'polygon'];
    for (const tool of identity) {
      expect(carveKind(tool)).toBe(tool);
    }
  });

  it('every carve tool resolves through the shared per-tool tolerance policy', () => {
    // Mirrors DEFAULT_TOOL_TOLERANCE (tolerance.ts): ngon/room/polygon commit
    // crisp (0), corridor/path prune redundant vertices.
    expect(vectorMap.toolTolerance(carveKind('ngon'))).toBe(0);
    expect(vectorMap.toolTolerance(carveKind('room'))).toBe(0);
    expect(vectorMap.toolTolerance(carveKind('polygon'))).toBe(0);
    expect(vectorMap.toolTolerance(carveKind('corridor'))).toBeGreaterThan(0);
    expect(vectorMap.toolTolerance(carveKind('path'))).toBeGreaterThan(0);
  });
});
