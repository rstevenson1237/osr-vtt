import {
  parseRoomImageRef,
  roomImageDataUrl,
  type AssetStore,
  type CampaignStore,
  type RoomImage,
} from '@osr-vtt/shared';

/** What an `img:` ref resolves to before its image has arrived, or after it
 * has been deleted: a transparent 1×1 GIF. A token behind it shows its own
 * disc; a portrait shows nothing rather than a broken-image glyph. */
export const PENDING_IMAGE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * The room's `AssetStore`, taught one more kind of ref (SPEC-057 §6): an
 * `img:<id>` ref resolves to a `data:` URL built from the room's `images`
 * collection, and every other ref goes to the build's own `AssetStore`
 * unchanged. `RoomShell` provides it in place of the app-level one, so no
 * component that calls `assets.resolve(ref)` has to know the new kind exists.
 *
 * `resolve` reads a `$state` map, so a template or effect that resolves an
 * `img:` ref re-runs when the image arrives. The optional upload members are
 * passed through only when the base store has them — their presence is how a
 * component asks whether Storage uploads are live (see `AssetStore`).
 */
export class RoomImageAssets implements AssetStore {
  /** Every image in the room, by id — the Images tab lists these. */
  images = $state<RoomImage[]>([]);
  #urls = $state<Record<string, string>>({});
  #unsubscribe: () => void;

  upload?: AssetStore['upload'];
  listRoomUploads?: AssetStore['listRoomUploads'];
  deleteUpload?: AssetStore['deleteUpload'];
  deleteRoomUploads?: AssetStore['deleteRoomUploads'];

  constructor(
    private readonly base: AssetStore,
    store: CampaignStore,
    roomId: string,
  ) {
    if (base.upload) this.upload = base.upload.bind(base);
    if (base.listRoomUploads) this.listRoomUploads = base.listRoomUploads.bind(base);
    if (base.deleteUpload) this.deleteUpload = base.deleteUpload.bind(base);
    if (base.deleteRoomUploads) this.deleteRoomUploads = base.deleteRoomUploads.bind(base);
    this.#unsubscribe = store.subscribeImages(roomId, (images) => {
      const urls: Record<string, string> = {};
      for (const image of images) urls[image.id] = roomImageDataUrl(image);
      this.images = images;
      this.#urls = urls;
    });
  }

  resolve(ref: string): string {
    const id = parseRoomImageRef(ref);
    if (id === null) return this.base.resolve(ref);
    return this.#urls[id] ?? PENDING_IMAGE_URL;
  }

  dispose(): void {
    this.#unsubscribe();
  }
}
