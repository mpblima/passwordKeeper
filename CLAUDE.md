# CLAUDE.md

This file provides guidance to AI agents working with code in this repository.

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

# Run test suite
npm test -- --run

# Build for release
npm run tauri build
```

## Environment

Copy `.env.example` to `.env` and fill in Google OAuth credentials before running:

```env
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-...
VITE_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com  # Android only
```

Google Cloud Console setup: create a **Desktop app** OAuth Client ID with `http://localhost:8899` as the authorized redirect URI.

## Tests

Vitest + `@testing-library/react` + happy-dom. Tests live in:
- `src/services/crypto.test.ts` — AES-256-GCM, PBKDF2, envelope v1/v2
- `src/__tests__/App.test.tsx` — auto-lock, polling behaviour
- `src/components/__tests__/` — PasswordDetail, PasswordGrid, ShareModal

Run: `npm test -- --run` (single pass) or `npm run test:watch` (watch mode).

## Architecture

**Stack:** Tauri 2 (Rust backend) + React 18 + TypeScript + Zustand + Tailwind CSS. Vite is the frontend build tool.

### Data flow

The vault is a `VaultData` JSON document (defined in `src/types/vault.ts`) that is **always encrypted before leaving memory** — encryption happens in `src/services/crypto.ts` using AES-256-GCM with a key derived via PBKDF2 (310 000 iterations). The encrypted blob is stored as a `.keep` file locally or on Google Drive.

The master password is held in memory inside `useVaultStore` (Zustand) and never persisted anywhere.

### State management

All application state lives in a single Zustand store: `src/store/vaultStore.ts`. It manages:
- Auth/lock state and master password
- The decrypted `VaultData` in memory
- Google token, Drive file references, and Drive Changes API token (`driveChangesToken`)
- `sharedSources[]` — collaborative vaults received via sharing (separate `.keep` files on Drive)
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

`src/services/googleDrive.ts` handles all Drive API calls via `native_fetch`. The main vault file is named `meu-cofre.keep`. Collaborative shares are named `pk-collab-<documentId>.keep`.

Auto-save fires 5 seconds after any `isDirty` change (see `App.tsx`). Drive changes are detected via the **Drive Changes API** (`GET /drive/v3/changes`) with a persistent `pageToken`. A single `pollDriveChanges` interval (5 s) covers both the main vault and all shared sources — it only downloads a file when its `fileId` appears in the changes list, so idle cycles are near-zero cost.

### Sharing model

A shared document is a **separate** encrypted `pk-collab-<uuid>.keep` file on Drive encrypted with an **envelope v2 multi-slot**: one key slot for the owner (master password) and one for each collaborator (share password). The main vault file is never exposed to collaborators.

IDs for entries and groups from shared sources are namespaced as `shared:<sourceId>:entry:<id>` and `shared:<sourceId>:group:<id>` to avoid collisions with the main vault. Owners see merged updates from collaborators; editors write directly to the shared file. Readers are read-only.

### Encryption formats

- **Envelope v2 (current):** JSON `{ format, version: 2, payload: { iv, data }, keySlots[] }` — multi-password support via key slots.
- **Legacy v1:** raw `[16B salt][12B iv][ciphertext]` concatenated and base64-encoded. Read-only; new files always use v2.

### Release

Releases are triggered by pushing a `v*` tag. The GitHub Actions workflow (`release.yml`) builds for Linux, Windows, macOS, and Android. Android signing uses the `ANDROID_KEYSTORE_B64` secret (Base64-encoded `.jks`); if absent, a temporary keystore is generated.

Security pipeline (`security.yml`) runs on every PR and push to master: `npm audit` (SCA) + Gitleaks (secret scan). SAST/SCA via Aikido is handled by the native GitHub PR Gating integration (no CI minutes consumed).
