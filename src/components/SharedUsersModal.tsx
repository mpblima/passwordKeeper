import { useState } from "react";
import { X, Users, UserPlus, Trash2, ShieldCheck, Eye, Edit, Crown } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { VaultPermission } from "../types/vault";
import { ShareModal } from "./ShareModal";

interface SharedUsersModalProps {
  onClose: () => void;
}

const ROLE_LABELS: Record<VaultPermission, { label: string; icon: React.ReactNode; color: string }> = {
  owner:  { label: "Proprietário", icon: <Crown size={13} />,      color: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30" },
  editor: { label: "Editor",       icon: <Edit size={13} />,       color: "text-vault-success bg-vault-success/15 border-vault-success/30" },
  reader: { label: "Somente leitura", icon: <Eye size={13} />,     color: "text-vault-textMuted bg-vault-card border-vault-border" },
};

export function SharedUsersModal({ onClose }: SharedUsersModalProps) {
  const { vault, updateSharedUserRole, removeSharedUser } = useVaultStore();
  const [showAddShare, setShowAddShare] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const sharedWith = vault?.sharedWith ?? [];

  if (showAddShare) {
    // Reuse existing ShareModal in "vault share" mode — pass null target to indicate whole vault
    return (
      <AddShareWrapper onClose={() => setShowAddShare(false)} onDone={() => setShowAddShare(false)} />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-primary/20 flex items-center justify-center">
              <Users size={18} className="text-vault-primary" />
            </div>
            <div>
              <h2 className="text-vault-text font-semibold">Compartilhado com</h2>
              <p className="text-vault-textMuted text-sm">
                {sharedWith.length === 0 ? "Nenhum acesso compartilhado" : `${sharedWith.length} pessoa(s) com acesso`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* User list */}
          {sharedWith.length === 0 ? (
            <div className="text-center py-6">
              <Users size={32} className="text-vault-textMuted mx-auto mb-3" />
              <p className="text-vault-textSecondary font-medium text-sm">Nenhum compartilhamento ativo</p>
              <p className="text-vault-textMuted text-xs mt-1">
                Compartilhe grupos ou senhas para dar acesso a outras pessoas.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sharedWith.map((user) => {
                const roleInfo = ROLE_LABELS[user.role];
                return (
                  <div key={user.email} className="flex items-center gap-3 p-3 bg-vault-sidebar border border-vault-border rounded-xl">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-vault-primary/20 flex items-center justify-center flex-shrink-0 text-vault-primary font-semibold text-sm">
                      {user.email[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-vault-text text-sm font-medium truncate">{user.email}</p>
                      <p className="text-vault-textMuted text-xs">
                        {new Date(user.addedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>

                    {/* Role selector */}
                    <select
                      value={user.role}
                      onChange={(e) => updateSharedUserRole(user.email, e.target.value as VaultPermission)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium bg-transparent cursor-pointer ${roleInfo.color} focus:outline-none`}
                    >
                      <option value="reader">Somente leitura</option>
                      <option value="editor">Editor</option>
                      <option value="owner">Proprietário</option>
                    </select>

                    {/* Remove */}
                    {confirmRemove === user.email ? (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="px-2 py-1 text-xs bg-vault-card border border-vault-border rounded-lg text-vault-textMuted hover:text-vault-text transition-colors"
                        >
                          Não
                        </button>
                        <button
                          onClick={() => { removeSharedUser(user.email); setConfirmRemove(null); }}
                          className="px-2 py-1 text-xs bg-vault-danger/20 border border-vault-danger/30 rounded-lg text-vault-danger font-medium transition-colors"
                        >
                          Sim
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(user.email)}
                        className="p-1.5 text-vault-textMuted hover:text-vault-danger transition-colors flex-shrink-0"
                        title="Remover acesso"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new share */}
          <button
            onClick={() => setShowAddShare(true)}
            className="w-full py-2.5 flex items-center justify-center gap-2 bg-vault-primary/15 hover:bg-vault-primary/25 border border-vault-primary/30 rounded-xl text-vault-primary font-medium text-sm transition-colors"
          >
            <UserPlus size={16} /> Compartilhar com alguém
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper para adicionar novo compartilhamento via ShareModal ──────────────

function AddShareWrapper({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { vault } = useVaultStore();

  // Create a fake "vault" entry to share via the existing ShareModal
  // We share the entire vault concept — type "group" with the first group or a placeholder
  const firstGroup = vault?.groups[0] ?? null;

  if (!firstGroup) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl">
          <p className="text-vault-text font-medium mb-2">Sem grupos para compartilhar</p>
          <p className="text-vault-textMuted text-sm mb-4">
            Crie um grupo primeiro para poder compartilhá-lo com outras pessoas.
          </p>
          <button onClick={onClose} className="w-full py-2.5 bg-vault-primary rounded-xl text-white text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <ShareModal
      target={firstGroup}
      type="group"
      onClose={onDone}
    />
  );
}
