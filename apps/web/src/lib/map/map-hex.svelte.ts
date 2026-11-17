import { hexMap, type HexLine, type HexSymbol, type HexTile } from '@osr-vtt/shared';
import type { MapSeamDeps } from './map-seam';
import {
  effectiveRevealedHexes,
  extendHexFogStroke,
  hexesToReset,
  hexesToRevealAll,
  hexFogged,
  hexFogStrokeChanges,
  revealedHexKeys,
  startHexFogStroke,
  type HexFogStroke,
} from './hex-fog';
import { hexLinePreview as hexLinePreviewFor } from './view-helpers';
import type { HexLinePreview } from './vector-engine';

/** The slice of the shared `MapToolController` the hex tools read and write
 * (SPEC-066 §3): the picked hex, and the palette's per-tool choices. */
export interface HexToolState {
  selectedHex: hexMap.Axial | null;
  readonly selectedHexSymbolKind: string;
  readonly selectedHexTerrainKind: string;
  readonly selectedHexLineWidth: number;
}

/**
 * What the hex controller is handed (SPEC-066 §3). **No square-lattice
 * conversion, and no `cellSize`** (DEC-133, RULE-006): the controller converts
 * a pointer to an axial coordinate itself, from `hexSize`, and a square map
 * never constructs one.
 *
 * Everything the component owns and changes over time is a getter, so a change
 * is seen on the next call.
 */
export interface MapHexDeps extends MapSeamDeps {
  tools: HexToolState;
  /** `GameMap.hex.size`, the render-time multiplier (RULE-006). */
  hexSize: () => number;
  /** The Select tool is the active tool. */
  selecting: () => boolean;
  tool: () => string;
  isGM: () => boolean;
  /** `GameMap.fog?.enabled ?? false`. */
  fogEnabled: () => boolean;
  /** A pan/zoom gesture is in progress. */
  gestureActive: () => boolean;
  /** A token or vertex drag is in progress. */
  dragging: () => boolean;
  isCoarsePointer: () => boolean;
  /** The Hex/Free snap mode in force for this gesture. */
  effectiveSnap: () => string;
  /** Null before the engine exists. */
  toScreen: (p: { x: number; y: number }) => { x: number; y: number } | null;
  /** Select's background pick (SPEC-059 §3.3): `true` when an unlocked
   * background took the press. Behind the hex pick a background could never be
   * reached, since every point of a hex crawl is inside some hex. */
  pickBackground: (worldPx: { x: number; y: number }) => boolean;
  /** A hex pick drops the background pick — Select's slots are exclusive. */
  dropBackgroundPick: () => void;
}

/**
 * The hex authoring seam (SPEC-066, WI-228, DEC-133): everything that turns a
 * pointer on a hex map into an axial coordinate, and everything that acts on
 * the result — Select's hex pick, the Symbol, Road/River, Label, Terrain and
 * Reveal/Hide tools, the note hover, the hex-tile sheet's writes, hex fog and
 * the three hex subscriptions.
 *
 * **It is constructed only on a hex map.** A square map holds `null`, so the
 * axial boundary RULE-006 draws is whether this object exists rather than a
 * guard at the top of each method.
 *
 * The documents (`tiles`, `symbols`, `lines`) and the note hover are `$state`;
 * the composers and the markup read them as plain fields. The Road/River
 * buffer, the pointer position and the fog stroke are per-gesture fields that
 * are written on the pointer path and read by the tools/fog passes, so they
 * are not reactive — each write is followed by an explicit `invalidate`, as it
 * was in the component.
 */
export class HexAuthoringController {
  readonly #deps: MapHexDeps;

  /** Painted hexes (SPEC-030 §§2–3) — sparse, so this is what the referee has
   * touched rather than what is on screen. */
  tiles = $state<HexTile[]>([]);
  /** Placed hex symbols and drawn roads/rivers (SPEC-047 §§2, 4). */
  symbols = $state<HexSymbol[]>([]);
  lines = $state<HexLine[]>([]);
  /** The keys of every revealed hex (`HexTile.revealed`), stored state only. */
  readonly revealed = $derived(revealedHexKeys(this.tiles));
  /** The tile document for `tools.selectedHex`, or `null` for a hex nobody has
   * painted or written about — which is most of an infinite plane. Keyed by
   * `axialKey`, because that *is* the document id. */
  readonly selectedTile = $derived.by(() => {
    const hex = this.#deps.tools.selectedHex;
    if (!hex) return null;
    const key = hexMap.axialKey(hex);
    return this.tiles.find((t) => t.id === key) ?? null;
  });
  /** The hovered hex, as its key and the screen anchor of its centre, or `null`. */
  hoverNote = $state<{ key: string; x: number; y: number } | null>(null);
  /** The hovered hex's note, if it has one (SPEC-030 §4). Empty on every hex
   * nobody wrote about — an empty popover following the pointer across an
   * infinite plane would be pure noise. */
  readonly hoverNoteText = $derived.by(() => {
    const hovered = this.hoverNote;
    if (!hovered) return '';
    return this.tiles.find((t) => t.id === hovered.key)?.note ?? '';
  });

  /** The in-progress Road/River polyline (SPEC-047 §4), in `HexPoint`s. */
  #collecting: hexMap.HexPoint[] = [];
  /** Where the pointer last was, in world pixels, for the Road/River preview
   * (SPEC-047 §12) to run its last segment to. */
  #hoverPx: { x: number; y: number } | null = null;
  /** The Reveal / Hide stroke in progress (SPEC-056 §9), or `null`. Local to
   * this client until release — never an RTDB draft, since a peer preview would
   * leak what is about to be revealed. */
  #fogStroke: HexFogStroke | null = null;
  /** A released stroke whose write has not reached `tiles` yet, still
   * previewed so the hexes do not flash back under fog in between: a Firestore
   * transaction is not latency-compensated, and the listener can trail the
   * commit. Cleared by `#settleFogPending` once the subscription shows every
   * hex it changed, or when the write fails. */
  #fogPending: { stroke: HexFogStroke; changes: hexMap.Axial[] } | null = null;

  constructor(deps: MapHexDeps) {
    this.#deps = deps;
  }

  // ---- listeners ----

  /** Opens the three hex subscriptions — painted hexes, placed symbols, drawn
   * roads/rivers. Returns the unsubscribers for the component to tear down. */
  subscribe(): Array<() => void> {
    const { store, roomId, mapId } = this.#deps;
    return [
      store.subscribeHexTiles(roomId, mapId, (t) => {
        this.tiles = t;
        this.#settleFogPending();
      }),
      store.subscribeHexSymbols(roomId, mapId, (s) => {
        this.symbols = s;
      }),
      store.subscribeHexLines(roomId, mapId, (l) => {
        this.lines = l;
      }),
    ];
  }

  // ---- conversions: the only place a pointer becomes an axial coordinate ----

  /** Which hex a world-pixel point is in. */
  hexAt = (worldPx: { x: number; y: number }): hexMap.Axial | null => {
    const size = this.#deps.hexSize();
    if (size <= 0) return null;
    return hexMap.pixelToAxial(worldPx, size);
  };

  /** Resolves a world-pixel pointer to a `HexPoint`, the way §3's table says
   * (SPEC-047 §§3, 4): Hex snap lands the hex Symbol tool on the hex the
   * pointer is inside (an integer-valued centre); Free snap keeps the raw
   * pointer, fractional. */
  hexSymbolPointFor(worldPx: { x: number; y: number }): hexMap.HexPoint | null {
    const size = this.#deps.hexSize();
    if (size <= 0) return null;
    if (this.#deps.effectiveSnap() === 'free') return hexMap.pixelToHexPoint(worldPx, size);
    return hexMap.axialToHexPoint(hexMap.pixelToAxial(worldPx, size));
  }

  /** Where a Road/River vertex lands for a given world pixel. Under Hex snap
   * it resolves through `snapHexPoint` — the nearest thirds-lattice point,
   * corner or centre, which is what makes a road run corner to corner; under
   * Free snap it is the raw pointer. Shared by the click and the live preview
   * (SPEC-047 §12), so the ghost's last segment ends exactly where the next
   * click would put it, by construction rather than by two sites agreeing. */
  hexLinePointFor = (worldPx: { x: number; y: number }): hexMap.HexPoint | null => {
    const size = this.#deps.hexSize();
    if (size <= 0) return null;
    const raw = hexMap.pixelToHexPoint(worldPx, size);
    return this.#deps.effectiveSnap() === 'free' ? raw : hexMap.snapHexPoint(raw);
  };

  // ---- fog ----

  get #fogOn(): boolean {
    return this.#deps.fogEnabled();
  }

  /** Whether a hex is hidden from *this viewer* — a player on a fogged hex.
   * The referee sees through their own fog (dimmed), so this is always `false`
   * for them. Keyed by axial coordinate only (RULE-006). */
  hiddenFromMe(hex: hexMap.Axial): boolean {
    return !this.#deps.isGM() && hexFogged(this.#fogOn, this.revealed, hex);
  }

  /** The hex fog the fog pass draws (SPEC-056 §9): the stored flags with an
   * in-progress Reveal / Hide stroke previewed on top. */
  fogView(): { size: number; revealed: hexMap.Axial[] } {
    return {
      size: this.#deps.hexSize(),
      revealed: effectiveRevealedHexes(this.tiles, [
        this.#fogPending?.stroke ?? null,
        this.#fogStroke,
      ]),
    };
  }

  /** The Reveal / Hide hex tool may paint — the referee's, and only while the
   * map's fog is on, the same belt-and-braces gate the carve fog gets: the
   * palette already hides the button otherwise, and this stops a stale tool
   * writing. */
  #fogAllowed(): boolean {
    return this.#deps.tool() === 'hexFog' && this.#deps.isGM() && this.#fogOn;
  }

  /** A player's selected hex that the referee fogs (SPEC-056 §9) is dropped, so
   * the sheet stops showing — or writing — what the fog now hides. Called from
   * the component's tracking `$effect`. */
  dropFoggedSelection(): void {
    const hex = this.#deps.tools.selectedHex;
    if (hex && this.hiddenFromMe(hex)) this.#deps.tools.selectedHex = null;
  }

  /** A hex crawl's Reveal all (SPEC-056 §9): every hex the referee has put
   * something on, in one batched write. Not on the undo stack — no hex write
   * is (the Terrain tool's are not either). */
  async revealAll(): Promise<void> {
    if (!this.#deps.isGM()) return;
    const hexes = hexesToRevealAll(this.tiles);
    if (hexes.length) {
      await this.#deps.store.setHexesRevealed(this.#deps.roomId, this.#deps.mapId, hexes, true);
    }
  }

  /** Every revealed hex back under fog, flag-only tiles deleted outright. */
  async resetFog(): Promise<void> {
    if (!this.#deps.isGM()) return;
    const hexes = hexesToReset(this.tiles);
    if (hexes.length) {
      await this.#deps.store.setHexesRevealed(this.#deps.roomId, this.#deps.mapId, hexes, false);
    }
  }

  /** The Reveal / Hide hex tool's press (SPEC-056 §9): starts a stroke on the
   * hex under the pointer, which decides whether the stroke reveals or hides
   * (`startHexFogStroke`). A no-op unless `#fogAllowed`. */
  #startFog(worldPx: { x: number; y: number }): void {
    if (!this.#fogAllowed()) return;
    const hex = this.hexAt(worldPx);
    if (!hex) return;
    this.#fogStroke = startHexFogStroke(this.revealed, hex);
    this.#deps.invalidate();
  }

  /** The drag: every hex the pointer crosses joins the stroke, previewed
   * locally in the fog layer as it grows. */
  #extendFog(worldPx: { x: number; y: number }): void {
    const hex = this.hexAt(worldPx);
    if (!this.#fogStroke || !hex) return;
    if (extendHexFogStroke(this.#fogStroke, hex)) this.#deps.invalidate('fog');
  }

  /** The release: the whole stroke in **one** batched write (RULE-003), and
   * only the hexes whose state it actually changes. */
  async #commitFog(): Promise<void> {
    const stroke = this.#fogStroke;
    this.#fogStroke = null;
    if (!stroke) return;
    const changes = hexFogStrokeChanges(stroke, this.revealed);
    if (changes.length) {
      const pending = { stroke, changes };
      this.#fogPending = pending;
      try {
        await this.#deps.store.setHexesRevealed(
          this.#deps.roomId,
          this.#deps.mapId,
          changes,
          stroke.reveal,
        );
        this.#settleFogPending();
      } catch (err) {
        if (this.#fogPending === pending) this.#fogPending = null;
        throw err;
      } finally {
        this.#deps.invalidate();
      }
    }
  }

  /** Drops the pending stroke's preview once `tiles` shows every hex it
   * changed — called after the write resolves and on every tile snapshot, so
   * whichever of the two arrives last settles it. */
  #settleFogPending(): void {
    const pending = this.#fogPending;
    if (!pending) return;
    const landed = pending.changes.every(
      (h) => this.revealed.has(hexMap.axialKey(h)) === pending.stroke.reveal,
    );
    if (landed) this.#fogPending = null;
  }

  // ---- Select's pick, and the click tools ----

  /** Select's click on a hex map: pick the hex under the pointer, or drop the
   * selection when the same hex is clicked again — the toggle a referee needs
   * to get the sheet out of "editing hex 3,-4" without picking another one.
   * Returns whether the click was consumed. */
  #pick(worldPx: { x: number; y: number }): boolean {
    const { tools, invalidate } = this.#deps;
    // An unlocked background under the pointer is picked up first (SPEC-059
    // §3.3), GM-only like the square map's pick (DEC-063).
    if (this.#deps.pickBackground(worldPx)) {
      tools.selectedHex = null;
      invalidate('tools');
      return true;
    }
    const hex = this.hexAt(worldPx);
    if (!hex) return false;
    // A hex pick and a background pick are exclusive, as Select's slots are on
    // a square map.
    this.#deps.dropBackgroundPick();
    // A fogged hex is unexplored to a player (SPEC-056 §9): its note must not
    // be readable through the sheet, nor its fields overwritten blind. The
    // click is consumed and drops any selection instead.
    if (this.hiddenFromMe(hex)) {
      tools.selectedHex = null;
      invalidate();
      return true;
    }
    const current = tools.selectedHex;
    tools.selectedHex = current && hexMap.axialEquals(current, hex) ? null : { q: hex.q, r: hex.r };
    invalidate();
    return true;
  }

  /** The hex Symbol tool's click (SPEC-047 §4): places one
   * `HEX_CONTENTS_CATALOG` symbol, one settled write per click (RULE-003). */
  async #placeSymbol(worldPx: { x: number; y: number }): Promise<void> {
    const point = this.hexSymbolPointFor(worldPx);
    if (!point) return;
    await this.#deps.store.placeHexSymbol(this.#deps.roomId, this.#deps.mapId, {
      point,
      kind: this.#deps.tools.selectedHexSymbolKind,
    });
  }

  /** A Road/River vertex click (SPEC-047 §4), accumulated in `#collecting` and
   * committed by `finishLine` on the double-click that ends the gesture,
   * exactly like Wall/Path/Polygon. */
  #addLineVertex(worldPx: { x: number; y: number }): void {
    const point = this.hexLinePointFor(worldPx);
    if (!point) return;
    this.#collecting.push(point);
    this.#deps.invalidate();
  }

  /** The hex Label tool's click (SPEC-047 §5): opens that hex's note by
   * publishing it as `tools.selectedHex`, exactly what Select's pick does. Both
   * snap modes agree, because a note belongs to a hex by definition — so unlike
   * Select, this never toggles the selection off. */
  #labelClick(worldPx: { x: number; y: number }): void {
    const hex = this.hexAt(worldPx);
    if (!hex || this.hiddenFromMe(hex)) return;
    this.#deps.tools.selectedHex = { q: hex.q, r: hex.r };
    this.#deps.invalidate();
  }

  /** The Terrain tool's click (SPEC-047 §7): one settled write per hex
   * (RULE-003), through the same `setHexTerrain` the hex-tile sheet calls.
   * There is no snap mode to read, since Hex and Free would both land on the
   * same hex. Painting the kind the hex already carries clears it instead,
   * mirroring the sheet's own toggle. */
  async #placeTerrain(worldPx: { x: number; y: number }): Promise<void> {
    const hex = this.hexAt(worldPx);
    // Not onto a hex a player cannot see (SPEC-056 §9): the toggle reads what
    // the hex already carries, and a player has not been shown that.
    if (!hex || this.hiddenFromMe(hex)) return;
    const key = hexMap.axialKey(hex);
    const current = this.tiles.find((t) => t.id === key)?.terrain ?? null;
    const kind = this.#deps.tools.selectedHexTerrainKind;
    await this.#deps.store.setHexTerrain(
      this.#deps.roomId,
      this.#deps.mapId,
      hex,
      current === kind ? null : kind,
    );
  }

  // ---- the hex-tile sheet's writes (SPEC-030 §5) ----

  setTerrain(kind: string | null): void {
    const hex = this.#deps.tools.selectedHex;
    if (hex) void this.#deps.store.setHexTerrain(this.#deps.roomId, this.#deps.mapId, hex, kind);
  }

  setContents(kind: string | null): void {
    const hex = this.#deps.tools.selectedHex;
    if (hex) void this.#deps.store.setHexContents(this.#deps.roomId, this.#deps.mapId, hex, kind);
  }

  setNote(note: string | null): void {
    const hex = this.#deps.tools.selectedHex;
    if (hex) void this.#deps.store.setHexNote(this.#deps.roomId, this.#deps.mapId, hex, note);
  }

  // ---- the read side for the `*Inputs()` composers ----

  /** The Road/River ghost for this frame (SPEC-047 §12), or `null` when there
   * is nothing to show. Derived entirely from live tool state and written
   * nowhere: no document, no store method, no RTDB frame. */
  linePreview(): HexLinePreview | null {
    return hexLinePreviewFor(
      this.#deps.tool(),
      true,
      this.#hoverPx,
      this.#collecting,
      this.hexLinePointFor,
      this.#deps.tools.selectedHexLineWidth,
    );
  }

  // ---- note hover (SPEC-030 §4) ----

  /** The hover half of §4: runs on every pointer-move, before any tool, and is
   * likewise read-only and tool-agnostic — a note is information about the map,
   * so whichever tool is in hand can read it.
   *
   * There is no coarse-pointer note dot here, unlike a room label (SPEC-033
   * §4): a hex map's equivalent is already the quick sheet, which shows the
   * selected hex's note in full and is reached by the tap that selects it. */
  #updateHoverNote(worldPx: { x: number; y: number }): void {
    if (this.#deps.isCoarsePointer() || this.#deps.gestureActive() || this.#deps.dragging()) {
      this.hoverNote = null;
      return;
    }
    const hex = this.hexAt(worldPx);
    if (!hex) {
      this.hoverNote = null;
      return;
    }
    // A player is not shown what a fogged hex says (SPEC-056 §9).
    if (this.hiddenFromMe(hex)) {
      this.hoverNote = null;
      return;
    }
    const key = hexMap.axialKey(hex);
    if (this.hoverNote?.key === key) return; // already showing; don't jitter it
    // Anchored on the hex's centre, the way a label tooltip is anchored on its
    // cell's centre — one convention, so both popovers sit where the thing
    // they describe is.
    const at = this.#deps.toScreen(hexMap.axialToPixel(hex, this.#deps.hexSize()));
    if (!at) return;
    this.hoverNote = { key, ...at };
  }

  // ---- pointer events (SPEC-066 §5) ----
  // Raw world pixels in; `true` means the event was consumed.

  /** Select's hex pick plus the `hexSymbol`, `road`/`river`, `hexLabel`,
   * `hexTerrain` and `hexFog` tools. Those tools and Select are mutually
   * exclusive with each other and with the square `label`/`symbol`/`text`
   * tools, so merging the branches reorders no outcome. */
  pointerDown(worldPx: { x: number; y: number }): boolean {
    if (this.#deps.selecting()) return this.#pick(worldPx);
    const tool = this.#deps.tool();
    if (tool === 'hexSymbol') {
      void this.#placeSymbol(worldPx);
      return true;
    }
    if (tool === 'road' || tool === 'river') {
      this.#addLineVertex(worldPx);
      return true;
    }
    if (tool === 'hexLabel') {
      this.#labelClick(worldPx);
      return true;
    }
    if (tool === 'hexTerrain') {
      void this.#placeTerrain(worldPx);
      return true;
    }
    if (tool === 'hexFog') {
      this.#startFog(worldPx);
      return true;
    }
    return false;
  }

  /** Records the preview point and updates the note hover — on every move,
   * whichever handler consumes it (SPEC-069 §3). */
  hover(worldPx: { x: number; y: number }): void {
    this.#updateHoverNote(worldPx);
    this.#hoverPx = worldPx;
  }

  /** Consumes the event only while a fog stroke is open. */
  pointerMove(worldPx: { x: number; y: number }): boolean {
    if (!this.#fogStroke) return false;
    this.#extendFog(worldPx);
    return true;
  }

  /** Commits an open fog stroke. */
  async pointerUp(): Promise<boolean> {
    if (!this.#fogStroke) return false;
    await this.#commitFog();
    return true;
  }

  pointerOut(): void {
    this.hoverNote = null;
  }

  /** Ends a Road/River on the double-click: a one-point (or zero-point) line is
   * not a line (SPEC-047 §4, `types.ts`'s `HexLine.points`) — the same `>= 2`
   * guard Wall's own branch takes, discarding rather than committing a
   * degenerate gesture. The caller redraws. */
  async finishLine(): Promise<void> {
    const kind = this.#deps.tool();
    if (kind !== 'road' && kind !== 'river') return;
    const points = this.#collecting;
    this.#collecting = [];
    if (points.length < 2) return;
    const width = this.#deps.tools.selectedHexLineWidth;
    await this.#deps.store.addHexLine(this.#deps.roomId, this.#deps.mapId, {
      kind,
      points,
      // The shade is the width (SPEC-047 §14, WI-129): no separate shade
      // control, so the index it commits is the width index.
      shade: width,
      width,
      join: hexMap.hexLineEntry(kind).join,
    });
  }

  /** Drops the Road/River run and the fog stroke (Escape, a pan gesture, a
   * tool change). The caller redraws — it clears other state in the same
   * breath. */
  cancel(): void {
    this.#collecting = [];
    this.#fogStroke = null;
  }
}
