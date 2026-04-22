import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { GoogleToken } from "../types/vault";

/**
 * Fetch via tauri-plugin-http (Drive API, userinfo, refresh token).
 * Desktop: reqwest bypassa CORS do WebView.
 * Android: requer que o app tenha permissão de internet nas configurações do MIUI
 *   (Configurações → Apps → Password Keeper → Uso de dados → ativar Wi-Fi e Dados móveis).
 */
async function rustFetch(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<{ ok: boolean; status: number; text: () => string; json: () => unknown }> {
  const response = await tauriFetch(url, { method, headers, body });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text: () => text,
    json: () => JSON.parse(text),
  };
}
import {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ANDROID_CLIENT_ID,
  OAUTH_ANDROID_REDIRECT, VAULT_DRIVE_FILENAME, OAUTH_PORT,
} from "../config";

const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Inicia o fluxo OAuth PKCE.
 * Todas as plataformas → servidor TCP local na porta 8899 + browser externo.
 * No Android, Chrome conecta ao localhost do próprio dispositivo onde o servidor TCP roda.
 */
export async function startOAuthFlow(forceConsent = true): Promise<GoogleToken> {
  if (/android/i.test(navigator.userAgent)) {
    return startOAuthAndroid(forceConsent);
  }
  return startOAuthDesktop(forceConsent);
}

function parseOAuthRedirect(url: string, expectedState: string): string {
  const parsed = new URL(url);
  const params = parsed.searchParams;
  const error = params.get("error");
  if (error) throw new Error(params.get("error_description") ?? error);
  if (params.get("state") !== expectedState) {
    throw new Error("Estado OAuth invalido. Tente conectar novamente.");
  }
  const code = params.get("code");
  if (!code) throw new Error("Codigo OAuth nao recebido.");
  return code;
}

async function exchangeCodeForToken(options: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  clientSecret?: string;
}): Promise<GoogleToken> {
  const body: Record<string, string> = {
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
    code: options.code,
    code_verifier: options.codeVerifier,
  };
  if (options.clientSecret) body.client_secret = options.clientSecret;

  const res = await rustFetch(
    "POST",
    "https://oauth2.googleapis.com/token",
    { "Content-Type": "application/x-www-form-urlencoded" },
    new URLSearchParams(body).toString(),
  );

  if (!res.ok) {
    throw new Error(`Falha no token exchange (${res.status}): ${res.text()}`);
  }
  const data = res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

async function startOAuthAndroid(forceConsent: boolean): Promise<GoogleToken> {
  if (!GOOGLE_ANDROID_CLIENT_ID) {
    throw new Error("Configure VITE_GOOGLE_ANDROID_CLIENT_ID no arquivo .env para usar o Google Drive no Android.");
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: GOOGLE_ANDROID_CLIENT_ID,
    redirect_uri: OAUTH_ANDROID_REDIRECT,
    response_type: "code",
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    ...(forceConsent ? { prompt: "consent" } : {}),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  const code = await new Promise<string>(async (resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error("Tempo esgotado aguardando autorizacao do Google.")));
    }, 120000);

    const handleUrls = (urls: string[]) => {
      for (const url of urls) {
        if (!url.startsWith(OAUTH_ANDROID_REDIRECT)) continue;
        try {
          const receivedCode = parseOAuthRedirect(url, state);
          window.clearTimeout(timeout);
          finish(() => resolve(receivedCode));
        } catch (err) {
          window.clearTimeout(timeout);
          finish(() => reject(err));
        }
      }
    };

    try {
      const unlisten = await onOpenUrl(handleUrls);
      const current = await getCurrent();
      if (current) handleUrls(current);
      await invoke("open_url", { url: authUrl });

      const cleanup = () => { unlisten(); };
      window.setTimeout(cleanup, 121000);
    } catch (err) {
      window.clearTimeout(timeout);
      finish(() => reject(err));
    }
  });

  return exchangeCodeForToken({
    code,
    codeVerifier: verifier,
    clientId: GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: OAUTH_ANDROID_REDIRECT,
  });
}

// ─── Desktop OAuth (TCP listener) ─────────────────────────────────────────────

async function startOAuthDesktop(forceConsent: boolean): Promise<GoogleToken> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const redirectUri = `http://localhost:${OAUTH_PORT}`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    ...(forceConsent ? { prompt: "consent" } : {}),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // O Chrome (browser externo) faz o token exchange — bypassa restrições de rede do app.
  // start_oauth retorna o token JSON diretamente.
  const tokenJson = await invoke<string>("start_oauth", {
    authUrl,
    port: OAUTH_PORT,
    codeVerifier: verifier,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri,
    expectedState: state,
  });

  const data = JSON.parse(tokenJson) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

// ─── Refresh token ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<GoogleToken> {
  const body: Record<string, string> = {
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };

  const res = await rustFetch(
    "POST",
    "https://oauth2.googleapis.com/token",
    { "Content-Type": "application/x-www-form-urlencoded" },
    new URLSearchParams(body).toString(),
  );

  if (!res.ok) throw new Error("Falha ao renovar token. Faça login novamente.");
  const data = res.json() as { access_token: string; expires_in: number; token_type: string };
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

export async function getUserInfo(accessToken: string): Promise<{ email: string; name: string; picture: string }> {
  const res = await rustFetch("GET", "https://www.googleapis.com/oauth2/v2/userinfo", { Authorization: `Bearer ${accessToken}` });
  if (!res.ok) throw new Error("Falha ao obter informações do usuário");
  return res.json() as { email: string; name: string; picture: string };
}

// ─── Drive API ────────────────────────────────────────────────────────────────

async function authHeaders(token: GoogleToken) {
  return { Authorization: `Bearer ${token.access_token}` };
}

export async function findVaultFile(token: GoogleToken): Promise<string | null> {
  const files = await findAllVaultFiles(token);
  return files[0]?.id ?? null;
}

/** Returns all .keep files the user has access to in Drive. */
export async function findAllVaultFiles(token: GoogleToken): Promise<{ id: string; name: string }[]> {
  const headers = await authHeaders(token);
  const query = encodeURIComponent(`name contains '.keep' and not name contains 'pk-collab-' and trashed=false`);
  const res = await rustFetch("GET", `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name`, headers);
  if (!res.ok) throw new Error("Erro ao buscar arquivos no Drive");
  const data = res.json() as { files?: { id: string; name: string }[] };
  return (data.files ?? []);
}

/** Returns collaborative .keep files shared with the user or owned by them. */
export async function findAllCollaborativeVaultFiles(token: GoogleToken): Promise<{ id: string; name: string }[]> {
  const headers = await authHeaders(token);
  const query = encodeURIComponent(`name contains 'pk-collab-' and name contains '.keep' and trashed=false`);
  const res = await rustFetch("GET", `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime desc`, headers);
  if (!res.ok) throw new Error("Erro ao buscar compartilhamentos no Drive");
  const data = res.json() as { files?: { id: string; name: string }[] };
  return (data.files ?? []);
}

export async function getFileVersion(token: GoogleToken, fileId: string): Promise<string> {
  const headers = await authHeaders(token);
  const res = await rustFetch("GET", `https://www.googleapis.com/drive/v3/files/${fileId}?fields=headRevisionId,modifiedTime`, headers);
  if (!res.ok) throw new Error("Erro ao verificar versão do arquivo no Drive");
  const data = res.json() as { headRevisionId?: string; modifiedTime?: string };
  return data.headRevisionId ?? data.modifiedTime ?? "";
}

export async function downloadVaultFile(token: GoogleToken, fileId: string): Promise<string> {
  const headers = await authHeaders(token);
  const res = await rustFetch("GET", `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, headers);
  if (!res.ok) throw new Error("Erro ao baixar cofre do Drive");
  return res.text();
}

export async function uploadVaultFile(
  token: GoogleToken,
  content: string,
  existingFileId?: string
): Promise<string> {
  const headers = await authHeaders(token);

  if (existingFileId) {
    // Update existing file
    const res = await rustFetch(
      "PATCH",
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      { ...headers, "Content-Type": "application/octet-stream" },
      content,
    );
    if (!res.ok) throw new Error(`Erro ao atualizar cofre no Drive (${res.status}): ${res.text()}`);
    return existingFileId;
  } else {
    // Create new file (multipart upload)
    const metadata = JSON.stringify({ name: VAULT_DRIVE_FILENAME, mimeType: "application/octet-stream" });
    const boundary = "vault_boundary_" + crypto.randomUUID().replace(/-/g, "");
    const multipart = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/octet-stream",
      "",
      content,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await rustFetch(
      "POST",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      multipart,
    );
    if (!res.ok) throw new Error(`Erro ao criar cofre no Drive (${res.status}): ${res.text()}`);
    const data = res.json() as { id: string };
    return data.id;
  }
}

export async function shareFile(
  token: GoogleToken,
  fileId: string,
  email: string,
  role: "reader" | "writer" = "reader",
  emailMessage?: string,
): Promise<void> {
  const headers = await authHeaders(token);
  const res = await rustFetch(
    "POST",
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`,
    { ...headers, "Content-Type": "application/json" },
    JSON.stringify({ role, type: "user", emailAddress: email, ...(emailMessage ? { emailMessage } : {}) }),
  );
  if (!res.ok) {
    const err = res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Erro ao compartilhar arquivo");
  }
}

export async function createSharedVaultFile(
  token: GoogleToken,
  content: string,
  fileName: string
): Promise<string> {
  const headers = await authHeaders(token);
  const metadata = JSON.stringify({ name: fileName, mimeType: "application/octet-stream" });
  const boundary = "vault_share_" + crypto.randomUUID().replace(/-/g, "");
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/octet-stream",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await rustFetch(
    "POST",
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  );
  if (!res.ok) throw new Error("Erro ao criar arquivo compartilhado");
  const data = res.json() as { id: string };
  return data.id;
}
