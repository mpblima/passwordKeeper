// ─── Google OAuth2 Credentials ────────────────────────────────────────────────
// As credenciais vêm de variáveis de ambiente (nunca commitar valores reais aqui).
//
// Desenvolvimento local:
//   Copie .env.example → .env e preencha os valores do Google Cloud Console.
//
// CI/CD (GitHub Actions):
//   Configure os GitHub Secrets VITE_GOOGLE_CLIENT_ID e VITE_GOOGLE_CLIENT_SECRET.
//
// Para obter as credenciais:
//   1. console.cloud.google.com → Seu projeto → APIs e Serviços → Credenciais
//   2. ID do cliente OAuth → Tipo: Aplicativo para computador
//   3. URI de redirecionamento autorizado: http://localhost:8899

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "") as string;
export const GOOGLE_CLIENT_SECRET = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "") as string;

// Nome do arquivo do cofre no Google Drive
export const VAULT_DRIVE_FILENAME = "meu-cofre.keep";

// Porta local para o callback OAuth (deve bater com o redirect URI cadastrado no Google Cloud)
export const OAUTH_PORT = 8899;
