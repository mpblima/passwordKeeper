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
//   3. URIs de redirecionamento autorizados:
//      - Desktop:  http://localhost:8899
//      - Mobile:   passwordkeeper://oauth2callback

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "") as string;
export const GOOGLE_CLIENT_SECRET = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "") as string;

// Nome do arquivo do cofre no Google Drive
export const VAULT_DRIVE_FILENAME = "meu-cofre.keep";

// Porta local para o callback OAuth no desktop (deve bater com o redirect URI acima)
export const OAUTH_PORT = 8899;

// Scheme do deep link para OAuth no mobile (reverse client ID — exigido pelo Google no Android)
export const OAUTH_MOBILE_REDIRECT = "com.googleusercontent.apps.288890427052-gp0llktopdorl4mfdf1oj99dprq34ivq:/oauth2redirect";
