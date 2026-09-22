# Password Keeper — Design

## Arquitetura Geral

O app segue uma arquitetura em camadas com separação clara entre UI, estado, serviços e plataforma:

```
┌─────────────────────────────────────────────────┐
│  React UI (componentes Tailwind + Lucide)        │
├─────────────────────────────────────────────────┤
│  Zustand Store (vaultStore.ts)                   │
│  — toda a lógica de negócio e estado global      │
├─────────┬───────────────────────────────────────┤
│ crypto  │ googleDrive │ localFile │ storage      │
│ .ts     │ .ts         │ .ts       │ .ts          │
├─────────┴───────────────────────────────────────┤
│  Tauri Commands (Rust — lib.rs)                  │
│  native_fetch │ write_file │ start_oauth │ …     │
├──────────────────────┬──────────────────────────┤
│  Desktop (reqwest)   │  Android (Kotlin JNI)    │
│                      │  NativeHttp + OAuthMgr   │
└──────────────────────┴──────────────────────────┘
```

---

## Modelo de Dados

### `VaultData` — o cofre em memória (decriptografado)
```typescript
interface VaultData {
  version: string;
  owner: string;               // email do dono
  collaboration?: VaultCollaboration;
  sharedWith: SharedUser[];
  deletionRequests: DeletionRequest[];
  groups: PasswordGroup[];
  entries: PasswordEntry[];
}
```

### `PasswordEntry`
```typescript
interface PasswordEntry {
  id: string;
  sourceEntryId?: string;      // ID na fonte compartilhada original
  sharedSourceId?: string;     // ID do SharedSource pai
  name: string;
  description: string;
  icon: string;                // emoji
  username: string;
  password: string;
  url?: string;
  notes?: string;
  groupId?: string;
  favorite?: boolean;
  createdBy?: string;
  createdAt: string;           // ISO 8601
  updatedAt: string;
}
```

### `SharedSource` — fonte compartilhada em memória
```typescript
interface SharedSource {
  id: string;
  fileId: string;              // Google Drive file ID
  name: string;
  owner: string;
  role: VaultPermission;       // "owner" | "editor" | "reader"
  collaboration?: VaultCollaboration;
  sharedWith: SharedUser[];
  password: string;            // senha de abertura do compartilhamento
  revision: string | null;     // Drive revision para evitar re-download
  lastSyncAt: string | null;
  groups: PasswordGroup[];
  entries: PasswordEntry[];
}
```

### Arquivo `.keep` em disco
```json
{
  "format": "password-keeper-envelope",
  "version": 2,
  "payload": {
    "iv": "<base64>",
    "data": "<base64 ciphertext AES-256-GCM>"
  },
  "keySlots": [
    {
      "id": "<uuid>",
      "salt": "<base64>",
      "iv": "<base64>",
      "encryptedKey": "<base64 dataKey criptografada com a senha>",
      "createdAt": "<ISO 8601>"
    }
  ]
}
```

---

## Criptografia

### Derivação de chave (PBKDF2)
```
senha_mestra → PBKDF2(SHA-256, salt=16B aleatórios, iterations=310_000) → CryptoKey AES-256
```

### Fluxo de encriptação (Envelope v2)
```
1. gerar dataKey = 32 bytes aleatórios
2. para cada senha autorizada:
   deriveKey(senha, salt) → passwordKey
   passwordKey.encrypt(dataKey) → keySlot.encryptedKey
3. dataKey.encrypt(plaintext) → payload.data
4. serializar envelope JSON
```

### Fluxo de decriptação
```
1. para cada keySlot:
   tentar deriveKey(senha, slot.salt) → passwordKey
   tentar passwordKey.decrypt(slot.encryptedKey) → dataKey
   dataKey.decrypt(payload.data) → plaintext
2. primeiro slot que decriptar com sucesso → retorna plaintext + dataKey
3. nenhum slot → lança erro "Senha incorreta"
```

### Legado (v1)
```
[16B salt][12B iv][N bytes ciphertext] → concatenados e encodados em base64
```

---

## Estado Global (Zustand)

O store em `src/store/vaultStore.ts` gerencia:

| Slice | Tipo | Descrição |
|-------|------|-----------|
| `isLocked` | `boolean` | Cofre bloqueado ou desbloqueado |
| `masterPassword` | `string` | Senha mestra em memória (nunca persistida) |
| `dataKey` | `string \| null` | Chave de dados base64 (envelope v2) |
| `keySlots` | `VaultKeySlot[]` | Slots do envelope atual |
| `vault` | `VaultData \| null` | Dados descriptografados em memória |
| `sharedSources` | `SharedSource[]` | Fontes colaborativas carregadas |
| `googleToken` | `GoogleToken \| null` | Token OAuth em memória |
| `localVaultPath` | `string \| null` | Caminho do arquivo local |
| `driveFileId` | `string \| null` | ID do arquivo no Drive |
| `isDirty` | `boolean` | Mudanças não salvas pendentes |
| `isSyncing` | `boolean` | Operação de sync em andamento |
| `syncError` | `string \| null` | Última mensagem de erro de sync |
| `selectedEntryId` | `string \| null` | Entrada selecionada na UI |
| `selectedGroupId` | `string \| null` | Grupo ativo na sidebar |
| `activeView` | `"all" \| "favorites" \| "group"` | View atual |
| `viewMode` | `"grid" \| "list"` | Modo de exibição |
| `searchQuery` | `string` | Texto de busca atual |

---

## Fluxo OAuth — Desktop

```
1. usuário clica "Conectar Google Drive"
2. frontend invoca comando Tauri `start_oauth`
3. Rust abre navegador do sistema com URL de autorização
4. Rust inicia listener TCP na porta 8899
5. Google redireciona para http://localhost:8899/callback?code=...
6. HTML servido pela porta 8899 troca o code por tokens via fetch
7. Página posta tokens de volta ao listener Rust via POST /token
8. Rust retorna tokens para o frontend via `invoke`
9. frontend persiste tokens no Tauri Store
```

### Desktop — PKCE
- `code_verifier`: 64 bytes aleatórios, base64url
- `code_challenge`: SHA-256 do verifier, base64url
- Redirect URI: `http://localhost:8899`

## Fluxo OAuth — Android

```
1. usuário clica "Conectar Google Drive"
2. frontend invoca `start_oauth_android_native`
3. Rust chama `GoogleOAuthManager.startOAuth()` via JNI
4. Kotlin abre Chrome Custom Tab com URL de autorização
5. Deep link `passwordkeeper://oauth` captura o redirect
6. Kotlin extrai o code, troca por tokens via HttpURLConnection
7. Kotlin retorna tokens para Rust via callback JNI
8. frontend recebe tokens e persiste no Tauri Store
```

---

## Fluxo de Compartilhamento

```
Proprietário                              Colaborador
    │                                          │
    │ 1. Cria documento compartilhado          │
    │    (copia entradas/grupos selecionados)  │
    │                                          │
    │ 2. Gera senha de compartilhamento         │
    │                                          │
    │ 3. Cria envelope multi-slot:             │
    │    slot_owner(masterPassword)            │
    │    slot_editor(sharePassword)            │
    │                                          │
    │ 4. Sobe pk-collab-<id>.keep no Drive     │
    │                                          │
    │ 5. Compartilha o fileId via Drive API    │
    │    (permissão "reader" para todos)       │
    │                                          │
    │ 6. Envia a sharePassword ao colaborador  │
    │    (fora do app — e-mail, etc.)          │
    │                                          │
    │                    7. Colaborador abre   │
    │                       ImportSharedFile  │
    │                                          │
    │                    8. Insere fileId +   │
    │                       sharePassword     │
    │                                          │
    │                    9. App baixa e abre  │
    │                       o arquivo com     │
    │                       sharePassword     │
    │                                          │
    │ 10. Polling 3s detecta mudanças ────────▶│
    │     de editores                          │
    │ ◀──────────────── 11. Editor salva      │
    │                        mudanças         │
```

### Namespacing de IDs
- Entradas de fontes compartilhadas têm IDs no formato: `shared:<sourceId>:entry:<originalId>`
- Grupos: `shared:<sourceId>:group:<originalId>`
- Isso evita colisões ao renderizar listas mescladas do cofre principal + fontes

---

## Componentes UI

### Hierarquia de componentes
```
App
├── MasterPasswordScreen       ← tela de lock (10+ modos de abertura)
└── [desbloqueado]
    ├── AppMenuBar              ← menu nativo (Arquivo/Utilitários/Ajuda)
    │   └── [modais via menu]
    │       ├── GoogleDriveModal
    │       ├── BackupModal
    │       ├── ChangePasswordModal
    │       ├── SharedUsersModal
    │       ├── DeletionRequests
    │       └── AboutScreen
    ├── [banners de status]     ← sync error, pending sync, shared notice
    ├── Sidebar
    │   ├── grupos (GroupForm como inline form)
    │   └── shared sources
    └── main
        ├── PasswordGrid
        │   ├── [cards/lista de entradas]
        │   └── PasswordDetail  ← painel lateral direito
        └── PasswordForm        ← modal de criação/edição
            └── IconPicker
```

### `MasterPasswordScreen` — modos de operação
| Modo | Descrição |
|------|-----------|
| `quick` | Inserir senha para abrir cofre já carregado |
| `new` | Criar novo cofre (nome + senha + confirmação) |
| `pick-local` | Selecionar arquivo `.keep` local |
| `pick-drive` | Listar e abrir arquivos `.keep` do Drive |
| `open-local` | Inserir senha para arquivo local selecionado |
| `open-drive` | Inserir senha para arquivo Drive selecionado |
| `sharing` | Abrir arquivo compartilhado (fileId + sharePassword) |
| `import-shared` | Importar fonte compartilhada existente |

---

## Persistência Dual

```
write(key, value):
  1. TauriStore.set(key, value)   ← primário, assíncrono, seguro
  2. localStorage.setItem(key, value)  ← fallback de cold start

read(key):
  1. TauriStore.get(key)          ← tenta primeiro
  2. if null → localStorage.getItem(key)  ← fallback

Exceção: GoogleToken
  1. APENAS TauriStore.set()      ← nunca em localStorage
  2. read: APENAS TauriStore.get()
```

---

## HTTP Multiplataforma

```
Frontend (TypeScript)
    │  invoke("native_fetch", { method, url, headers, body })
    ▼
Tauri Command: native_fetch (Rust — lib.rs)
    │
    ├── [desktop]  → reqwest::Client
    │                  → response body String
    │
    └── [android]  → android_http_request()
                       → JNI call to NativeHttp.kt
                           → HttpURLConnection
                           → response body String
```

---

## Polling e Auto-save

```
isDirty = true
    │
    ├── setTimeout 5s
    │   └── saveToLocalFile() se localVaultPath ou android
    │   └── syncToCloud() se googleToken e não isOwnerOfCollabVault
    │
setInterval 10s (quando não bloqueado + googleToken + driveFileId)
    └── refreshFromCloudIfChanged()
        └── se revision mudou → baixar + decriptar + mergedVault

setInterval 3s (quando não bloqueado + googleToken)
    └── refreshSharedSources()
        └── para cada SharedSource com fileId
            └── se revision mudou → baixar + decriptar + atualizar source
```

---

## Segurança — Decisões de Design

| Decisão | Justificativa |
|---------|---------------|
| Senha mestra nunca persistida | Compromisso do armazenamento não expõe a vault |
| PBKDF2 310.000 iterações | Acima do mínimo NIST 2023; brute-force impraticável |
| Clipboard auto-clear: 30s senha / 60s usuário | Janela mínima de exposição |
| Tokens Google apenas no Tauri Store | `localStorage` é acessível por qualquer JS; Tauri Store tem proteção de processo |
| Envelope multi-slot | Permite colaboração sem re-encriptação do payload principal |
| Salt e IV únicos por arquivo | Garante que dois arquivos com a mesma senha produzam ciphertexts diferentes |
| Android HTTP via Kotlin | Contorna limitação de DNS em threads NDK do Android |

---

## Escopo OAuth — Decisão Pendente

O app atualmente usa `https://www.googleapis.com/auth/drive` (escopo completo) para:
- Listar arquivos `.keep` existentes do usuário
- Abrir arquivos compartilhados diretamente pelo Drive

Para v1.0, três alternativas:
1. **Manter `drive`** e completar verificação OAuth do Google (requer política de privacidade + revisão de segurança)
2. **Migrar para `drive.file`** + implementar Google Picker para seleção de arquivos
3. **Importação explícita** por download de arquivo, eliminando dependência de listagem global

**Recomendação:** opção 3 minimiza o escopo OAuth e elimina a necessidade de verificação de segurança do Google para uso público.
