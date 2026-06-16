# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run in development (full Tauri desktop app)
npm run tauri dev

# Validate frontend only (TypeScript + Vite build)
npm run build

# Validate Rust backend only
cd src-tauri && cargo check

# Build for release
npm run tauri build
```

There is no test suite. TypeScript type-checking (`tsc`) is the primary correctness gate for the frontend.

## Environment

Copy `.env.example` to `.env` and fill in Google OAuth credentials before running:

```env
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Google Cloud Console setup: create a **Desktop app** OAuth Client ID with `http://localhost:8899` as the authorized redirect URI.

## Architecture

**Stack:** Tauri 2 (Rust backend) + React 18 + TypeScript + Zustand + Tailwind CSS. Vite is the frontend build tool.

### Data flow

The vault is a `VaultData` JSON document (defined in `src/types/vault.ts`) that is **always encrypted before leaving memory** — encryption happens in `src/services/crypto.ts` using AES-256-GCM with a key derived via PBKDF2 (310 000 iterations). The encrypted blob is stored as a `.keep` file locally or on Google Drive.

The master password is held in memory inside `useVaultStore` (Zustand) and never persisted anywhere.

### State management

All application state lives in a single Zustand store: `src/store/vaultStore.ts`. It manages:
- Auth/lock state and master password
- The decrypted `VaultData` in memory
- Google token and Drive file references
- `sharedSources[]` — vaults received via collaborative sharing
- UI state (selected entry/group, view mode, search query)

Persistence uses a dual-write strategy: `@tauri-apps/plugin-store` (reliable, async) plus `localStorage` as a synchronous cold-start fallback. Sensitive keys (Google token) are written only to the Tauri store, never to `localStorage`.

### Tauri commands (Rust side)

`src-tauri/src/lib.rs` exposes these Tauri commands to the frontend:

| Command | Purpose |
|---|---|
| `start_oauth` | Opens browser, runs OAuth PKCE flow via local TCP server on port 8899 |
| `start_oauth_android_native` | Android-only OAuth via Kotlin `GoogleOAuthManager` (JNI) |
| `native_fetch` | HTTP proxy — desktop uses `reqwest`, Android delegates to Kotlin `NativeHttp` via JNI |
| `write_file` / `read_file` | Vault file I/O |
| `get_default_vault_path` | Returns `<app_data_dir>/meu-cofre.keep` |
| `pick_and_read_image` | Desktop file picker for icons (stub on Android) |
| `open_url` | Opens URL in system browser |
| `exit_app` | Terminates the process |

**Android networking:** Android NDK threads cannot do DNS resolution, so all HTTP goes through Kotlin via JNI (`NativeHttp.kt` / `HttpURLConnection`). The OAuth flow on desktop works by serving an HTML page to Chrome that performs the token exchange itself (Chrome has unrestricted network access), then posts the token back to the local TCP listener.

### Google Drive sync

`src/services/googleDrive.ts` handles all Drive API calls via `native_fetch`. The vault file is named `meu-cofre.keep`. Collaborative shares are named `pk-collab-<documentId>.keep`.

Auto-save fires 5 seconds after any `isDirty` change (see `App.tsx`). The Drive revision header is tracked to avoid redundant downloads. Shared sources are polled every 3 seconds; the main vault is polled every 10 seconds for remote changes.

### Sharing model

A shared document is a separate encrypted `.keep` file on Drive with its own password. IDs for entries and groups from shared sources are namespaced as `shared:<sourceId>:entry:<id>` and `shared:<sourceId>:group:<id>` to avoid collisions with the main vault. Owners see merged updates from collaborators; editors write directly to the shared file. Readers are read-only.

### Release

Releases are triggered by pushing a `v*` tag. The GitHub Actions workflow (`release.yml`) builds for Linux, Windows, macOS, and Android. Android signing uses the `ANDROID_KEYSTORE_B64` secret (Base64-encoded `.jks`); if absent, a temporary keystore is generated.
