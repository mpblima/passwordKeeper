import { platform } from "@tauri-apps/plugin-os";

interface PlatformInfo {
  isAndroid: boolean;
  isDesktop: boolean;
}

// Avaliado uma vez e cacheado — platform() é síncrono no Tauri 2
function detectPlatform(): PlatformInfo {
  try {
    const p = platform();
    return {
      isAndroid: p === "android",
      isDesktop: p !== "android" && p !== "ios",
    };
  } catch {
    return { isAndroid: false, isDesktop: true };
  }
}

const PLATFORM = detectPlatform();

export function usePlatform(): PlatformInfo {
  return PLATFORM;
}
