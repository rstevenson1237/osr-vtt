import type { hexMap, CursorPos, Drawing, PingPos, Token } from '@osr-vtt/shared';
import type { SquareSeamDeps } from './map-seam';
import { annotationsWithLiveStroke } from './drag-display';
import { resolvePingsForRender } from './token-view';
import type { RenderPing } from './vector-engine';
import type { Point } from './vector-tools';

/** Minimum gap between two published cursor positions, in ms (RULE-003). */
export const CURSOR_PUBLISH_MS = 80;

export interface MapDrawDeps extends SquareSeamDeps {
  /**
   * The one place a draw seam is handed both coordinate conversions
   * (SPEC-060 §2 otherwise forbids it): the Measure path stays lattice-space on
   * every map, and a hex map's own hex path is tracked alongside it for the
   * count (SPEC-049 §1). Resolves to `null` off a hex map: the component hands it
   * the hex controller's `hexAt`, which exists only there (SPEC-066 §2).
   */
  hexAt: (worldPx: Point) => hexMap.Axial | null;
  /** False in a local build: peer cursors and pings mean "somebody else", so no
   * listener is opened for them (SPEC-041 §3). */
  multiplayer: boolean;
  myUid: string | null;
  tool: () => string;
  tokens: () => readonly Token[];
  /** Paints peer cursors; they have their own sprite lifecycle in the engine,
   * so this is not a layer invalidation. */
  renderCursors: (cursors: readonly CursorPos[], myUid: string | null) => void;
  /** Mirrors the measure chip to the hidden DOM readout. Called from the
   * pointer path only, exactly where the component called it before. */
  syncReadout: () => void;
}

/**
 * The collaboration-draw seam (SPEC-060 §2–§5, WI-226): the freehand Pen
 * stroke, the Ping tool and the live pings, the Measure path, and the
 * throttled cursor publish. Cursors, pings and in-progress strokes are the
 * RTDB half of RULE-003; the Pen's released stroke is the one settled
 * Firestore write (`writeDrawing`).
 *
 * Only `livePings` is `$state`. The pen buffer and the Measure path are plain
 * per-frame fields, as they were in the component: the layer passes read them
 * inside tracking effects, so making them reactive would invalidate those
 * effects on every assignment on top of the explicit `invalidate` below. They
 * are written on the pointer path only; the getters are pure (SPEC-060 §3).
 */
export class MapDraw {
  readonly #deps: MapDrawDeps;

  /** The raw feed from `subscribePings` — resolved into render-ready pings by
   * the component's `$effect`, which also re-resolves on every token move so a
   * dropped ping (SPEC-046 §2) stops drawing the moment its token moves off. */
  livePings = $state<PingPos[]>([]);
  /** Per-ping remembered target, resolved once on first sight and never
   * re-hit-tested (SPEC-046 §2): `null` means a floor ping, a token id means
   * this ping is aimed and still tracks whether that token has moved off. */
  readonly #pingTargets = new Map<string, string | null>();

  /** In-progress freehand Pen stroke, pixel-space (not lattice-snapped — a note
   * stroke should follow the pointer smoothly). */
  #penPoints: Point[] = [];
  /** The Measure path, lattice space (SPEC-054 §12): each click appends a
   * point. Nothing is ever committed — there is no write. */
  #measurePath: Point[] = [];
  /** The path's live extension, following the cursor between clicks. */
  #measureLive: Point | null = null;
  /** The same path resolved to hexes (SPEC-049 §1) — empty on a square map. */
  #measureHexPath: hexMap.Axial[] = [];
  #measureHexLive: hexMap.Axial | null = null;
  #lastCursorPublish = 0;

  constructor(deps: MapDrawDeps) {
    this.#deps = deps;
  }

  // ---- listeners (the multiplayer-only guard, SPEC-041 §3) ----

  /** Opens the peer-cursor and ping listeners — none at all in a local build.
   * Returns the unsubscribers for the component to tear down. */
  subscribe(): Array<() => void> {
    const { store, roomId, multiplayer, myUid, renderCursors } = this.#deps;
    if (!multiplayer) return [];
    return [
      store.subscribeCursors(roomId, (c) => renderCursors(c, myUid)),
      store.subscribePings(roomId, (p) => (this.livePings = p)),
    ];
  }

  /** Ping list ready for the engine: a floor ping unchanged, a token-aimed ping
   * annotated with the ring radius to draw — or dropped entirely once its token
   * has moved off the mark it was published at. */
  resolvePings(): RenderPing[] {
    return resolvePingsForRender(this.livePings, this.#pingTargets, this.#deps.tokens());
  }

  // ---- read side for the `*Inputs()` composers ----

  /** The annotations with the in-progress Pen stroke appended. */
  annotationsWithLiveStroke(source: Drawing[]): Drawing[] {
    return annotationsWithLiveStroke(source, this.#deps.tool(), this.#penPoints);
  }

  /** The Measure path plus its live extension to the pointer (SPEC-054 §12) —
   * the leg being aimed reads on the running total before it is placed. */
  get livePath(): Point[] {
    return this.#measureLive ? [...this.#measurePath, this.#measureLive] : this.#measurePath;
  }

  get liveHexPath(): hexMap.Axial[] {
    return this.#measureHexLive
      ? [...this.#measureHexPath, this.#measureHexLive]
      : this.#measureHexPath;
  }

  // ---- cursor publish (RTDB, RULE-003) ----

  publishCursor(worldPx: Point): void {
    if (!this.#deps.multiplayer) return;
    const now = Date.now();
    if (now - this.#lastCursorPublish < CURSOR_PUBLISH_MS) return;
    this.#lastCursorPublish = now;
    this.#deps.store.publishCursor(this.#deps.roomId, worldPx);
  }

  // ---- pointer events (SPEC-060 §4) ----
  // These operate on the *pixel-space* world point: drawings, cursors and pings
  // store pixel-space coordinates, like tokens. `true` means the event was
  // consumed, so the default lattice pointer flow is skipped for these tools.

  pointerDown(worldPx: Point): boolean {
    const tool = this.#deps.tool();
    if (tool === 'ping') {
      this.#deps.store.publishPing(this.#deps.roomId, worldPx);
      return true;
    }
    if (tool === 'pen') {
      this.#penPoints = [worldPx];
      return true;
    }
    if (tool === 'measure') {
      // Each click extends the path (SPEC-054 §12) rather than starting a new
      // drag. Raw lattice, deliberately unsnapped: a ruler that jumps to grid
      // vertices can't answer "how far is it from here to there".
      const p = this.#deps.toLatticeRaw(worldPx);
      this.#measurePath = [...this.#measurePath, p];
      this.#measureLive = p;
      const hex = this.#deps.hexAt(worldPx);
      if (hex) this.#measureHexPath = [...this.#measureHexPath, hex];
      this.#measureHexLive = hex ?? null;
      this.#deps.invalidate('tools');
      this.#deps.syncReadout();
      return true;
    }
    return false;
  }

  pointerMove(worldPx: Point): boolean {
    const tool = this.#deps.tool();
    if (tool === 'ping') return true; // click-only, nothing to drag
    if (tool === 'pen') {
      if (this.#penPoints.length) {
        this.#penPoints = [...this.#penPoints, worldPx];
        // The live stroke is drawn with the annotations, on `overlay`.
        this.#deps.invalidate('overlay');
      }
      return true;
    }
    if (tool === 'measure') {
      // Follows the pointer between clicks so the ruler and the running total
      // track the next leg before it is placed; the click itself commits a leg.
      if (this.#measurePath.length) {
        this.#measureLive = this.#deps.toLatticeRaw(worldPx);
        const hex = this.#deps.hexAt(worldPx);
        if (hex) this.#measureHexLive = hex;
        this.#deps.invalidate('tools');
        this.#deps.syncReadout();
      }
      return true;
    }
    return false;
  }

  async pointerUp(): Promise<boolean> {
    const tool = this.#deps.tool();
    if (tool === 'ping') return true;
    // Measure is click-to-extend (SPEC-054 §12): the path is built entirely on
    // pointer-down and ends on Escape or a double-click, so there is nothing
    // left to do here.
    if (tool === 'measure') return true;
    if (tool === 'pen') {
      const points = this.#penPoints;
      if (points.length > 1) {
        await this.#deps.store.writeDrawing(this.#deps.roomId, this.#deps.mapId, {
          layer: 'mapping',
          kind: 'freehand',
          points,
          style: {},
        });
      }
      this.#penPoints = [];
      this.#deps.invalidate('overlay');
      return true;
    }
    return false;
  }

  // ---- ending a gesture ----

  /** Ends the Measure path on a double-click (SPEC-054 §12) — the `Escape`
   * equivalent, `cancel`, clears the same state. */
  finishMeasure(): void {
    this.#clearMeasure();
    this.#deps.invalidate('tools');
  }

  /** Drops the Pen stroke and the Measure path (Escape, a pan gesture). The
   * caller redraws — it clears other state in the same breath. */
  cancel(): void {
    this.#penPoints = [];
    this.#clearMeasure();
  }

  #clearMeasure(): void {
    this.#measurePath = [];
    this.#measureLive = null;
    this.#measureHexPath = [];
    this.#measureHexLive = null;
  }
}
