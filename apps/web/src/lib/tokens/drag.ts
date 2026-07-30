/**
 * Dragging a character's token out of a quick sheet and onto the map.
 *
 * The two ends are far apart in the component tree — `CharacterDock` starts the
 * drag, `VectorMapView` receives the drop — and HTML5 drag-and-drop is the only
 * channel between them that survives crossing the Pixi canvas boundary, since
 * the map's own input is Pixi federated pointer events rather than DOM ones.
 * So the payload travels on the `DataTransfer` and this module owns its shape.
 *
 * A custom MIME type (rather than `text/plain`) is what lets the map's `drop`
 * handler tell one of these apart from a file, a URL, or a selection dragged in
 * from elsewhere, and ignore everything that is not ours.
 */
export const TOKEN_DRAG_MIME = 'application/x-vtt-token';

export interface TokenDragPayload {
  /** The character's existing token, or `null` when they have none yet — the
   * drop creates one at the dropped position in that case. */
  tokenId: string | null;
  /** The character's profile seat, so a created token is linked to it. */
  seatId: string;
  /** Art for a created token; the sheet's portrait, matching what "My token"
   * would have used. */
  imageRef: string;
}

export function writeTokenDrag(dt: DataTransfer, payload: TokenDragPayload): void {
  dt.setData(TOKEN_DRAG_MIME, JSON.stringify(payload));
  dt.effectAllowed = 'move';
}

/**
 * The payload from a `drop`, or `null` if this drag is not ours. Note that
 * `getData` returns an empty string during `dragover` by design (the browser
 * withholds the data until the drop), so callers must decide whether to accept
 * a drag from `types` alone — see `hasTokenDrag`.
 */
export function readTokenDrag(dt: DataTransfer | null): TokenDragPayload | null {
  const raw = dt?.getData(TOKEN_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TokenDragPayload;
    return typeof parsed?.seatId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether a `dragover` is carrying one of our tokens — readable before the
 * drop, unlike the payload itself. */
export function hasTokenDrag(dt: DataTransfer | null): boolean {
  return dt ? Array.from(dt.types).includes(TOKEN_DRAG_MIME) : false;
}
