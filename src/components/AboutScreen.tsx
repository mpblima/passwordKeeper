import { X, ShieldCheck, Lock, Cloud, Share2, Users, Key, Github } from "lucide-react";

interface AboutScreenProps {
  onClose: () => void;
}

const APP_VERSION = "0.1.0";

const FEATURES = [
  {
    icon: <Lock size={18} />,
    title: "Criptografia AES-256-GCM",
    desc: "Todas as senhas são criptografadas localmente com sua senha mestra antes de qualquer armazenamento.",
  },
  {
    icon: <Cloud size={18} />,
    title: "Sincronização com Google Drive",
    desc: "Faça backup e acesse seu cofre de qualquer dispositivo via Google Drive.",
  },
  {
    icon: <Share2 size={18} />,
    title: "Compartilhamento seguro",
    desc: "Compartilhe senhas ou grupos com controle de permissões: leitura, edição ou proprietário.",
  },
  {
    icon: <Users size={18} />,
    title: "Controle de acesso",
    desc: "Somente o proprietário pode excluir senhas. Editores podem solicitar exclusão para revisão.",
  },
  {
    icon: <Key size={18} />,
    title: "Gerador de senhas",
    desc: "Gere senhas fortes e seguras com configurações personalizadas diretamente no aplicativo.",
  },
];

export function AboutScreen({ onClose }: AboutScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-vault-card border border-vault-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-vault-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-vault-primary to-vault-secondary flex items-center justify-center shadow-lg shadow-vault-primary/30">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-vault-text font-bold text-lg leading-tight">Password Keeper</h2>
              <p className="text-vault-textMuted text-sm">Versão {APP_VERSION}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-vault-textMuted hover:text-vault-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Description */}
          <div className="p-4 bg-vault-sidebar border border-vault-border rounded-xl">
            <p className="text-vault-textSecondary text-sm leading-relaxed">
              <strong className="text-vault-text">Password Keeper</strong> é um cofre de senhas seguro e offline-first
              para guardar, organizar e compartilhar credenciais com total controle e privacidade.
              Suas senhas nunca saem do seu dispositivo sem criptografia — nem mesmo para o Google Drive.
            </p>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-vault-textMuted text-xs font-semibold uppercase tracking-wider mb-3">
              Funcionalidades
            </h3>
            <div className="space-y-3">
              {FEATURES.map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-vault-primary/15 flex items-center justify-center flex-shrink-0 text-vault-primary">
                    {feat.icon}
                  </div>
                  <div>
                    <p className="text-vault-text text-sm font-medium">{feat.title}</p>
                    <p className="text-vault-textMuted text-xs mt-0.5 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech info */}
          <div>
            <h3 className="text-vault-textMuted text-xs font-semibold uppercase tracking-wider mb-3">
              Informações técnicas
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Versão", APP_VERSION],
                ["Plataforma", "Tauri 2 (Rust + React)"],
                ["Criptografia", "AES-256-GCM"],
                ["Derivação de chave", "PBKDF2 / 310.000 iterações"],
                ["Armazenamento", "Local (.keep) + Google Drive"],
                ["Autenticação", "OAuth 2.0 PKCE"],
              ].map(([label, value]) => (
                <div key={label} className="p-2.5 bg-vault-sidebar border border-vault-border rounded-lg">
                  <p className="text-vault-textMuted">{label}</p>
                  <p className="text-vault-text font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* License */}
          <div className="flex items-center gap-2 text-xs text-vault-textMuted">
            <Github size={13} />
            <span>Código aberto · Licença MIT</span>
          </div>
        </div>

        <div className="p-6 border-t border-vault-border flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-vault-primary hover:bg-vault-primaryHover rounded-xl text-white font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
