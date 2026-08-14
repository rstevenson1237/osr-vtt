import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BundledAssetStore,
  FirebaseStorageAssetStore,
  buildGenTokenRef,
  genColorToken,
  letterLabel,
  parseGenTokenRef,
  renderGenTokenSvg,
  resolveGenTokenRef,
  type AssetStore,
} from './asset-store.js';
import { parseRoomUploadPath } from './upload-containment.js';

/**
 * A stand-in for the Cloud Storage SDK holding objects by path, so
 * `FirebaseStorageAssetStore`'s room-scoped behaviour (SPEC-034) can be
 * exercised without a bucket. `listAll` reproduces the one shape that matters:
 * a folder listing returns child **prefixes**, not the objects beneath them,
 * which is why enumeration is two levels deep.
 */
const objects = new Map<string, { size: number; contentType: string }>();

function fakeRef(path: string): Record<string, unknown> {
  const clean = path.replace(/\/+$/, '');
  const segments = clean.split('/');
  return {
    fullPath: clean,
    name: segments[segments.length - 1],
    get parent() {
      return segments.length > 1 ? fakeRef(segments.slice(0, -1).join('/')) : null;
    },
  };
}

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => fakeRef(path),
  uploadBytes: vi.fn(
    async (r: { fullPath: string }, _data: unknown, meta?: { contentType?: string }) => {
      objects.set(r.fullPath, { size: 6, contentType: meta?.contentType ?? '' });
    },
  ),
  getDownloadURL: vi.fn(
    async (r: { fullPath: string }) => `https://storage.example.com/${r.fullPath}`,
  ),
  getMetadata: vi.fn(async (r: { fullPath: string }) => objects.get(r.fullPath) ?? { size: 0 }),
  deleteObject: vi.fn(async (r: { fullPath: string }) => {
    objects.delete(r.fullPath);
  }),
  listAll: vi.fn(async (r: { fullPath: string }) => {
    const prefix = `${r.fullPath}/`;
    const items: unknown[] = [];
    const prefixes = new Set<string>();
    for (const path of objects.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes('/')) prefixes.add(`${prefix}${rest.split('/')[0]}`);
      else items.push(fakeRef(path));
    }
    return { items, prefixes: [...prefixes].map(fakeRef) };
  }),
}));

describe('BundledAssetStore', () => {
  it('resolves a bare ref against the default base path', () => {
    const store = new BundledAssetStore();
    expect(store.resolve('tokens/goblin.png')).toBe('/assets/tokens/goblin.png');
  });

  it('resolves against a custom base path, tolerating leading slashes on both sides', () => {
    const store = new BundledAssetStore('/assets');
    expect(store.resolve('/maps/dungeon.png')).toBe('/assets/maps/dungeon.png');
  });

  it('passes absolute URLs through unchanged (referee-pasted image URL)', () => {
    const store = new BundledAssetStore();
    expect(store.resolve('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('has no upload capability in v1 (Plan §6 — Blaze-gated, deferred)', () => {
    const store: AssetStore = new BundledAssetStore();
    expect(store.upload).toBeUndefined();
  });
});

describe('gen: default token scheme (Master Plan v2, R7.1)', () => {
  it('resolves a gen:disc: ref to a deterministic data: URI — same ref in, byte-identical SVG out', () => {
    const store = new BundledAssetStore();
    const ref = buildGenTokenRef('A', genColorToken('seat-1'));
    const first = store.resolve(ref);
    const second = store.resolve(ref);
    expect(first).toBe(second);
    expect(first.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('embeds the label and color in the rendered SVG', () => {
    const svg = renderGenTokenSvg('B', 'hsl(210, 65%, 45%)');
    expect(svg).toContain('<svg');
    expect(svg).toContain('>B<');
    expect(svg).toContain('fill="hsl(210, 65%, 45%)"');
  });

  it('escapes XML-significant characters in the label', () => {
    const svg = renderGenTokenSvg('<&"', 'hsl(0, 0%, 50%)');
    expect(svg).not.toContain('<&"');
    expect(svg).toContain('&lt;&amp;&quot;');
  });

  it('flips text color for contrast between light and dark discs', () => {
    const dark = renderGenTokenSvg('A', 'hsl(210, 65%, 20%)');
    const light = renderGenTokenSvg('A', 'hsl(210, 65%, 80%)');
    expect(dark).toContain('fill="#f6f1e6"');
    expect(light).toContain('fill="#1a1a1a"');
  });

  it('different refs (label or color) resolve to different SVG content', () => {
    const a = resolveGenTokenRef('gen:disc:A:hsl(10, 65%, 45%)')!;
    const b = resolveGenTokenRef('gen:disc:B:hsl(10, 65%, 45%)')!;
    const c = resolveGenTokenRef('gen:disc:A:hsl(200, 65%, 45%)')!;
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('returns null for a non-gen ref (falls through to normal resolution)', () => {
    expect(resolveGenTokenRef('tokens/goblin.png')).toBeNull();
    expect(resolveGenTokenRef('https://example.com/a.png')).toBeNull();
  });

  it('BundledAssetStore.resolve() renders gen: refs before its normal base-path logic', () => {
    const store = new BundledAssetStore('/assets/');
    const ref = buildGenTokenRef('C', genColorToken('seat-3'));
    expect(store.resolve(ref)).toBe(resolveGenTokenRef(ref));
  });

  it('genColorToken is a stable hsl() for a given seed', () => {
    expect(genColorToken('same-seed')).toBe(genColorToken('same-seed'));
    expect(genColorToken('seed-a')).not.toBe(genColorToken('seed-b'));
    expect(genColorToken('x')).toMatch(/^hsl\(\d+, 65%, 45%\)$/);
  });

  it('letterLabel produces spreadsheet-style base-26 labels', () => {
    expect(letterLabel(0)).toBe('A');
    expect(letterLabel(25)).toBe('Z');
    expect(letterLabel(26)).toBe('AA');
    expect(letterLabel(27)).toBe('AB');
    expect(letterLabel(51)).toBe('AZ');
    expect(letterLabel(52)).toBe('BA');
  });

  it('buildGenTokenRef round-trips through resolve()', () => {
    const ref = buildGenTokenRef('a1', genColorToken('goblin'));
    expect(ref.startsWith('gen:disc:a1:hsl(')).toBe(true);
    const store = new BundledAssetStore();
    expect(store.resolve(ref)).toContain('data:image/svg+xml,');
  });

  it('buildGenTokenRef embeds the given color directly, without re-hashing it', () => {
    const color = 'hsl(210, 65%, 45%)';
    expect(buildGenTokenRef('B', color)).toBe(`gen:disc:B:${color}`);
  });

  it('parseGenTokenRef is the inverse of buildGenTokenRef (quick-sheet color split)', () => {
    const ref = buildGenTokenRef('B', 'hsl(210, 65%, 45%)');
    expect(parseGenTokenRef(ref)).toEqual({ label: 'B', color: 'hsl(210, 65%, 45%)' });
  });

  it('parseGenTokenRef returns null for a non-gen ref', () => {
    expect(parseGenTokenRef('tokens/fighter.svg')).toBeNull();
    expect(parseGenTokenRef('https://example.com/a.png')).toBeNull();
  });

  it('parseGenTokenRef round-trips a rebuilt ref with a new color, keeping the label', () => {
    const original = buildGenTokenRef('a1', genColorToken('goblin'));
    const gen = parseGenTokenRef(original)!;
    const rebuilt = buildGenTokenRef(gen.label, '#3366cc');
    expect(parseGenTokenRef(rebuilt)).toEqual({ label: 'a1', color: '#3366cc' });
  });

  it('a `:` typed into the label is escaped so the ref parse stays unambiguous (Plan R18.1)', () => {
    const ref = buildGenTokenRef('a:b', 'hsl(10, 65%, 45%)');
    expect(ref).not.toMatch(/^gen:disc:a:b:/); // would misparse "a" as the label
    const svg = resolveGenTokenRef(ref);
    expect(svg).not.toBeNull();
    const decoded = decodeURIComponent(svg!.slice('data:image/svg+xml,'.length));
    expect(decoded).toContain('>a:b<'); // renders as the literal typed label
  });

  it('caps the rendered label at 3 glyphs, counting by Unicode code point (Plan R18.1)', () => {
    const svg = renderGenTokenSvg('WXYZ', 'hsl(10, 65%, 45%)');
    expect(svg).toContain('>WXY<');
    expect(svg).not.toContain('>WXYZ<');
  });

  it('counts a multi-code-unit glyph (e.g. an emoji) as one glyph for the render cap', () => {
    const svg = renderGenTokenSvg('☠★7Z', 'hsl(10, 65%, 45%)');
    expect(svg).toContain('>☠★7<');
    expect(svg).not.toContain('Z<');
  });
});

describe('FirebaseStorageAssetStore (v1.1, Plan §6/§10.5 — left behind the interface, disabled by default)', () => {
  beforeEach(() => objects.clear());

  const png = () => new File(['pixels'], 'art.png', { type: 'image/png' });

  it('implements the AssetStore interface, including the upload-containment members', () => {
    const store: AssetStore = new FirebaseStorageAssetStore({} as never);
    expect(typeof store.resolve).toBe('function');
    expect(typeof store.upload).toBe('function');
    expect(typeof store.listRoomUploads).toBe('function');
    expect(typeof store.deleteUpload).toBe('function');
    expect(typeof store.deleteRoomUploads).toBe('function');
  });

  it('passes absolute URLs through unchanged, same as BundledAssetStore', () => {
    const store = new FirebaseStorageAssetStore({} as never);
    expect(store.resolve('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('falls back to the bare ref until upload() has resolved it (resolve() must stay sync)', () => {
    const store = new FirebaseStorageAssetStore({} as never);
    expect(store.resolve('uploads/not-yet-known.png')).toBe('uploads/not-yet-known.png');
  });

  it('stores an upload at the room/uid path the rules gate on (SPEC-034 §2)', async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    const path = (await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-9' })) as string;
    expect(parseRoomUploadPath(path)).toMatchObject({ roomId: 'room-1', uid: 'uid-9' });
  });

  it("caches an uploaded ref's download URL for subsequent resolve() calls", async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    const path = (await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-9' })) as string;
    expect(store.resolve(path)).toBe(`https://storage.example.com/${path}`);
  });

  it('lists a room’s uploads across every uploader, with sizes for the usage readout', async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-9' });
    await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-other' });
    await store.upload?.(png(), { roomId: 'room-2', uid: 'uid-9' });

    const uploads = (await store.listRoomUploads?.('room-1')) ?? [];
    expect(uploads).toHaveLength(2);
    expect(uploads.map((u) => u.uploadedByUid).sort()).toEqual(['uid-9', 'uid-other']);
    expect(uploads.every((u) => u.bytes === 6)).toBe(true);
    // Listing is also what makes another session's uploads resolvable.
    expect(store.resolve(uploads[0]!.path)).toBe(`https://storage.example.com/${uploads[0]!.path}`);
  });

  it('deletes one upload and forgets its cached URL', async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    const path = (await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-9' })) as string;
    await store.deleteUpload?.(path);
    expect(await store.listRoomUploads?.('room-1')).toEqual([]);
    expect(store.resolve(path)).toBe(path);
  });

  it('deletes every object of one room and leaves other rooms alone (SPEC-034 §4)', async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-9' });
    await store.upload?.(png(), { roomId: 'room-1', uid: 'uid-other' });
    await store.upload?.(png(), { roomId: 'room-2', uid: 'uid-9' });

    await store.deleteRoomUploads?.('room-1');
    expect(await store.listRoomUploads?.('room-1')).toEqual([]);
    expect(await store.listRoomUploads?.('room-2')).toHaveLength(1);
  });
});
