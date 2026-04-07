import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

const FILTERS = [{ name: "Password Keeper", extensions: ["keep"] }];

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
