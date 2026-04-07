import { X, Trash2, XCircle, Flag, User } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";

interface DeletionRequestsProps {
  onClose: () => void;
}

export function DeletionRequests({ onClose }: DeletionRequestsProps) {
  const { vault, approveDeletion, rejectDeletion } = useVaultStore();
  const requests = vault?.deletionRequests ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-warning/20 flex items-center justify-center">
              <Flag size={18} className="text-vault-warning" />
            </div>
            <div>
              <h2 className="text-vault-text font-semibold">Solicitações de exclusão</h2>
              <p className="text-vault-textMuted text-sm">{requests.length} pendente(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-vault-success/10 flex items-center justify-center mx-auto mb-3">
                <Flag size={24} className="text-vault-success" />
              </div>
              <p className="text-vault-textSecondary font-medium">Nenhuma solicitação pendente</p>
              <p className="text-vault-textMuted text-sm mt-1">
                Quando um editor solicitar a exclusão de uma senha, aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-vault-textMuted">
                Revisão obrigatória — apenas o proprietário pode aprovar ou rejeitar exclusões.
              </p>
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-vault-sidebar border border-vault-border rounded-xl space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-vault-danger/10 flex items-center justify-center flex-shrink-0">
                      <Trash2 size={16} className="text-vault-danger" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-vault-text font-medium truncate">{req.entryName}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-vault-textMuted">
                        <User size={11} />
                        {req.requestedBy}
                      </div>
                      <p className="text-xs text-vault-textMuted mt-0.5">
                        {new Date(req.requestedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectDeletion(req.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-vault-card border border-vault-border rounded-xl text-vault-textMuted hover:text-vault-text text-sm transition-colors"
                    >
                      <XCircle size={14} /> Recusar
                    </button>
                    <button
                      onClick={() => approveDeletion(req.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-vault-danger/15 border border-vault-danger/30 rounded-xl text-vault-danger hover:bg-vault-danger/25 text-sm font-medium transition-colors"
                    >
                      <Trash2 size={14} /> Aprovar exclusão
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 py-2.5 bg-vault-sidebar border border-vault-border rounded-xl text-vault-textSecondary hover:text-vault-text text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
