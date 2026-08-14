import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_ROOM_UPLOAD_BYTES_SOFT,
  MAX_UPLOAD_BYTES,
  atRoomUploadSoftCap,
  buildUploadObjectId,
  checkUpload,
  formatBytes,
  parseRoomUploadPath,
  roomUploadFolder,
  roomUploadPath,
  type UploadCandidate,
} from './upload-containment.js';

/**
 * Upload containment, the client half (SPEC-034 §§2–3).
 *
 * Two different kinds of claim live here and the difference matters:
 *
 *  - The **path helpers** and the **rules-agreement** test below are about the
 *    boundary. A wrong path shape means an object `deleteRoom` cannot find, and
 *    a drifted constant means the client promises a limit the rules do not
 *    keep.
 *  - `checkUpload`'s soft-cap branch is about **friction**. What is asserted is
 *    the arithmetic, not that anyone is stopped — nothing enforces an aggregate
 *    on this stack (RULE-010), exactly as `room-soft-cap.test.ts` says of
 *    `MAX_ROOMS_SOFT`.
 */

const RULES_PATH = fileURLToPath(new URL('../../../../firebase/storage.rules', import.meta.url));

function file(over: Partial<UploadCandidate> = {}): UploadCandidate {
  return { name: 'goblin.png', size: 1024, type: 'image/png', ...over };
}

describe('storage.rules and the client constants agree', () => {
  // A `.rules` file cannot import TypeScript, so `MAX_UPLOAD_BYTES` and the
  // content-type allowlist exist twice. These two tests are what stops the
  // copies drifting: a client that refuses at 5 MB while the rules accept 50 is
  // friction pretending to be a boundary, and one that accepts at 50 while the
  // rules refuse at 5 is a broken upload button.
  const rules = readFileSync(RULES_PATH, 'utf8');

  it('encodes the same per-object size limit', () => {
    const match = /request\.resource\.size <= ([\d *]+);/.exec(rules);
    expect(match, 'size check not found in storage.rules').not.toBeNull();
    const expression = (match as RegExpExecArray)[1] as string;
    const rulesLimit = expression
      .split('*')
      .map((n) => Number(n.trim()))
      .reduce((a, b) => a * b, 1);
    expect(rulesLimit).toBe(MAX_UPLOAD_BYTES);
  });

  it('encodes the same content-type allowlist', () => {
    const match = /request\.resource\.contentType in\s*\n?\s*\[([^\]]+)\]/.exec(rules);
    expect(match, 'content-type allowlist not found in storage.rules').not.toBeNull();
    const listed = ((match as RegExpExecArray)[1] as string)
      .split(',')
      .map((t) => t.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    expect(listed).toEqual([...ALLOWED_UPLOAD_CONTENT_TYPES]);
  });

  it('does not accept image/svg+xml on either side', () => {
    expect(ALLOWED_UPLOAD_CONTENT_TYPES).not.toContain('image/svg+xml');
    expect(rules).not.toContain("'image/svg+xml'");
  });
});

describe('upload path shape (SPEC-034 §2)', () => {
  it('binds an object to its room and to the uid that wrote it', () => {
    expect(roomUploadPath('room-1', 'uid-9', '123-goblin.png')).toBe(
      'rooms/room-1/uploads/uid-9/123-goblin.png',
    );
  });

  it('exposes the folder deleteRoom enumerates', () => {
    expect(roomUploadFolder('room-1')).toBe('rooms/room-1/uploads');
    expect(roomUploadPath('room-1', 'uid-9', 'x.png').startsWith(roomUploadFolder('room-1'))).toBe(
      true,
    );
  });

  it('round-trips through parseRoomUploadPath', () => {
    const path = roomUploadPath('room-1', 'uid-9', '123-goblin.png');
    expect(parseRoomUploadPath(path)).toEqual({
      roomId: 'room-1',
      uid: 'uid-9',
      objectId: '123-goblin.png',
    });
  });

  it('returns null for anything that is not an upload path', () => {
    expect(parseRoomUploadPath('tokens/goblin.png')).toBeNull();
    expect(parseRoomUploadPath('https://example.com/art.png')).toBeNull();
    expect(parseRoomUploadPath('gen:disc:A:hsl(1, 2%, 3%)')).toBeNull();
    expect(parseRoomUploadPath('rooms/room-1/uploads/uid-9')).toBeNull();
    expect(parseRoomUploadPath('rooms/room-1/uploads/uid-9/a/b')).toBeNull();
    expect(parseRoomUploadPath('rooms/room-1/backgrounds/uid-9/a.png')).toBeNull();
  });
});

describe('buildUploadObjectId', () => {
  it('keeps a recognisable filename behind a sortable timestamp', () => {
    expect(buildUploadObjectId('goblin.png', 1700)).toBe('1700-goblin.png');
  });

  it('collapses anything that could reshape the storage path', () => {
    expect(buildUploadObjectId('../../etc/passwd', 1700)).toBe('1700-etc-passwd');
    expect(buildUploadObjectId('a b/c?d.png', 1700)).toBe('1700-a-b-c-d.png');
  });

  it('still produces an id when the name sanitises away to nothing', () => {
    expect(buildUploadObjectId('///', 1700)).toBe('1700-upload');
  });
});

describe('checkUpload — the two branches the rules also enforce', () => {
  it('accepts an ordinary image well inside every limit', () => {
    expect(checkUpload(file(), 0).ok).toBe(true);
  });

  it('refuses a content type outside the allowlist', () => {
    const verdict = checkUpload(file({ type: 'image/svg+xml' }), 0);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('content-type');
  });

  it('accepts exactly the limit and refuses one byte past it — same boundary as the rules', () => {
    expect(checkUpload(file({ size: MAX_UPLOAD_BYTES }), 0).ok).toBe(true);
    const verdict = checkUpload(file({ size: MAX_UPLOAD_BYTES + 1 }), 0);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('object-size');
  });

  it('reports object size before the room total — the more specific refusal wins', () => {
    // A file that busts both bounds must name the one the rules would also
    // refuse on, not the soft cap, or the message sends the user to delete
    // uploads that were never the problem.
    const verdict = checkUpload(file({ size: MAX_UPLOAD_BYTES + 1 }), MAX_ROOM_UPLOAD_BYTES_SOFT);
    expect(verdict.reason).toBe('object-size');
  });
});

describe('checkUpload — the soft cap, which is friction and not a boundary', () => {
  it('refuses the upload that would take the room past its cap', () => {
    const verdict = checkUpload(file({ size: 1024 }), MAX_ROOM_UPLOAD_BYTES_SOFT - 512);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('room-soft-cap');
  });

  it('accepts the upload that lands exactly on the cap', () => {
    expect(checkUpload(file({ size: 1024 }), MAX_ROOM_UPLOAD_BYTES_SOFT - 1024).ok).toBe(true);
  });

  it('reads the cap as at-or-past, matching MAX_ROOMS_SOFT’s >= convention', () => {
    expect(atRoomUploadSoftCap(MAX_ROOM_UPLOAD_BYTES_SOFT - 1)).toBe(false);
    expect(atRoomUploadSoftCap(MAX_ROOM_UPLOAD_BYTES_SOFT)).toBe(true);
    expect(atRoomUploadSoftCap(MAX_ROOM_UPLOAD_BYTES_SOFT + 1)).toBe(true);
  });

  it('accepts an override cap so the rule is testable independently of the number', () => {
    expect(atRoomUploadSoftCap(300, 300)).toBe(true);
    expect(atRoomUploadSoftCap(299, 300)).toBe(false);
  });
});

describe('formatBytes', () => {
  it('renders the usage readout in binary units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(MAX_UPLOAD_BYTES)).toBe('5 MB');
    expect(formatBytes(MAX_ROOM_UPLOAD_BYTES_SOFT)).toBe('100 MB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
  });

  it('treats a missing or negative total as zero rather than rendering NaN', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });
});
