import { useEffect, useState } from "react";
import { X, Share2, Lock, Check, AlertCircle, Eye, EyeOff, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { findAllCollaborativeVaultFiles, downloadVaultFile, getFileVersion } from "../services/googleDrive";
import { decryptData } from "../services/crypto";
import { VaultData } from "../types/vault";

interface ImportSharedFileProps {
  onClose: () => void;
}

function formatShareFileName(name: string): string {
  return name
    .replace(/^pk-collab-/, "")
    .replace(/-\d+\.keep$/, "")
    .replace(/\.keep$/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ImportSharedFile({ onClose }: ImportSharedFileProps) {
  const {
    googleToken, userInfo, ensureValidToken, addSharedSource,
    dismissedShareFileIds, dismissShareFile,
  } = useVaultStore();
  const [files, setFiles] = useState<{ id: string; name: string; ownerEmail?: string }[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [step, setStep] = useState<"pick" | "password" | "opening" | "done" | "error">("pick");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function loadShares() {
    setLoading(true);
    setErrorMsg("");
    try {
      const token = await ensureValidToken();
      const result = (await findAllCollaborativeVaultFiles(token))
        .filter((file) => !dismissedShareFileIds.includes(file.id));
      setFiles(result);
      setStep("pick");
    } catch (err) {
      setErrorMsg(googleToken ? String(err) : "Conecte sua conta Google Drive primeiro.");
      setStep("error");
    }
    setLoading(false);
  }

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFileId || !password) return;
    setStep("opening");
    try {
      const token = await ensureValidToken();
      const encrypted = await downloadVaultFile(token, selectedFileId);
      const decrypted = await decryptData(encrypted, password);
      const sharedVault = JSON.parse(decrypted) as VaultData;
      const revision = await getFileVersion(token, selectedFileId);
      addSharedSource(selectedFileId, sharedVault, password, revision);
      setStep("done");
      setTimeout(onClose, 800);
    } catch {
      setErrorMsg("Senha incorreta ou compartilhamento invalido.");
      setStep("error");
    }
  }

  useEffect(() => {
    loadShares().catch(() => {});
  }, []);

  const selectedFile = files.find((file) => file.id === selectedFileId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-accent/20 flex items-center justify-center">
              <Share2 size={18} className="text-vault-accent" />
            </div>
            <div>
              <h2 className="text-vault-text font-semibold">Abrir compartilhamento</h2>
              <p className="text-vault-textMuted text-sm">Colaborar em um cofre do Drive</p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === "pick" && (
            <div className="space-y-4">
              {userInfo && <p className="text-vault-textMuted text-xs">Conta: {userInfo.email}</p>}
              <button
                onClick={loadShares}
                disabled={loading}
                className="w-full py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Atualizar compartilhamentos
              </button>
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    files.forEach((file) => dismissShareFile(file.id));
                    setFiles([]);
                  }}
                  className="w-full py-2 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textMuted hover:text-vault-danger text-xs transition-colors"
                >
                  Ocultar todos os convites desta lista
                </button>
              )}

              {loading ? (
                <div className="text-center py-8 text-vault-textMuted text-sm">
                  <Loader2 size={24} className="animate-spin mx-auto mb-3" />
                  Buscando no Google Drive...
                </div>
              ) : files.length === 0 ? (
                <div className="p-4 bg-vault-sidebar border border-vault-border rounded-xl text-center">
                  <Share2 size={32} className="text-vault-textMuted mx-auto mb-2" />
                  <p className="text-vault-textSecondary text-sm font-medium">Nenhum compartilhamento encontrado</p>
                  <p className="text-vault-textMuted text-xs mt-1">
                    O convite aparece aqui depois que o proprietario compartilhar com seu email Google.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="w-full flex items-center gap-3 p-3 bg-vault-sidebar border border-vault-border hover:border-vault-primary/40 rounded-xl transition-colors text-left"
                    >
                      <Share2 size={16} className="text-vault-primary" />
                      <button
                        onClick={() => { setSelectedFileId(file.id); setStep("password"); }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-vault-textSecondary text-sm truncate">{formatShareFileName(file.name)}</p>
                        <p className="text-vault-textMuted text-xs">
                          {file.ownerEmail ? `Compartilhado por ${file.ownerEmail}` : "Convite de colaboração"}
                        </p>
                      </button>
                      <button
                        onClick={() => {
                          dismissShareFile(file.id);
                          setFiles((current) => current.filter((item) => item.id !== file.id));
                        }}
                        className="px-2 py-1 rounded-lg text-xs text-vault-textMuted hover:text-vault-danger hover:bg-vault-danger/10"
                      >
                        Ocultar
                      </button>
                      <ArrowRight size={14} className="text-vault-textMuted" />
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full py-2.5 bg-vault-card border border-vault-border rounded-xl text-vault-textSecondary text-sm">
                Fechar
              </button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={handleOpen} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-vault-success/10 border border-vault-success/20 rounded-xl">
                <Check size={15} className="text-vault-success flex-shrink-0" />
                <p className="text-sm text-vault-success truncate">
                  {selectedFile ? formatShareFileName(selectedFile.name) : "Compartilhamento"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-vault-textSecondary mb-1.5">
                  <Lock size={13} className="inline mr-1" />
                  Senha do compartilhamento
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha enviada pelo proprietario"
                    required
                    autoFocus
                    className="w-full bg-vault-input border border-vault-border rounded-xl px-4 py-2.5 pr-11 text-vault-text placeholder-vault-textMuted focus:outline-none focus:border-vault-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-textMuted hover:text-vault-text transition-colors">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("pick")} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary text-sm">
                  Voltar
                </button>
                <button type="submit" disabled={!password} className="flex-1 py-2.5 bg-vault-primary hover:bg-vault-primaryHover disabled:opacity-40 rounded-xl text-vault-bg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                  <ArrowRight size={15} /> Abrir
                </button>
              </div>
            </form>
          )}

          {step === "opening" && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full border-2 border-vault-primary border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-vault-text font-medium">Abrindo compartilhamento...</p>
              <p className="text-vault-textMuted text-sm mt-1">Sincronizacao colaborativa sera ativada automaticamente</p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <Check size={36} className="text-vault-success mx-auto" />
              <p className="text-vault-text font-semibold">Compartilhamento aberto</p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle size={36} className="text-vault-danger mx-auto" />
              <div>
                <h3 className="text-vault-text font-semibold">Nao foi possivel abrir</h3>
                <p className="text-vault-textMuted text-sm mt-1">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("pick")} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary text-sm">
                  Tentar novamente
                </button>
                <button onClick={onClose} className="flex-1 py-2.5 bg-vault-danger/20 border border-vault-danger/30 rounded-xl text-vault-danger text-sm font-medium">
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
