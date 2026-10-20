import { describe, expect, it } from 'vitest';
import { MapSelection } from './map-selection.svelte';
import type { Handle, ObjectSelection } from './vector-tools';

const handle = (id: string): Handle => ({
  owner: { kind: 'wall', id },
  point: { x: 0, y: 0 },
  ring: null,
  locate: () => ({ x: 0, y: 0 }),
});
const obj = (id: string, kind: ObjectSelection['kind'] = 'symbol'): ObjectSelection => ({
  kind,
  id,
});

/** A selection holding something in every slot, which the writer then replaces. */
function full(): MapSelection {
  const s = new MapSelection();
  s.handles = [handle('h')];
  s.objects = [obj('o')];
  s.tokenIds = ['t'];
  s.backgroundId = 'bg';
  return s;
}

describe('MapSelection writers keep the four slots exclusive', () => {
  it('selectHandles empties objects, tokens and the background', () => {
    const s = full();
    s.selectHandles([handle('a')]);
    expect(s.handles.map((h) => h.owner.id)).toEqual(['a']);
    expect(s.objects).toEqual([]);
    expect(s.tokenIds).toEqual([]);
    expect(s.backgroundId).toBeNull();
  });

  it('selectObjects empties handles, tokens and the background', () => {
    const s = full();
    s.selectObjects([obj('a')]);
    expect(s.objects).toEqual([obj('a')]);
    expect(s.handles).toEqual([]);
    expect(s.tokenIds).toEqual([]);
    expect(s.backgroundId).toBeNull();
  });

  it('selectGeometry sets handles and objects together and empties tokens and the background', () => {
    const s = full();
    s.selectGeometry([handle('a')], [obj('b')]);
    expect(s.handles).toHaveLength(1);
    expect(s.objects).toEqual([obj('b')]);
    expect(s.tokenIds).toEqual([]);
    expect(s.backgroundId).toBeNull();
  });

  it('selectTokens empties handles, objects and the background', () => {
    const s = full();
    s.selectTokens(['a', 'b']);
    expect(s.tokenIds).toEqual(['a', 'b']);
    expect(s.handles).toEqual([]);
    expect(s.objects).toEqual([]);
    expect(s.backgroundId).toBeNull();
  });

  it('selectBackground empties handles, objects and tokens', () => {
    const s = full();
    s.selectBackground('other');
    expect(s.backgroundId).toBe('other');
    expect(s.handles).toEqual([]);
    expect(s.objects).toEqual([]);
    expect(s.tokenIds).toEqual([]);
  });

  it('dropBackground clears only the background pick', () => {
    const s = full();
    s.dropBackground();
    expect(s.backgroundId).toBeNull();
    expect(s.handles).toHaveLength(1);
    expect(s.objects).toHaveLength(1);
    expect(s.tokenIds).toEqual(['t']);
  });

  it('clear empties every slot', () => {
    const s = full();
    s.clear();
    expect(s.handles).toEqual([]);
    expect(s.objects).toEqual([]);
    expect(s.tokenIds).toEqual([]);
    expect(s.backgroundId).toBeNull();
    expect(s.count).toBe(0);
  });
});

describe('MapSelection reads', () => {
  it('object is the single selected object, and null for none or several', () => {
    const s = new MapSelection();
    expect(s.object).toBeNull();
    s.selectObjects([obj('a', 'door')]);
    expect(s.object).toEqual(obj('a', 'door'));
    s.selectObjects([obj('a'), obj('b')]);
    expect(s.object).toBeNull();
  });

  it('count is handles plus objects plus a selectable background', () => {
    const s = new MapSelection();
    s.selectGeometry([handle('a'), handle('b')], [obj('c')]);
    expect(s.count).toBe(3);
    s.selectBackground('bg');
    expect(s.count).toBe(1);
  });

  it('count follows a token click, which the hand-called sync used to miss', () => {
    const s = new MapSelection();
    s.selectGeometry([handle('a')], []);
    expect(s.count).toBe(1);
    s.selectTokens(['t']);
    expect(s.count).toBe(0);
  });

  it('a background the handed getter rejects does not count', () => {
    let selectable = true;
    const s = new MapSelection(() => selectable);
    s.selectBackground('bg');
    expect(s.count).toBe(1);
    selectable = false;
    // The getter is read when `count` is read, so re-derive via a fresh write.
    s.selectBackground('bg');
    expect(s.count).toBe(0);
  });

  it('a background pick is handed the id it is asked about', () => {
    const seen: string[] = [];
    const s = new MapSelection((id) => {
      seen.push(id);
      return true;
    });
    s.selectBackground('bg-1');
    void s.count;
    expect(seen).toEqual(['bg-1']);
  });
});
