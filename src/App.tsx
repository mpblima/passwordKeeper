import { useState, useEffect } from "react";
import { useVaultStore } from "./store/vaultStore";
import { MasterPasswordScreen } from "./components/MasterPasswordScreen";
import { Sidebar } from "./components/Sidebar";
import { PasswordGrid } from "./components/PasswordGrid";
import { PasswordForm } from "./components/PasswordForm";
import { AppMenuBar } from "./components/AppMenuBar";
import { Cloud, RefreshCw } from "lucide-react";
import { usePlatform } from "./hooks/usePlatform";

export function App() {
  const { isAndroid } = usePlatform();
  const {
    isLocked, isDirty, isSyncing,
    googleToken, localVaultPath, driveFileId,
    syncToCloud, saveToLocalFile, initFromStorage, refreshFromCloudIfChanged,
    refreshSharedSources,
  } = useVaultStore();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryGroupId, setAddEntryGroupId] = useState<string | undefined>();
  const [autoSyncTimer, setAutoSyncTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [sharedNotice, setSharedNotice] = useState("");

  // Load persisted credentials from Tauri store on startup
  useEffect(() => {
    initFromStorage().catch(() => {});
  }, []);

  // Auto-save: local file and/or Drive after 5s of inactivity
  useEffect(() => {
    if (!isDirty) return;
    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    const timer = setTimeout(() => {
      if (localVaultPath || isAndroid) saveToLocalFile(localVaultPath ?? undefined).catch(() => {});
      if (googleToken) syncToCloud().catch(() => {});
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

  useEffect(() => {
    if (isLocked || !googleToken) return;
    const timer = setInterval(() => {
      refreshSharedSources()
        .then((changed) => {
          if (!changed) return;
          setSharedNotice("Compartilhamento atualizado por outro colaborador");
          setTimeout(() => setSharedNotice(""), 3500);
        })
        .catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, googleToken, refreshSharedSources]);

  if (isLocked) {
    return <MasterPasswordScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-vault-bg overflow-hidden">
      {/* Menu bar */}
      <AppMenuBar />

      {/* Top bar - sync status */}
      {(isDirty || isSyncing) && googleToken && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs transition-all ${
          isSyncing ? "bg-blue-500/10 text-blue-400" : "bg-vault-warning/10 text-vault-warning"
        }`}>
          {isSyncing ? (
            <><RefreshCw size={12} className="animate-spin" /> Sincronizando com Google Drive...</>
          ) : (
            <><Cloud size={12} /> Alterações pendentes de sincronização</>
          )}
        </div>
      )}

      {sharedNotice && (
        <div className="flex items-center justify-center gap-2 py-1.5 text-xs bg-vault-success/10 text-vault-success border-b border-vault-success/20">
          <RefreshCw size={12} /> {sharedNotice}
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onAddEntry={(groupId) => { setAddEntryGroupId(groupId); setShowAddEntry(true); }} />

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
