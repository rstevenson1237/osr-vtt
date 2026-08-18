import type { FirebaseStorage, StorageReference } from 'firebase/storage';
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { resolveGenTokenRef, type AssetStore, type RoomUpload } from './asset-store.js';
import { buildUploadObjectId, roomUploadFolder, roomUploadPath } from './upload-containment.js';

/**
 * The Cloud Storage half of `AssetStore` (SPEC-034), split out of
 * `asset-store.ts` so that module stays free of the Firebase SDK.
 *
 * That split is load-bearing rather than tidy: `BundledAssetStore` is used by
 * **every** build, so its module is always in the graph, and a top-level
 * `import … from 'firebase/storage'` beside it is a side-effectful import the
 * bundler must keep — which put the whole Storage SDK into a local build that
 * can never reach it (SPEC-041 §6). Nothing local imports this file, so
 * nothing local pulls the SDK.
 */

/**
 * Enumerates a room's uploaded objects (SPEC-034 §4).
 *
 * Storage has no recursive list, and `rooms/{roomId}/uploads` holds a *prefix*
 * per uploading uid rather than objects, so this is two levels: list the
 * folder for its per-uid prefixes, then list each prefix for its items. Kept as
 * a free function rather than a method because `deleteRoom` on `FirebaseStore`
 * needs it too, and a room's recursive delete must not depend on whichever
 * `AssetStore` a given build happens to have constructed.
 */
export async function listRoomUploadRefs(
  storage: FirebaseStorage,
  roomId: string,
): Promise<StorageReference[]> {
  const folder = await listAll(storageRef(storage, roomUploadFolder(roomId)));
  const perUid = await Promise.all(folder.prefixes.map((prefix) => listAll(prefix)));
  // `folder.items` is normally empty (nothing may write directly under the
  // uploads folder — the rules only match one level deeper), but including it
  // costs nothing and means a stray object left by an earlier shape still gets
  // swept up rather than billed forever.
  return [...folder.items, ...perUid.flatMap((result) => result.items)];
}

/**
 * Deletes every object stored for a room (SPEC-034 §4) — "storage that nothing
 * ever deletes is a bill that only grows, and an orphaned object has no room
 * left to authorize a read against."
 *
 * Returns the paths it removed, so a caller holding a resolve cache can evict
 * them.
 */
export async function deleteRoomUploads(
  storage: FirebaseStorage,
  roomId: string,
): Promise<string[]> {
  const refs = await listRoomUploadRefs(storage, roomId);
  await Promise.all(refs.map((r) => deleteObject(r)));
  return refs.map((r) => r.fullPath);
}

/**
 * v1.1 (Plan §6, §10.5) — Blaze-gated Cloud Storage uploads. Implements the
 * same `AssetStore` interface so it's a drop-in swap for `BundledAssetStore`
 * later; nothing in `apps/web` constructs this today (see `lib/assets.ts`) —
 * it stays **disabled** until you upgrade the Firebase project to Blaze and
 * explicitly opt in.
 *
 * `resolve()` must stay synchronous (the `AssetStore` interface contract),
 * but Cloud Storage download URLs are only obtainable async. This class
 * resolves refs from an in-memory cache, populated by its own uploads and by
 * `listRoomUploads` — so opening the Assets activity's Uploads tab is what
 * makes a room's existing uploads resolvable in a fresh session. A persisted
 * uploader-ref registry (so an uploaded ref resolves before anything has
 * listed it) remains a v1.1 UI concern.
 */
export class FirebaseStorageAssetStore implements AssetStore {
  private readonly cache = new Map<string, string>();

  constructor(private readonly storage: FirebaseStorage) {}

  resolve(ref: string): string {
    const gen = resolveGenTokenRef(ref);
    if (gen) return gen;
    if (/^https?:\/\//.test(ref)) return ref;
    return this.cache.get(ref) ?? ref;
  }

  /**
   * Uploads one image into the room's containment path (SPEC-034 §2). The
   * client-side gate (`checkUpload`) belongs to the caller, not here: it is
   * friction, and burying it in the store would read as though the store
   * enforced it. What is enforced is `firebase/storage.rules`, which refuses
   * this write on its own terms whether or not anything checked first.
   */
  async upload(file: File, ctx: { roomId: string; uid: string }): Promise<string> {
    const path = roomUploadPath(ctx.roomId, ctx.uid, buildUploadObjectId(file.name));
    const fileRef = storageRef(this.storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);
    this.cache.set(path, url);
    return path;
  }

  async listRoomUploads(roomId: string): Promise<RoomUpload[]> {
    const refs = await listRoomUploadRefs(this.storage, roomId);
    const uploads = await Promise.all(
      refs.map(async (r) => {
        const [meta, url] = await Promise.all([getMetadata(r), getDownloadURL(r)]);
        return {
          path: r.fullPath,
          bytes: meta.size,
          contentType: meta.contentType ?? '',
          // The uid is a path segment, so it needs no metadata round-trip —
          // that is the point of the path shape (SPEC-034 §2).
          uploadedByUid: r.parent?.name ?? '',
          url,
        };
      }),
    );
    for (const upload of uploads) this.cache.set(upload.path, upload.url);
    return uploads.sort((a, b) => a.path.localeCompare(b.path));
  }

  async deleteUpload(path: string): Promise<void> {
    await deleteObject(storageRef(this.storage, path));
    this.cache.delete(path);
  }

  async deleteRoomUploads(roomId: string): Promise<void> {
    for (const path of await deleteRoomUploads(this.storage, roomId)) this.cache.delete(path);
  }
}
