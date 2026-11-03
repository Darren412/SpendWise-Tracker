// Minimal browser-global stubs for unit tests (node environment, no jsdom).
// Provides just enough surface for store/persistence code under test:
//   - process.env for the Supabase client constructor (never called in tests)
//   - a Map-backed localStorage
//   - window → globalThis (+ addEventListener for module-level listeners)

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

class LocalStorageStub implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    writable: true,
    configurable: true,
  });
}

if (typeof (globalThis as { addEventListener?: unknown }).addEventListener === 'undefined') {
  Object.defineProperty(globalThis, 'addEventListener', {
    value: () => {},
    writable: true,
    configurable: true,
  });
}

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
    configurable: true,
  });
}
