import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { GoogleToken } from "../types/vault";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, VAULT_DRIVE_FILENAME, OAUTH_PORT, OAUTH_MOBILE_REDIRECT } from "../config";

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
 * Starts the OAuth PKCE flow and opens the browser.
 * `forceConsent` should be true only the very first time (to obtain a refresh_token).
 *
 * - Desktop: opens browser + TCP listener on localhost:8899, waits for redirect.
 * - Mobile: opens browser → waits for deep link `passwordkeeper://oauth2callback`.
 */
export async function startOAuthFlow(forceConsent = true): Promise<GoogleToken> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  const os = await platform();
  const isMobile = os === "android" || os === "ios";
  const redirectUri = isMobile ? OAUTH_MOBILE_REDIRECT : `http://localhost:${OAUTH_PORT}`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    // Only force consent screen on first login so we get a refresh_token.
    ...(forceConsent ? { prompt: "consent" } : {}),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  let queryString: string;

  if (isMobile) {
    // ── Mobile: open browser, wait for deep link callback ──────────────────
    queryString = await new Promise<string>((resolve, reject) => {
      let unlistenFn: (() => void) | null = null;

      const timer = setTimeout(() => {
        if (unlistenFn) unlistenFn();
        reject(new Error("Tempo esgotado aguardando autorização do Google"));
      }, 120_000);

      // Register listener BEFORE opening browser to avoid race condition
      onOpenUrl((urls) => {
        const callbackUrl = urls.find((u) => u.startsWith("passwordkeeper://oauth2callback"));
        if (!callbackUrl) return;

        clearTimeout(timer);
        if (unlistenFn) unlistenFn();

        try {
          const url = new URL(callbackUrl);
          if (url.searchParams.get("error")) {
            reject(new Error("Autorização cancelada pelo usuário"));
          } else {
            resolve(url.search.slice(1)); // query string without leading '?'
          }
        } catch (e) {
          reject(e);
        }
      })
        .then((fn) => {
          unlistenFn = fn;
          // Now open browser (returns "__mobile_deep_link__" sentinel)
          return invoke<string>("start_oauth", { authUrl, port: 0 });
        })
        .catch((err) => {
          clearTimeout(timer);
          if (unlistenFn) unlistenFn();
          reject(err);
        });
    });
  } else {
    // ── Desktop: TCP listener on localhost ─────────────────────────────────
    queryString = await invoke<string>("start_oauth", { authUrl, port: OAUTH_PORT });
  }

  const callbackParams = new URLSearchParams(queryString);
  const code = callbackParams.get("code");
  const returnedState = callbackParams.get("state");

  if (!code) throw new Error("Código de autorização não recebido");
  if (returnedState !== state) throw new Error("State inválido");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Falha ao obter token: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
    token_type: tokenData.token_type,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleToken> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Falha ao renovar token. Faça login novamente.");
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

export async function getUserInfo(accessToken: string): Promise<{ email: string; name: string; picture: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Falha ao obter informações do usuário");
  return res.json();
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
  const query = encodeURIComponent(`name contains '.keep' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name`,
    { headers }
  );
  if (!res.ok) throw new Error("Erro ao buscar arquivos no Drive");
  const data = await res.json();
  return (data.files ?? []) as { id: string; name: string }[];
}

/** Returns all .pks share files accessible to the user (own + shared with them). */
export async function findAllShareFiles(token: GoogleToken): Promise<{ id: string; name: string }[]> {
  const headers = await authHeaders(token);
  const query = encodeURIComponent(`name contains '.pks' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name`,
    { headers }
  );
  if (!res.ok) throw new Error("Erro ao buscar compartilhamentos no Drive");
  const data = await res.json();
  return (data.files ?? []) as { id: string; name: string }[];
}

export async function downloadVaultFile(token: GoogleToken, fileId: string): Promise<string> {
  const headers = await authHeaders(token);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers }
  );
  if (!res.ok) throw new Error("Erro ao baixar cofre do Drive");
  return res.text();
}

export async function uploadVaultFile(
  token: GoogleToken,
  content: string,
  existingFileId?: string
): Promise<string> {
  const headers = await authHeaders(token);
  const blob = new Blob([content], { type: "application/octet-stream" });

  if (existingFileId) {
    // Update existing file
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      { method: "PATCH", headers, body: blob }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro ao atualizar cofre no Drive (${res.status}): ${errText}`);
    }
    return existingFileId;
  } else {
    // Create new file (multipart upload)
    const metadata = JSON.stringify({ name: VAULT_DRIVE_FILENAME, mimeType: "application/octet-stream" });
    const boundary = "vault_boundary_" + crypto.randomUUID().replace(/-/g, "");
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

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro ao criar cofre no Drive (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.id;
  }
}

export async function shareFile(
  token: GoogleToken,
  fileId: string,
  email: string,
  role: "reader" | "writer" = "reader"
): Promise<void> {
  const headers = await authHeaders(token);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ role, type: "user", emailAddress: email }),
  });
  if (!res.ok) {
    const err = await res.json();
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

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error("Erro ao criar arquivo compartilhado");
  const data = await res.json();
  return data.id;
}
