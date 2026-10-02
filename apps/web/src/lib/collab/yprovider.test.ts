import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { CampaignStore } from '@osr-vtt/shared';
import { LOCAL_IDLE_MS, LOCAL_MAX_WAIT_MS, YRoomProvider } from './yprovider';

function makeStore() {
  let onState: ((state: Uint8Array | null) => void) | null = null;
  const mergeYUpdate = vi.fn(async () => {});
  const unsubscribe = vi.fn();
  const store = {
    mergeYUpdate,
    subscribeYState: vi.fn((_room: string, _doc: string, cb: (s: Uint8Array | null) => void) => {
      onState = cb;
      return unsubscribe;
    }),
  } as unknown as CampaignStore;
  return { store, mergeYUpdate, push: (s: Uint8Array) => onState?.(s) };
}

/** Types `text` one character at a time, as a keyboard would. */
function type(provider: YRoomProvider, text: string, at = 0) {
  const ytext = provider.doc.getText('notes');
  for (const [i, ch] of [...text].entries()) ytext.insert(at + i, ch);
}

describe('YRoomProvider local-update coalescing (WI-208)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends nothing while typing continues, then one merge after the idle window', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    type(p, 'hello');
    expect(mergeYUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LOCAL_IDLE_MS - 1);
    expect(mergeYUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mergeYUpdate).toHaveBeenCalledTimes(1);
    expect(mergeYUpdate).toHaveBeenCalledWith('room', 'notes', expect.any(Uint8Array));
  });

  it('the one merged update carries the whole burst', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    type(p, 'hello');
    vi.advanceTimersByTime(LOCAL_IDLE_MS);
    const [, , update] = mergeYUpdate.mock.calls[0] as unknown as [string, string, Uint8Array];
    const peer = new Y.Doc();
    Y.applyUpdate(peer, update);
    expect(peer.getText('notes').toString()).toBe('hello');
  });

  it('each keystroke restarts the idle window', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    for (let i = 0; i < 4; i++) {
      type(p, 'x', i);
      vi.advanceTimersByTime(LOCAL_IDLE_MS - 10);
    }
    expect(mergeYUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(mergeYUpdate).toHaveBeenCalledTimes(1);
  });

  it('flushes a burst that never pauses once the max wait is reached', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    const step = LOCAL_IDLE_MS - 10;
    let elapsed = 0;
    while (elapsed < LOCAL_MAX_WAIT_MS) {
      type(p, 'x', elapsed);
      vi.advanceTimersByTime(step);
      elapsed += step;
    }
    expect(mergeYUpdate).toHaveBeenCalledTimes(1);
  });

  it('disconnect flushes what is pending, and nothing fires afterwards', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    p.connect();
    type(p, 'bye');
    p.disconnect();
    expect(mergeYUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LOCAL_MAX_WAIT_MS * 2);
    expect(mergeYUpdate).toHaveBeenCalledTimes(1);
  });

  it('disconnect with nothing pending sends nothing', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    p.connect();
    p.disconnect();
    expect(mergeYUpdate).not.toHaveBeenCalled();
  });

  it('does not re-broadcast state that arrived from the room', () => {
    const { store, mergeYUpdate, push } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    p.connect();
    const remote = new Y.Doc();
    remote.getText('notes').insert(0, 'from a peer');
    push(Y.encodeStateAsUpdate(remote));
    vi.advanceTimersByTime(LOCAL_MAX_WAIT_MS);
    expect(p.doc.getText('notes').toString()).toBe('from a peer');
    expect(mergeYUpdate).not.toHaveBeenCalled();
  });

  it('sends a second burst separately after the first has flushed', () => {
    const { store, mergeYUpdate } = makeStore();
    const p = new YRoomProvider(store, 'room', 'notes');
    type(p, 'ab');
    vi.advanceTimersByTime(LOCAL_IDLE_MS);
    type(p, 'cd', 2);
    vi.advanceTimersByTime(LOCAL_IDLE_MS);
    expect(mergeYUpdate).toHaveBeenCalledTimes(2);
  });
});
