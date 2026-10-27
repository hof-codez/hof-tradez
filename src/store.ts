// Per-device convenience storage. Always wrapped, it can be blocked or empty.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
export function clear(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
