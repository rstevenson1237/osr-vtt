import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import {
  DrawingSchema,
  GroupSchema,
  LogEntrySchema,
  PlayerSeatSchema,
  ProfileInstanceSchema,
  RoomSchema,
  RollSchema,
  TokenSchema,
} from './schemas.js';
import type {
  Drawing,
  Group,
  LogEntry,
  PlayerSeat,
  ProfileInstance,
  Room,
  Roll,
  Token,
} from './types.js';
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
