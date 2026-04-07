import { create } from "zustand";
import { VaultData, PasswordEntry, PasswordGroup, GoogleToken, ViewMode, ActiveView, VaultPermission, DeletionRequest } from "../types/vault";
import { encryptData, decryptData } from "../services/crypto";
import {
  findVaultFile,
  downloadVaultFile,
  uploadVaultFile,
  refreshAccessToken,
} from "../services/googleDrive";
import {
  pickSavePath,
  pickOpenPath,
  writeVaultFile,
  readVaultFile,
} from "../services/localFile";
import { persistSave, persistLoad } from "../services/storage";

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ─── Sync persistence helpers (localStorage, for cold-start reads) ─────────────

function loadPersisted<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function savePersisted(key: string, value: unknown) {
  // Fire-and-forget: write to Tauri store (reliable) + localStorage (sync fallback)
  persistSave(key, value).catch(() => {});
}

interface VaultStore {
  // ── Auth / Lock state ──────────────────────────────────────────────────────
  isLocked: boolean;
  masterPassword: string;

  // ── Google Drive ───────────────────────────────────────────────────────────
  googleToken: GoogleToken | null;
  driveFileId: string | null;
  userInfo: { email: string; name: string; picture: string } | null;

  // ── Local storage ──────────────────────────────────────────────────────────
  localVaultPath: string | null;

  // ── Vault data ─────────────────────────────────────────────────────────────
  vault: VaultData | null;
  isDirty: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncError: string | null;

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedGroupId: string | null;
  selectedEntryId: string | null;
  activeView: ActiveView;
  searchQuery: string;
  viewMode: ViewMode;

  // ── Auth ───────────────────────────────────────────────────────────────────
  setGoogleToken: (token: GoogleToken | null) => void;
  setUserInfo: (info: { email: string; name: string; picture: string } | null) => void;
  setDriveFileId: (id: string | null) => void;

  // ── Role ───────────────────────────────────────────────────────────────────
  currentUserRole: () => VaultPermission;

  // ── Storage init ───────────────────────────────────────────────────────────
  initFromStorage: () => Promise<void>;

  // ── Vault lifecycle ────────────────────────────────────────────────────────
  createVault: (masterPassword: string) => void;
  unlockVault: (encryptedData: string, masterPassword: string) => Promise<void>;
  lockVault: () => void;
  closeVault: () => void;
  getEncryptedVault: () => Promise<string>;
  mergeSharedEntries: (entries: PasswordEntry[], group?: PasswordGroup | null) => void;
  mergeFromVault: (otherVault: VaultData) => number;

  // ── Local file ─────────────────────────────────────────────────────────────
  saveToLocalFile: (path?: string) => Promise<void>;
  loadFromLocalFile: (path?: string) => Promise<string>;

  // ── Google Drive sync ──────────────────────────────────────────────────────
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<string>;
  ensureValidToken: () => Promise<GoogleToken>;

  // ── Groups ─────────────────────────────────────────────────────────────────
  addGroup: (data: Omit<PasswordGroup, "id" | "createdAt" | "updatedAt">) => void;
  updateGroup: (id: string, data: Partial<PasswordGroup>) => void;
  deleteGroup: (id: string) => void;

  // ── Entries ────────────────────────────────────────────────────────────────
  addEntry: (data: Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">) => void;
  updateEntry: (id: string, data: Partial<PasswordEntry>) => void;
  deleteEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;

  // ── Deletion requests ──────────────────────────────────────────────────────
  requestDeletion: (entryId: string) => void;
  approveDeletion: (requestId: string) => void;
  rejectDeletion: (requestId: string) => void;

  // ── Sharing / permissions ──────────────────────────────────────────────────
  updateSharedUserRole: (email: string, role: VaultPermission) => void;
  removeSharedUser: (email: string) => void;

  // ── UI ─────────────────────────────────────────────────────────────────────
  selectGroup: (id: string | null) => void;
  selectEntry: (id: string | null) => void;
  setActiveView: (view: ActiveView) => void;
  setSearchQuery: (q: string) => void;
  setViewMode: (m: ViewMode) => void;

  // ── Computed ───────────────────────────────────────────────────────────────
  getFilteredEntries: () => PasswordEntry[];
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  isLocked: true,
  masterPassword: "",
  googleToken: loadPersisted<GoogleToken>("pk_google_token"),
  driveFileId: loadPersisted<string>("pk_drive_file_id"),
  userInfo: loadPersisted<{ email: string; name: string; picture: string }>("pk_user_info"),
  localVaultPath: loadPersisted<string>("pk_local_vault_path"),
  vault: null,
  isDirty: false,
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,
  selectedGroupId: null,
  selectedEntryId: null,
  activeView: "all",
  searchQuery: "",
  viewMode: "grid",

  setGoogleToken: (token) => {
    savePersisted("pk_google_token", token);
    set({ googleToken: token });
  },
  setUserInfo: (info) => {
    savePersisted("pk_user_info", info);
    set((s) => ({
      userInfo: info,
      vault: s.vault && !s.vault.owner && info
        ? { ...s.vault, owner: info.email }
        : s.vault,
    }));
  },
  setDriveFileId: (id) => {
    savePersisted("pk_drive_file_id", id);
    set({ driveFileId: id });
  },

  initFromStorage: async () => {
    const [googleToken, userInfo, driveFileId, localVaultPath] = await Promise.all([
      persistLoad<GoogleToken>("pk_google_token"),
      persistLoad<{ email: string; name: string; picture: string }>("pk_user_info"),
      persistLoad<string>("pk_drive_file_id"),
      persistLoad<string>("pk_local_vault_path"),
    ]);
    set((s) => ({
      googleToken: googleToken ?? s.googleToken,
      userInfo: userInfo ?? s.userInfo,
      driveFileId: driveFileId ?? s.driveFileId,
      localVaultPath: localVaultPath ?? s.localVaultPath,
    }));
  },

  currentUserRole: (): VaultPermission => {
    const { vault, userInfo } = get();
    if (!vault || !userInfo) return "owner";
    if (!vault.owner || vault.owner === userInfo.email) return "owner";
    const shared = vault.sharedWith?.find((u) => u.email === userInfo.email);
    return shared?.role ?? "reader";
  },

  createVault: (masterPassword) => {
    const vault: VaultData = {
      version: "1.0",
      owner: "",
      sharedWith: [],
      deletionRequests: [],
      groups: [],
      entries: [],
    };
    set({ vault, masterPassword, isLocked: false, isDirty: true });
  },

  unlockVault: async (encryptedData, masterPassword) => {
    const json = await decryptData(encryptedData, masterPassword);
    const raw = JSON.parse(json);
    // Migrate older vaults that lack new fields
    const vault: VaultData = {
      sharedWith: [],
      deletionRequests: [],
      owner: "",
      ...raw,
    };
    set({ vault, masterPassword, isLocked: false });
  },

  lockVault: () => {
    set({ isLocked: true, masterPassword: "", vault: null, selectedEntryId: null });
  },

  closeVault: () => {
    // Only clear vault-specific state — keep Google credentials so user
    // doesn't have to re-authenticate on the next open.
    savePersisted("pk_drive_file_id", null);
    savePersisted("pk_local_vault_path", null);
    set({
      isLocked: true,
      masterPassword: "",
      vault: null,
      selectedEntryId: null,
      selectedGroupId: null,
      activeView: "all",
      searchQuery: "",
      localVaultPath: null,
      driveFileId: null,
      syncError: null,
      isDirty: false,
    });
  },

  mergeSharedEntries: (entries, group) => {
    const { userInfo } = get();
    set((s) => {
      if (!s.vault) return s;
      let groups = s.vault.groups;
      let targetGroupId: string | undefined;

      // If the share included a group, add it (or reuse existing by name)
      if (group) {
        const existing = groups.find((g) => g.name === group.name);
        if (existing) {
          targetGroupId = existing.id;
        } else {
          const newGroup: PasswordGroup = { ...group, id: generateId(), createdAt: now(), updatedAt: now() };
          groups = [...groups, newGroup];
          targetGroupId = newGroup.id;
        }
      }

      // Add entries, skipping any already existing (by username+name match)
      const newEntries = entries
        .filter((e) => !s.vault!.entries.some((ex) => ex.name === e.name && ex.username === e.username))
        .map((e) => ({
          ...e,
          id: generateId(),
          groupId: targetGroupId ?? e.groupId,
          createdBy: userInfo?.email,
          createdAt: now(),
          updatedAt: now(),
        }));

      return {
        vault: { ...s.vault, groups, entries: [...s.vault.entries, ...newEntries] },
        isDirty: true,
      };
    });
  },

  mergeFromVault: (otherVault) => {
    let newEntriesCount = 0;
    set((s) => {
      if (!s.vault) return s;

      // Map group IDs from the other vault → this vault (match by name)
      const groupIdMap = new Map<string, string>();
      let groups = [...s.vault.groups];
      for (const g of (otherVault.groups ?? [])) {
        const existing = groups.find((eg) => eg.name === g.name);
        if (existing) {
          groupIdMap.set(g.id, existing.id);
        } else {
          const newGroup: PasswordGroup = { ...g, id: generateId(), createdAt: now(), updatedAt: now() };
          groups = [...groups, newGroup];
          groupIdMap.set(g.id, newGroup.id);
        }
      }

      const incoming = (otherVault.entries ?? [])
        .filter((e) => !s.vault!.entries.some((ex) => ex.name === e.name && ex.username === e.username))
        .map((e) => ({
          ...e,
          id: generateId(),
          groupId: e.groupId ? (groupIdMap.get(e.groupId) ?? undefined) : undefined,
          createdAt: now(),
          updatedAt: now(),
        }));
      newEntriesCount = incoming.length;

      if (incoming.length === 0 && groups.length === s.vault.groups.length) return s;
      return {
        vault: { ...s.vault, groups, entries: [...s.vault.entries, ...incoming] },
        isDirty: incoming.length > 0,
      };
    });
    return newEntriesCount;
  },

  getEncryptedVault: async () => {
    const { vault, masterPassword } = get();
    if (!vault || !masterPassword) throw new Error("Cofre não está desbloqueado");
    return encryptData(JSON.stringify(vault), masterPassword);
  },

  // ── Local file ────────────────────────────────────────────────────────────

  saveToLocalFile: async (path) => {
    set({ isSyncing: true, syncError: null });
    try {
      let savePath = path ?? get().localVaultPath;
      if (!savePath) {
        savePath = await pickSavePath("meu-cofre.keep");
        if (!savePath) { set({ isSyncing: false }); return; }
      }
      const encrypted = await get().getEncryptedVault();
      await writeVaultFile(savePath, encrypted);
      savePersisted("pk_local_vault_path", savePath);
      set({ localVaultPath: savePath, isDirty: false, lastSyncAt: now(), isSyncing: false });
    } catch (err) {
      set({ syncError: String(err), isSyncing: false });
      throw err;
    }
  },

  loadFromLocalFile: async (path) => {
    set({ isSyncing: true, syncError: null });
    try {
      let loadPath: string | null | undefined = path;
      if (!loadPath) {
        loadPath = await pickOpenPath();
        if (!loadPath) { set({ isSyncing: false }); throw new Error("Nenhum arquivo selecionado"); }
      }
      const encrypted = await readVaultFile(loadPath);
      set({ localVaultPath: loadPath, isSyncing: false });
      return encrypted;
    } catch (err) {
      set({ syncError: String(err), isSyncing: false });
      throw err;
    }
  },

  // ── Google Drive ──────────────────────────────────────────────────────────

  ensureValidToken: async () => {
    const { googleToken } = get();
    if (!googleToken) throw new Error("Não autenticado com o Google");
    if (Date.now() < googleToken.expires_at - 60000) return googleToken;
    // Token expired — try silent refresh before asking user to log in again
    if (!googleToken.refresh_token) throw new Error("Sessão expirada, faça login novamente");
    const newToken = await refreshAccessToken(googleToken.refresh_token);
    savePersisted("pk_google_token", newToken);
    set({ googleToken: newToken });
    return newToken;
  },

  syncToCloud: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const token = await get().ensureValidToken();
      const { driveFileId } = get();
      const encrypted = await get().getEncryptedVault();
      const newFileId = await uploadVaultFile(token, encrypted, driveFileId ?? undefined);
      set({ driveFileId: newFileId, isDirty: false, lastSyncAt: now(), isSyncing: false });
    } catch (err) {
      set({ syncError: String(err), isSyncing: false });
      throw err;
    }
  },

  loadFromCloud: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const token = await get().ensureValidToken();
      let fileId = get().driveFileId;
      if (!fileId) {
        fileId = await findVaultFile(token);
        if (!fileId) throw new Error("Nenhum cofre encontrado no Drive");
        set({ driveFileId: fileId });
      }
      const encrypted = await downloadVaultFile(token, fileId);
      set({ isSyncing: false });
      return encrypted;
    } catch (err) {
      set({ syncError: String(err), isSyncing: false });
      throw err;
    }
  },

  addGroup: (data) => {
    const group: PasswordGroup = { ...data, id: generateId(), createdAt: now(), updatedAt: now() };
    set((s) => ({
      vault: s.vault ? { ...s.vault, groups: [...s.vault.groups, group] } : s.vault,
      isDirty: true,
    }));
  },

  updateGroup: (id, data) => {
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, groups: s.vault.groups.map((g) => g.id === id ? { ...g, ...data, updatedAt: now() } : g) }
        : s.vault,
      isDirty: true,
    }));
  },

  deleteGroup: (id) => {
    set((s) => ({
      vault: s.vault
        ? {
            ...s.vault,
            groups: s.vault.groups.filter((g) => g.id !== id),
            entries: s.vault.entries.map((e) => e.groupId === id ? { ...e, groupId: undefined, updatedAt: now() } : e),
          }
        : s.vault,
      selectedGroupId: s.selectedGroupId === id ? null : s.selectedGroupId,
      isDirty: true,
    }));
  },

  addEntry: (data) => {
    const { userInfo } = get();
    const entry: PasswordEntry = {
      ...data,
      id: generateId(),
      createdBy: userInfo?.email,
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({
      vault: s.vault ? { ...s.vault, entries: [...s.vault.entries, entry] } : s.vault,
      isDirty: true,
    }));
  },

  updateEntry: (id, data) => {
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, entries: s.vault.entries.map((e) => e.id === id ? { ...e, ...data, updatedAt: now() } : e) }
        : s.vault,
      isDirty: true,
    }));
  },

  deleteEntry: (id) => {
    set((s) => ({
      vault: s.vault ? { ...s.vault, entries: s.vault.entries.filter((e) => e.id !== id) } : s.vault,
      selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId,
      isDirty: true,
    }));
  },

  toggleFavorite: (id) => {
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, entries: s.vault.entries.map((e) => e.id === id ? { ...e, favorite: !e.favorite, updatedAt: now() } : e) }
        : s.vault,
      isDirty: true,
    }));
  },

  requestDeletion: (entryId) => {
    const { vault, userInfo } = get();
    if (!vault) return;
    const entry = vault.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const request: DeletionRequest = {
      id: generateId(),
      entryId,
      entryName: entry.name,
      requestedBy: userInfo?.email ?? "Desconhecido",
      requestedAt: now(),
    };
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, deletionRequests: [...(s.vault.deletionRequests ?? []), request] }
        : s.vault,
      isDirty: true,
    }));
  },

  approveDeletion: (requestId) => {
    set((s) => {
      if (!s.vault) return s;
      const req = (s.vault.deletionRequests ?? []).find((r) => r.id === requestId);
      if (!req) return s;
      return {
        vault: {
          ...s.vault,
          entries: s.vault.entries.filter((e) => e.id !== req.entryId),
          deletionRequests: s.vault.deletionRequests.filter((r) => r.id !== requestId),
        },
        selectedEntryId: s.selectedEntryId === req.entryId ? null : s.selectedEntryId,
        isDirty: true,
      };
    });
  },

  rejectDeletion: (requestId) => {
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, deletionRequests: (s.vault.deletionRequests ?? []).filter((r) => r.id !== requestId) }
        : s.vault,
      isDirty: true,
    }));
  },

  updateSharedUserRole: (email, role) => {
    set((s) => {
      if (!s.vault) return s;
      const existing = s.vault.sharedWith.find((u) => u.email === email);
      const sharedWith = existing
        ? s.vault.sharedWith.map((u) => u.email === email ? { ...u, role } : u)
        : [...s.vault.sharedWith, { email, role, addedAt: now() }];
      return { vault: { ...s.vault, sharedWith }, isDirty: true };
    });
  },

  removeSharedUser: (email) => {
    set((s) => ({
      vault: s.vault
        ? { ...s.vault, sharedWith: s.vault.sharedWith.filter((u) => u.email !== email) }
        : s.vault,
      isDirty: true,
    }));
  },

  selectGroup: (id) => set({ selectedGroupId: id, selectedEntryId: null, activeView: id ? "group" : "all" }),
  selectEntry: (id) => set({ selectedEntryId: id }),
  setActiveView: (view) => set({ activeView: view, selectedGroupId: null, selectedEntryId: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setViewMode: (m) => set({ viewMode: m }),

  getFilteredEntries: () => {
    const { vault, activeView, selectedGroupId, searchQuery } = get();
    if (!vault) return [];
    let entries = vault.entries;
    if (activeView === "favorites") entries = entries.filter((e) => e.favorite);
    else if (activeView === "group" && selectedGroupId) entries = entries.filter((e) => e.groupId === selectedGroupId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) => e.name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q) ||
               e.description?.toLowerCase().includes(q) || e.url?.toLowerCase().includes(q)
      );
    }
    return entries;
  },
}));
