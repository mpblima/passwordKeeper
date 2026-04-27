import { useState, useEffect } from "react";
import { useVaultStore } from "./store/vaultStore";
import { MasterPasswordScreen } from "./components/MasterPasswordScreen";
import { Sidebar } from "./components/Sidebar";
import { PasswordGrid } from "./components/PasswordGrid";
import { PasswordForm } from "./components/PasswordForm";
import { AppMenuBar } from "./components/AppMenuBar";
import { Cloud, RefreshCw, AlertCircle, X } from "lucide-react";
import { usePlatform } from "./hooks/usePlatform";

export function App() {
  const { isAndroid } = usePlatform();
  const {
    isLocked, isDirty, isSyncing, syncError, vault,
    googleToken, localVaultPath, driveFileId,
    syncToCloud, saveToLocalFile, initFromStorage, refreshFromCloudIfChanged,
    refreshSharedSources, forceSync, clearSyncError,
  } = useVaultStore();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryGroupId, setAddEntryGroupId] = useState<string | undefined>();
  const [autoSyncTimer, setAutoSyncTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [sharedNotice, setSharedNotice] = useState("");
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  // Load persisted credentials from Tauri store on startup
  useEffect(() => {
    initFromStorage().catch(() => {});
  }, []);

  // Auto-save: local file and/or Drive after 5s of inactivity.
  // Skip syncToCloud when the main vault IS a shared collaboration file —
  // that would overwrite the shared Drive file with the wrong encryption password.
  useEffect(() => {
    if (!isDirty) return;
    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    const timer = setTimeout(() => {
      const state = useVaultStore.getState();
      // Block syncToCloud only when the OWNER of a collab vault would encrypt with the wrong password.
      // Editors open with the share password as masterPassword, so their sync is correct.
      const isOwnerOfCollabVault = !!state.vault?.collaboration && state.currentUserRole() === "owner";
      if (localVaultPath || isAndroid) saveToLocalFile(localVaultPath ?? undefined).catch(() => {});
      if (googleToken && !isOwnerOfCollabVault) syncToCloud().catch(() => {});
    }, 5000);
    setAutoSyncTimer(timer);
    return () => clearTimeout(timer);
  }, [isDirty, googleToken, localVaultPath, isAndroid]);

  // Collaborative Drive documents: pull remote changes while the local vault is clean.
  useEffect(() => {
    if (isLocked || !googleToken || !driveFileId) return;
    const timer = setInterval(() => {
      refreshFromCloudIfChanged().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [isLocked, googleToken, driveFileId, refreshFromCloudIfChanged]);

  // Poll shared sources every second for collaborator updates.
  useEffect(() => {
    if (isLocked || !googleToken) return;
    const timer = setInterval(() => {
      refreshSharedSources()
        .then((changed) => {
          if (!changed) return;
          setSharedNotice("Compartilhamento atualizado");
          setTimeout(() => setSharedNotice(""), 3000);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [isLocked, googleToken, refreshSharedSources]);

  async function handleForceSync() {
    setIsForceSyncing(true);
    try {
      await forceSync();
    } finally {
      setIsForceSyncing(false);
    }
  }

  if (isLocked) {
    return <MasterPasswordScreen />;
  }

  const isCollabVault = !!vault?.collaboration;

  return (
    <div className="h-screen flex flex-col bg-vault-bg overflow-hidden">
      {/* Menu bar */}
      <AppMenuBar onForceSync={handleForceSync} isForceSyncing={isForceSyncing} />

      {/* Sync error banner */}
      {syncError && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-vault-danger/10 text-vault-danger border-b border-vault-danger/20">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="flex-1 truncate">Erro de sincronização: {syncError}</span>
          <button
            onClick={clearSyncError}
            className="p-0.5 rounded hover:bg-vault-danger/20 transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Pending sync / syncing banner */}
      {(isDirty || isSyncing || isForceSyncing) && (
        <button
          onClick={handleForceSync}
          disabled={isSyncing || isForceSyncing}
          className={`w-full flex items-center justify-center gap-2 py-1.5 text-xs transition-all ${
            isSyncing || isForceSyncing
              ? "bg-blue-500/10 text-blue-400 cursor-default"
              : isCollabVault
              ? "bg-vault-warning/10 text-vault-warning hover:bg-vault-warning/20 cursor-pointer"
              : "bg-vault-warning/10 text-vault-warning hover:bg-vault-warning/20 cursor-pointer"
          }`}
          title={isSyncing || isForceSyncing ? undefined : "Clique para sincronizar agora"}
        >
          {isSyncing || isForceSyncing ? (
            <><RefreshCw size={12} className="animate-spin" /> Sincronizando...</>
          ) : (
            <><Cloud size={12} /> Alterações pendentes — clique para sincronizar</>
          )}
        </button>
      )}

      {/* Shared update notice */}
      {sharedNotice && (
        <div className="flex items-center justify-center gap-2 py-1.5 text-xs bg-vault-success/10 text-vault-success border-b border-vault-success/20">
          <RefreshCw size={12} /> {sharedNotice}
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          onAddEntry={(groupId) => { setAddEntryGroupId(groupId); setShowAddEntry(true); }}
          onForceSync={handleForceSync}
          isForceSyncing={isForceSyncing}
        />

        {/* Content area */}
        <main className="flex-1 flex overflow-hidden">
          <PasswordGrid onAddEntry={(groupId) => { setAddEntryGroupId(groupId); setShowAddEntry(true); }} />
        </main>
      </div>

      {/* Add entry modal */}
      {showAddEntry && (
        <PasswordForm
          defaultGroupId={addEntryGroupId}
          onClose={() => { setShowAddEntry(false); setAddEntryGroupId(undefined); }}
        />
      )}
    </div>
  );
}
