import { describe, expect, it, vi } from 'vitest';
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

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  uploadBytes: vi.fn().mockResolvedValue(undefined),
  getDownloadURL: vi.fn().mockResolvedValue('https://storage.example.com/uploads/mock.png'),
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
  it('implements the AssetStore interface, including upload', () => {
    const store: AssetStore = new FirebaseStorageAssetStore({} as never);
    expect(typeof store.resolve).toBe('function');
    expect(typeof store.upload).toBe('function');
  });

  it('passes absolute URLs through unchanged, same as BundledAssetStore', () => {
    const store = new FirebaseStorageAssetStore({} as never);
    expect(store.resolve('https://example.com/art.png')).toBe('https://example.com/art.png');
  });

  it('falls back to the bare ref until upload() has resolved it (resolve() must stay sync)', () => {
    const store = new FirebaseStorageAssetStore({} as never);
    expect(store.resolve('uploads/not-yet-known.png')).toBe('uploads/not-yet-known.png');
  });

  it("caches an uploaded ref's download URL for subsequent resolve() calls", async () => {
    const store = new FirebaseStorageAssetStore({} as never);
    const file = new File(['pixels'], 'art.png', { type: 'image/png' });
    const path = await store.upload?.(file);
    expect(path).toBeDefined();
    expect(store.resolve(path as string)).toBe('https://storage.example.com/uploads/mock.png');
  });
});
