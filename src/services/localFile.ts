import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

const FILTERS = [{ name: "Password Keeper", extensions: ["keep"] }];
const isAndroid = (() => {
  try {
    return platform() === "android";
  } catch {
    return false;
  }
})();

export async function pickSavePath(defaultName = "meu-cofre.keep"): Promise<string | null> {
  const path = await save({ defaultPath: defaultName, filters: FILTERS });
  return path ?? null;
}

export async function pickOpenPath(): Promise<string | null> {
  const path = await open({ filters: FILTERS, multiple: false });
  if (Array.isArray(path)) return path[0] ?? null;
  return path ?? null;
}

export async function writeVaultFile(path: string, content: string): Promise<void> {
  await invoke("write_file", { path, content });
}

export async function readVaultFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function getDefaultVaultPath(): Promise<string> {
  return invoke<string>("get_default_vault_path");
}

export async function getMobileVaultPath(): Promise<string | null> {
  if (!isAndroid) return null;
  return getDefaultVaultPath();
}
