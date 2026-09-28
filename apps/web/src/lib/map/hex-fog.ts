import { hexMap, type HexTile } from '@osr-vtt/shared';

/**
 * Hex fog of war (SPEC-056 §9, DEC-113) — the pure half of the Reveal / Hide
 * hex tool and the fog render, kept out of `VectorMapView` so it can be tested
 * without a canvas.
 *
 * Everything here is keyed by `hexMap.axialKey` and nothing else (RULE-006):
 * a hex's fog state is `HexTile.revealed` on the tile whose id *is* that key,
 * and no square-lattice consumer is reached from here.
 */

/** The keys of every revealed hex on the map. Absent `revealed` is hidden. */
export function revealedHexKeys(tiles: readonly HexTile[]): Set<string> {
  const keys = new Set<string>();
  for (const t of tiles) if (t.revealed) keys.add(t.id);
  return keys;
}

/** Whether `hex` is under fog for this viewer's purposes — only ever true
 * while the map's fog is on. */
export function hexFogged(
  fogEnabled: boolean,
  revealed: ReadonlySet<string>,
  hex: hexMap.Axial,
): boolean {
  return fogEnabled && !revealed.has(hexMap.axialKey(hex));
}

/**
 * An in-progress Reveal / Hide stroke. **The first hex decides the stroke**:
 * pressing on a hidden hex reveals everything the drag crosses, pressing on a
 * revealed one hides it — the Terrain tool's "same click clears it" toggle,
 * carried over to a brush, so the tool needs no mode control of its own.
 */
export interface HexFogStroke {
  reveal: boolean;
  /** Every hex the stroke has crossed, by key, in the order first crossed. */
  hexes: Map<string, hexMap.Axial>;
  /** The last hex the pointer was in, for filling the gap to the next one. */
  last: hexMap.Axial;
}

export function startHexFogStroke(
  revealed: ReadonlySet<string>,
  hex: hexMap.Axial,
): HexFogStroke {
  return {
    reveal: !revealed.has(hexMap.axialKey(hex)),
    hexes: new Map([[hexMap.axialKey(hex), hex]]),
    last: hex,
  };
}

/** Extends the stroke to `hex`, filling every hex on the straight line from
 * the last one — a fast drag moves several hexes per pointer event. Returns
 * whether anything new was crossed, so the caller can skip a redraw. */
export function extendHexFogStroke(stroke: HexFogStroke, hex: hexMap.Axial): boolean {
  if (hexMap.axialEquals(stroke.last, hex)) return false;
  let grew = false;
  for (const h of hexMap.axialLine(stroke.last, hex)) {
    const key = hexMap.axialKey(h);
    if (stroke.hexes.has(key)) continue;
    stroke.hexes.set(key, h);
    grew = true;
  }
  stroke.last = hex;
  return grew;
}

/** The hexes a finished stroke actually changes — already-revealed hexes are
 * dropped from a reveal and hidden ones from a hide, so the write carries only
 * real changes and a stroke that changes nothing writes nothing. */
export function hexFogStrokeChanges(
  stroke: HexFogStroke,
  revealed: ReadonlySet<string>,
): hexMap.Axial[] {
  return [...stroke.hexes].filter(([key]) => revealed.has(key) !== stroke.reveal).map(([, h]) => h);
}

/** The revealed set as the viewer should see it right now: the stored flags,
 * with strokes applied on top in order — the in-progress stroke's live
 * preview, and a released one whose write has not landed yet (a Firestore
 * transaction is not latency-compensated, so without it the hexes would flash
 * back under fog until the server answers). Local to the drawing client: like
 * a square fog stroke, it is never published as a draft, since a peer preview
 * would leak what is about to be revealed. */
export function effectiveRevealedHexes(
  tiles: readonly HexTile[],
  strokes: readonly (HexFogStroke | null)[],
): hexMap.Axial[] {
  const out = new Map<string, hexMap.Axial>();
  for (const t of tiles) if (t.revealed) out.set(t.id, t.hex);
  for (const stroke of strokes) {
    if (!stroke) continue;
    for (const [key, h] of stroke.hexes) {
      if (stroke.reveal) out.set(key, h);
      else out.delete(key);
    }
  }
  return [...out.values()];
}

/**
 * **Reveal all** on a hex map — "the party has the map", as it is on a square
 * one, where it reveals the whole carved floor. A hex crawl has no carved
 * floor and an infinite plane, so "all" is every hex the referee has put
 * something on: a tile carrying terrain, contents or a note that is not yet
 * revealed.
 */
export function hexesToRevealAll(tiles: readonly HexTile[]): hexMap.Axial[] {
  return tiles.filter((t) => !t.revealed && (t.terrain || t.contents || t.note)).map((t) => t.hex);
}

/** **Reset fog** on a hex map: every revealed hex, back under fog. */
export function hexesToReset(tiles: readonly HexTile[]): hexMap.Axial[] {
  return tiles.filter((t) => t.revealed).map((t) => t.hex);
}
