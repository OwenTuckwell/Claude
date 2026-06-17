// Vitest global setup. Node 22+ ships an experimental built-in `localStorage` global
// that is `undefined` unless launched with --localstorage-file, and it shadows the one
// jsdom would otherwise provide — breaking any test that touches storage. We install a
// simple in-memory implementation so storage behaves consistently across environments.

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string): void { this.map.set(key, String(value)); }
  removeItem(key: string): void { this.map.delete(key); }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
}

function install(name: "localStorage" | "sessionStorage") {
  const store = new MemoryStorage();
  try {
    Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true });
  } catch {
    (globalThis as Record<string, unknown>)[name] = store;
  }
}

install("localStorage");
install("sessionStorage");
