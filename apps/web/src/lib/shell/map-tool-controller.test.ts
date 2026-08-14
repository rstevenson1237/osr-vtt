import { vectorMap } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import {
  carveKind,
  DEFAULT_BAND_WIDTH,
  isFogCarve,
  MapToolController,
  type MapToolId,
} from './map-tool-controller.svelte';

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

describe('isFogCarve (which collection a carve tool targets)', () => {
  it('is true only for the two fog modes', () => {
    expect(isFogCarve('fog')).toBe(true);
    expect(isFogCarve('unfog')).toBe(true);
    expect(isFogCarve('add')).toBe(false);
    expect(isFogCarve('subtract')).toBe(false);
  });
});

describe('MapToolController.setMapMode (IN-031 — the Edit/View soft lock)', () => {
  it('defaults to view, locked (DEC-064)', () => {
    const ctrl = new MapToolController();
    expect(ctrl.mapMode).toBe('view');
  });

  it('entering view forces a carve/edit tool back to Pan', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'wall';
    ctrl.setMapMode('view');
    expect(ctrl.mapMode).toBe('view');
    expect(ctrl.activeTool).toBe('pan');
  });

  it('entering view leaves an already-active view tool alone', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'measure';
    ctrl.setMapMode('view');
    expect(ctrl.activeTool).toBe('measure');
  });

  it('returning to edit does not change whatever tool view left active', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'ngon';
    ctrl.setMapMode('view');
    expect(ctrl.activeTool).toBe('pan');
    ctrl.setMapMode('edit');
    expect(ctrl.mapMode).toBe('edit');
    expect(ctrl.activeTool).toBe('pan');
  });
});

describe('MapToolController.release (Battle map capture, SPEC-029 §1)', () => {
  it('clears a pending capture, unlike selectedMapRoomId', () => {
    const ctrl = new MapToolController();
    ctrl.pendingBattleCapture = { minX: 3, minY: 5, maxX: 6, maxY: 8 };
    ctrl.selectedMapRoomId = 'room-1';
    ctrl.release();
    expect(ctrl.pendingBattleCapture).toBeNull();
    expect(ctrl.selectedMapRoomId).toBe('room-1');
  });

  it('drops the battle-map flag, so the next map starts with a full palette', () => {
    const ctrl = new MapToolController();
    ctrl.setBattleMap(true);
    ctrl.release();
    expect(ctrl.isBattleMap).toBe(false);
  });
});

describe('MapToolController.setBattleMap (SPEC-029 §4 — view tools only)', () => {
  it('is off by default: an ordinary map offers the whole catalog', () => {
    expect(new MapToolController().isBattleMap).toBe(false);
  });

  it('entering a battle map forces a carve/edit tool back to Pan', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'room';
    ctrl.setBattleMap(true);
    expect(ctrl.isBattleMap).toBe(true);
    // A battle map's palette does not render Room at all, so leaving it
    // active would show no selection while the gesture stayed armed.
    expect(ctrl.activeTool).toBe('pan');
  });

  it('leaves an already-active view tool alone', () => {
    const ctrl = new MapToolController();
    for (const tool of ['pan', 'eye', 'measure', 'ping'] as MapToolId[]) {
      ctrl.activeTool = tool;
      ctrl.setBattleMap(true);
      expect(ctrl.activeTool).toBe(tool);
    }
  });

  it('leaving a battle map clears the flag without changing the tool', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'measure';
    ctrl.setBattleMap(true);
    ctrl.setBattleMap(false);
    expect(ctrl.isBattleMap).toBe(false);
    expect(ctrl.activeTool).toBe('measure');
  });
});

describe('MapToolController.setHexMap (SPEC-030 §5 — Select plus the View tools)', () => {
  it('is off by default, with nothing selected', () => {
    const ctrl = new MapToolController();
    expect(ctrl.isHexMap).toBe(false);
    expect(ctrl.selectedHex).toBeNull();
    expect(ctrl.selectedHexTile).toBeNull();
  });

  it('entering a hex map forces a carve or overlay tool back to Pan', () => {
    // Neither is in `HEX_TOOL_IDS`: a carve tool has no floor to carve, and an
    // overlay tool would store square-lattice geometry on an axial map
    // (RULE-006). Neither renders in the palette, so leaving one active would
    // arm a gesture with no button showing it.
    for (const tool of ['carve', 'symbol', 'label', 'pen', 'door'] as MapToolId[]) {
      const ctrl = new MapToolController();
      ctrl.activeTool = tool;
      ctrl.setHexMap(true);
      expect(ctrl.activeTool).toBe('pan');
    }
  });

  it('keeps Select, which is how a hex is picked at all', () => {
    const ctrl = new MapToolController();
    ctrl.activeTool = 'select';
    ctrl.setHexMap(true);
    expect(ctrl.activeTool).toBe('select');
  });

  it('leaves an already-active view tool alone', () => {
    const ctrl = new MapToolController();
    for (const tool of ['pan', 'eye', 'measure', 'ping'] as MapToolId[]) {
      ctrl.activeTool = tool;
      ctrl.setHexMap(true);
      expect(ctrl.activeTool).toBe(tool);
    }
  });

  it('leaving a hex map drops the hex selection with it', () => {
    // An axial coordinate names a hex on *that* map; carried onto the next one
    // it would point the sheet's writes at a hex nobody picked.
    const ctrl = new MapToolController();
    ctrl.setHexMap(true);
    ctrl.selectedHex = { q: 4, r: -2 };
    ctrl.selectedHexTile = { id: '4,-2', hex: { q: 4, r: -2 }, terrain: 'forest' };
    ctrl.setHexMap(false);
    expect(ctrl.selectedHex).toBeNull();
    expect(ctrl.selectedHexTile).toBeNull();
  });

  it('release drops the selection too, unlike selectedMapRoomId', () => {
    const ctrl = new MapToolController();
    ctrl.setHexMap(true);
    ctrl.selectedHex = { q: 0, r: 0 };
    ctrl.release();
    expect(ctrl.isHexMap).toBe(false);
    expect(ctrl.selectedHex).toBeNull();
  });
});

describe('DEFAULT_BAND_WIDTH (SPEC-028 §7)', () => {
  it('opens at a half cell under half snap and two cells otherwise', () => {
    expect(DEFAULT_BAND_WIDTH.half).toBe(0.5);
    expect(DEFAULT_BAND_WIDTH.full).toBe(2);
    expect(DEFAULT_BAND_WIDTH.free).toBe(2);
  });

  it('only ever names widths the Corridor and Path tools actually offer', () => {
    for (const w of Object.values(DEFAULT_BAND_WIDTH)) {
      expect(vectorMap.BAND_WIDTH_OPTIONS).toContain(w);
    }
  });

  it('setSnapMode carries the band width, which Corridor and Path share', () => {
    const ctrl = new MapToolController();
    expect(ctrl.bandWidth).toBe(2);
    ctrl.setSnapMode('half');
    expect(ctrl.bandWidth).toBe(0.5);
    ctrl.setSnapMode('full');
    expect(ctrl.bandWidth).toBe(2);
  });
});
