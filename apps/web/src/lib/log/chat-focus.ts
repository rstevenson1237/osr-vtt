/**
 * Tiny registry backing the `L` "focus chat input" shortcut (Master Plan v2,
 * R1.7). Chat inputs live in two places — the peek drawer and the Log stage —
 * so each registers a focuser under its location and the shell picks the right
 * one to call. No reactivity needed: it's an imperative focus hop, not state.
 */

export type ChatLocation = 'drawer' | 'stage';
type Focuser = () => void;

const focusers = new Map<ChatLocation, Focuser>();

/** A chat input registers its focus fn on mount; the returned disposer clears
 * it on destroy (guarding against clobbering a newer registration). */
export function registerChatFocus(where: ChatLocation, fn: Focuser): () => void {
  focusers.set(where, fn);
  return () => {
    if (focusers.get(where) === fn) focusers.delete(where);
  };
}

/** Focus the chat input at `preferred`, falling back to whichever is mounted. */
export function focusChat(preferred: ChatLocation): void {
  const fn = focusers.get(preferred) ?? focusers.get('stage') ?? focusers.get('drawer');
  fn?.();
}
