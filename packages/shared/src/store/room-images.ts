import type { RoomImage } from '../types.js';

/**
 * Portrait images in Firestore (SPEC-057 §6, DEC-119).
 *
 * A portrait is a small WebP — resized client-side to at most 256×256 — stored
 * as a `rooms/{roomId}/images/{id}` document and referenced as `img:<id>`
 * wherever a portrait ref is accepted (`ProfileInstance.portraitRef`,
 * `Token.imageRef`). No field changes type: an `img:` ref is a string like any
 * other, and it resolves to a `data:` URL built from the stored bytes.
 *
 * **Per-write containment only.** `firebase/firestore.rules` bounds what one
 * write may carry — the mime, the dimensions, the encoded size, an own-uid
 * `by`, no other keys — which is RULE-010 §1's per-write containment, the only
 * in-app boundary this stack has. **No aggregate quota exists**: nothing limits
 * how many images a room holds, because a running total needs a trusted writer
 * RULE-010 forbids. `checkRoomImage` below mirrors the per-write bounds so the
 * client refuses earlier and more legibly; it is friction, not a boundary, and
 * the rules refuse the same write whether or not anything checked first.
 *
 * The three bounds the rules also encode are duplicated in `firestore.rules`,
 * because a `.rules` file cannot import TypeScript; `room-images.test.ts`
 * parses the rules file and asserts the copies agree.
 */

/** The one content type an image document may carry. WebP only — the client
 * re-encodes whatever it is given, so there is no reason to admit another. */
export const ROOM_IMAGE_MIME = 'image/webp' as const;

/** Largest width or height, in pixels. Mirrored in `firebase/firestore.rules`. */
export const MAX_ROOM_IMAGE_DIMENSION = 256;

/** Longest `bytes` string (base64 characters) the rules accept — ~100 KB, which
 * a 256×256 WebP stays far inside. Mirrored in `firebase/firestore.rules`. */
export const MAX_ROOM_IMAGE_BASE64_CHARS = 100_000;

/** The ref prefix that names an image document (SPEC-057 §6). */
export const ROOM_IMAGE_REF_PREFIX = 'img:';

/** `img:<id>` for an image document id. */
export function roomImageRef(id: string): string {
  return `${ROOM_IMAGE_REF_PREFIX}${id}`;
}

/** The image id an `img:<id>` ref names, or `null` for any other ref. */
export function parseRoomImageRef(ref: string | undefined | null): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(ROOM_IMAGE_REF_PREFIX)) return null;
  const id = ref.slice(ROOM_IMAGE_REF_PREFIX.length);
  return id.length > 0 && !id.includes('/') ? id : null;
}

/** The `data:` URL an image document resolves to. */
export function roomImageDataUrl(image: Pick<RoomImage, 'bytes' | 'mime'>): string {
  return `data:${image.mime};base64,${image.bytes}`;
}

/** Why a candidate image would be refused, or `null` when it is within every
 * per-write bound. Friction, not a boundary — see the module comment. */
export function checkRoomImage(image: Pick<RoomImage, 'bytes' | 'mime' | 'w' | 'h'>): string | null {
  if (image.mime !== ROOM_IMAGE_MIME) return `Images are stored as WebP (got ${image.mime}).`;
  for (const [axis, value] of [
    ['width', image.w],
    ['height', image.h],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_ROOM_IMAGE_DIMENSION) {
      return `Image ${axis} must be a whole number from 1 to ${MAX_ROOM_IMAGE_DIMENSION} px.`;
    }
  }
  if (image.bytes.length === 0) return 'The image is empty.';
  if (image.bytes.length > MAX_ROOM_IMAGE_BASE64_CHARS) {
    return 'The image is too large to store, even after resizing.';
  }
  return null;
}
