import { archiveToSnapshot, snapshotToArchive } from '../portability/vttcamp.js';
import type { ProfileTemplateField } from '../types.js';
import type { Unsubscribe } from './campaign-store.js';
import { MemoryBackend, MemoryStore } from './memory-store.js';

/**
 * Local mode's backing store (SPEC-041 §2, DEC-073): a third `CampaignStore`
 * implementation in which the campaign is a **file on the user's disk** rather
 * than a backend.
 *
 * It is `MemoryStore` — which already passes `campaign-store.contract.ts` in
 * full — plus persistence, and deliberately nothing else. Every read, write and
 * subscription behaves exactly as the in-memory store's does; what this class
 * adds is that the whole campaign is serialised back through
 * `snapshotToArchive` and written to a `CampaignFile` whenever it changes.
 *
 * **There is no sync layer here and no second client.** One referee, one file
 * (SPEC-041 §1). RULE-003's write discipline does not apply — there is no
 * Firestore quota to spend — but the write-back is debounced and whole-file
 * anyway, because a file write per drag frame would be wrong for its own
 * reasons.
 */

/**
 * The one thing `LocalStore` needs from the host: somewhere to put the bytes.
 *
 * Two implementations exist in the web app (SPEC-041 §2). Where the File System
 * Access API is available — Chromium — a real `FileSystemFileHandle` gives a
 * silent write-back and `autosave` is **true**. Where it is not, the fallback
 * is the download-plus-file-input path the app already ships, `autosave` is
 * **false**, and saving is an explicit user action.
 *
 * **`write` must be atomic at the file level** — write, then replace — so the
 * campaign is never left half-written (SPEC-041 §2). A campaign is hours of
 * work and there is no server-side copy of it. `FileSystemWritableFileStream`
 * gives that for free: it writes to a swap file and renames on close.
 */
export interface CampaignFile {
  /** Display name for the UI — the file's name, not a path. */
  readonly name: string;
  /**
   * Whether `write` lands on the user's chosen file silently. False means the
   * host can only *hand the user* the bytes (a download), so `LocalStore` never
   * writes on its own and the UI must say so — a user who believes their
   * campaign is autosaving when it is not will lose it.
   */
  readonly autosave: boolean;
  /** The file's current bytes, or `null` for a file that does not exist yet. */
  read(): Promise<Uint8Array | null>;
  /** Replaces the file's contents, atomically. */
  write(bytes: Uint8Array): Promise<void>;
}

/** What the UI renders about the campaign file — see `subscribeSaveState`. */
export interface LocalSaveState {
  /** The open file's display name. */
  fileName: string;
  /** Mirrors `CampaignFile.autosave`: false means Save is the user's job. */
  autosave: boolean;
  /** Changes exist that are not in the file yet. */
  dirty: boolean;
  /** A write is in flight. */
  saving: boolean;
  /** When the last successful write completed, or `null` if none has. */
  lastSavedAt: number | null;
  /** The last write's failure, cleared by the next successful one. */
  error: string | null;
}

/**
 * How long a mutation waits before the campaign is written back. Long enough
 * that a stroke, a drag-run or a batched commit collapses into one write;
 * short enough that "I closed it right after" keeps the change.
 */
export const LOCAL_SAVE_DEBOUNCE_MS = 750;

export class LocalStore extends MemoryStore {
  /**
   * The room this file *is*. Local mode has exactly one campaign per file, so
   * the first room this store opens or creates is the one that gets persisted;
   * anything created after it is scratch and is never written.
   */
  private campaignId: string | null = null;
  private dirty = false;
  private saving = false;
  private lastSavedAt: number | null = null;
  private error: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly stateListeners = new Set<(state: LocalSaveState) => void>();
  private readonly unwatch: Unsubscribe;

  constructor(
    private readonly file: CampaignFile,
    // Named apart from `MemoryStore`'s own (private) `backend` field, which a
    // subclass cannot see. Same object, passed twice.
    private readonly memory: MemoryBackend = new MemoryBackend(),
    private readonly debounceMs: number = LOCAL_SAVE_DEBOUNCE_MS,
  ) {
    super(memory);
    this.unwatch = this.memory.onChange(() => this.markDirty());
  }

  /** The room id of the open campaign, or `null` before one is opened. */
  get campaignRoomId(): string | null {
    return this.campaignId;
  }

  // ---- opening and creating ----

  /**
   * Reads the file and seeds the store from it, resolving to the campaign's
   * room id.
   *
   * The bytes go through the existing, pure `archiveToSnapshot`, so local mode
   * inherits the migration-on-import path unchanged — and inherits its refusal
   * to open an archive older than `VTTCAMP_FORMAT_VERSION` (RULE-014). A
   * `VttCampFormatError` propagates: an unsupported archive is reported, never
   * silently opened.
   */
  async openCampaign(): Promise<string> {
    const bytes = await this.file.read();
    if (!bytes || bytes.length === 0) {
      throw new Error(`${this.file.name} is empty — it is not a .vttcamp campaign.`);
    }
    const roomId = await this.importRoom(archiveToSnapshot(bytes));
    // Freshly loaded state matches the file exactly; `importRoom`'s own writes
    // are what put the campaign here in the first place.
    this.dirty = false;
    this.emitState();
    return roomId;
  }

  /**
   * Creates a fresh campaign in this file, seeded exactly the way `createRoom`
   * seeds a hosted room (SPEC-041 §5), and writes it out immediately so the
   * file exists from the moment the referee names it.
   */
  async createCampaign(input: {
    name: string;
    profileTemplate: ProfileTemplateField[];
  }): Promise<string> {
    const roomId = await this.createRoom(input);
    if (this.file.autosave) await this.save();
    return roomId;
  }

  // ---- the two places a room becomes *the* campaign ----

  override async createRoom(input: Parameters<MemoryStore['createRoom']>[0]): Promise<string> {
    const roomId = await super.createRoom(input);
    this.campaignId ??= roomId;
    return roomId;
  }

  override async importRoom(snapshot: Parameters<MemoryStore['importRoom']>[0]): Promise<string> {
    const roomId = await super.importRoom(snapshot);
    this.campaignId ??= roomId;
    return roomId;
  }

  /** Deleting the campaign unbinds the file: there is nothing left to write,
   * and `exportRoom` on a deleted room throws. */
  override async deleteRoom(roomId: string): Promise<void> {
    await super.deleteRoom(roomId);
    if (roomId === this.campaignId) {
      this.campaignId = null;
      this.dirty = false;
      this.emitState();
    }
  }

  // ---- saving ----

  /** The current save state — the same value `subscribeSaveState` delivers. */
  saveState(): LocalSaveState {
    return {
      fileName: this.file.name,
      autosave: this.file.autosave,
      dirty: this.dirty,
      saving: this.saving,
      lastSavedAt: this.lastSavedAt,
      error: this.error,
    };
  }

  /** Fires once immediately with the current state, then on every change —
   * the same subscribe contract every other channel in this store uses. */
  subscribeSaveState(cb: (state: LocalSaveState) => void): Unsubscribe {
    this.stateListeners.add(cb);
    const initial = this.saveState();
    queueMicrotask(() => cb(initial));
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  /**
   * Writes the campaign out now, debounce and dirty flag ignored. This is the
   * fallback path's **Save** button, and it is also what a caller uses before
   * closing a campaign.
   */
  async save(): Promise<void> {
    this.dirty = true;
    await this.persist();
  }

  /** Writes out only if there is something unwritten. */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    await this.persist();
  }

  /** Cancels any pending write-back and stops observing the backend. Does not
   * flush — a caller that wants the campaign on disk calls `flush` first, and
   * saying so explicitly is better than a dispose that quietly does I/O. */
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.unwatch();
    this.stateListeners.clear();
  }

  private markDirty(): void {
    if (this.disposed || !this.campaignId) return;
    this.dirty = true;
    this.emitState();
    if (!this.file.autosave) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.persist();
    }, this.debounceMs);
  }

  /**
   * One whole-file write. Re-checks `dirty` after the write because mutations
   * land freely while the `await`s are in flight — without the loop, a change
   * made mid-write would sit unwritten until the *next* one arrived, which for
   * a referee who stops typing and closes the tab is never.
   */
  private async persist(): Promise<void> {
    if (this.disposed || !this.campaignId || this.saving || !this.dirty) return;
    this.saving = true;
    this.emitState();
    try {
      do {
        this.dirty = false;
        const snapshot = await this.exportRoom(this.campaignId);
        await this.file.write(snapshotToArchive(snapshot));
      } while (this.dirty && !this.disposed);
      this.lastSavedAt = Date.now();
      this.error = null;
    } catch (err) {
      // Still dirty: the bytes never landed, so the next mutation (or an
      // explicit Save) must try again rather than assume the file is current.
      this.dirty = true;
      this.error = err instanceof Error ? err.message : 'Failed to save campaign';
    } finally {
      this.saving = false;
      this.emitState();
    }
  }

  private emitState(): void {
    if (this.stateListeners.size === 0) return;
    const state = this.saveState();
    for (const cb of this.stateListeners) cb(state);
  }
}

/**
 * A `CampaignFile` held entirely in memory — the shape a test wants, and the
 * one the contract suite runs `LocalStore` against. Not used by the app.
 */
export class MemoryCampaignFile implements CampaignFile {
  private bytes: Uint8Array | null;
  /** How many times the file has been written — the cheap way for a test to
   * assert that a burst of mutations collapsed into one write. */
  writes = 0;

  constructor(
    readonly name = 'campaign.vttcamp',
    readonly autosave = true,
    initial: Uint8Array | null = null,
  ) {
    this.bytes = initial;
  }

  async read(): Promise<Uint8Array | null> {
    return this.bytes;
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.bytes = bytes;
    this.writes += 1;
  }
}
