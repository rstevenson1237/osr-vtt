import { describe, expect, it, vi } from 'vitest';
import * as PIXI from 'pixi.js';
import {
  MemoryBackend,
  MemoryStore,
  snapFor,
  type Group,
  type SnapMode,
  type Token,
} from '@osr-vtt/shared';
import type { TokenPickerResult } from '../shell/dialogs.svelte';
import type { UndoEntry } from '../shell/undo-controller.svelte';
import { TOKEN_DRAG_MIME } from '../tokens/drag';
import { MapSelection } from './map-selection.svelte';
import { TokenLayerController, type TokenLayerDeps } from './token-layer.svelte';
import { TOKEN_PX } from './token-view';

const CELL = 48;

function token(id: string, x: number, y: number, over: Partial<Token> = {}): Token {
  return { id, pos: { x, y }, size: 1, layer: 'tokens', ...over } as Token;
}
function group(id: string, memberTokenIds: string[], over: Partial<Group> = {}): Group {
  return {
    id,
    name: id,
    memberTokenIds,
    showMap: true,
    showBoard: true,
    active: false,
    ...over,
  } as Group;
}

interface SetupOver {
  tokens?: Token[];
  groups?: Group[];
  tool?: string;
  isGM?: boolean;
  myUid?: string | null;
  present?: Set<string>;
  visible?: Set<string>;
  revealed?: boolean;
  hidden?: Set<string>;
  currentTurn?: Set<string>;
  noEngine?: boolean;
  picked?: TokenPickerResult | null;
  loadArt?: (url: string, ref: string) => Promise<PIXI.Texture>;
}

function setup(over: SetupOver = {}) {
  const state = {
    tokens: over.tokens ?? [],
    groups: over.groups ?? [],
    tool: over.tool ?? 'select',
    isGM: over.isGM ?? true,
    myUid: over.myUid === undefined ? 'seat-me' : over.myUid,
    present: over.present ?? new Set<string>(),
    visible: over.visible,
    revealed: over.revealed ?? true,
    hidden: over.hidden ?? new Set<string>(),
    currentTurn: over.currentTurn ?? new Set<string>(),
    cellSize: CELL,
    engineOn: !over.noEngine,
  };
  const layer = new PIXI.Container();
  const world = new PIXI.Container();
  const generateTexture = vi.fn(() => PIXI.Texture.EMPTY);
  const engine = {
    layers: { tokens: layer },
    world,
    app: {
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      renderer: { generateTexture },
    },
  };

  const store = new MemoryStore(new MemoryBackend());
  let nextId = 0;
  const moveToken = vi.spyOn(store, 'moveToken').mockResolvedValue(undefined);
  const moveTokens = vi.spyOn(store, 'moveTokens').mockResolvedValue(undefined);
  const createToken = vi
    .spyOn(store, 'createToken')
    .mockImplementation(async () => `new-${nextId++}`);
  const createGroup = vi.spyOn(store, 'createGroup').mockResolvedValue('g-new');
  const publishPing = vi.spyOn(store, 'publishPing').mockImplementation(() => {});
  const publishDrag = vi.spyOn(store, 'publishDrag').mockImplementation(() => {});
  const clearDrag = vi.spyOn(store, 'clearDrag').mockImplementation(() => {});

  const selection = new MapSelection();
  const mapCtrl = {
    tokenSnap: 'cell' as SnapMode,
    sheetDragTokenId: null as string | null,
    selectedToken: null as Token | null,
  };
  const undo: UndoEntry[] = [];
  const pickToken = vi.fn(async () => (over.picked === undefined ? null : over.picked));
  const aimEye = vi.fn();
  const onSelectActor = vi.fn();
  const loadArt = vi.fn(over.loadArt ?? (async () => PIXI.Texture.EMPTY));

  const deps: TokenLayerDeps = {
    store,
    roomId: 'room',
    mapCtrl,
    selection,
    engine: () => (state.engineOn ? engine : null),
    pushUndo: (entry) => undo.push(entry),
    dialogs: { pickToken },
    resolveAsset: (ref) => (ref.startsWith('img:') ? `https://cdn/${ref.slice(4)}` : ref),
    loadArt,
    aimEye,
    onSelectActor,
    tokens: () => state.tokens,
    groups: () => state.groups,
    renderableTokens: () => state.tokens,
    tool: () => state.tool as ReturnType<TokenLayerDeps['tool']>,
    isGM: () => state.isGM,
    myUid: () => state.myUid,
    presentSeatIds: () => state.present,
    mapVisibleIds: () => state.visible ?? new Set(state.tokens.map((t) => t.id)),
    revealedAt: () => state.revealed,
    currentTurnIds: () => state.currentTurn,
    hiddenTokenIds: () => state.hidden,
    collapsedGroups: () => state.groups.filter((g) => g.collapsed && g.memberTokenIds.length > 0),
    measure: () => null,
    cellSize: () => state.cellSize,
    hexSize: () => undefined,
  };
  const ctrl = new TokenLayerController(deps);

  /** The per-token containers, in creation order — the ring layer is always the
   * last child of the layer. */
  const containers = () => layer.children.slice(0, -1) as PIXI.Container[];
  const spriteOf = (c: PIXI.Container) =>
    c.children.find((k) => k instanceof PIXI.Sprite) as PIXI.Sprite;
  const pointer = (over: Partial<PIXI.FederatedPointerEvent> & { x?: number; y?: number } = {}) =>
    ({
      shiftKey: false,
      altKey: false,
      global: new PIXI.Point(over.x ?? 0, over.y ?? 0),
      stopPropagation: vi.fn(),
      ...over,
    }) as unknown as PIXI.FederatedPointerEvent & { stopPropagation: ReturnType<typeof vi.fn> };
  /** Syncs `state.tokens` and returns each token's sprite by id. */
  const syncAll = () => {
    ctrl.sync(state.tokens);
    const byId = new Map<string, PIXI.Sprite>();
    state.tokens.forEach((t, i) => byId.set(t.id, spriteOf(containers()[i]!)));
    return byId;
  };

  return {
    ctrl,
    state,
    layer,
    world,
    store,
    selection,
    mapCtrl,
    undo,
    pickToken,
    aimEye,
    onSelectActor,
    loadArt,
    generateTexture,
    moveToken,
    moveTokens,
    createToken,
    createGroup,
    publishPing,
    publishDrag,
    clearDrag,
    containers,
    spriteOf,
    pointer,
    syncAll,
  };
}

/** Lets the in-flight `loadArt` promise settle. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('TokenLayerController sprite lifecycle', () => {
  it('draws one container per token at its position, below the ring layer', () => {
    const t = setup({ tokens: [token('a', 96, 48), token('b', 144, 48, { size: 2 })] });
    t.ctrl.sync(t.state.tokens);
    const [a, b] = t.containers();
    expect(t.layer.children).toHaveLength(3);
    expect(t.layer.children[2]).toBeInstanceOf(PIXI.RenderLayer);
    expect([a!.position.x, a!.position.y]).toEqual([96, 48]);
    expect([b!.position.x, b!.position.y]).toEqual([144, 48]);
    const sprite = t.spriteOf(b!);
    expect([sprite.width, sprite.height]).toEqual([TOKEN_PX * 2, TOKEN_PX * 2]);
    // disc, art, ring — the always-present children, back to front
    expect(a!.children).toHaveLength(3);
    expect(a!.eventMode).toBe('passive');
    expect(t.spriteOf(a!).eventMode).toBe('static');
  });

  it('moves an existing container when the token moves, and destroys the one that goes', () => {
    const t = setup({ tokens: [token('a', 96, 48), token('b', 144, 48)] });
    t.ctrl.sync(t.state.tokens);
    const [a] = t.containers();
    t.state.tokens = [token('a', 192, 96)];
    t.ctrl.sync(t.state.tokens);
    expect(t.containers()).toHaveLength(1);
    expect(t.containers()[0]).toBe(a);
    expect([a!.position.x, a!.position.y]).toEqual([192, 96]);
  });

  it('does nothing without an engine', () => {
    const t = setup({ tokens: [token('a', 0, 0)], noEngine: true });
    t.ctrl.sync(t.state.tokens);
    expect(t.layer.children).toHaveLength(0);
  });

  it('leaves a token under drag where the drag holds it', () => {
    const t = setup({ tokens: [token('a', 96, 48)] });
    const sprites = t.syncAll();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('a')!.emit('globalpointermove', t.pointer({ x: 300, y: 200 }));
    t.state.tokens = [token('a', 96, 48)];
    t.ctrl.sync(t.state.tokens);
    expect([t.containers()[0]!.position.x, t.containers()[0]!.position.y]).toEqual([300, 200]);
  });

  it('shows a token ownership affordance: grab when actionable, pointer when not', () => {
    const t = setup({
      tokens: [token('mine', 0, 0, { ownerSeatId: 'seat-me' }), token('theirs', 48, 0)],
      isGM: false,
    });
    const sprites = t.syncAll();
    expect(sprites.get('mine')!.cursor).toBe('grab');
    expect(sprites.get('theirs')!.cursor).toBe('pointer');
  });

  it('dims a token the players cannot see, tints the current turn and hides a hidden one', () => {
    const t = setup({
      tokens: [token('a', 0, 0), token('b', 48, 0), token('c', 96, 0)],
      visible: new Set(['b', 'c']),
      currentTurn: new Set(['b']),
      hidden: new Set(['c']),
    });
    const sprites = t.syncAll();
    expect(sprites.get('a')!.alpha).toBe(0.4);
    expect(sprites.get('b')!.alpha).toBe(1);
    expect(sprites.get('b')!.tint).toBe(0xffd699);
    expect(sprites.get('a')!.tint).toBe(0xffffff);
    expect(sprites.get('c')!.visible).toBe(false);
    const [, , c] = t.containers();
    // the ring follows the token's visibility
    expect(c!.children[c!.children.length - 1]!.visible).toBe(false);
  });

  it('dims an away owner with min(), not a product, and badges it', () => {
    const t = setup({
      tokens: [
        token('away', 0, 0, { ownerSeatId: 'seat-x' }),
        token('hiddenAway', 48, 0, { ownerSeatId: 'seat-x' }),
        token('here', 96, 0, { ownerSeatId: 'seat-here' }),
      ],
      visible: new Set(['away', 'here']),
      present: new Set(['seat-here']),
    });
    const sprites = t.syncAll();
    expect(sprites.get('away')!.alpha).toBe(0.42);
    // 0.4 is already below the presence dim, so min keeps 0.4
    expect(sprites.get('hiddenAway')!.alpha).toBe(0.4);
    expect(sprites.get('here')!.alpha).toBe(1);
    const [away, , here] = t.containers();
    // disc, art, away badge, ring
    expect(away!.children).toHaveLength(4);
    expect(here!.children).toHaveLength(3);
    const badge = away!.children[2] as PIXI.Graphics;
    expect([badge.position.x, badge.position.y]).toEqual([TOKEN_PX * 0.36, TOKEN_PX * 0.36]);
  });

  it('removes the away badge once the owner is back', () => {
    const t = setup({ tokens: [token('a', 0, 0, { ownerSeatId: 'seat-x' })] });
    t.syncAll();
    expect(t.containers()[0]!.children).toHaveLength(4);
    t.state.present = new Set(['seat-x']);
    t.ctrl.sync(t.state.tokens);
    expect(t.containers()[0]!.children).toHaveLength(3);
  });

  it('draws the colour disc only for a token that has a colour', () => {
    const t = setup({ tokens: [token('a', 0, 0, { color: '#ff0000' }), token('b', 48, 0)] });
    t.ctrl.sync(t.state.tokens);
    const [a, b] = t.containers();
    expect((a!.children[0] as PIXI.Graphics).context.instructions.length).toBeGreaterThan(0);
    expect((b!.children[0] as PIXI.Graphics).context.instructions).toHaveLength(0);
  });
});

describe('TokenLayerController token letters and group badges', () => {
  it('draws a letter child and mirrors every drawn letter, sorted', () => {
    const t = setup({
      tokens: [
        token('a', 0, 0, { letter: 'B' }),
        token('b', 48, 0, { letter: 'A', ownerSeatId: 'seat-x' }),
        token('c', 96, 0),
      ],
    });
    t.ctrl.sync(t.state.tokens);
    expect(t.ctrl.tokenLetterText).toBe('A:character B:creature');
    const [a, , c] = t.containers();
    // disc, art, letter, ring
    expect(a!.children).toHaveLength(4);
    expect(a!.children[2]).toBeInstanceOf(PIXI.Text);
    expect(c!.children).toHaveLength(3);
  });

  it('drops the letter when the token loses it', () => {
    const t = setup({ tokens: [token('a', 0, 0, { letter: 'B' })] });
    t.ctrl.sync(t.state.tokens);
    t.state.tokens = [token('a', 0, 0)];
    t.ctrl.sync(t.state.tokens);
    expect(t.containers()[0]!.children).toHaveLength(3);
    expect(t.ctrl.tokenLetterText).toBe('');
  });

  it('puts a collapsed group’s count badge on its anchor and moves it with a new anchor', () => {
    const tokens = [token('a', 0, 0), token('b', 0, 0), token('c', 200, 0)];
    const t = setup({
      tokens,
      groups: [group('g', ['a', 'b'], { collapsed: true, anchorTokenId: 'a' })],
      hidden: new Set(['b']),
    });
    t.ctrl.sync(tokens);
    const badgeOn = (c: PIXI.Container) =>
      c.children.find(
        (k) =>
          k.label !== 'count' &&
          k instanceof PIXI.Container &&
          !(k instanceof PIXI.Sprite) &&
          !(k instanceof PIXI.Graphics) &&
          !(k instanceof PIXI.Text),
      ) as PIXI.Container | undefined;
    const [a, b] = t.containers();
    const badge = badgeOn(a!)!;
    expect(badge).toBeDefined();
    expect((badge.getChildByLabel('count') as PIXI.Text).text).toBe('2');
    expect([badge.position.x, badge.position.y]).toEqual([TOKEN_PX * 0.35, -TOKEN_PX * 0.35]);
    expect(badgeOn(b!)).toBeUndefined();
    // the anchor changes: the same badge is re-parented, not rebuilt
    t.state.groups = [group('g', ['a', 'b'], { collapsed: true, anchorTokenId: 'b' })];
    t.ctrl.sync(tokens);
    expect(badgeOn(a!)).toBeUndefined();
    expect(badgeOn(b!)).toBe(badge);
  });

  it('draws no badge for a group whose anchor the viewer cannot see, and removes a stale one', () => {
    const tokens = [token('a', 0, 0), token('b', 48, 0)];
    const t = setup({
      tokens,
      groups: [group('g', ['a', 'b'], { collapsed: true, anchorTokenId: 'a' })],
    });
    t.ctrl.sync([tokens[1]!]);
    expect(t.containers()[0]!.children).toHaveLength(3);
    t.ctrl.sync(tokens);
    // `b` was drawn first, so the anchor `a` is the second container
    expect(t.containers()[1]!.children).toHaveLength(4);
    t.state.groups = [];
    t.ctrl.sync(tokens);
    expect(t.containers()[1]!.children).toHaveLength(3);
  });
});

describe('TokenLayerController token art', () => {
  it('loads art once per ref and reloads when the ref changes', async () => {
    const t = setup({ tokens: [token('a', 0, 0, { imageRef: 'https://x/a.png' })] });
    t.ctrl.sync(t.state.tokens);
    t.ctrl.sync(t.state.tokens);
    await flush();
    expect(t.loadArt).toHaveBeenCalledTimes(1);
    expect(t.loadArt).toHaveBeenCalledWith('https://x/a.png', 'https://x/a.png');
    t.state.tokens = [token('a', 0, 0, { imageRef: 'https://x/b.png' })];
    t.ctrl.sync(t.state.tokens);
    await flush();
    expect(t.loadArt).toHaveBeenCalledTimes(2);
  });

  it('falls back to the plain texture and raises no badge for a token with no art', async () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    const sprites = t.syncAll();
    await flush();
    expect(t.loadArt).not.toHaveBeenCalled();
    expect(sprites.get('a')!.texture).toBe(PIXI.Texture.WHITE);
    expect(t.ctrl.brokenTokenCount).toBe(0);
  });

  it('keys an img: ref by what it resolves to, so it reloads when the image arrives', () => {
    const t = setup();
    expect(t.ctrl.textureKey(undefined)).toBeUndefined();
    expect(t.ctrl.textureKey('https://x/a.png')).toBe('https://x/a.png');
    expect(t.ctrl.textureKey('img:abc')).toBe('img:abc https://cdn/abc');
  });

  it('shows a failed load with a placeholder texture and a badge, and retries on a new ref', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup({
      tokens: [token('a', 0, 0, { imageRef: 'https://x/dead.png' })],
      loadArt: async (url) => {
        if (url.includes('dead')) throw new Error('nope');
        return PIXI.Texture.EMPTY;
      },
    });
    const sprites = t.syncAll();
    await flush();
    expect(t.ctrl.brokenTokenCount).toBe(1);
    expect(sprites.get('a')!.texture).toBe(PIXI.Texture.EMPTY);
    expect(t.generateTexture).toHaveBeenCalledTimes(1);
    // disc, art, broken badge, ring
    expect(t.containers()[0]!.children).toHaveLength(4);
    const badge = t.containers()[0]!.children[2] as PIXI.Graphics;
    expect([badge.position.x, badge.position.y]).toEqual([-TOKEN_PX * 0.36, TOKEN_PX * 0.36]);

    // a second broken token reuses the cached placeholder texture
    t.state.tokens = [
      token('a', 0, 0, { imageRef: 'https://x/dead.png' }),
      token('b', 48, 0, { imageRef: 'https://x/dead2.png' }),
    ];
    t.ctrl.sync(t.state.tokens);
    await flush();
    expect(t.ctrl.brokenTokenCount).toBe(2);
    expect(t.generateTexture).toHaveBeenCalledTimes(1);

    // a new ref clears the failure and retries
    t.state.tokens = [token('a', 0, 0, { imageRef: 'https://x/ok.png' })];
    t.ctrl.sync(t.state.tokens);
    await flush();
    expect(t.ctrl.brokenTokenCount).toBe(0);
    expect(t.containers()[0]!.children).toHaveLength(3);
    warn.mockRestore();
  });
});

describe('TokenLayerController click and focus', () => {
  it('selects the clicked token, focuses it and raises its owner’s sheet', () => {
    const tokens = [token('a', 96, 96, { ownerSeatId: 'seat-a' })];
    const t = setup({ tokens });
    const sprite = t.syncAll().get('a')!;
    const e = t.pointer();
    sprite.emit('pointerdown', e);
    expect(t.selection.tokenIds).toEqual(['a']);
    expect(t.ctrl.selectedTokenId).toBe('a');
    expect(t.mapCtrl.selectedToken).toBe(tokens[0]);
    expect(t.onSelectActor).toHaveBeenCalledWith('seat-a');
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it('does not raise a sheet for a creature', () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    t.syncAll().get('a')!.emit('pointerdown', t.pointer());
    expect(t.onSelectActor).not.toHaveBeenCalled();
  });

  it('clears geometry selection when a token is picked', () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    t.selection.selectObjects([{ kind: 'symbol', id: 's' }]);
    t.syncAll().get('a')!.emit('pointerdown', t.pointer());
    expect(t.selection.objects).toEqual([]);
    expect(t.selection.tokenIds).toEqual(['a']);
  });

  it('Shift-click toggles a token in the selection, and a deselect starts no drag', () => {
    const t = setup({ tokens: [token('a', 0, 0), token('b', 48, 0)] });
    const sprites = t.syncAll();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('b')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    expect(t.selection.tokenIds).toEqual(['a', 'b']);
    sprites.get('b')!.emit('pointerup', t.pointer());
    t.moveToken.mockClear();
    t.moveTokens.mockClear();
    sprites.get('b')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    expect(t.selection.tokenIds).toEqual(['a']);
    sprites.get('b')!.emit('globalpointermove', t.pointer({ x: 500, y: 500 }));
    sprites.get('b')!.emit('pointerup', t.pointer());
    expect(t.moveToken).not.toHaveBeenCalled();
    expect(t.moveTokens).not.toHaveBeenCalled();
  });

  it('a plain click on a member of the selection keeps the whole set', () => {
    const t = setup({ tokens: [token('a', 0, 0), token('b', 48, 0)] });
    const sprites = t.syncAll();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('b')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    sprites.get('a')!.emit('pointerdown', t.pointer());
    expect(t.selection.tokenIds).toEqual(['a', 'b']);
  });

  it('Ping publishes the token’s position and picks nothing up', () => {
    const t = setup({ tokens: [token('a', 96, 48)], tool: 'ping' });
    const e = t.pointer();
    t.syncAll().get('a')!.emit('pointerdown', e);
    expect(t.publishPing).toHaveBeenCalledWith('room', { x: 96, y: 48 });
    expect(t.selection.tokenIds).toEqual([]);
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it('Eye hands the token’s pixel position to the component and picks nothing up', () => {
    const t = setup({ tokens: [token('a', 96, 48)], tool: 'eye' });
    const e = t.pointer();
    t.syncAll().get('a')!.emit('pointerdown', e);
    expect(t.aimEye).toHaveBeenCalledWith({ x: 96, y: 48 });
    expect(t.selection.tokenIds).toEqual([]);
    expect(t.ctrl.selectedTokenId).toBeNull();
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it('focus follows a token, and is null-safe for one that has gone', () => {
    const tokens = [token('a', 0, 0)];
    const t = setup({ tokens });
    t.ctrl.focus('a');
    expect(t.ctrl.selectedTokenId).toBe('a');
    expect(t.mapCtrl.selectedToken).toBe(tokens[0]);
    t.ctrl.focus('gone');
    expect(t.ctrl.selectedTokenId).toBe('gone');
    expect(t.mapCtrl.selectedToken).toBeNull();
  });
});

describe('TokenLayerController drag', () => {
  it('moves the container with the pointer, publishes drag frames, and snaps on drop', () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    expect(sprite.cursor).toBe('grabbing');
    sprite.emit('globalpointermove', t.pointer({ x: 203, y: 131 }));
    const container = t.containers()[0]!;
    expect([container.position.x, container.position.y]).toEqual([203, 131]);
    expect(t.publishDrag).toHaveBeenCalledWith('room', 'a', { x: 203, y: 131 });
    sprite.emit('pointerup', t.pointer());
    const snapped = snapFor('token', 'cell', { x: 203, y: 131 }, { cellSize: CELL, size: 1 });
    expect([container.position.x, container.position.y]).toEqual([snapped.x, snapped.y]);
    expect(t.moveToken).toHaveBeenCalledWith('room', 'a', snapped);
    expect(t.ctrl.lastBatchMoveCount).toBe(1);
    expect(t.clearDrag).toHaveBeenCalledWith('room', 'a');
    expect(sprite.cursor).toBe('grab');
  });

  it('honours the snap modifiers and the rail’s snap mode', () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    t.mapCtrl.tokenSnap = 'free';
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('globalpointermove', t.pointer({ x: 203, y: 131 }));
    sprite.emit('pointerup', t.pointer());
    expect(t.moveToken).toHaveBeenLastCalledWith('room', 'a', { x: 203, y: 131 });
  });

  it('pushes one undo entry that moves the token back and forth', async () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('globalpointermove', t.pointer({ x: 300, y: 300 }));
    sprite.emit('pointerup', t.pointer());
    await flush();
    const to = t.moveToken.mock.calls[0]![2];
    expect(t.undo).toHaveLength(1);
    await t.undo[0]!.undo();
    expect(t.moveToken).toHaveBeenLastCalledWith('room', 'a', { x: 96, y: 96 });
    await t.undo[0]!.redo();
    expect(t.moveToken).toHaveBeenLastCalledWith('room', 'a', to);
  });

  it('writes a same-position drop but pushes no undo entry for it', async () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    t.mapCtrl.tokenSnap = 'free';
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('pointerup', t.pointer());
    await flush();
    expect(t.moveToken).toHaveBeenCalledTimes(1);
    expect(t.undo).toHaveLength(0);
  });

  it('lets a token its seat may not act on be selected but not moved', () => {
    const t = setup({ tokens: [token('a', 96, 96)], isGM: false });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    expect(t.selection.tokenIds).toEqual(['a']);
    expect(sprite.cursor).toBe('pointer');
    sprite.emit('globalpointermove', t.pointer({ x: 500, y: 500 }));
    sprite.emit('pointerup', t.pointer());
    expect(t.containers()[0]!.position.x).toBe(96);
    expect(t.moveToken).not.toHaveBeenCalled();
    expect(t.publishDrag).not.toHaveBeenCalled();
  });

  it('ignores a release that no drag began', () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerup', t.pointer());
    sprite.emit('pointerupoutside', t.pointer());
    expect(t.moveToken).not.toHaveBeenCalled();
    expect(t.clearDrag).not.toHaveBeenCalled();
  });

  it('drops on pointerupoutside as well', () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('globalpointermove', t.pointer({ x: 300, y: 300 }));
    sprite.emit('pointerupoutside', t.pointer());
    expect(t.moveToken).toHaveBeenCalledTimes(1);
  });

  it('shows a distance chip while dragging and destroys it on drop', () => {
    const t = setup({ tokens: [token('a', 96, 96)] });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('globalpointermove', t.pointer({ x: 96 + CELL * 3, y: 96 }));
    const chips = () => t.world.children.filter((c) => c instanceof PIXI.Text);
    expect(chips()).toHaveLength(1);
    expect((chips()[0] as PIXI.Text).position.x).toBe(96 + CELL * 3 + 14);
    sprite.emit('globalpointermove', t.pointer({ x: 96 + CELL * 4, y: 96 }));
    expect(chips()).toHaveLength(1);
    sprite.emit('pointerup', t.pointer());
    expect(chips()).toHaveLength(0);
  });

  it('writes one batched move for a collapsed group dragged by its anchor', async () => {
    const tokens = [token('a', 96, 96), token('b', 96, 96), token('c', 96, 96)];
    const g = group('g', ['a', 'b', 'c'], {
      collapsed: true,
      anchorTokenId: 'a',
      memberOffsets: { a: { x: 0, y: 0 }, b: { x: 48, y: 0 }, c: { x: 0, y: 48 } },
    });
    const t = setup({ tokens, groups: [g], hidden: new Set(['b', 'c']) });
    const sprite = t.syncAll().get('a')!;
    sprite.emit('pointerdown', t.pointer());
    sprite.emit('globalpointermove', t.pointer({ x: 300, y: 300 }));
    sprite.emit('pointerup', t.pointer());
    await flush();
    const snapped = snapFor('token', 'cell', { x: 300, y: 300 }, { cellSize: CELL, size: 1 });
    expect(t.moveTokens).toHaveBeenCalledWith('room', [
      { tokenId: 'a', pos: snapped },
      { tokenId: 'b', pos: { x: snapped.x + 48, y: snapped.y } },
      { tokenId: 'c', pos: { x: snapped.x, y: snapped.y + 48 } },
    ]);
    expect(t.moveToken).not.toHaveBeenCalled();
    expect(t.ctrl.lastBatchMoveCount).toBe(3);
    expect(t.undo).toHaveLength(1);
    await t.undo[0]!.undo();
    expect(t.moveTokens).toHaveBeenLastCalledWith('room', [
      { tokenId: 'a', pos: { x: 96, y: 96 } },
      { tokenId: 'b', pos: { x: 144, y: 96 } },
      { tokenId: 'c', pos: { x: 96, y: 144 } },
    ]);
  });

  it('drags every other selected, actionable token along as a set, formation preserved', async () => {
    const tokens = [token('a', 96, 96), token('b', 192, 96), token('c', 96, 192)];
    const t = setup({ tokens });
    // free snap: the setup clicks must not quantize the pickup positions
    t.mapCtrl.tokenSnap = 'free';
    const sprites = t.syncAll();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('b')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    sprites.get('c')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    sprites.get('a')!.emit('pointerup', t.pointer());
    sprites.get('b')!.emit('pointerup', t.pointer());
    sprites.get('c')!.emit('pointerup', t.pointer());
    await flush();
    t.moveToken.mockClear();
    t.moveTokens.mockClear();
    t.undo.length = 0;

    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('a')!.emit('globalpointermove', t.pointer({ x: 200, y: 150 }));
    const [a, b, c] = t.containers();
    expect([b!.position.x, b!.position.y]).toEqual([296, 150]);
    expect([c!.position.x, c!.position.y]).toEqual([200, 246]);
    // members are held where the drag puts them, not re-synced under it
    t.ctrl.sync(tokens);
    expect([b!.position.x, b!.position.y]).toEqual([296, 150]);
    sprites.get('a')!.emit('pointerup', t.pointer());
    await flush();
    const snapped = { x: a!.position.x, y: a!.position.y };
    expect(t.moveTokens).toHaveBeenCalledWith('room', [
      { tokenId: 'a', pos: snapped },
      { tokenId: 'b', pos: { x: snapped.x + 96, y: snapped.y } },
      { tokenId: 'c', pos: { x: snapped.x, y: snapped.y + 96 } },
    ]);
    expect(t.ctrl.lastBatchMoveCount).toBe(3);
    expect(t.undo).toHaveLength(1);
    await t.undo[0]!.undo();
    expect(t.moveTokens).toHaveBeenLastCalledWith('room', [
      { tokenId: 'a', pos: { x: 96, y: 96 } },
      { tokenId: 'b', pos: { x: 192, y: 96 } },
      { tokenId: 'c', pos: { x: 96, y: 192 } },
    ]);
    // the set is released: a later sync puts every token back where the roster says
    t.ctrl.sync(tokens);
    expect([b!.position.x, b!.position.y]).toEqual([192, 96]);
  });

  it('touches no passenger when a click on a selected set never moved', () => {
    const tokens = [token('a', 96, 96), token('b', 192, 96)];
    const t = setup({ tokens });
    const sprites = t.syncAll();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('b')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    sprites.get('b')!.emit('pointerup', t.pointer());
    sprites.get('a')!.emit('pointerup', t.pointer());
    t.moveToken.mockClear();
    t.moveTokens.mockClear();
    sprites.get('a')!.emit('pointerdown', t.pointer());
    sprites.get('a')!.emit('pointerup', t.pointer());
    expect(t.moveTokens).not.toHaveBeenCalled();
    expect(t.moveToken).toHaveBeenCalledTimes(1);
    expect(t.moveToken.mock.calls[0]![1]).toBe('a');
    expect(t.ctrl.lastBatchMoveCount).toBe(1);
  });

  it('leaves a token the seat may not act on out of a set drag', async () => {
    const tokens = [
      token('mine', 96, 96, { ownerSeatId: 'seat-me' }),
      token('theirs', 192, 96, { ownerSeatId: 'seat-other' }),
    ];
    const t = setup({ tokens, isGM: false });
    const sprites = t.syncAll();
    sprites.get('mine')!.emit('pointerdown', t.pointer());
    sprites.get('theirs')!.emit('pointerdown', t.pointer({ shiftKey: true }));
    sprites.get('theirs')!.emit('pointerup', t.pointer());
    sprites.get('mine')!.emit('pointerdown', t.pointer());
    sprites.get('mine')!.emit('globalpointermove', t.pointer({ x: 300, y: 300 }));
    expect(t.containers()[1]!.position.x).toBe(192);
    sprites.get('mine')!.emit('pointerup', t.pointer());
    await flush();
    expect(t.moveTokens).not.toHaveBeenCalled();
    expect(t.moveToken).toHaveBeenCalledTimes(1);
  });

  it('destroy() forgets the layer’s lookups so a fresh sync rebuilds', () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    t.ctrl.sync(t.state.tokens);
    t.ctrl.destroy();
    t.layer.removeChildren();
    t.ctrl.sync(t.state.tokens);
    expect(t.containers()).toHaveLength(1);
    expect(t.layer.children[1]).toBeInstanceOf(PIXI.RenderLayer);
  });
});

function dropEvent(payload: unknown, over: Partial<DragEvent> = {}): DragEvent {
  const types = payload === undefined ? [] : [TOKEN_DRAG_MIME];
  return {
    dataTransfer: {
      types,
      dropEffect: 'none',
      getData: (mime: string) =>
        mime === TOKEN_DRAG_MIME && payload !== undefined ? JSON.stringify(payload) : '',
    },
    clientX: 0,
    clientY: 0,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...over,
  } as unknown as DragEvent;
}

describe('TokenLayerController quick-sheet drop', () => {
  it('accepts a dragover only when it carries a token', () => {
    const t = setup();
    const ours = dropEvent({ tokenId: null, seatId: 's' });
    t.ctrl.onCanvasDragOver(ours);
    expect(ours.preventDefault).toHaveBeenCalled();
    expect(ours.dataTransfer!.dropEffect).toBe('move');
    const foreign = dropEvent(undefined);
    t.ctrl.onCanvasDragOver(foreign);
    expect(foreign.preventDefault).not.toHaveBeenCalled();
  });

  it('moves the dragged character’s existing token to the snapped drop, undoably', async () => {
    const t = setup({ tokens: [token('a', 96, 96, { size: 2 })] });
    t.mapCtrl.sheetDragTokenId = 'a';
    const e = dropEvent({ tokenId: 'a', seatId: 's' }, { clientX: 203, clientY: 131 });
    await t.ctrl.onCanvasDrop(e);
    const snapped = snapFor('token', 'cell', { x: 203, y: 131 }, { cellSize: CELL, size: 2 });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(t.mapCtrl.sheetDragTokenId).toBeNull();
    expect(t.moveToken).toHaveBeenCalledWith('room', 'a', snapped);
    expect(t.ctrl.lastBatchMoveCount).toBe(1);
    expect(t.undo).toHaveLength(1);
    await t.undo[0]!.undo();
    expect(t.moveToken).toHaveBeenLastCalledWith('room', 'a', { x: 96, y: 96 });
    expect(t.createToken).not.toHaveBeenCalled();
  });

  it('measures the drop from the canvas rect, through the world transform', async () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    t.mapCtrl.tokenSnap = 'free';
    t.world.position.set(10, 20);
    t.world.scale.set(2);
    await t.ctrl.onCanvasDrop(
      dropEvent({ tokenId: 'a', seatId: 's' }, { clientX: 110, clientY: 120 }),
    );
    expect(t.moveToken).toHaveBeenCalledWith('room', 'a', { x: 50, y: 50 });
  });

  it('creates a token for a character that has none, with the art or letter it travelled with', async () => {
    const t = setup();
    await t.ctrl.onCanvasDrop(
      dropEvent(
        { tokenId: null, seatId: 'seat-a', imageRef: 'https://x/a.png' },
        { clientX: 100, clientY: 100 },
      ),
    );
    await t.ctrl.onCanvasDrop(
      dropEvent(
        { tokenId: null, seatId: 'seat-b', letter: 'Q', color: '#112233' },
        { clientX: 100, clientY: 100 },
      ),
    );
    const snapped = snapFor('token', 'cell', { x: 100, y: 100 }, { cellSize: CELL, size: 1 });
    expect(t.createToken).toHaveBeenNthCalledWith(1, 'room', {
      pos: snapped,
      size: 1,
      layer: 'tokens',
      imageRef: 'https://x/a.png',
      ownerSeatId: 'seat-a',
    });
    expect(t.createToken).toHaveBeenNthCalledWith(2, 'room', {
      pos: snapped,
      size: 1,
      layer: 'tokens',
      letter: 'Q',
      color: '#112233',
      ownerSeatId: 'seat-b',
    });
    expect(t.moveToken).not.toHaveBeenCalled();
  });

  it('clears the sheet drag but writes nothing for a drop that is not ours or has no engine', async () => {
    const t = setup({ tokens: [token('a', 0, 0)] });
    t.mapCtrl.sheetDragTokenId = 'a';
    const foreign = dropEvent(undefined);
    await t.ctrl.onCanvasDrop(foreign);
    expect(t.mapCtrl.sheetDragTokenId).toBeNull();
    expect(foreign.preventDefault).not.toHaveBeenCalled();

    const noEngine = setup({ tokens: [token('a', 0, 0)], noEngine: true });
    noEngine.mapCtrl.sheetDragTokenId = 'a';
    await noEngine.ctrl.onCanvasDrop(dropEvent({ tokenId: 'a', seatId: 's' }));
    expect(noEngine.mapCtrl.sheetDragTokenId).toBeNull();
    for (const w of [t, noEngine]) {
      expect(w.moveToken).not.toHaveBeenCalled();
      expect(w.createToken).not.toHaveBeenCalled();
    }
  });
});

function picked(over: Partial<TokenPickerResult> = {}): TokenPickerResult {
  return { ref: '', count: 1, groupName: '', name: '', ...over };
}

describe('TokenLayerController addCreature', () => {
  it('opens the creature picker and writes nothing when it is cancelled', async () => {
    const t = setup({ picked: null });
    await t.ctrl.addCreature();
    expect(t.pickToken).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room', mode: 'creature', genDefaultLabel: 'A' }),
    );
    expect(t.createToken).not.toHaveBeenCalled();
    expect(t.createGroup).not.toHaveBeenCalled();
  });

  it('drops a generated batch one cell apart from the starter point, then groups it', async () => {
    const t = setup({
      tokens: [token('x', 0, 0), token('y', 0, 0)],
      picked: picked({ count: 3, name: 'Goblin', groupName: 'Goblins' }),
    });
    await t.ctrl.addCreature();
    expect(t.createToken).toHaveBeenCalledTimes(3);
    const calls = t.createToken.mock.calls.map((c) => c[1]);
    // two tokens already on the map: the starter x steps from `tokens.length`
    expect(calls.map((c) => c.pos)).toEqual([
      { x: 160 + 2 * CELL, y: 160 },
      { x: 160 + 3 * CELL, y: 160 },
      { x: 160 + 4 * CELL, y: 160 },
    ]);
    expect(calls.map((c) => c.letter)).toEqual(['A', 'B', 'C']);
    expect(calls.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
    expect(calls.every((c) => c.size === 1 && c.layer === 'tokens' && !('imageRef' in c))).toBe(
      true,
    );
    expect(calls.every((c) => /^#[0-9a-f]{6}$/i.test(c.color ?? ''))).toBe(true);
    expect(t.createGroup).toHaveBeenCalledWith('room', {
      name: 'Goblins',
      memberTokenIds: ['new-0', 'new-1', 'new-2'],
      showMap: false,
      showBoard: false,
      active: false,
    });
  });

  it('starts at the starter point on an empty map and names the group Creatures by default', async () => {
    const t = setup({ picked: picked({ count: 2 }) });
    await t.ctrl.addCreature();
    expect(t.createToken.mock.calls.map((c) => c[1].pos)).toEqual([
      { x: 160, y: 160 },
      { x: 160 + CELL, y: 160 },
    ]);
    expect(t.createGroup).toHaveBeenCalledWith(
      'room',
      expect.objectContaining({ name: 'Creatures', memberTokenIds: ['new-0', 'new-1'] }),
    );
  });

  it('writes picked art as imageRef with no letter or colour, and no group for a lone token', async () => {
    const t = setup({ picked: picked({ ref: 'https://x/orc.png', name: 'Orc', count: 1 }) });
    await t.ctrl.addCreature();
    expect(t.createToken).toHaveBeenCalledWith('room', {
      pos: { x: 160, y: 160 },
      size: 1,
      layer: 'tokens',
      imageRef: 'https://x/orc.png',
      name: 'Orc',
    });
    expect(t.createGroup).not.toHaveBeenCalled();
  });

  it('puts one typed letter and colour on the whole batch', async () => {
    const t = setup({ picked: picked({ count: 2, genLabel: 'Z', genColor: '#ff0000' }) });
    await t.ctrl.addCreature();
    const calls = t.createToken.mock.calls.map((c) => c[1]);
    expect(calls.map((c) => c.letter)).toEqual(['Z', 'Z']);
    expect(calls.map((c) => c.color)).toEqual(['#ff0000', '#ff0000']);
  });

  it('ignores a second request while a batch is being written', async () => {
    const t = setup({ picked: picked({ count: 1 }) });
    let release: (id: string) => void = () => {};
    t.createToken.mockImplementationOnce(() => new Promise<string>((r) => (release = r)));
    const first = t.ctrl.addCreature();
    await flush();
    await t.ctrl.addCreature();
    expect(t.pickToken).toHaveBeenCalledTimes(1);
    release('n');
    await first;
    await t.ctrl.addCreature();
    expect(t.pickToken).toHaveBeenCalledTimes(2);
  });

  it('is reusable after a write fails', async () => {
    const t = setup({ picked: picked({ count: 1 }) });
    t.createToken.mockRejectedValueOnce(new Error('offline'));
    await expect(t.ctrl.addCreature()).rejects.toThrow('offline');
    await t.ctrl.addCreature();
    expect(t.createToken).toHaveBeenCalledTimes(2);
  });
});
