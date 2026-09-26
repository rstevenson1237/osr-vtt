import { afterEach, describe, expect, it, vi } from 'vitest';

// The SDK's cache factories return opaque objects; tagging them lets the test
// say which one `firestoreSettings` chose without an IndexedDB to run against.
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    memoryLocalCache: () => ({ kind: 'memory' }),
    persistentMultipleTabManager: () => ({ kind: 'multi-tab' }),
    persistentLocalCache: (settings: unknown) => ({ kind: 'persistent', settings }),
  };
});

const { firestoreSettings } = await import('./firebase-config.js');

describe('firestoreSettings (SPEC-056 §4, DEC-110)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the persistent multi-tab cache where IndexedDB exists', () => {
    vi.stubGlobal('indexedDB', {});
    expect(firestoreSettings().localCache).toEqual({
      kind: 'persistent',
      settings: { tabManager: { kind: 'multi-tab' } },
    });
  });

  it('falls back to the memory cache where IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(firestoreSettings().localCache).toEqual({ kind: 'memory' });
  });
});
