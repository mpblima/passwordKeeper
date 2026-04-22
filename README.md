# Password Keeper

Aplicativo multiplataforma de cofre de senhas feito com Tauri, React e TypeScript. Os dados ficam criptografados antes de serem salvos localmente ou enviados ao Google Drive.

## Funcionalidades

- Cofre de senhas com nome, usuario, senha, URL, notas, descricao e icone
- Grupos para organizar credenciais
- Criptografia AES-256-GCM com chave derivada via PBKDF2
- Arquivo local `.keep` criptografado
- Sincronizacao com Google Drive
- Compartilhamento colaborativo via Google Drive
- Permissoes de leitor, editor e proprietario
- Notificacao por email Google ao compartilhar
- Gerador de senhas e indicador de forca
- Interface desktop e mobile via Tauri

## Como Funciona

O Password Keeper salva o cofre como um documento criptografado. A senha mestra nunca e enviada ao Google Drive: ela e usada localmente para derivar a chave que criptografa e descriptografa o conteudo.

O compartilhamento cria um documento colaborativo `.keep` no Drive, com prefixo `pk-collab-`. A pessoa convidada recebe uma notificacao do Google e abre esse documento pelo app em **Abrir compartilhamento**. Enquanto o cofre compartilhado estiver aberto, o app verifica mudancas no Drive periodicamente e aplica atualizacoes quando nao ha edicoes locais pendentes.

## Requisitos

- Node.js 18+
- Rust estavel
- Dependencias do Tauri para sua plataforma
- Projeto Google Cloud com Google Drive API ativada

## Instalacao

```bash
npm install
```

## Ambiente

Copie `.env.example` para `.env` e preencha as credenciais OAuth:

```bash
cp .env.example .env
```

Variaveis usadas:

```env
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-SEU_SECRET_AQUI
```

O arquivo `.env` nao deve ser commitado.

## Desenvolvimento

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Para validar o frontend:

```bash
npm run build
```

Para validar o backend Tauri:

```bash
cd src-tauri
cargo check
```

## Google Drive

Para usar sincronizacao e compartilhamento:

1. Acesse o Google Cloud Console
2. Crie ou selecione um projeto
3. Ative a Google Drive API
4. Crie um OAuth Client ID do tipo Desktop app
5. Configure `http://localhost:8899` como URI de redirecionamento autorizado
6. Coloque o Client ID e Client Secret no `.env`

Em CI/CD, configure os secrets:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_SECRET`

## Compartilhamento

Ao compartilhar uma senha, grupo ou cofre:

1. O app cria um documento colaborativo `.keep` criptografado no Google Drive
2. O documento e compartilhado com o email Google informado
3. O Google envia uma notificacao ao destinatario
4. Voce envia a senha do compartilhamento por outro canal
5. O destinatario abre **Abrir compartilhamento** no app
6. As alteracoes passam a ser sincronizadas pelo Drive

Permissoes:

- **Leitor** pode visualizar
- **Editor** pode criar e editar
- **Proprietario** pode criar, editar, excluir e gerenciar acessos

Observacao: a colaboracao atual e baseada em sincronizacao periodica com o Google Drive. Ela nao e um editor em tempo real com websocket/CRDT como o Google Docs.

## Seguranca

- Senhas sao criptografadas localmente antes de salvar ou enviar ao Drive
- O arquivo no Drive e opaco sem a senha correta
- O app usa AES-256-GCM e PBKDF2 com 310.000 iteracoes
- O token Google nao e persistido no fallback de `localStorage`
- O Tauri usa CSP e permissao HTTP restrita aos endpoints Google necessarios
- Arquivos de segredo e assinatura ficam ignorados pelo Git

Arquivos sensiveis que nao devem ser commitados:

- `.env`
- `client_secret*.json`
- `*.jks`
- `*.keystore`

Se algum segredo ja foi commitado em algum momento, rotacione as credenciais no Google Cloud e gere nova chave de assinatura antes de distribuir builds publicos.

## Release

O workflow principal de release roda ao criar tags `v*` e gera pacotes desktop e Android.

Secrets recomendados para Android:

- `ANDROID_KEYSTORE_B64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_STORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`

Sem esses secrets, o workflow pode gerar uma keystore temporaria, mas updates Android podem exigir reinstalacao porque a assinatura muda.

## Estrutura

```text
password-keeper/
├── src/
│   ├── components/
│   ├── services/
│   ├── store/
│   └── types/
├── src-tauri/
│   ├── capabilities/
│   └── src/
├── public/
├── docs/
└── .github/workflows/
```

## Scripts

```bash
npm run build
npm run tauri dev
npm run tauri build
```
