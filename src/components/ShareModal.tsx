import { useState } from "react";
import { X, Share2, Mail, Copy, Check, AlertCircle, Lock, ShieldCheck, Eye, Edit } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { PasswordEntry, PasswordGroup, VaultPermission } from "../types/vault";
import { encryptData } from "../services/crypto";
import { createSharedVaultFile, shareFile } from "../services/googleDrive";

interface ShareModalProps {
  target: PasswordEntry | PasswordGroup | null;
  type: "entry" | "group";
  onClose: () => void;
}

const ROLE_OPTIONS: { value: VaultPermission; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: "reader",
    label: "Somente leitura",
    desc: "Pode visualizar as senhas, mas não editar nem criar.",
    icon: <Eye size={15} />,
  },
  {
    value: "editor",
    label: "Editor",
    desc: "Pode visualizar e criar novas senhas. Não pode deletar.",
    icon: <Edit size={15} />,
  },
  {
    value: "owner",
    label: "Proprietário",
    desc: "Acesso total, incluindo deletar senhas e gerenciar compartilhamentos.",
    icon: <ShieldCheck size={15} />,
  },
];

export function ShareModal({ target, type, onClose }: ShareModalProps) {
  const { vault, googleToken, updateSharedUserRole } = useVaultStore();
  const [step, setStep] = useState<"form" | "sharing" | "done" | "error">("form");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VaultPermission>("reader");
  const [sharePassword, setSharePassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedPwd, setCopiedPwd] = useState(false);

  if (!target || !vault) return null;

  const isGroup = type === "group";
  const groupTarget = isGroup ? (target as PasswordGroup) : null;

  const entriesToShare = isGroup
    ? vault.entries.filter((e) => e.groupId === target.id)
    : [target as PasswordEntry];

  async function handleShare() {
    if (!email.trim() || !sharePassword || !googleToken) return;
    setStep("sharing");

    try {
      const shareData = {
        type,
        role,
        sharedBy: new Date().toISOString(),
        group: groupTarget,
        entries: entriesToShare,
        vaultOwner: vault!.owner,
      };

      const encrypted = await encryptData(JSON.stringify(shareData), sharePassword);
      const fileName = `pk-share-${(target as { name: string }).name.replace(/\s+/g, "-")}-${Date.now()}.pks`;
      const fileId = await createSharedVaultFile(googleToken, encrypted, fileName);

      // Share the Drive file with the recipient — role mapping to Drive roles
      const driveRole = role === "reader" ? "reader" : "writer";
      await shareFile(googleToken, fileId, email, driveRole);

      // Record the shared user in the vault metadata
      updateSharedUserRole(email, role);

      setStep("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  function generateSharePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    setSharePassword(Array.from(arr, (x) => chars[x % chars.length]).join(""));
  }

  function copyPassword() {
    navigator.clipboard.writeText(sharePassword);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  }

  const selectedRoleOption = ROLE_OPTIONS.find((r) => r.value === role)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-primary/20 flex items-center justify-center">
              <Share2 size={18} className="text-vault-primary" />
            </div>
            <div>
              <h2 className="text-vault-text font-semibold">Compartilhar</h2>
              <p className="text-vault-textMuted text-sm">
                {isGroup ? "Grupo" : "Senha"}: {target.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === "form" && (
            <div className="space-y-4">
              {!googleToken && (
                <div className="p-3 bg-vault-warning/10 border border-vault-warning/30 rounded-xl flex items-start gap-2">
                  <AlertCircle size={16} className="text-vault-warning mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-vault-warning">
                    Conecte ao Google Drive primeiro para compartilhar.
                  </p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-vault-textSecondary mb-1.5">
                  <Mail size={13} className="inline mr-1" />
                  Email do destinatário
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="destinatario@gmail.com"
                  className="w-full bg-vault-input border border-vault-border rounded-xl px-4 py-2.5 text-vault-text placeholder-vault-textMuted focus:outline-none focus:border-vault-primary transition-colors"
                />
              </div>

              {/* Permission role */}
              <div>
                <label className="block text-sm font-medium text-vault-textSecondary mb-2">
                  Nível de acesso
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        role === opt.value
                          ? "border-vault-primary bg-vault-primary/10"
                          : "border-vault-border bg-vault-input hover:border-vault-primary/40"
                      }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${role === opt.value ? "text-vault-primary" : "text-vault-textMuted"}`}>
                        {opt.icon}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${role === opt.value ? "text-vault-primary" : "text-vault-text"}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-vault-textMuted mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Share password */}
              <div>
                <label className="block text-sm font-medium text-vault-textSecondary mb-1.5">
                  <Lock size={13} className="inline mr-1" />
                  Senha de compartilhamento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Senha para descriptografar"
                    className="w-full bg-vault-input border border-vault-border rounded-xl px-4 py-2.5 pr-20 text-vault-text font-mono text-sm placeholder-vault-textMuted focus:outline-none focus:border-vault-primary transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={generateSharePassword}
                      className="px-2 py-1 text-xs bg-vault-primary/20 text-vault-primary rounded-lg hover:bg-vault-primary/30 transition-colors"
                    >
                      Gerar
                    </button>
                    {sharePassword && (
                      <button type="button" onClick={copyPassword} className="p-1.5 text-vault-textMuted hover:text-vault-text transition-colors">
                        {copiedPwd ? <Check size={14} className="text-vault-success" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-vault-textMuted mt-1">
                  Envie esta senha ao destinatário por outro canal (WhatsApp, SMS, etc)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text transition-colors font-medium">
                  Cancelar
                </button>
                <button
                  onClick={handleShare}
                  disabled={!email || !sharePassword || !googleToken}
                  className="flex-1 py-2.5 bg-vault-primary hover:bg-vault-primaryHover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 size={16} /> Compartilhar
                </button>
              </div>
            </div>
          )}

          {step === "sharing" && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full border-2 border-vault-primary border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-vault-text font-medium">Compartilhando...</p>
              <p className="text-vault-textMuted text-sm mt-1">Criando arquivo no Google Drive</p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-vault-success/20 flex items-center justify-center mx-auto">
                <Check size={32} className="text-vault-success" />
              </div>
              <div>
                <h3 className="text-vault-text font-semibold text-lg">Compartilhado!</h3>
                <p className="text-vault-textMuted text-sm mt-1">
                  Arquivo enviado para <strong className="text-vault-text">{email}</strong> como{" "}
                  <strong className="text-vault-primary">{selectedRoleOption.label}</strong>.
                </p>
              </div>
              <div className="p-3 bg-vault-warning/10 border border-vault-warning/30 rounded-xl text-left">
                <p className="text-sm text-vault-warning font-medium">Senha de compartilhamento:</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-vault-primary font-mono text-sm bg-vault-input px-3 py-1.5 rounded-lg flex-1">
                    {sharePassword}
                  </code>
                  <button onClick={copyPassword} className="p-2 text-vault-textMuted hover:text-vault-text transition-colors">
                    {copiedPwd ? <Check size={16} className="text-vault-success" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-vault-primary hover:bg-vault-primaryHover rounded-xl text-white font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-vault-danger/20 flex items-center justify-center mx-auto">
                <AlertCircle size={32} className="text-vault-danger" />
              </div>
              <div>
                <h3 className="text-vault-text font-semibold">Erro ao compartilhar</h3>
                <p className="text-vault-textMuted text-sm mt-1">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("form")} className="flex-1 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text transition-colors font-medium">
                  Tentar novamente
                </button>
                <button onClick={onClose} className="flex-1 py-2.5 bg-vault-danger/20 border border-vault-danger/40 rounded-xl text-vault-danger font-medium transition-colors">
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
