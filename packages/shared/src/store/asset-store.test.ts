import { describe, expect, it, vi } from 'vitest';
import { BundledAssetStore, FirebaseStorageAssetStore, type AssetStore } from './asset-store.js';

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
