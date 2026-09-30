import {
  MAX_ROOM_IMAGE_BASE64_CHARS,
  MAX_ROOM_IMAGE_DIMENSION,
  ROOM_IMAGE_MIME,
  type RoomImage,
} from '@osr-vtt/shared';

/** The size a source image is scaled to: its aspect ratio kept, the longer
 * side at most `max`, never enlarged, and never below 1 px. Pure. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_ROOM_IMAGE_DIMENSION,
): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    w: Math.max(1, Math.min(max, Math.round(width * scale))),
    h: Math.max(1, Math.min(max, Math.round(height * scale))),
  };
}

/** WebP qualities tried in turn until the encoded image fits the rules'
 * `bytes` bound. A 256×256 portrait fits at the first nearly always. */
const QUALITIES = [0.85, 0.7, 0.5, 0.3];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('could not read the image'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Resizes a picked file to at most 256×256 and re-encodes it as WebP
 * (SPEC-057 §6) — the body `CampaignStore.putImage` takes. Throws with a
 * user-facing message when the file is not a decodable image, when the
 * browser cannot encode WebP, or when no quality brings it under the bound.
 */
export async function resizeToWebp(file: Blob): Promise<Omit<RoomImage, 'id' | 'by'>> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file is not an image this browser can read.');
  }
  const { w, h } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, ROOM_IMAGE_MIME, quality),
    );
    // A browser without a WebP encoder silently hands back PNG instead.
    if (!blob || blob.type !== ROOM_IMAGE_MIME) {
      throw new Error('This browser cannot save WebP images.');
    }
    const bytes = await blobToBase64(blob);
    if (bytes.length <= MAX_ROOM_IMAGE_BASE64_CHARS) {
      return { bytes, mime: ROOM_IMAGE_MIME, w, h };
    }
  }
  throw new Error('That image is too detailed to store, even at 256 px.');
}
