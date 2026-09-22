# Password Keeper — Tarefas de Implementação

## Status do projeto

O núcleo do app está implementado e funcional. As tarefas abaixo são organizadas por
prioridade para alcançar a v1.0 pública.

---

## Bloco 1 — Qualidade e Estabilidade

- [x] 1.1 Criptografia AES-256-GCM com PBKDF2 (legacy + envelope v2)
- [x] 1.2 Store Zustand com gerenciamento de estado completo
- [x] 1.3 Componentes de UI principais (Grid, Sidebar, Forms, Detail)
- [x] 1.4 OAuth 2.0 PKCE desktop (TCP local porta 8899)
- [x] 1.5 OAuth Android via Kotlin JNI (GoogleOAuthManager)
- [x] 1.6 HTTP multiplataforma via native_fetch (reqwest + NativeHttp.kt)
- [x] 1.7 Auto-lock por inatividade (5 min)
- [x] 1.8 Suite de testes de criptografia (Vitest)
- [x] 1.9 Testes de componentes básicos (PasswordDetail, PasswordGrid, ShareModal)

- [x] 1.10 **Compartilhamento colaborativo com arquivo separado (pk-collab-*.keep)**
  - Criado `createSharedDocument` no store — gera arquivo colaborativo independente do cofre principal
  - Envelope v2 multi-slot: owner usa senha mestra, colaborador usa sharePassword
  - `ShareModal` refatorado para usar `createSharedDocument` (não altera mais o arquivo principal)

- [x] 1.11 **Sincronização quasi-realtime via Drive Changes API**
  - Substituídos dois `setInterval` (10s vault + 3s shared) por um único `pollDriveChanges` (5s)
  - A Changes API retorna apenas fileIds alterados — zero downloads desnecessários em ciclos sem mudança
  - `driveChangesToken` persistido entre sessões via Tauri Store

- [x] 1.12 **Correção da criptografia em shared sources**
  - `refreshSharedSources` / `pollDriveChanges` agora usa `decryptVaultEnvelope` (suporta v2 + legado)
  - `syncSharedSource` usa `encryptVaultEnvelope` com keySlots existentes (preserva múltiplos colaboradores)
  - `addSharedSource` aceita `openedEnvelope` com `dataKey` e `keySlots` para re-encriptação correta

- [x] 1.13 **Correção do fluxo de abertura de compartilhamento (colaborador)**
  - `ImportSharedFile` agora chama `addSharedSource` em vez de `unlockVault` (não substitui cofre principal)
  - `MasterPasswordScreen.handleImportDecrypt` corrigido para registrar SharedSource com envelope
  - Ambos inicializam `driveChangesToken` após abrir compartilhamento

- [ ] 1.14 Expandir cobertura de testes do vaultStore
  - Cobrir: `createVault`, `unlockVault`, `addEntry`, `deleteEntry`
  - Cobrir: `createSharedDocument` (criar arquivo, multi-slot, shareFile chamado)
  - Cobrir: `pollDriveChanges` (Changes API, dispatch para shared sources)
  - Cobrir: refresh de token expirado

- [ ] 1.15 Remover arquivos órfãos da raiz do projeto
  - Excluir pastas `Conteúdo do Arquivo \`src/...` e `Conteúdo do Arquivo \`src-tauri/...`
  - Excluir `path/to/filename.js`

- [ ] 1.16 Corrigir CLAUDE.md (diz "There is no test suite" mas há testes)

---

## Bloco 2 — UX e Polimento

- [ ] 2.1 Loading state durante derivação de chave PBKDF2
  - Exibir spinner/progress bar na MasterPasswordScreen enquanto PBKDF2 roda
  - Impedir dupla submissão durante o processo

- [ ] 2.2 Mensagens de erro mais descritivas
  - Distinguir "senha incorreta" de "arquivo corrompido" de "erro de rede"

- [ ] 2.3 Indicador de fonte da entrada (cofre principal vs. compartilhada)
  - Badge visual nos cards de entradas de fontes compartilhadas
  - Tooltip com nome do compartilhamento e papel do usuário

- [ ] 2.4 Confirmação ao fechar formulário com dados não salvos

- [ ] 2.5 Ordenação de entradas (A-Z, por data)

---

## Bloco 3 — Infraestrutura de Release

- [ ] 3.1 Configurar secrets no GitHub
  - `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_ANDROID_CLIENT_ID`
  - `ANDROID_KEYSTORE_B64`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`

- [ ] 3.2 Gerar e testar builds reais por plataforma
  - Linux, Windows, macOS, Android

- [ ] 3.3 Configurar assinatura macOS (Developer ID + notarização)

- [ ] 3.4 Configurar assinatura Windows (certificado de code signing)

- [ ] 3.5 Configurar clientes OAuth de produção (Desktop + Android com keystore final)

---

## Bloco 4 — Verificação OAuth Google (Bloqueador v1.0 Público)

- [ ] 4.1 Decidir estratégia de escopo OAuth
  - **Opção A:** Manter `drive` e completar verificação de segurança do Google
  - **Opção B:** Migrar para `drive.file` + Google Picker
  - **Opção C:** Importação apenas por upload de arquivo (sem listagem global)

- [ ] 4.2 Publicar política de privacidade
- [ ] 4.3 Publicar termos de uso
- [ ] 4.4 Criar página de suporte
- [ ] 4.5 Submeter verificação OAuth ao Google

---

## Bloco 5 — Features Pós-v1.0

- [ ] 5.1 File picker de imagem no Android (atualmente stub)
- [ ] 5.2 Suporte a iOS
- [ ] 5.3 Importação de outros gerenciadores (Bitwarden, 1Password, LastPass, KeePass)
- [ ] 5.4 TOTP (2FA integrado como campo especial)
- [ ] 5.5 Histórico de versões de entrada

---

## Gates de Release (executar antes de criar tag v*)

```bash
npm test -- --run
npm run build
cd src-tauri && cargo check
npm audit --omit=dev
```
