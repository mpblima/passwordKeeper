import { Store } from "@tauri-apps/plugin-store";

let _store: Store | null = null;

const SENSITIVE_KEYS = new Set(["pk_google_token"]);

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await Store.load("vault-config.json");
  }
  return _store;
}

export async function persistSave(key: string, value: unknown): Promise<void> {
  try {
    const s = await getStore();
    if (value == null) {
      await s.delete(key);
    } else {
      await s.set(key, value);
    }
    await s.save();
  } catch {
    // fallback: keep localStorage in sync for synchronous reads on cold start
  }
  if (!SENSITIVE_KEYS.has(key)) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export async function persistLoad<T>(key: string): Promise<T | null> {
  try {
    const s = await getStore();
    const val = await s.get<T>(key);
    return val ?? null;
  } catch {
    // fallback to localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}
