import type { Handle, ObjectSelection } from './vector-tools';

/**
 * What the Select tool holds (SPEC-067 §2, DEC-134): four slots that are
 * mutually exclusive — vertex handles, whole objects, tokens and one
 * background (SPEC-037 §2, SPEC-039 §2, SPEC-056 §3). Every writer sets its own
 * slot(s) and empties the rest, so the exclusion lives here rather than in
 * every seam that selects.
 *
 * A pure state holder: no store, no engine, no coordinates. The Select gesture,
 * the background seam and the token sprite all write through it; the composers
 * and the test readouts read it.
 */
export class MapSelection {
  /** Vertex handles. `$state.raw`: a `Handle` carries a `locate` closure and is
   * compared by `sameHandle`, so a reactive proxy buys nothing. */
  handles = $state.raw<Handle[]>([]);
  /** Whole objects (symbol, room label, door, drawing); raw for the same reason
   * as `handles` — the entries are replaced, never edited in place. */
  objects = $state.raw<ObjectSelection[]>([]);
  /** Every token Select holds. Reassigned rather than mutated. */
  tokenIds = $state<string[]>([]);
  /** The picked background's document id, not the `MapBackground` itself, so a
   * lock or removal elsewhere is picked up through the handed
   * `backgroundSelectable` rather than going stale. */
  backgroundId = $state<string | null>(null);

  #backgroundSelectable: (id: string) => boolean = () => true;

  /** The one selected object, or `null` while nothing — or more than one thing —
   * is picked. Rotate, the Room quick sheet's published selection and the
   * `selected-object` readout are all single-target by nature. */
  readonly object = $derived(this.objects.length === 1 ? this.objects[0]! : null);

  /** The `selection-count` readout: handles, plus objects, plus one for a
   * background that is still selectable. */
  readonly count = $derived(
    this.handles.length +
      this.objects.length +
      (this.backgroundId !== null && this.#backgroundSelectable(this.backgroundId) ? 1 : 0),
  );

  /**
   * @param backgroundSelectable whether a background id still names a background
   * that Select may hold (on this map, unlocked, and the viewer is the GM). It
   * is handed in so this class never resolves a background itself; without one
   * every non-null id counts.
   */
  constructor(backgroundSelectable: (id: string) => boolean = () => true) {
    this.#backgroundSelectable = backgroundSelectable;
  }

  selectHandles(handles: Handle[]): void {
    this.handles = handles;
    this.objects = [];
    this.tokenIds = [];
    this.backgroundId = null;
  }

  selectObjects(objects: ObjectSelection[]): void {
    this.handles = [];
    this.objects = objects;
    this.tokenIds = [];
    this.backgroundId = null;
  }

  /** The lasso's mixed catch of handles and whole objects. */
  selectGeometry(handles: Handle[], objects: ObjectSelection[]): void {
    this.handles = handles;
    this.objects = objects;
    this.tokenIds = [];
    this.backgroundId = null;
  }

  /** A click, a Shift-click toggle (the caller passes the toggled list) or a
   * lasso's token catch. */
  selectTokens(ids: string[]): void {
    this.handles = [];
    this.objects = [];
    this.tokenIds = ids;
    this.backgroundId = null;
  }

  selectBackground(id: string): void {
    this.handles = [];
    this.objects = [];
    this.tokenIds = [];
    this.backgroundId = id;
  }

  /** Drops the background pick and nothing else: a press on open canvas that
   * starts a lasso, or a hex pick, leaves the other slots as they were until
   * its release decides. */
  dropBackground(): void {
    this.backgroundId = null;
  }

  clear(): void {
    this.handles = [];
    this.objects = [];
    this.tokenIds = [];
    this.backgroundId = null;
  }
}
