// AES-256-GCM encryption using Web Crypto API
// Legacy layout: [16 bytes salt][12 bytes iv][encrypted data]
// Envelope layout: JSON with an encrypted payload and one or more password key slots.

export interface VaultKeySlot {
  id: string;
  salt: string;
  iv: string;
  encryptedKey: string;
  createdAt: string;
}

interface VaultEnvelope {
  format: "password-keeper-envelope";
  version: 2;
  payload: {
    iv: string;
    data: string;
  };
  keySlots: VaultKeySlot[];
}

export interface DecryptedVaultEnvelope {
  plaintext: string;
  dataKey: string | null;
  keySlots: VaultKeySlot[];
  slotId?: string;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 310000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function importDataKey(dataKeyBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuffer(dataKeyBase64) as unknown as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function createVaultDataKey(): string {
  return bufferToBase64(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export async function createVaultKeySlot(id: string, password: string, dataKeyBase64: string): Promise<VaultKeySlot> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await deriveKey(password, salt);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    passwordKey,
    base64ToBuffer(dataKeyBase64) as unknown as BufferSource
  );

  return {
    id,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    encryptedKey: bufferToBase64(encryptedKey),
    createdAt: new Date().toISOString(),
  };
}

async function decryptVaultKeySlot(slot: VaultKeySlot, password: string): Promise<string> {
  const passwordKey = await deriveKey(password, base64ToBuffer(slot.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(slot.iv) as unknown as BufferSource },
    passwordKey,
    base64ToBuffer(slot.encryptedKey) as unknown as BufferSource
  );
  return bufferToBase64(decrypted);
}

export async function encryptVaultEnvelope(
  plaintext: string,
  dataKeyBase64: string,
  keySlots: VaultKeySlot[]
): Promise<string> {
  if (keySlots.length === 0) throw new Error("Nenhuma senha autorizada para criptografar o cofre");
  const key = await importDataKey(dataKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, encoded);

  const envelope: VaultEnvelope = {
    format: "password-keeper-envelope",
    version: 2,
    payload: {
      iv: bufferToBase64(iv.buffer),
      data: bufferToBase64(encrypted),
    },
    keySlots,
  };

  return JSON.stringify(envelope);
}

function parseVaultEnvelope(content: string): VaultEnvelope | null {
  try {
    const parsed = JSON.parse(content) as Partial<VaultEnvelope>;
    if (parsed.format === "password-keeper-envelope" && parsed.version === 2 && parsed.payload && Array.isArray(parsed.keySlots)) {
      return parsed as VaultEnvelope;
    }
  } catch {
    return null;
  }
  return null;
}

export async function decryptVaultEnvelope(content: string, password: string): Promise<DecryptedVaultEnvelope> {
  const envelope = parseVaultEnvelope(content);
  if (!envelope) {
    return {
      plaintext: await decryptData(content, password),
      dataKey: null,
      keySlots: [],
    };
  }

  let lastError: unknown;
  for (const slot of envelope.keySlots) {
    try {
      const dataKey = await decryptVaultKeySlot(slot, password);
      const key = await importDataKey(dataKey);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBuffer(envelope.payload.iv) as unknown as BufferSource },
        key,
        base64ToBuffer(envelope.payload.data) as unknown as BufferSource
      );
      return {
        plaintext: new TextDecoder().decode(decrypted),
        dataKey,
        keySlots: envelope.keySlots,
        slotId: slot.id,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Senha incorreta");
}

export async function encryptData(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, encoded);

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return bufferToBase64(combined.buffer);
}

export async function decryptData(encryptedBase64: string, password: string): Promise<string> {
  const combined = base64ToBuffer(encryptedBase64);
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, data);
  return new TextDecoder().decode(decrypted);
}

export function generatePassword(
  length = 20,
  options = { upper: true, lower: true, numbers: true, symbols: true }
): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";

  let charset = "";
  if (options.upper) charset += upper;
  if (options.lower) charset += lower;
  if (options.numbers) charset += numbers;
  if (options.symbols) charset += symbols;
  if (!charset) charset = lower + numbers;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => charset[x % charset.length]).join("");
}

export function measurePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "Vazia", color: "#64748b" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: (score / 7) * 100, label: "Fraca", color: "#ef4444" };
  if (score <= 4) return { score: (score / 7) * 100, label: "Média", color: "#f59e0b" };
  if (score <= 6) return { score: (score / 7) * 100, label: "Boa", color: "#22c55e" };
  return { score: 100, label: "Excelente", color: "#6366f1" };
}
