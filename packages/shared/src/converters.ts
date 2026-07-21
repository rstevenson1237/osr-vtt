import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import {
  AssetRefSchema,
  DiceMacroSchema,
  DrawingSchema,
  EncounterSchema,
  GameMapSchema,
  GroupSchema,
  LogEntrySchema,
  MapRoomSchema,
  MapSymbolSchema,
  PlayerSeatSchema,
  ProfileInstanceSchema,
  RandomTableSchema,
  RoomSchema,
  RollSchema,
  TokenSchema,
  VectorDoorSchema,
  VectorStoredFloorRegionSchema,
  VectorWallSchema,
} from './schemas.js';
import type {
  AssetRef,
  DiceMacro,
  Drawing,
  Encounter,
  GameMap,
  Group,
  LogEntry,
  MapRoom,
  MapSymbol,
  PlayerSeat,
  ProfileInstance,
  RandomTable,
  Room,
  Roll,
  Token,
} from './types.js';
import type { Door as VectorDoor, FloorRegion as VectorFloorRegion } from './map/vector/index.js';
import type { StoredVectorWall } from './store/campaign-store.js';
import { migrateRoom } from './migrations/index.js';

/**
 * Firestore data converters (Plan §8.2). Each converter validates against the
 * Zod schema at the read/write boundary and reattaches the Firestore document
 * ID as the model's id field (`id`, `uid`, or `seatId` depending on the
 * collection) — the field is never itself stored in the document body.
 */

export const roomConverter: FirestoreDataConverter<Room> = {
  toFirestore(room: Room) {
    const { id: _id, ...rest } = room;
    return RoomSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Room {
    // Runs every room doc through the schemaVersion migration scaffold
    // (Plan §5) before validating — a no-op today (CURRENT_SCHEMA_VERSION
    // is still 1), but load-bearing the moment a future version ships.
    const migrated = migrateRoom(snapshot.data(options) as Record<string, unknown>);
    const data = RoomSchema.omit({ id: true }).parse(migrated);
    return { id: snapshot.id, ...data };
  },
};

export const gameMapConverter: FirestoreDataConverter<GameMap> = {
  toFirestore(map: GameMap) {
    const { id: _id, ...rest } = map;
    return GameMapSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): GameMap {
    const data = GameMapSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const playerSeatConverter: FirestoreDataConverter<PlayerSeat> = {
  toFirestore(player: PlayerSeat) {
    const { uid: _uid, ...rest } = player;
    return PlayerSeatSchema.omit({ uid: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): PlayerSeat {
    const data = PlayerSeatSchema.omit({ uid: true }).parse(snapshot.data(options));
    return { uid: snapshot.id, ...data };
  },
};

export const profileInstanceConverter: FirestoreDataConverter<ProfileInstance> = {
  toFirestore(profile: ProfileInstance) {
    const { seatId: _seatId, ...rest } = profile;
    return ProfileInstanceSchema.omit({ seatId: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): ProfileInstance {
    const data = ProfileInstanceSchema.omit({ seatId: true }).parse(snapshot.data(options));
    return { seatId: snapshot.id, ...data };
  },
};

export const tokenConverter: FirestoreDataConverter<Token> = {
  toFirestore(token: Token) {
    const { id: _id, ...rest } = token;
    return TokenSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Token {
    const data = TokenSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const groupConverter: FirestoreDataConverter<Group> = {
  toFirestore(group: Group) {
    const { id: _id, ...rest } = group;
    return GroupSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Group {
    const data = GroupSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

/** rooms/{roomId}/encounter/current — a fixed-id singleton doc, so unlike
 * the other converters there's no id field to strip/reattach. */
export const encounterConverter: FirestoreDataConverter<Encounter> = {
  toFirestore(encounter: Encounter) {
    const parsed = EncounterSchema.parse(encounter);
    // Clearing an optional widget (difficultyDie/dangerDie/callerSeatId) sets
    // it to `undefined`; Firestore rejects explicit undefined, so drop those
    // keys rather than write them.
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Encounter {
    return EncounterSchema.parse(snapshot.data(options));
  },
};

export const drawingConverter: FirestoreDataConverter<Drawing> = {
  toFirestore(drawing: Drawing) {
    const { id: _id, ...rest } = drawing;
    return DrawingSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Drawing {
    const data = DrawingSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const logEntryConverter: FirestoreDataConverter<LogEntry> = {
  toFirestore(entry: LogEntry) {
    const { id: _id, ...rest } = entry;
    return LogEntrySchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): LogEntry {
    const data = LogEntrySchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const mapSymbolConverter: FirestoreDataConverter<MapSymbol> = {
  toFirestore(symbol: MapSymbol) {
    const { id: _id, ...rest } = symbol;
    return MapSymbolSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): MapSymbol {
    const data = MapSymbolSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const mapRoomConverter: FirestoreDataConverter<MapRoom> = {
  toFirestore(room: MapRoom) {
    const { id: _id, ...rest } = room;
    return MapRoomSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): MapRoom {
    const data = MapRoomSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const randomTableConverter: FirestoreDataConverter<RandomTable> = {
  toFirestore(table: RandomTable) {
    const { id: _id, ...rest } = table;
    return RandomTableSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): RandomTable {
    const data = RandomTableSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const rollConverter: FirestoreDataConverter<Roll> = {
  toFirestore(roll: Roll) {
    const { id: _id, ...rest } = roll;
    return RollSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Roll {
    const data = RollSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const assetRefConverter: FirestoreDataConverter<AssetRef> = {
  toFirestore(assetRef: AssetRef) {
    const { id: _id, ...rest } = assetRef;
    return AssetRefSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): AssetRef {
    const data = AssetRefSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const diceMacroConverter: FirestoreDataConverter<DiceMacro> = {
  toFirestore(macro: DiceMacro) {
    const { id: _id, ...rest } = macro;
    return DiceMacroSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): DiceMacro {
    const data = DiceMacroSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

// ---- Vector Map System (WI-B) — same id-folding pattern as the cellular
// converters above; validated against the `Vector*` schemas so a malformed
// vector doc is rejected at the read/write boundary exactly like every other
// collection.

export const vectorFloorRegionConverter: FirestoreDataConverter<VectorFloorRegion> = {
  toFirestore(region: VectorFloorRegion) {
    // Firestore forbids nested arrays, so ring-wrap `rings: Point[][]` into an
    // array of `{ points }` maps (see `VectorStoredFloorRegionSchema`).
    return VectorStoredFloorRegionSchema.parse({
      rings: region.rings.map((points) => ({ points })),
      bbox: region.bbox,
    });
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): VectorFloorRegion {
    const data = VectorStoredFloorRegionSchema.parse(snapshot.data(options));
    return { id: snapshot.id, rings: data.rings.map((ring) => ring.points), bbox: data.bbox };
  },
};

export const vectorWallConverter: FirestoreDataConverter<StoredVectorWall> = {
  toFirestore(wall: StoredVectorWall) {
    const { id: _id, ...rest } = wall;
    return VectorWallSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): StoredVectorWall {
    const data = VectorWallSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};

export const vectorDoorConverter: FirestoreDataConverter<VectorDoor> = {
  toFirestore(door: VectorDoor) {
    const { id: _id, ...rest } = door;
    return VectorDoorSchema.omit({ id: true }).parse(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): VectorDoor {
    const data = VectorDoorSchema.omit({ id: true }).parse(snapshot.data(options));
    return { id: snapshot.id, ...data };
  },
};
