import type { CampaignStore } from '@osr-vtt/shared';
import * as Y from 'yjs';
import { YRoomProvider } from './yprovider';
import { applyTextDiff } from './text-diff';

/** Yjs document name carrying every map room's players' notes for a session. */
export const ROOM_NOTES_DOC = 'room-notes';

/**
 * The per-map-room "players' notes" (Shell UI Redesign, Room quick sheet) —
 * long-form markdown any player may read or write, not just the referee.
 *
 * All rooms' notes live in **one** Yjs doc (a `Y.Map` of `mapRoomId → Y.Text`)
 * rather than one doc per room. The Room sheet's list renders a hover preview
 * for every row, so a doc-per-room would mean one RTDB subscription per room
 * in the dungeon; a single shared doc is one subscription regardless. Notes
 * ride the same CRDT transport as the party notes, so concurrent editors
 * converge with no last-write-wins stomp, and nothing here touches the
 * `MapRoom` Firestore schema (no migration).
 */
export class RoomNotesDoc {
  #provider: YRoomProvider;
  #map: Y.Map<Y.Text>;

  /** Reactive mirror of every room's note text, keyed by map-room id. */
  notes = $state<Record<string, string>>({});

  constructor(store: CampaignStore, roomId: string) {
    this.#provider = new YRoomProvider(store, roomId, ROOM_NOTES_DOC);
    this.#map = this.#provider.doc.getMap<Y.Text>('rooms');
    this.#map.observeDeep(this.#sync);
    this.#provider.connect();
    this.#sync();
  }

  #sync = (): void => {
    const next: Record<string, string> = {};
    for (const [id, text] of this.#map.entries()) next[id] = text.toString();
    this.notes = next;
  };

  get(mapRoomId: string): string {
    return this.notes[mapRoomId] ?? '';
  }

  /** Applies a textarea edit as a minimal diff against the shared text. */
  set(mapRoomId: string, value: string): void {
    this.#provider.doc.transact(() => {
      let ytext = this.#map.get(mapRoomId);
      if (!ytext) {
        ytext = new Y.Text();
        this.#map.set(mapRoomId, ytext);
      }
      applyTextDiff(ytext, ytext.toString(), value);
    });
  }

  dispose(): void {
    this.#map.unobserveDeep(this.#sync);
    this.#provider.disconnect();
  }
}
