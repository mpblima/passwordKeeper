import { invoke } from "@tauri-apps/api/core";

/** Returns true if the icon string is an image (data-URL or http/https URL). */
export function isImageIcon(icon: string): boolean {
  return (
    icon.startsWith("data:image/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://")
  );
}

/**
 * Resizes an image data-URL to a square of `maxSize`px using a canvas.
 * Returns a JPEG data-URL to minimise storage size.
 */
export function resizeImage(dataUrl: string, maxSize = 56): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      // Center-crop
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, maxSize, maxSize);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem"));
    img.src = dataUrl;
  });
}

/** Open native file picker and return a resized base64 data-URL. */
export async function pickLocalImage(): Promise<string | null> {
  const raw = await invoke<string | null>("pick_and_read_image");
  if (!raw) return null;
  return resizeImage(raw, 56);
}

/** Fetch a URL and return as resized data-URL, or throw if not an image. */
export async function fetchUrlImage(url: string): Promise<string> {
  // Try a quick HEAD to validate content-type (may fail on CORS, that's OK)
  try {
    const res = await fetch(url, { method: "HEAD" });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) throw new Error("A URL não aponta para uma imagem");
  } catch {
    // CORS may block HEAD — proceed anyway and let the <img> tag validate
  }
  // Return the URL as-is; resize only if it's a data-URL
  return url;
}
