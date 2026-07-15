/**
 * Tiny registry backing the `L` "focus chat input" shortcut (Master Plan v2,
 * R1.7). Chat inputs live in two places — the peek drawer and the Log stage —
 * so each registers a focuser under its location and the shell picks the right
 * one to call. No reactivity needed: it's an imperative focus hop, not state.
 */

export type ChatLocation = 'drawer' | 'stage';
type Focuser = () => void;

const focusers = new Map<ChatLocation, Focuser>();

/** Set by `focusChat` when the caller just expanded the drawer (or switched to
 * the Log activity) in the same tick — its `ChatInput` hasn't mounted yet, so
 * there's nothing to call. Resolved as soon as that location registers. */
let pendingFocus: ChatLocation | null = null;

/** A chat input registers its focus fn on mount; the returned disposer clears
 * it on destroy (guarding against clobbering a newer registration). */
export function registerChatFocus(where: ChatLocation, fn: Focuser): () => void {
  focusers.set(where, fn);
  if (pendingFocus === where) {
    pendingFocus = null;
    fn();
  }
  return () => {
    if (focusers.get(where) === fn) focusers.delete(where);
  };
}

/** Focus the chat input at `preferred`, falling back to whichever is mounted.
 * If `preferred` isn't mounted yet (e.g. its drawer was just expanded in this
 * same tick), the request is queued and honored the moment it registers. */
export function focusChat(preferred: ChatLocation): void {
  const fn = focusers.get(preferred) ?? focusers.get('stage') ?? focusers.get('drawer');
  if (fn) fn();
  else pendingFocus = preferred;
}
