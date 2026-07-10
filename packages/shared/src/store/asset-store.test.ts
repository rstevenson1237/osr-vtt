import { describe, expect, it } from 'vitest';
import { BundledAssetStore, type AssetStore } from './asset-store.js';

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
