import { describe, expect, it } from "vitest";
import {
  createVaultDataKey,
  createVaultKeySlot,
  decryptVaultEnvelope,
  encryptData,
  encryptVaultEnvelope,
} from "./crypto";

describe("vault encryption compatibility", () => {
  it("decrypts legacy vault data through the envelope reader", async () => {
    const plaintext = JSON.stringify({ version: "legacy", entries: [{ id: "1" }] });
    const encrypted = await encryptData(plaintext, "master-password");

    const opened = await decryptVaultEnvelope(encrypted, "master-password");

    expect(JSON.parse(opened.plaintext)).toEqual({ version: "legacy", entries: [{ id: "1" }] });
    expect(opened.dataKey).toBeNull();
    expect(opened.keySlots).toEqual([]);
  });

  it("decrypts an envelope vault with the master password", async () => {
    const plaintext = JSON.stringify({ version: "2", entries: [{ id: "1", name: "Email" }] });
    const dataKey = createVaultDataKey();
    const masterSlot = await createVaultKeySlot("master", "master-password", dataKey);
    const encrypted = await encryptVaultEnvelope(plaintext, dataKey, [masterSlot]);

    const opened = await decryptVaultEnvelope(encrypted, "master-password");

    expect(JSON.parse(opened.plaintext)).toEqual({ version: "2", entries: [{ id: "1", name: "Email" }] });
    expect(opened.dataKey).toBe(dataKey);
    expect(opened.slotId).toBe("master");
    expect(opened.keySlots).toHaveLength(1);
  });

  it("decrypts the same envelope vault with an authorized share password", async () => {
    const plaintext = JSON.stringify({ version: "2", entries: [{ id: "shared", name: "Shared" }] });
    const dataKey = createVaultDataKey();
    const masterSlot = await createVaultKeySlot("master", "master-password", dataKey);
    const shareSlot = await createVaultKeySlot("share:user@example.com:vault:vault", "share-password", dataKey);
    const encrypted = await encryptVaultEnvelope(plaintext, dataKey, [masterSlot, shareSlot]);

    const opened = await decryptVaultEnvelope(encrypted, "share-password");

    expect(JSON.parse(opened.plaintext)).toEqual({ version: "2", entries: [{ id: "shared", name: "Shared" }] });
    expect(opened.dataKey).toBe(dataKey);
    expect(opened.slotId).toBe("share:user@example.com:vault:vault");
  });

  it("rejects an unauthorized password", async () => {
    const dataKey = createVaultDataKey();
    const masterSlot = await createVaultKeySlot("master", "master-password", dataKey);
    const encrypted = await encryptVaultEnvelope("{}", dataKey, [masterSlot]);

    await expect(decryptVaultEnvelope(encrypted, "wrong-password")).rejects.toThrow();
  });
});
