import { describe, expect, it, vi } from 'vitest';
import { loadImageElement } from './texture-load';

/** Minimal stand-in for `HTMLImageElement` — the vitest config runs in the
 * `node` environment (no jsdom), so `Image` isn't a real global here. Setting
 * `src` synchronously schedules the configured outcome on a microtask, same
 * as a real image's async decode. */
class FakeImage {
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  static nextOutcome: 'load' | 'error' = 'load';

  set src(value: string) {
    this._src = value;
    const outcome = FakeImage.nextOutcome;
    queueMicrotask(() => {
      if (outcome === 'load') this.onload?.();
      else this.onerror?.();
    });
  }

  get src(): string {
    return this._src;
  }
}

describe('loadImageElement', () => {
  it('resolves with the image once it loads, with crossOrigin set', async () => {
    vi.stubGlobal('Image', FakeImage);
    FakeImage.nextOutcome = 'load';
    const img = await loadImageElement('https://example.com/token.png');
    expect(img.crossOrigin).toBe('anonymous');
    expect((img as unknown as FakeImage).src).toBe('https://example.com/token.png');
    vi.unstubAllGlobals();
  });

  it('rejects when the image fails to load (e.g. CORS-blocked)', async () => {
    vi.stubGlobal('Image', FakeImage);
    FakeImage.nextOutcome = 'error';
    await expect(loadImageElement('https://example.com/blocked.png')).rejects.toThrow(
      /failed to load image/,
    );
    vi.unstubAllGlobals();
  });
});
