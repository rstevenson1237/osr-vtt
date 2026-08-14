/**
 * Upload containment on Blaze (SPEC-034 §§2–3).
 *
 * Three layers, and **only one of them is a boundary**:
 *
 *  1. `firebase/storage.rules` is the boundary — per-object size, a content-type
 *     allowlist, a path shape that binds every object to a room and to the uid
 *     that wrote it, and a cross-service membership check. Testable code
 *     (RULE-004); see `src/rules/storage.rules.test.ts`.
 *  2. Everything in *this* file that is not a path helper is **friction, not a
 *     boundary** — the same shape and the same honesty as `MAX_ROOMS_SOFT`
 *     (`campaign-store.ts`). `MAX_ROOM_UPLOAD_BYTES_SOFT` is an *aggregate*,
 *     and RULE-010 forbids the only mechanism that could enforce one: a running
 *     total needs a trusted writer, and there isn't one. A determined client
 *     simply does not call `checkUpload`. It is here so an honest referee sees
 *     what a room is costing before it costs it, not so an abuser is stopped.
 *  3. The real backstop is outside this repository — a Cloud Billing budget with
 *     alerts plus a `[HUMAN]` runbook (`docs/runbooks/blaze-billing.md`).
 *
 * The two constants the rules also encode — `MAX_UPLOAD_BYTES` and
 * `ALLOWED_UPLOAD_CONTENT_TYPES` — are duplicated in `firebase/storage.rules`
 * because a `.rules` file cannot import TypeScript. `upload-containment.test.ts`
 * parses the rules file and asserts the two agree, so the duplication cannot
 * drift silently.
 */

/**
 * Largest single object the rules will accept, in bytes. Per-object, which is
 * the only size question Security Rules can answer without a trusted writer
 * (SPEC-034 §2).
 *
 * Mirrored in `firebase/storage.rules`; keep the two in step (a test enforces
 * it).
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Content types the rules accept. Images only.
 *
 * **`image/svg+xml` is deliberately absent.** An SVG is a script-bearing
 * document, and the containment premise on Blaze is that a single accepted
 * write is bounded in what it can do; a stored SVG is not. Every other layer
 * here treats an upload as inert pixels, and the allowlist is what makes that
 * true. A referee who wants vector art pastes a URL (the Assets activity's "By
 * URL" tab) or bundles it.
 *
 * Mirrored in `firebase/storage.rules`; keep the two in step (a test enforces
 * it).
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

/**
 * Soft per-room ceiling on stored upload bytes — **client-side friction,
 * explicitly not a security boundary** (SPEC-034 §3.2).
 *
 * Documented in the same spirit as `MAX_ROOMS_SOFT` and the unenforced
 * `Room.password` field: a future reader must not mistake it for a guarantee.
 * No rule enforces it and none can, because an aggregate needs a running total
 * and RULE-010 forbids the trusted writer that would maintain one.
 */
export const MAX_ROOM_UPLOAD_BYTES_SOFT = 100 * 1024 * 1024;

/** Where a room's uploaded objects live. The shape is load-bearing: the room
 * id lets `deleteRoom` enumerate them (SPEC-034 §4) and lets the rules check
 * membership, and the uid segment makes every object attributable to the seat
 * that wrote it without a `get()`. */
export const ROOM_UPLOAD_PREFIX = 'uploads';

/** Longest an object id may get once a filename has been folded into it — long
 * enough to stay recognisable in the console, short enough that the total path
 * stays well inside Cloud Storage's 1024-byte object-name limit. */
const OBJECT_ID_NAME_CAP = 64;

/** A parsed `rooms/{roomId}/uploads/{uid}/{objectId}` path. */
export interface RoomUploadRef {
  roomId: string;
  uid: string;
  objectId: string;
}

/** The storage prefix every object of one room sits under. `deleteRoomUploads`
 * lists this and nothing else. */
export function roomUploadFolder(roomId: string): string {
  return `rooms/${roomId}/${ROOM_UPLOAD_PREFIX}`;
}

/** Full object path for one upload. */
export function roomUploadPath(roomId: string, uid: string, objectId: string): string {
  return `${roomUploadFolder(roomId)}/${uid}/${objectId}`;
}

/** Inverse of `roomUploadPath`, or `null` for any path that is not an upload
 * (a bundled ref, a pasted URL, a `gen:` recipe). */
export function parseRoomUploadPath(path: string): RoomUploadRef | null {
  const parts = path.split('/');
  if (parts.length !== 5) return null;
  const [rooms, roomId, uploads, uid, objectId] = parts as [string, string, string, string, string];
  if (rooms !== 'rooms' || uploads !== ROOM_UPLOAD_PREFIX) return null;
  if (!roomId || !uid || !objectId) return null;
  return { roomId, uid, objectId };
}

/**
 * Builds the object id for a new upload: a timestamp for ordering plus a
 * sanitised remnant of the original filename, so the object stays recognisable
 * in the Firebase console without letting an arbitrary user-supplied string
 * into a storage path. Anything outside `[A-Za-z0-9._-]` collapses to `-`, and
 * runs of dots go with it — Cloud Storage treats `..` as an ordinary name
 * rather than a parent directory, but an object id that *reads* as a traversal
 * is a trap for whoever next writes something that parses these paths.
 */
export function buildUploadObjectId(fileName: string, now = Date.now()): string {
  const cleaned = fileName
    .replace(/\.{2,}/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, OBJECT_ID_NAME_CAP);
  return `${now}-${cleaned || 'upload'}`;
}

/** Just enough of a `File` to decide about it — so the rule is testable without
 * a DOM. */
export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

export type UploadRefusalReason = 'content-type' | 'object-size' | 'room-soft-cap';

export interface UploadVerdict {
  ok: boolean;
  reason?: UploadRefusalReason;
  /** Ready to render; names the layer honestly (the first two are what the
   * rules would refuse anyway, the third is friction and says so). */
  message?: string;
}

const OK: UploadVerdict = { ok: true };

/**
 * The client-side gate in front of an upload (SPEC-034 §3.2).
 *
 * The first two verdicts mirror the rules exactly — refusing here saves a
 * round-trip and gives a readable message, but the rules refuse the same write
 * whether or not this ran. The third has **no** rules counterpart and is the
 * friction: it is a number this client believes about a total it cannot
 * enforce.
 */
export function checkUpload(file: UploadCandidate, roomBytesUsed: number): UploadVerdict {
  if (!ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.type)) {
    return {
      ok: false,
      reason: 'content-type',
      message: `Only images are accepted (${ALLOWED_UPLOAD_CONTENT_TYPES.map((t) => t.replace('image/', '')).join(', ')}).`,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: 'object-size',
      message: `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)} per image.`,
    };
  }
  if (roomBytesUsed + file.size > MAX_ROOM_UPLOAD_BYTES_SOFT) {
    return {
      ok: false,
      reason: 'room-soft-cap',
      message: `This room is using ${formatBytes(roomBytesUsed)} of its ${formatBytes(MAX_ROOM_UPLOAD_BYTES_SOFT)} soft cap. Delete an upload to make room.`,
    };
  }
  return OK;
}

/** Whether the room is already at or past its soft cap, independent of any
 * particular file — what the usage readout renders against. */
export function atRoomUploadSoftCap(
  roomBytesUsed: number,
  cap = MAX_ROOM_UPLOAD_BYTES_SOFT,
): boolean {
  return roomBytesUsed >= cap;
}

/** Human-readable byte count for the usage readout. Binary units, one decimal
 * once past KB, so "4.7 MB" rather than "4915200 bytes". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return `${rounded} ${units[unit]}`;
}
