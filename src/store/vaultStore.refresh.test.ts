import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVaultDataKey, createVaultKeySlot, encryptData, encryptVaultEnvelope } from "../services/crypto";
import { useVaultStore } from "./vaultStore";

vi.mock("../services/googleDrive", () => ({
  findVaultFile: vi.fn(),
  downloadVaultFile: vi.fn(),
  uploadVaultFile: vi.fn(),
  refreshAccessToken: vi.fn(),
  getFileVersion: vi.fn(),
  deleteDriveFile: vi.fn(),
}));

vi.mock("../services/localFile", () => ({
  pickSavePath: vi.fn(),
  pickOpenPath: vi.fn(),
  writeVaultFile: vi.fn(),
  readVaultFile: vi.fn(),
  getMobileVaultPath: vi.fn(),
}));

vi.mock("../services/storage", () => ({
  persistSave: vi.fn().mockResolvedValue(undefined),
  persistLoad: vi.fn().mockResolvedValue(null),
}));

import { downloadVaultFile, getFileVersion } from "../services/googleDrive";

const baseVault = {
  version: "1.0",
  owner: "owner@example.com",
  sharedWith: [],
  deletionRequests: [],
  groups: [],
  entries: [],
};

describe("vaultStore cloud refresh compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVaultStore.setState({
      isLocked: false,
      isDirty: false,
      masterPassword: "master-password",
      vaultDataKey: null,
      vaultKeySlots: [],
      googleToken: { access_token: "token", expires_at: Date.now() + 60 * 60 * 1000, token_type: "Bearer" },
      driveFileId: "drive-file-id",
      driveRevision: "rev-1",
      userInfo: { email: "owner@example.com", name: "Owner", picture: "" },
      localVaultPath: null,
      vault: baseVault,
      sharedSources: [],
      dismissedShareFileIds: [],
      isSyncing: false,
      lastSyncAt: null,
      syncError: null,
      selectedGroupId: null,
      selectedEntryId: null,
      activeView: "all",
      searchQuery: "",
      viewMode: "grid",
      sidebarOpen: true,
    });
  });

  it("refreshes a Drive vault encrypted with the envelope format", async () => {
    const nextVault = {
      ...baseVault,
      entries: [
        {
          id: "entry-1",
          name: "Email",
          description: "",
          icon: "key",
          username: "user@example.com",
          password: "secret",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const dataKey = createVaultDataKey();
    const masterSlot = await createVaultKeySlot("master", "master-password", dataKey);
    const encrypted = await encryptVaultEnvelope(JSON.stringify(nextVault), dataKey, [masterSlot]);

    vi.mocked(getFileVersion).mockResolvedValue("rev-2");
    vi.mocked(downloadVaultFile).mockResolvedValue(encrypted);

    const changed = await useVaultStore.getState().refreshFromCloudIfChanged();

    expect(changed).toBe(true);
    expect(downloadVaultFile).toHaveBeenCalledWith(expect.objectContaining({ access_token: "token" }), "drive-file-id");
    expect(useVaultStore.getState().vault?.entries).toHaveLength(1);
    expect(useVaultStore.getState().vaultDataKey).toBe(dataKey);
    expect(useVaultStore.getState().vaultKeySlots).toHaveLength(1);
    expect(useVaultStore.getState().driveRevision).toBe("rev-2");
  });

  it("still refreshes a legacy Drive vault", async () => {
    const nextVault = { ...baseVault, groups: [{ id: "g1", name: "Team", description: "", icon: "folder", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] };
    const encrypted = await encryptData(JSON.stringify(nextVault), "master-password");

    vi.mocked(getFileVersion).mockResolvedValue("rev-legacy");
    vi.mocked(downloadVaultFile).mockResolvedValue(encrypted);

    const changed = await useVaultStore.getState().refreshFromCloudIfChanged();

    expect(changed).toBe(true);
    expect(useVaultStore.getState().vault?.groups).toHaveLength(1);
    expect(useVaultStore.getState().vaultDataKey).toBeNull();
    expect(useVaultStore.getState().vaultKeySlots).toEqual([]);
    expect(useVaultStore.getState().driveRevision).toBe("rev-legacy");
  });

  it("does not download when the Drive revision has not changed", async () => {
    vi.mocked(getFileVersion).mockResolvedValue("rev-1");

    const changed = await useVaultStore.getState().refreshFromCloudIfChanged();

    expect(changed).toBe(false);
    expect(downloadVaultFile).not.toHaveBeenCalled();
  });
});
