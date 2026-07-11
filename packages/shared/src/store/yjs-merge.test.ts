import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

/**
 * Verifies the CRDT convergence guarantee `FirebaseStore.mergeYUpdate`
 * (Plan §7 Phase 5) relies on: merging two clients' concurrent Yjs updates
 * always converges to the same state with no last-write-wins stomp,
 * regardless of arrival order. This is what makes an RTDB transaction a
 * safe merge point without a live `Y.Doc` in the transaction body — pure,
 * no RTDB/emulator needed (Gate 5: "two clients edit Notes at once with no
 * stomp").
 */
describe('Yjs update merge — the no-stomp guarantee mergeYUpdate relies on', () => {
  it('converges two clients concurrent edits to the same Y.Text with no data loss', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    docA.getText('notes').insert(0, 'Hello');
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA)); // both start from the same base state

    // Two clients diverge from that shared base, editing concurrently.
    docA.getText('notes').insert(5, ', GM');
    docB.getText('notes').insert(0, '>> ');

    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);

    // mergeYUpdate's core operation: merge two update vectors without a
    // live Y.Doc, exactly as the RTDB transaction body does.
    const merged = Y.mergeUpdates([updateA, updateB]);

    const converged = new Y.Doc();
    Y.applyUpdate(converged, merged);

    const result = converged.getText('notes').toString();
    expect(result).toContain('Hello');
    expect(result).toContain(', GM');
    expect(result).toContain('>> ');
    expect(result).toBe('>> Hello, GM');
  });

  it('is idempotent — re-applying an already-contained state does not duplicate content', () => {
    const doc = new Y.Doc();
    doc.getText('notes').insert(0, 'Torches: 3');
    const state = Y.encodeStateAsUpdate(doc);

    Y.applyUpdate(doc, state);
    Y.applyUpdate(doc, state);

    expect(doc.getText('notes').toString()).toBe('Torches: 3');
  });

  it('merges out of order — a late-arriving update still converges to the same result', () => {
    const base = new Y.Doc();
    base.getText('notes').insert(0, 'Room 3: ');
    const baseState = Y.encodeStateAsUpdate(base);

    const docA = new Y.Doc();
    Y.applyUpdate(docA, baseState);
    docA.getText('notes').insert(8, 'trapped');

    const docB = new Y.Doc();
    Y.applyUpdate(docB, baseState);
    docB.getText('notes').insert(8, 'empty, ');

    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);

    const inOrder = new Y.Doc();
    Y.applyUpdate(inOrder, Y.mergeUpdates([updateA, updateB]));

    const outOfOrder = new Y.Doc();
    Y.applyUpdate(outOfOrder, Y.mergeUpdates([updateB, updateA]));

    expect(outOfOrder.getText('notes').toString()).toBe(inOrder.getText('notes').toString());
  });
});
