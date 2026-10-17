import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { roomConverter } from './converters.js';
import { migrateRoom, newerRoomVersion } from './migrations/index.js';
import { NewerRoomError } from './store/campaign-store.js';
import { CURRENT_SCHEMA_VERSION } from './types.js';

vi.mock('./migrations/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./migrations/index.js')>();
  return { ...actual, migrateRoom: vi.fn(actual.migrateRoom) };
});

const snapshotOf = (data: Record<string, unknown>) =>
  ({ id: 'room1', data: () => data }) as unknown as QueryDocumentSnapshot;

describe('newerRoomVersion (SPEC-070 §1)', () => {
  const V = CURRENT_SCHEMA_VERSION;

  it('is null when neither number is above this build', () => {
    expect(newerRoomVersion({ schemaVersion: V, collectionsMigratedTo: V })).toBeNull();
    expect(newerRoomVersion({ schemaVersion: 1 })).toBeNull();
  });

  it('reports the higher of the two when either is above', () => {
    expect(newerRoomVersion({ schemaVersion: V + 1 })).toBe(V + 1);
    expect(newerRoomVersion({ collectionsMigratedTo: V + 2 })).toBe(V + 2);
    expect(newerRoomVersion({ schemaVersion: V + 1, collectionsMigratedTo: V + 4 })).toBe(V + 4);
  });

  it('counts a missing or non-numeric field as 0', () => {
    expect(newerRoomVersion({})).toBeNull();
    expect(
      newerRoomVersion({ schemaVersion: String(V + 1), collectionsMigratedTo: null }),
    ).toBeNull();
  });
});

describe('roomConverter.fromFirestore on a newer room (SPEC-070 §1, §5)', () => {
  beforeEach(() => {
    vi.mocked(migrateRoom).mockClear();
  });

  it('throws NewerRoomError before migrateRoom or the parse runs', () => {
    // Not a parseable room: proves the check precedes the schema parse too.
    const snap = snapshotOf({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, name: 42 });
    expect(() => roomConverter.fromFirestore(snap)).toThrow(NewerRoomError);
    expect(migrateRoom).not.toHaveBeenCalled();
  });
});
