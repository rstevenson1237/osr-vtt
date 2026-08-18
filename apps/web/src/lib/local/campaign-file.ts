import type { CampaignFile } from '@osr-vtt/shared';

/**
 * The two ways a browser can hold a campaign file for `LocalStore`
 * (SPEC-041 §2).
 *
 * **File System Access** — Chromium — gives a real handle: the bytes go back
 * to the file the user picked, silently, and `autosave` is true. The write is
 * atomic for free, because `createWritable()` streams to a swap file and
 * renames it into place on `close()`; a crash mid-save leaves the previous
 * campaign intact.
 *
 * **Everywhere else** there is no handle to write through, so the fallback is
 * the `.vttcamp` download plus file-input path the app already ships. Saving
 * hands the user a file; `autosave` is false and the UI says so, because a
 * referee who believes their campaign is autosaving when it is not will lose
 * hours of work.
 */

/** The slice of the File System Access API this module uses. Hand-declared
 * rather than pulled from a `lib.dom` that may or may not carry it. */
interface WritableFileStream {
  write(data: Uint8Array | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<WritableFileStream>;
}
interface FilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
  excludeAcceptAllOption?: boolean;
}
interface FilePickerWindow {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FsFileHandle[]>;
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FsFileHandle>;
}

export const CAMPAIGN_FILE_EXTENSION = '.vttcamp';

const PICKER_TYPES: FilePickerOptions['types'] = [
  { description: 'VTT campaign', accept: { 'application/zip': [CAMPAIGN_FILE_EXTENSION] } },
];

function picker(): FilePickerWindow {
  return window as unknown as FilePickerWindow;
}

/** Whether this browser can write back to a file the user picked. The lobby
 * renders a different pair of buttons either way, and the save indicator says
 * which mode the session is in. */
export function hasFileSystemAccess(): boolean {
  const w = picker();
  return typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function';
}

/** A picker the user dismissed is not an error — every caller treats `null` as
 * "nothing happened". */
function isCancel(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function handleFile(handle: FsFileHandle): CampaignFile {
  return {
    name: handle.name,
    autosave: true,
    async read(): Promise<Uint8Array | null> {
      const file = await handle.getFile();
      if (file.size === 0) return null;
      return new Uint8Array(await file.arrayBuffer());
    },
    async write(bytes: Uint8Array): Promise<void> {
      const writable = await handle.createWritable();
      try {
        await writable.write(bytes);
      } finally {
        // `close()` is the atomic rename. Skipping it on the error path would
        // leave the swap file behind *and* the original untouched, which is
        // the outcome we want, but the stream must still be released.
        await writable.close();
      }
    },
  };
}

/**
 * The fallback file: it remembers the bytes it was opened with, and "writing"
 * it hands the user a download. `autosave` is false, so `LocalStore` never
 * writes on its own — every write here is a user pressing Save.
 */
export function downloadCampaignFile(name: string, initial: Uint8Array | null): CampaignFile {
  let current = initial;
  return {
    name,
    autosave: false,
    async read(): Promise<Uint8Array | null> {
      return current;
    },
    async write(bytes: Uint8Array): Promise<void> {
      current = bytes;
      const blob = new Blob([bytes.slice()], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

/** "Open campaign…" on a browser with file handles. `null` = the user
 * cancelled the picker. */
export async function pickCampaignToOpen(): Promise<CampaignFile | null> {
  const show = picker().showOpenFilePicker;
  if (!show) return null;
  try {
    const [handle] = await show({ types: PICKER_TYPES, excludeAcceptAllOption: false });
    return handle ? handleFile(handle) : null;
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}

/** "New campaign…" on a browser with file handles: the referee chooses where
 * the campaign will live before it has anything in it, which is what makes the
 * first autosave land somewhere they can find again. */
export async function pickCampaignToCreate(suggestedName: string): Promise<CampaignFile | null> {
  const show = picker().showSaveFilePicker;
  if (!show) return null;
  try {
    const handle = await show({ suggestedName, types: PICKER_TYPES });
    return handleFile(handle);
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}

/** A file name for a campaign called `name` — the same shaping the hosted
 * lobby's export uses, so the two builds produce recognisably similar files. */
export function campaignFileName(name: string): string {
  const safe = (name || 'campaign').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'campaign';
  return `${safe}${CAMPAIGN_FILE_EXTENSION}`;
}
