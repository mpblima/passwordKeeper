import { useState } from "react";
import { X, Download, Lock, Check, AlertCircle, FileKey, Eye, EyeOff } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { decryptData } from "../services/crypto";
import { pickOpenPath, readVaultFile } from "../services/localFile";

interface ImportSharedFileProps {
  onClose: () => void;
}

export function ImportSharedFile({ onClose }: ImportSharedFileProps) {
  const { mergeSharedEntries } = useVaultStore();
  const [step, setStep] = useState<"pick" | "password" | "importing" | "done" | "error">("pick");
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  async function handlePickFile() {
    try {
      const path = await pickOpenPath();
      if (!path) return;
      const content = await readVaultFile(path);
      setFilePath(path.split(/[\\/]/).pop() ?? path);
      setFileContent(content);
      setStep("password");
    } catch (err) {
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!sharePassword || !fileContent) return;
    setStep("importing");

    try {
      const json = await decryptData(fileContent, sharePassword);
      const data = JSON.parse(json);

      const entries = data.entries ?? [];
      const group = data.group ?? null;

      mergeSharedEntries(entries, group);
      setImportedCount(entries.length);
      setStep("done");
    } catch {
      setErrorMsg("Senha incorreta ou arquivo inválido.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-accent/20 flex items-center justify-center">
              <Download size={18} className="text-vault-accent" />
            </div>
            <div>
              <h2 className="text-vault-text font-semibold">Importar compartilhamento</h2>
              <p className="text-vault-textMuted text-sm">Abrir arquivo .pks recebido</p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Step: pick file */}
          {step === "pick" && (
            <div className="space-y-4">
              <div className="p-4 bg-vault-sidebar border border-vault-border rounded-xl text-center space-y-3">
                <FileKey size={36} className="text-vault-accent mx-auto" />
                <div>
                  <p className="text-vault-text font-medium text-sm">
                    Selecione o arquivo <code className="text-vault-accent">.pks</code> recebido
                  </p>
                  <p className="text-vault-textMuted text-xs mt-1">
                    O remetente compartilhou este arquivo via Google Drive. Faça o download e abra aqui.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text text-sm transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handlePickFile}
                  className="flex-1 py-2.5 bg-vault-accent/20 hover:bg-vault-accent/30 border border-vault-accent/30 rounded-xl text-vault-accent font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <FileKey size={15} /> Selecionar arquivo
                </button>
              </div>
            </div>
          )}

          {/* Step: enter share password */}
          {step === "password" && (
            <form onSubmit={handleImport} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-vault-success/10 border border-vault-success/20 rounded-xl">
                <Check size={15} className="text-vault-success flex-shrink-0" />
                <p className="text-sm text-vault-success truncate">{filePath}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-vault-textSecondary mb-1.5">
                  <Lock size={13} className="inline mr-1" />
                  Senha de compartilhamento
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Senha enviada pelo remetente"
                    required
                    autoFocus
                    className="w-full bg-vault-input border border-vault-border rounded-xl px-4 py-2.5 pr-11 text-vault-text placeholder-vault-textMuted focus:outline-none focus:border-vault-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-textMuted hover:text-vault-text transition-colors"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-vault-textMuted mt-1">
                  Esta senha foi enviada pelo remetente por WhatsApp, SMS ou email.
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("pick")} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text text-sm transition-colors">
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={!sharePassword}
                  className="flex-1 py-2.5 bg-vault-primary hover:bg-vault-primaryHover disabled:opacity-40 rounded-xl text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={15} /> Importar senhas
                </button>
              </div>
            </form>
          )}

          {/* Step: importing */}
          {step === "importing" && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full border-2 border-vault-primary border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-vault-text font-medium">Importando...</p>
              <p className="text-vault-textMuted text-sm mt-1">Descriptografando e mesclando senhas</p>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-vault-success/20 flex items-center justify-center mx-auto">
                <Check size={32} className="text-vault-success" />
              </div>
              <div>
                <h3 className="text-vault-text font-semibold text-lg">Importado!</h3>
                <p className="text-vault-textMuted text-sm mt-1">
                  <strong className="text-vault-text">{importedCount} senha(s)</strong> adicionada(s) ao seu cofre.
                </p>
                <p className="text-vault-textMuted text-xs mt-2">
                  Senhas duplicadas foram ignoradas automaticamente.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-vault-primary hover:bg-vault-primaryHover rounded-xl text-white font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === "error" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-vault-danger/20 flex items-center justify-center mx-auto">
                <AlertCircle size={32} className="text-vault-danger" />
              </div>
              <div>
                <h3 className="text-vault-text font-semibold">Erro ao importar</h3>
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
