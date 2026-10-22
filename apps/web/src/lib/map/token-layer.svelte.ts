import * as PIXI from 'pixi.js';
import {
  canActOnToken,
  collapsedDragUpdates,
  genColorHex,
  groupAnchorId,
  parseRoomImageRef,
  snapFor,
  snapModeFromModifiers,
  type CampaignStore,
  type Group,
  type RoomMeasure,
  type Token,
} from '@osr-vtt/shared';
import { VectorMapViewStrings as S } from '../strings/VectorMapView';
import type { DialogService } from '../shell/dialogs.svelte';
import type { MapToolController, MapToolId } from '../shell/map-tool-controller.svelte';
import type { UndoEntry } from '../shell/undo-controller.svelte';
import { hexToNumber } from '../theme';
import { hasTokenDrag, readTokenDrag } from '../tokens/drag';
import {
  creatureBatchColor,
  creatureBatchNames,
  defaultCreatureBatch,
  tokenRingColor,
} from '../tokens/labels';
import { letterStyleFor } from '../tokens/letter-style';
import { loadImageElement } from '../tokens/texture-load';
import type { MapSelection } from './map-selection.svelte';
import { isAway as tokenIsAway, TOKEN_PX } from './token-view';
import { measureSpanText, type Point } from './vector-tools';

/**
 * The engine handles the token layer reads (SPEC-068 §4): the `tokens` Pixi
 * layer it draws into, the `world` it converts a pointer into, and the canvas
 * rect a DOM drop is measured from. The renderer is there for one thing — the
 * cached broken-image placeholder texture. `VectorMapEngine` satisfies it
 * structurally, and a unit test hands bare Pixi containers.
 */
export interface TokenLayerEngine {
  layers: { tokens: PIXI.Container };
  world: PIXI.Container;
  app: {
    canvas: { getBoundingClientRect: () => Pick<DOMRect, 'left' | 'top'> };
    renderer: { generateTexture: (g: PIXI.Graphics) => PIXI.Texture };
  };
}

/**
 * What the token layer is handed (SPEC-068 §4). It is not a `MapSeamDeps`: it
 * never draws through the renderer's passes and is not handed `invalidate`
 * (SPEC-068 §2), and it takes no coordinate conversion (RULE-006) — `Token.pos`
 * is pixel space on every map. Everything the component owns and changes over
 * time is a function, so a read made inside the component's tracking `$effect`
 * is tracked exactly as it was before the extraction.
 */
export interface TokenLayerDeps {
  store: CampaignStore;
  roomId: string;
  /** The shared tool state: the snap the rail's toggle sets, the quick-sheet
   * drag in flight, and the token the Select and Resize controls follow. */
  mapCtrl: Pick<MapToolController, 'tokenSnap' | 'sheetDragTokenId' | 'selectedToken'>;
  /** What a click changes (SPEC-067 §4): a token click is `selectTokens`. */
  selection: MapSelection;
  /** The engine handles, or `null` before it exists and after it has gone. */
  engine: () => TokenLayerEngine | null;
  /** The shared per-client undo stack's `push` (DEC-108). */
  pushUndo: (entry: UndoEntry) => void;
  /** The token picker `addCreature` opens. */
  dialogs: Pick<DialogService, 'pickToken'>;
  /** `AssetStore.resolve`: an `img:` ref to what it currently resolves to. */
  resolveAsset: (ref: string) => string;
  /** Turns a resolved art URL into a texture; a rejection means "could not be
   * loaded". Defaults to `loadTokenArt`; a unit test supplies its own, since
   * the default needs a DOM. */
  loadArt?: (url: string, imageRef: string) => Promise<PIXI.Texture>;
  /** A token clicked with Eye: the component owns the eye mark and its clock
   * (SPEC-068 §4), so it is handed the token's pixel position and converts. */
  aimEye: (pos: Point) => void;
  /** Raises an actor's sheet (the Encounter board's own card click). */
  onSelectActor: (actorId: string) => void;
  tokens: () => Token[];
  groups: () => Group[];
  /** The tokens the layer draws: the whole roster for the referee, else the
   * ones a player may see. Also what a late image failure re-badges. */
  renderableTokens: () => Token[];
  tool: () => MapToolId;
  isGM: () => boolean;
  myUid: () => string | null;
  presentSeatIds: () => ReadonlySet<string>;
  /** Tokens flagged `[Map]`-visible; with `revealedAt`, what dims a token the
   * players cannot see. Both stay in the component (SPEC-068 §1). */
  mapVisibleIds: () => ReadonlySet<string>;
  revealedAt: (pos: Point) => boolean;
  currentTurnIds: () => ReadonlySet<string>;
  hiddenTokenIds: () => ReadonlySet<string>;
  collapsedGroups: () => Group[];
  measure: () => RoomMeasure | null;
  cellSize: () => number;
  hexSize: () => number | undefined;
}

/** One token's drawing on the `tokens` layer (SPEC-063 §1): a single
 * `PIXI.Container` placed at the token's position, whose children sit at fixed
 * local offsets, back to front — colour disc, art sprite, letter, away badge,
 * broken-image badge, status ring. Moving the container moves every child, so a
 * drag writes one position and nothing re-syncs. The letter and the two corner
 * badges exist only while their state does (absence is legitimate), so they are
 * created and destroyed in place. */
interface TokenView {
  container: PIXI.Container;
  /** Shows `Token.color` through a transparent uploaded image and behind a
   * letter token's own disc alike (quick-sheet token/color split). */
  disc: PIXI.Graphics;
  /** The art, and the token's only hit target (SPEC-063 §3). */
  sprite: PIXI.Sprite;
  /** The token letter drawn over whatever art the token has (SPEC-048 §4). */
  letter: PIXI.Text | null;
  /** "Owner disconnected" badge (R26.2). */
  awayBadge: PIXI.Graphics | null;
  /** Failed-`imageRef` badge (IN-008/WI-032). */
  brokenBadge: PIXI.Graphics | null;
  /** Selection/group status ring — rendered through the ring layer (§2). */
  ring: PIXI.Graphics;
}

/** Alpha for a token whose owning seat has no live presence (R26.2). */
const AWAY_ALPHA = 0.42;

/** Where a creature batch lands when it is added from the toolbar. */
const STARTER_DROP_POS = { x: 160, y: 160 };

/** Fixed raster resolution a token's art is rasterized to before it
 * becomes a texture (IN-119/WI-125). Deliberately independent of the
 * source image's own reported size: an SVG with no `width`/`height`
 * attributes (only a `viewBox`, sized via CSS on its own root, or nothing
 * at all) has no fixed intrinsic bitmap, and Chromium's DOM-facing
 * `naturalWidth`/`naturalHeight` (a CSS default-object-size fallback, not
 * a real raster) can disagree with what its own WebGL `texImage2D` will
 * accept — silently rejecting the source with a console-only
 * `INVALID_VALUE: texImage2D: bad image data` our promise-based
 * `try`/`catch` never sees, leaving the sprite an untextured black quad.
 * Rasterizing onto a canvas at an explicit size first sidesteps the
 * disagreement entirely: `drawImage` can force a concrete size on an SVG
 * source the same way CSS sizing does for the character sheet's plain
 * `<img>` preview (which is why that preview already displays such a
 * token correctly), and a canvas is always a well-defined WebGL texture
 * source. 256 comfortably covers the map's zoom range at `TOKEN_PX`
 * (48) × the largest token scale without visible upscaling blur. */
const TOKEN_ART_RASTER_PX = 256;

export function rasterizeTokenImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TOKEN_ART_RASTER_PX;
  canvas.height = TOKEN_ART_RASTER_PX;
  // Matches the sprite's own square width/height (`TOKEN_PX * token.size`,
  // set unconditionally in `sync`) — a non-square source was already being
  // stretched to fill a square sprite before this change.
  canvas.getContext('2d')!.drawImage(img, 0, 0, TOKEN_ART_RASTER_PX, TOKEN_ART_RASTER_PX);
  return canvas;
}

/** Loads a token's art via `loadImageElement` rather than `PIXI.Assets.load`
 * (IN-008/WI-032) — Pixi 8's loader only claims URLs whose extension it
 * recognizes, which rejects a pasted CDN/blog URL with no extension or a query
 * string. A plain `HTMLImageElement` accepts anything the browser can fetch, the
 * same as the character sheet's own `<img>`. A host without CORS headers still
 * fails here — that failure cannot be worked around client-side — but the layer
 * now shows it (placeholder texture and badge) instead of a silent
 * `Texture.WHITE` square.
 *
 * A source that is genuinely, verifiably empty — `naturalWidth`/`naturalHeight`
 * both 0, e.g. an SVG with explicit `width="0" height="0"` — is rejected before
 * rasterizing: there is no content `drawImage` could recover, and letting it
 * through would silently produce a blank (fully-transparent) canvas rather than
 * the broken-image indicator a genuinely unusable ref should raise. Checked here
 * rather than in `loadImageElement` because that loader also backs
 * `BackgroundsPanel`, where this is a different, unscoped problem (RULE-015). */
export async function loadTokenArt(url: string, imageRef: string): Promise<PIXI.Texture> {
  const img = await loadImageElement(url);
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    throw new Error(`token image has no intrinsic size: ${imageRef}`);
  }
  return PIXI.Texture.from(rasterizeTokenImage(img));
}

/**
 * The token layer (SPEC-068, WI-230): the per-token containers and their sync
 * passes (SPEC-063), the art textures and their failure badges, the sprite drag
 * with its snap and undoable moves, `addCreature`, the quick-sheet drop and the
 * focused token. The component hands it the roster and the visibility
 * derivations as getters and calls `sync` from its one tracking `$effect`.
 *
 * It is not a render pass (SPEC-068 §2): it mutates its Pixi display objects
 * directly and Pixi's ticker paints them, so it is handed no `invalidate`.
 * It takes no stage input either (§3, DEC-135): each token's art sprite is its
 * own hit target and stops propagation, so the controller attaches the sprite's
 * handlers itself when it builds a container, and no branch of the stage ladder
 * ever sees a pointer that lands on a token.
 */
export class TokenLayerController {
  readonly #deps: TokenLayerDeps;

  /** The token the last click, drag or lasso focused. The component's layer
   * effect reads it as a dependency; `mapCtrl.selectedToken` is its mirror. */
  selectedTokenId = $state<string | null>(null);
  /** Reactive mirror of `#brokenImageIds.size` — the badge itself is Pixi-drawn
   * (not queryable from the DOM), so this is how a test observes it. */
  brokenTokenCount = $state(0);
  /** DOM mirror of the drawn token letters (SPEC-048 §4) — `glyphs:mode` per
   * lettered token, sorted and space-joined. The letters themselves are on the
   * Pixi canvas, so this is the only way a test can see them. */
  tokenLetterText = $state('');
  /** Number of token docs the last drop wrote (1 for a lone token, N for a
   * collapsed group's or a multi-select's batched move) — surfaced for e2e
   * introspection. */
  lastBatchMoveCount = $state(1);

  readonly #viewsByToken = new Map<string, TokenView>();
  /** Where every token's status ring and every collapsed-group count badge
   * is *rendered* (SPEC-063 §2, DEC-130 (a)): one `RenderLayer`, kept the last
   * child of the `tokens` layer, so a ring is never covered by another
   * token's art whatever order the tokens were created in. The ring and badge
   * stay children of their token's container, so they still move with it. */
  #ringLayer: PIXI.RenderLayer | null = null;
  /** The `imageRef` each sprite's current texture was loaded from, so a ref
   * change (e.g. recolouring a letter token) reloads it. An `img:` ref
   * (SPEC-057 §6) is keyed with what it currently resolves to, so the texture
   * also reloads when the image arrives after the token does. */
  readonly #refsByToken = new Map<string, string | undefined>();
  /** Tokens whose current `imageRef` failed to load (IN-008/WI-032) — either
   * an unrecognized URL shape or a CORS-blocked host. Keyed by token id;
   * cleared the moment `#refsByToken` sees a different ref for that token, so
   * picking a different image retries. Drives `#brokenImageTexture` and
   * `#syncBrokenImageBadges`, the visible-failure half of the fix — a broken
   * host stays broken, but the referee sees why instead of a blank square. */
  readonly #brokenImageIds = new Set<string>();
  #brokenImageTextureCache: PIXI.Texture | null = null;
  readonly #badgesByGroup = new Map<string, PIXI.Container>();
  readonly #draggingIds = new Set<string>();
  #addingCreature = false;

  constructor(deps: TokenLayerDeps) {
    this.#deps = deps;
  }

  /** Drops the controller's lookups so no stale reference survives the unmount.
   * The Pixi nodes themselves go with `engine.destroy()` (SPEC-068 §5). */
  destroy(): void {
    this.#viewsByToken.clear();
    this.#ringLayer = null;
    this.#refsByToken.clear();
    this.#badgesByGroup.clear();
    this.#draggingIds.clear();
  }

  /** The token a click, a drag or a lasso focuses: what the Resize slider and
   * the Select controller's token catch follow (SPEC-067 §3's `focusToken`). */
  focus(id: string): void {
    this.selectedTokenId = id;
    this.#deps.mapCtrl.selectedToken = this.#deps.tokens().find((t) => t.id === id) ?? null;
  }

  /** The key a token's texture is loaded under. An `img:` ref (SPEC-057 §6) is
   * keyed with what it currently resolves to, so it is read reactively: the
   * component's layer effect calls this to re-sync when the image arrives. */
  textureKey(imageRef: string | undefined): string | undefined {
    if (imageRef === undefined || parseRoomImageRef(imageRef) === null) return imageRef;
    return `${imageRef} ${this.#deps.resolveAsset(imageRef)}`;
  }

  // ---- undoable moves ----

  /** A single token's settled drag write, pushed onto the shared stack as one
   * undo entry (SPEC-056 §2.3) — `from` is `null` for a drag with no captured
   * pickup point (shouldn't happen from a pointer drag, but guards a stray
   * programmatic call), and the entry is skipped outright when the drop
   * lands back where the drag started. */
  async #moveTokenUndoable(
    tokenId: string,
    to: { x: number; y: number },
    from: { x: number; y: number } | null,
  ): Promise<void> {
    const d = this.#deps;
    await d.store.moveToken(d.roomId, tokenId, to);
    if (!from || (from.x === to.x && from.y === to.y)) return;
    d.pushUndo({
      undo: () => d.store.moveToken(d.roomId, tokenId, from),
      redo: () => d.store.moveToken(d.roomId, tokenId, to),
    });
  }

  /** A collapsed group's batched drag write (anchor drag, every member moved
   * by its stored offset) as one undo entry — a multi-token drag undoes as a
   * single step, not one per member (SPEC-056 §2.3). */
  async #moveTokensUndoable(
    to: Array<{ tokenId: string; pos: { x: number; y: number } }>,
    from: Array<{ tokenId: string; pos: { x: number; y: number } }> | null,
  ): Promise<void> {
    const d = this.#deps;
    await d.store.moveTokens(d.roomId, to);
    const moved = from?.some((f, i) => f.pos.x !== to[i]?.pos.x || f.pos.y !== to[i]?.pos.y);
    if (!from || !moved) return;
    d.pushUndo({
      undo: () => d.store.moveTokens(d.roomId, from),
      redo: () => d.store.moveTokens(d.roomId, to),
    });
  }

  #collapsedGroupAnchoredBy(tokenId: string): Group | null {
    return this.#deps.collapsedGroups().find((g) => groupAnchorId(g) === tokenId) ?? null;
  }

  #canAct(tokenId: string): boolean {
    const d = this.#deps;
    return canActOnToken(d.groups(), d.tokens(), d.myUid() ?? '', tokenId, d.isGM());
  }

  // ---- token dropped in from a quick sheet ----
  //
  // Dragging a character's portrait out of the Character sheet and releasing it
  // here places that character's token at the drop point. The token is hidden
  // for the duration of the drag (`hiddenTokenIds`) so the gesture reads as
  // picking it up off the map and putting it down somewhere else.
  //
  // These are the only DOM drag handlers on the map. The map's own input is
  // Pixi federated pointer events, which a drag starting in ordinary DOM never
  // reaches — hence the `DataTransfer` payload (`tokens/drag.ts`).

  onCanvasDragOver(e: DragEvent): void {
    if (!hasTokenDrag(e.dataTransfer)) return;
    // Without `preventDefault` on *dragover* the browser refuses the drop
    // outright — no `drop` event is ever delivered.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  async onCanvasDrop(e: DragEvent): Promise<void> {
    const { store, mapCtrl } = this.#deps;
    const engine = this.#deps.engine();
    const payload = readTokenDrag(e.dataTransfer);
    mapCtrl.sheetDragTokenId = null;
    if (!payload || !engine) return;
    e.preventDefault();

    // Client coordinates -> canvas-local -> world space. The canvas fills the
    // wrapper, so its own rect is the right origin under any layout.
    const rect = engine.app.canvas.getBoundingClientRect();
    const local = engine.world.toLocal(new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top));

    const existing = payload.tokenId
      ? this.#deps.tokens().find((t) => t.id === payload.tokenId)
      : undefined;
    const size = existing?.size ?? 1;
    // The same snap the on-map drop uses, modifiers and all, so a token thrown
    // from the sheet lands exactly where dragging it across the map would.
    const snapped = snapFor(
      'token',
      snapModeFromModifiers(e.altKey, e.shiftKey, mapCtrl.tokenSnap),
      { x: local.x, y: local.y },
      { cellSize: this.#deps.cellSize(), size, hexSize: this.#deps.hexSize() },
    );

    if (existing) {
      this.lastBatchMoveCount = 1;
      await this.#moveTokenUndoable(existing.id, snapped, existing.pos);
      return;
    }
    // A character with no token yet gets one here rather than at "My token"'s
    // fixed spot — the drop already said where it goes. Real art travels as
    // `imageRef`; a generated default travels as `letter`/`color` fields
    // instead, never a `gen:disc:` ref (SPEC-048 §5).
    await store.createToken(this.#deps.roomId, {
      pos: snapped,
      size: 1,
      layer: 'tokens',
      ...(payload.imageRef ? { imageRef: payload.imageRef } : {}),
      ...(payload.letter ? { letter: payload.letter } : {}),
      ...(payload.color ? { color: payload.color } : {}),
      ownerSeatId: payload.seatId,
    });
  }

  // ---- add creature (GM-only, ported from the cellular MapView) — the only
  // way to place tokens on the map; opens the token picker, then drops `count`
  // tokens stepping one cell right from a deterministic start point. ----

  async addCreature(): Promise<void> {
    const { store, dialogs } = this.#deps;
    if (this.#addingCreature) return;
    const picked = await dialogs.pickToken({
      title: S.addCreatureTitle,
      roomId: this.#deps.roomId,
      mode: 'creature',
      confirmLabel: S.addCreatureConfirm,
      // The first letter this batch will take. A batch started from the map
      // toolbar forms its **own** group (below), so it never joins existing
      // members and always starts at A (SPEC-040 §4).
      genDefaultLabel: 'A',
    });
    if (!picked) return;
    this.#addingCreature = true;
    try {
      // No existing members to avoid: `createGroup` below makes the group this
      // batch lands in, so both the letters and the numbering start clean.
      // A picked bundled/URL ref carries no letter (SPEC-048 §3's second
      // exclusion); a generated batch is written as `letter`/`color` fields,
      // never a `gen:disc:` ref (§5).
      const batch = picked.ref
        ? null
        : defaultCreatureBatch(
            picked.count,
            [],
            creatureBatchColor(picked.name, picked.genColor),
            picked.genLabel,
          );
      // `Token.color` is validated hex (`HEX_COLOR_RE`); the batch colour is
      // an `hsl(...)` paint value, the same conversion `backfillLetterFromRef`
      // once ran on a ref's baked-in one (SPEC-048 §2).
      const batchColorHex = batch ? genColorHex(batch.color) : null;
      const names = creatureBatchNames(picked.name, picked.count, []);
      const newTokenIds: string[] = [];
      for (let i = 0; i < picked.count; i++) {
        const step = this.#deps.tokens().length + newTokenIds.length;
        const id = await store.createToken(this.#deps.roomId, {
          pos: { x: STARTER_DROP_POS.x + step * this.#deps.cellSize(), y: STARTER_DROP_POS.y },
          size: 1,
          layer: 'tokens',
          // Real art only when the referee actually picked some (§1) — a
          // generated batch has no ref at all.
          ...(picked.ref ? { imageRef: picked.ref } : {}),
          // Absent when the referee named nothing — `Token.name` stays unset
          // and the `creatureLabel` fallback reads exactly as it did before
          // v28 (SPEC-040 §3).
          ...(names[i] ? { name: names[i]! } : {}),
          // Stored at creation so a second batch added in the same room-open
          // reads this one's letters back (SPEC-048 §3).
          ...(batch ? { letter: batch.letters[i]! } : {}),
          ...(batchColorHex ? { color: batchColorHex } : {}),
        });
        newTokenIds.push(id);
      }
      if (newTokenIds.length > 1) {
        await store.createGroup(this.#deps.roomId, {
          name: picked.groupName || 'Creatures',
          memberTokenIds: newTokenIds,
          showMap: false,
          showBoard: false,
          active: false,
        });
      }
    } finally {
      this.#addingCreature = false;
    }
  }

  // ---- the sprite lifecycle ----

  /** Creates a token's container and its always-present children (disc,
   * sprite, ring), inserted below the ring layer so the layer stays the last
   * child of `tokens` (SPEC-063 §2). */
  #createTokenView(tokenId: string): TokenView {
    const layer = this.#deps.engine()!.layers.tokens;
    if (!this.#ringLayer) {
      this.#ringLayer = new PIXI.RenderLayer();
      layer.addChild(this.#ringLayer);
    }
    const ringLayer = this.#ringLayer;
    const container = new PIXI.Container();
    // Lets the sprite inside receive pointer events without the container
    // itself being a target (SPEC-063 §3).
    container.eventMode = 'passive';
    const disc = new PIXI.Graphics();
    disc.eventMode = 'none';
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'static';
    sprite.cursor = 'grab';
    const ring = new PIXI.Graphics();
    ring.eventMode = 'none';
    container.addChild(disc, sprite, ring);
    ringLayer.attach(ring);
    layer.addChildAt(container, layer.getChildIndex(ringLayer));
    const view: TokenView = {
      container,
      disc,
      sprite,
      letter: null,
      awayBadge: null,
      brokenBadge: null,
      ring,
    };
    this.#attachDragHandlers(sprite, container, tokenId);
    this.#viewsByToken.set(tokenId, view);
    return view;
  }

  /** Adds a lazily-created child (letter or a corner badge) at its slot in
   * the container's back-to-front order (SPEC-063 §1). Assign it to `view`
   * first. */
  #addTokenChild(view: TokenView, child: PIXI.Container): void {
    const order: (PIXI.Container | null)[] = [
      view.disc,
      view.sprite,
      view.letter,
      view.awayBadge,
      view.brokenBadge,
    ];
    const before = order.slice(0, order.indexOf(child)).filter((c) => c !== null).length;
    view.container.addChildAt(child, before);
  }

  /** Destroys a token's whole drawing. A collapsed-group count badge the
   * token anchored is a child of its container (SPEC-063 §2), so it goes too
   * and leaves `#badgesByGroup`; `#syncCollapsedBadges` rebuilds it on a new
   * anchor if the group is still collapsed. */
  #destroyTokenView(tokenId: string, view: TokenView): void {
    for (const [groupId, badge] of this.#badgesByGroup) {
      if (badge.parent === view.container) this.#badgesByGroup.delete(groupId);
    }
    view.container.destroy({ children: true });
    this.#viewsByToken.delete(tokenId);
  }

  /** Re-syncs the layer to `list` — the tokens the viewer may see. The
   * component calls it from its tracking `$effect`, which reads the roster and
   * every derivation this reads. */
  sync(list: Token[]): void {
    if (!this.#deps.engine()) return;
    const d = this.#deps;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      const view = this.#viewsByToken.get(token.id) ?? this.#createTokenView(token.id);
      const { container, disc, sprite } = view;
      // The texture is (re)loaded whenever the ref changes, not only when the
      // sprite is created — a referee can swap a token's art at any time
      // through the Assets panel or "My token".
      const key = this.textureKey(token.imageRef);
      if (this.#refsByToken.get(token.id) !== key) {
        this.#refsByToken.set(token.id, key);
        if (this.#brokenImageIds.delete(token.id)) {
          this.brokenTokenCount = this.#brokenImageIds.size;
        }
        // An absent ref means *no art* (SPEC-048 §§1, 5), not a failed load:
        // the sprite falls back to the plain white texture it is created
        // with, which the token's background disc shows through, and no
        // broken badge is raised. `#syncTokenLetters` (§4) is what gives such
        // a token its letter to draw.
        if (token.imageRef === undefined) sprite.texture = PIXI.Texture.WHITE;
        else void this.#loadTokenTexture(sprite, token.id, token.imageRef);
      }
      if (!this.#draggingIds.has(token.id)) {
        // The container owns the position (SPEC-063 §1); the drag writes it
        // directly while it holds the token.
        container.position.set(token.pos.x, token.pos.y);
        // The affordance matches the SPEC-032 §5 rule: every token is
        // selectable (§4), but the cursor tells you up front whether picking
        // it up will actually move it.
        sprite.cursor = this.#canAct(token.id) ? 'grab' : 'pointer';
      }
      sprite.width = TOKEN_PX * token.size;
      sprite.height = TOKEN_PX * token.size;
      // Translucent = GM-only view of a token the players can't see — either
      // not yet [Map]-visible, or standing in fog they haven't revealed.
      // Tinted = it's this token's side/actor's turn.
      const baseAlpha = d.mapVisibleIds().has(token.id) && d.revealedAt(token.pos) ? 1 : 0.4;
      // Presence dim (R26.2, Board 2). `min` rather than a product: a
      // GM-only token owned by a disconnected player would otherwise compound
      // to near-invisible, and both states mean "recede", not "recede twice".
      sprite.alpha = tokenIsAway(token, d.presentSeatIds())
        ? Math.min(baseAlpha, AWAY_ALPHA)
        : baseAlpha;
      sprite.tint = d.currentTurnIds().has(token.id) ? 0xffd699 : 0xffffff;
      sprite.visible = !d.hiddenTokenIds().has(token.id);

      disc.visible = sprite.visible;
      disc.alpha = sprite.alpha;
      disc.clear();
      if (token.color) {
        disc.circle(0, 0, (TOKEN_PX * token.size) / 2).fill(hexToNumber(token.color));
      }
    }
    for (const [id, view] of this.#viewsByToken) {
      if (!seen.has(id)) {
        this.#destroyTokenView(id, view);
        this.#refsByToken.delete(id);
        if (this.#brokenImageIds.delete(id)) this.brokenTokenCount = this.#brokenImageIds.size;
      }
    }
    this.#syncTokenRings(list);
    this.#syncTokenLetters(list);
    this.#syncAwayBadges(list);
    this.#syncBrokenImageBadges(list);
    this.#syncCollapsedBadges(list);
  }

  /** Small hollow badge on a disconnected owner's token (R26.2, Board 2).
   *
   * Load-bearing rather than decorative: `alpha` is already overloaded — 0.4
   * means "GM-only view of something players cannot see" — so without a second
   * channel the referee could not tell a hidden token from an away one. The
   * status ring is deliberately left at full weight and colour, so "whose
   * token is this" and "is that player here" stay independent readings. */
  #syncAwayBadges(list: Token[]): void {
    if (!this.#deps.engine()) return;
    const hidden = this.#deps.hiddenTokenIds();
    const present = this.#deps.presentSeatIds();
    const seen = new Set<string>();
    for (const token of list) {
      if (!tokenIsAway(token, present) || hidden.has(token.id)) continue;
      const view = this.#viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let badge = view.awayBadge;
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        view.awayBadge = badge;
        this.#addTokenChild(view, badge);
      }
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(r * 0.72, r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x1b1712).stroke({ width: 1.5, color: 0x9a8f7a });
    }
    for (const [id, view] of this.#viewsByToken) {
      if (view.awayBadge && !seen.has(id)) {
        view.awayBadge.destroy();
        view.awayBadge = null;
      }
    }
  }

  /** Small warning badge on a token whose `imageRef` failed to load
   * (IN-008/WI-032) — same corner-badge idiom as `#syncAwayBadges`, on the
   * opposite side so a token can show both at once (away *and* broken). */
  #syncBrokenImageBadges(list: Token[]): void {
    if (!this.#deps.engine()) return;
    const hidden = this.#deps.hiddenTokenIds();
    const seen = new Set<string>();
    for (const token of list) {
      if (!this.#brokenImageIds.has(token.id) || hidden.has(token.id)) continue;
      const view = this.#viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let badge = view.brokenBadge;
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        view.brokenBadge = badge;
        this.#addTokenChild(view, badge);
      }
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(-r * 0.72, r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x4a1414).stroke({ width: 1.5, color: 0xe3a23a });
      badge.moveTo(0, -3.5).lineTo(0, 1).stroke({ width: 1.5, color: 0xe3a23a });
      badge.circle(0, 3.5, 0.75).fill(0xe3a23a);
    }
    for (const [id, view] of this.#viewsByToken) {
      if (view.brokenBadge && !seen.has(id)) {
        view.brokenBadge.destroy();
        view.brokenBadge = null;
      }
    }
  }

  /** Lazily built, cached "broken image" placeholder — an X on a dark
   * square, distinct at a glance from `Texture.WHITE` (the pre-load
   * default) so a referee can tell "still loading" / "no image" apart from
   * "this URL failed" (IN-008/WI-032). */
  #brokenImageTexture(): PIXI.Texture {
    if (this.#brokenImageTextureCache) return this.#brokenImageTextureCache;
    const g = new PIXI.Graphics();
    const s = TOKEN_PX;
    g.rect(0, 0, s, s).fill(0x2a2320).stroke({ width: 2, color: 0xe3a23a });
    const pad = s * 0.28;
    g.moveTo(pad, pad)
      .lineTo(s - pad, s - pad)
      .stroke({ width: 3, color: 0xe3a23a });
    g.moveTo(s - pad, pad)
      .lineTo(pad, s - pad)
      .stroke({ width: 3, color: 0xe3a23a });
    this.#brokenImageTextureCache = this.#deps.engine()!.app.renderer.generateTexture(g);
    g.destroy();
    return this.#brokenImageTextureCache;
  }

  /** Status ring around each token: white when selected or owned by the
   * viewer, else the token's group color, else black. Stroke-only overlay
   * redrawn every sync — separate from a gen-disc's own baked art ring. */
  #syncTokenRings(list: Token[]): void {
    if (!this.#deps.engine()) return;
    const hidden = this.#deps.hiddenTokenIds();
    for (const token of list) {
      const ring = this.#viewsByToken.get(token.id)?.ring;
      if (!ring) continue;
      ring.visible = !hidden.has(token.id);
      const r = (TOKEN_PX * token.size) / 2;
      ring.clear();
      ring.circle(0, 0, r).stroke({
        width: 4,
        color: tokenRingColor(
          token,
          this.#deps.groups(),
          this.#deps.selection.tokenIds,
          this.#deps.myUid(),
        ),
      });
    }
  }

  /** The token letter (SPEC-048 §4) — a render pass on the token layer rather
   * than a shape inside the token's texture, which is what makes a lettered
   * *uploaded image* possible: the letter no longer competes for the
   * `imageRef` slot.
   *
   * **Two-tone by seat** (DEC-086 (a)): a token with an `ownerSeatId` reads as
   * somebody's character and draws white-on-black; one without reads as a
   * creature or scenery and draws black-on-white. The colours no longer
   * consult the disc's lightness — this *replaces* `discStyle`'s contrast flip
   * (R7.1) rather than extending it — so black-on-a-dark-disc and
   * white-on-a-light-disc are both reachable and the **outline is the only
   * thing keeping the glyph legible**. It is therefore a genuine stroke on the
   * glyph (Pixi paints the stroke first and the fill over it, so the letterform
   * keeps its full weight), never the disc's own ring.
   *
   * The status ring (SPEC-022) is untouched: it is state, the letter is
   * identity, and neither borrows the other's channel. */
  #syncTokenLetters(list: Token[]): void {
    if (!this.#deps.engine()) return;
    const seen = new Set<string>();
    for (const token of list) {
      const style = letterStyleFor(token);
      if (!style) continue;
      const view = this.#viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let text = view.letter;
      if (!text) {
        text = new PIXI.Text({ text: style.glyphs });
        text.anchor.set(0.5);
        // Never intercepts a pointer the sprite underneath should receive —
        // the sprite carries the drag handlers, and the letter sits on top.
        text.eventMode = 'none';
        view.letter = text;
        this.#addTokenChild(view, text);
      }
      text.text = style.glyphs;
      text.style = {
        fill: style.fill,
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: style.fontSize,
        fontWeight: 'bold',
        stroke: { color: style.stroke, width: style.strokeWidth, join: 'round' },
      };
      // Inherits the sprite's visibility and alpha, so a GM-only or
      // away-dimmed token dims whole rather than showing a solid letter over
      // faded art.
      text.visible = view.sprite.visible;
      text.alpha = view.sprite.alpha;
    }
    for (const [id, view] of this.#viewsByToken) {
      if (view.letter && !seen.has(id)) {
        view.letter.destroy();
        view.letter = null;
      }
    }
    // Reactive mirror for e2e (the letters are Pixi-drawn, so this is how a
    // test sees them): `glyphs:mode` per drawn letter, sorted, space-joined.
    // A *string* mirror on purpose — `sync` runs inside a tracking `$effect`
    // and must not re-invalidate it, and an equal string assigns without
    // invalidating (same idiom as `strokeMeasureText_`).
    this.tokenLetterText = list
      .map((token) => letterStyleFor(token))
      .filter((style): style is NonNullable<typeof style> => style !== null)
      .map((style) => `${style.glyphs}:${style.mode}`)
      .sort()
      .join(' ');
  }

  /** Count bubble on each collapsed group's anchor token — a child of the
   * anchor's container, so it moves with the anchor by construction, rendered
   * through the ring layer above all token art (SPEC-063 §2). `renderable` is
   * the list `sync` was handed; an anchor outside it is not visible to this
   * viewer. */
  #syncCollapsedBadges(renderable: Token[]): void {
    if (!this.#deps.engine() || !this.#ringLayer) return;
    const ringLayer = this.#ringLayer;
    const seen = new Set<string>();
    for (const group of this.#deps.collapsedGroups()) {
      const anchorId = groupAnchorId(group);
      if (!anchorId) continue;
      const anchor = renderable.find((t) => t.id === anchorId);
      if (!anchor) continue; // anchor not visible to this viewer
      const view = this.#viewsByToken.get(anchorId);
      if (!view) continue;
      seen.add(group.id);
      let badge = this.#badgesByGroup.get(group.id);
      if (!badge) {
        badge = this.#createCountBadge();
        this.#badgesByGroup.set(group.id, badge);
      }
      // Re-parented when the group's anchor changes; re-parenting detaches
      // it from the render layer, so it is attached again after.
      if (badge.parent !== view.container) {
        view.container.addChild(badge);
        ringLayer.attach(badge);
      }
      const label = badge.getChildByLabel('count') as PIXI.Text | null;
      if (label) label.text = String(group.memberTokenIds.length);
      const r = (TOKEN_PX * anchor.size) / 2;
      badge.position.set(r * 0.7, -r * 0.7);
    }
    for (const [id, badge] of this.#badgesByGroup) {
      if (!seen.has(id)) {
        badge.destroy({ children: true });
        this.#badgesByGroup.delete(id);
      }
    }
  }

  #createCountBadge(): PIXI.Container {
    const badge = new PIXI.Container();
    badge.eventMode = 'none';
    const circle = new PIXI.Graphics();
    circle.circle(0, 0, 13).fill(0x2a2118).stroke({ width: 2, color: 0xffd699 });
    badge.addChild(circle);
    const text = new PIXI.Text({
      text: '',
      style: { fill: 0xffd699, fontSize: 16, fontWeight: 'bold' },
    });
    text.label = 'count';
    text.anchor.set(0.5);
    badge.addChild(text);
    return badge;
  }

  /** Loads a token's art into its sprite; a failure leaves the placeholder
   * texture and a badge, tracked by `#brokenImageIds` (see `loadTokenArt`).
   * `#refsByToken`'s ref-change gate (in `sync`) is what retries a token whose
   * image is later changed. */
  async #loadTokenTexture(sprite: PIXI.Sprite, tokenId: string, imageRef: string): Promise<void> {
    try {
      const load = this.#deps.loadArt ?? loadTokenArt;
      sprite.texture = await load(this.#deps.resolveAsset(imageRef), imageRef);
    } catch (err) {
      console.warn(`[VectorMapView] token image failed to load: ${imageRef}`, err);
      this.#brokenImageIds.add(tokenId);
      this.brokenTokenCount = this.#brokenImageIds.size;
      sprite.texture = this.#brokenImageTexture();
      this.#syncBrokenImageBadges(this.#deps.renderableTokens());
    }
  }

  // ---- the sprite's own input (SPEC-068 §3, DEC-135) ----

  /** Pointer handling for one token (SPEC-063 §3). The `sprite` is the hit
   * target and carries the cursor; the drag reads and writes the token's
   * `container` position, which moves every part of the token at once. */
  #attachDragHandlers(sprite: PIXI.Sprite, container: PIXI.Container, tokenId: string): void {
    const d = this.#deps;
    let tokenDragging = false;
    /** The drag's start point, lattice units (SPEC-054 §12) — set on pickup,
     * `null` otherwise. The distance chip below goes through `measureSpanText`,
     * the same formatting the Measure tool's own readout uses. */
    let tokenDragStart: Point | null = null;
    let tokenDragChip: PIXI.Text | null = null;
    /** The token's (or, for a collapsed-group/multi-select anchor, the
     * anchor's) pixel position at pickup — the undo entry's `from`
     * (SPEC-056 §2.3). */
    let tokenMoveFrom: Point | null = null;
    /** A multi-token set drag (SPEC-056 §3, DEC-109): every other selected,
     * actionable token's pickup-time offset from this one, carried through to
     * the drop the same way a collapsed group's `memberOffsets` are. Empty
     * outside a multi-select drag (a lone token, or a collapsed-group anchor
     * drag, which takes priority — see `stop` below). */
    let dragSetOffsets: Array<{ tokenId: string; offset: Point; from: Point }> = [];
    /** Whether the pointer actually moved during this gesture — a plain
     * click (down, up, no `globalpointermove` in between) never sets it.
     * Gates the passenger write below: the *grabbed* token already accepts
     * a same-position "drop" as a harmless no-op (`moveTokenUndoable` skips
     * only the undo push, not the write, for that one), but relaying a
     * stationary click into a batch move of every *other* selected token
     * would relocate them by nothing but snap-grid quantization noise —
     * `STARTER_DROP_POS` isn't itself snap-aligned, so that noise is not
     * always zero. A click that never moved touches no passenger at all. */
    let moved = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const token = d.tokens().find((t) => t.id === tokenId) ?? null;
      // Eye/Ping aim at the token under the pointer instead of picking it up
      // (SPEC-046 §2): a View-tool click resolves the token at click time and
      // is done, rather than falling into the ordinary select-and-drag below.
      const tool = d.tool();
      if (tool === 'ping') {
        if (token) d.store.publishPing(d.roomId, token.pos);
        e.stopPropagation();
        return;
      }
      if (tool === 'eye') {
        if (token) d.aimEye(token.pos);
        e.stopPropagation();
        return;
      }
      // Shift-click toggles this token in the multi-selection, in either
      // Edit/View mode (SPEC-056 §3, DEC-109); a plain click on a token
      // outside the current selection replaces it, and a plain click on one
      // already inside it leaves the whole set selected — so grabbing any
      // member without Shift drags the group. Geometry's own selection is
      // mutually exclusive with a token catch, same as every other pick.
      const held = d.selection.tokenIds;
      d.selection.selectTokens(
        e.shiftKey
          ? held.includes(tokenId)
            ? held.filter((id) => id !== tokenId)
            : [...held, tokenId]
          : held.includes(tokenId)
            ? held
            : [tokenId],
      );
      this.focus(tokenId);
      // Picking up a token raises its character's sheet, the same way clicking
      // that actor's card on the Encounter board does. `pointerdown` *is* the
      // selection moment here (it also starts the drag), so there is no
      // click-versus-drag discrimination to make.
      // Still gated on an owning seat: the callback is actor-keyed since
      // WI-055, but raising a *creature's* sheet is WI-056 (SPEC-032 §4).
      if (token?.ownerSeatId) d.onSelectActor(token.ownerSeatId);
      if (!d.selection.tokenIds.includes(tokenId)) {
        // A Shift-click that just deselected this token — nothing to drag.
        e.stopPropagation();
        return;
      }
      // Selection is unconditional; the drag itself is ownership-gated
      // (SPEC-032 §5) — a token this seat may not act on stays inspectable
      // but does not move.
      if (this.#canAct(tokenId)) {
        const cellSize = d.cellSize();
        tokenDragging = true;
        moved = false;
        this.#draggingIds.add(tokenId);
        sprite.cursor = 'grabbing';
        tokenDragStart = {
          x: container.position.x / cellSize,
          y: container.position.y / cellSize,
        };
        tokenMoveFrom = { x: container.position.x, y: container.position.y };
        // Every other selected, actionable token joins this drag as a set
        // (SPEC-056 §3) — skipped when this token anchors a collapsed group,
        // which already moves its own members and takes priority (`stop`).
        dragSetOffsets = this.#collapsedGroupAnchoredBy(tokenId)
          ? []
          : d.selection.tokenIds
              .filter(
                (id) =>
                  id !== tokenId &&
                  // A collapsed group's own anchor moves its members through
                  // its own anchor-drag path only — carrying it along here as
                  // a plain offset would desync it from its stacked members.
                  !this.#collapsedGroupAnchoredBy(id) &&
                  this.#canAct(id),
              )
              .map((id) => {
                const other = this.#viewsByToken.get(id)?.container;
                const pos = other
                  ? { x: other.position.x, y: other.position.y }
                  : (d.tokens().find((t) => t.id === id)?.pos ?? {
                      x: container.position.x,
                      y: container.position.y,
                    });
                this.#draggingIds.add(id);
                return {
                  tokenId: id,
                  offset: { x: pos.x - container.position.x, y: pos.y - container.position.y },
                  from: pos,
                };
              });
      }
      e.stopPropagation();
    });
    sprite.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      const engine = d.engine();
      if (!tokenDragging || !engine) return;
      moved = true;
      const local = engine.world.toLocal(e.global);
      container.position.set(local.x, local.y);
      // RTDB drag frames for the anchor only — a collapsed group publishes one
      // stream, not one per member.
      d.store.publishDrag(d.roomId, tokenId, { x: local.x, y: local.y });
      // A multi-select set drag moves every other member's container by the
      // same delta, live — the batched write happens once, on drop.
      for (const member of dragSetOffsets) {
        this.#viewsByToken
          .get(member.tokenId)
          ?.container.position.set(local.x + member.offset.x, local.y + member.offset.y);
      }
      // The drag-distance chip (SPEC-054 §12): a lightweight overlay this
      // handler owns directly, rather than routing through a full render
      // pass on every pointer move.
      if (tokenDragStart) {
        const cellSize = d.cellSize();
        const cur = { x: local.x / cellSize, y: local.y / cellSize };
        const span = measureSpanText(tokenDragStart, cur, d.measure());
        if (span) {
          if (!tokenDragChip) {
            tokenDragChip = new PIXI.Text({
              text: '',
              style: { fill: 0xffffff, stroke: { color: 0x000000, width: 3 }, fontSize: 12 },
            });
            engine.world.addChild(tokenDragChip);
          }
          tokenDragChip.text = span.text;
          tokenDragChip.position.set(local.x + 14, local.y - 14);
        } else {
          tokenDragChip?.destroy();
          tokenDragChip = null;
        }
      }
    });
    const stop = (e: PIXI.FederatedPointerEvent) => {
      if (!tokenDragging) return;
      tokenDragging = false;
      this.#draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      tokenDragStart = null;
      tokenDragChip?.destroy();
      tokenDragChip = null;
      const fromPos = tokenMoveFrom;
      tokenMoveFrom = null;
      const setMembers = dragSetOffsets;
      dragSetOffsets = [];
      for (const m of setMembers) this.#draggingIds.delete(m.tokenId);
      // Snap on drop: cell grid by default, half-grid with Alt, free with
      // Alt+Shift; the rail's snap toggle is the base mode. Honors token size.
      const size = d.tokens().find((t) => t.id === tokenId)?.size ?? 1;
      const mode = snapModeFromModifiers(e.altKey, e.shiftKey, d.mapCtrl.tokenSnap);
      const snapped = snapFor(
        'token',
        mode,
        { x: container.position.x, y: container.position.y },
        { cellSize: d.cellSize(), size, hexSize: d.hexSize() },
      );
      container.position.set(snapped.x, snapped.y);
      const collapsedGroup = this.#collapsedGroupAnchoredBy(tokenId);
      if (collapsedGroup) {
        // One batched write of every member's new position, offsets preserved.
        const updates = collapsedDragUpdates(collapsedGroup, snapped);
        this.lastBatchMoveCount = updates.length;
        void this.#moveTokensUndoable(
          updates,
          fromPos ? collapsedDragUpdates(collapsedGroup, fromPos) : null,
        );
      } else if (moved && setMembers.length) {
        // A multi-select set drag (SPEC-056 §3): every selected token keeps
        // its pickup-time offset from the grabbed one — not independently
        // re-snapped, the same "formation preserved exactly" rule a
        // collapsed group's drag already follows. Gated on `moved`: a plain
        // click that never dragged touches no passenger (see `moved`'s own
        // comment above) — it falls through to the single-token branch below,
        // exactly like clicking a token outside any multi-selection always has.
        const to = [
          { tokenId, pos: snapped },
          ...setMembers.map((m) => ({
            tokenId: m.tokenId,
            pos: { x: snapped.x + m.offset.x, y: snapped.y + m.offset.y },
          })),
        ];
        this.lastBatchMoveCount = to.length;
        const from = fromPos
          ? [
              { tokenId, pos: fromPos },
              ...setMembers.map((m) => ({ tokenId: m.tokenId, pos: m.from })),
            ]
          : null;
        void this.#moveTokensUndoable(to, from);
      } else {
        this.lastBatchMoveCount = 1;
        void this.#moveTokenUndoable(tokenId, snapped, fromPos);
      }
      d.store.clearDrag(d.roomId, tokenId);
    };
    sprite.on('pointerup', stop);
    sprite.on('pointerupoutside', stop);
  }
}
