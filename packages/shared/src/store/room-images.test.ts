import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MAX_ROOM_IMAGE_BASE64_CHARS,
  MAX_ROOM_IMAGE_DIMENSION,
  ROOM_IMAGE_MIME,
  checkRoomImage,
  parseRoomImageRef,
  roomImageDataUrl,
  roomImageRef,
} from './room-images.js';

const RULES_PATH = fileURLToPath(new URL('../../../../firebase/firestore.rules', import.meta.url));

/** The rules' `isRoomImage` body — the only place the per-write bounds live
 * on the server side (SPEC-057 §6). */
function isRoomImageBody(): string {
  const rules = readFileSync(RULES_PATH, 'utf8');
  const match = /function isRoomImage\(data\) \{([\s\S]*?)\n\s*\}/.exec(rules);
  expect(match, 'isRoomImage not found in firestore.rules').not.toBeNull();
  return match![1]!;
}

describe('firestore.rules and the client constants agree (SPEC-057 §6)', () => {
  it('bounds width and height at MAX_ROOM_IMAGE_DIMENSION', () => {
    const body = isRoomImageBody();
    expect(body).toContain(`data.w <= ${MAX_ROOM_IMAGE_DIMENSION}`);
    expect(body).toContain(`data.h <= ${MAX_ROOM_IMAGE_DIMENSION}`);
  });

  it('bounds the encoded bytes at MAX_ROOM_IMAGE_BASE64_CHARS', () => {
    expect(isRoomImageBody()).toContain(`data.bytes.size() <= ${MAX_ROOM_IMAGE_BASE64_CHARS}`);
  });

  it('admits ROOM_IMAGE_MIME and nothing else', () => {
    const mimes = [...isRoomImageBody().matchAll(/data\.mime == '([^']+)'/g)].map((m) => m[1]);
    expect(mimes).toEqual([ROOM_IMAGE_MIME]);
  });
});

describe('img: refs', () => {
  it('round-trips an id through roomImageRef / parseRoomImageRef', () => {
    expect(roomImageRef('abc123')).toBe('img:abc123');
    expect(parseRoomImageRef(roomImageRef('abc123'))).toBe('abc123');
  });

  it('is null for every other kind of ref', () => {
    expect(parseRoomImageRef('tokens/goblin.svg')).toBeNull();
    expect(parseRoomImageRef('https://example.com/img:x.png')).toBeNull();
    expect(parseRoomImageRef('rooms/r/uploads/u/o.png')).toBeNull();
    expect(parseRoomImageRef('img:')).toBeNull();
    expect(parseRoomImageRef('img:a/b')).toBeNull();
    expect(parseRoomImageRef(undefined)).toBeNull();
  });

  it('resolves to a base64 data URL of the stored mime', () => {
    expect(roomImageDataUrl({ bytes: 'QUJD', mime: 'image/webp' })).toBe(
      'data:image/webp;base64,QUJD',
    );
  });
});

describe('checkRoomImage — friction mirroring the per-write bounds', () => {
  const ok = { bytes: 'QUJD', mime: 'image/webp' as const, w: 256, h: 1 };

  it('accepts an image within every bound', () => {
    expect(checkRoomImage(ok)).toBeNull();
  });

  it('refuses what the rules refuse', () => {
    expect(checkRoomImage({ ...ok, w: 257 })).not.toBeNull();
    expect(checkRoomImage({ ...ok, h: 0 })).not.toBeNull();
    expect(checkRoomImage({ ...ok, h: 2.5 })).not.toBeNull();
    expect(checkRoomImage({ ...ok, bytes: '' })).not.toBeNull();
    expect(checkRoomImage({ ...ok, bytes: 'A'.repeat(MAX_ROOM_IMAGE_BASE64_CHARS + 1) })).not.toBeNull();
    expect(
      checkRoomImage({ ...ok, mime: 'image/png' as unknown as typeof ROOM_IMAGE_MIME }),
    ).not.toBeNull();
  });
});
