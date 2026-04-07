# 🔐 Password Keeper

Aplicativo de cofre de senhas seguro, multiplataforma, construído com Tauri + React.

## Funcionalidades

- ✅ Armazenar senhas com nome, descrição e ícone personalizado
- ✅ Organizar em grupos (com ícone e descrição)
- ✅ Sincronização com Google Drive (arquivo criptografado)
- ✅ Compartilhar senhas individuais ou grupos via Google Drive
- ✅ Criptografia AES-256-GCM com chave derivada via PBKDF2
- ✅ Gerador de senhas integrado
- ✅ Indicador de força de senha
- ✅ Interface escura e moderna
- ✅ Visualização em grade ou lista

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (última versão estável)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/)

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run tauri dev
```

## Build de produção

```bash
npm run tauri build
```

---

## Configuração do Google Drive

Para usar a sincronização com o Google Drive, você precisa criar credenciais OAuth2:

### 1. Criar projeto no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google Drive API**

### 2. Criar credenciais OAuth2

1. Vá em **APIs e Serviços → Credenciais**
2. Clique em **Criar Credenciais → ID do cliente OAuth**
3. Selecione **Aplicativo para computador (Desktop app)**
4. Adicione `http://localhost:8899` como URI de redirecionamento autorizado
5. Copie o **Client ID** gerado

### 3. Configurar no app

1. Abra o Password Keeper
2. Clique em **Google Drive** na barra lateral
3. Clique no ícone ⚙️ de configurações
4. Cole o **Client ID** e salve
5. Clique em **Conectar com Google**

---

## Segurança

- Todas as senhas são criptografadas localmente **antes** de serem enviadas ao Drive
- A criptografia usa **AES-256-GCM** com chave derivada via **PBKDF2** (310.000 iterações)
- A senha mestra **nunca** sai do seu dispositivo
- O arquivo no Drive é opaco — sem a senha mestra, é impossível descriptografar

## Compartilhamento

Ao compartilhar um item ou grupo:
1. Um arquivo separado e criptografado é criado no seu Drive
2. Você define uma **senha de compartilhamento** diferente da senha mestra
3. O arquivo é compartilhado via Google Drive com o email indicado
4. Você envia a senha de compartilhamento por outro canal (WhatsApp, etc.)
5. O destinatário abre o arquivo com o Password Keeper e digita a senha

## Estrutura do projeto

```
password-keeper/
├── src/                   # Frontend React + TypeScript
│   ├── components/        # Componentes UI
│   ├── services/          # crypto.ts, googleDrive.ts
│   ├── store/             # Zustand state
│   └── types/             # TypeScript types
└── src-tauri/             # Backend Rust + Tauri
    └── src/
        └── lib.rs         # Comandos Tauri (OAuth, etc.)
```
