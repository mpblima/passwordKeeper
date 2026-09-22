# Password Keeper — Requisitos

## Visão Geral

Password Keeper é um gerenciador de senhas multiplataforma (desktop e Android) com cofre criptografado localmente. Os dados nunca saem do dispositivo em texto claro — a senha mestra deriva a chave AES e jamais é transmitida ou persistida. O app oferece sincronização e compartilhamento colaborativo opcionais via Google Drive.

**Versão alvo:** 1.0 (produção pública)  
**Plataformas:** Linux, Windows, macOS, Android  
**Stack:** Tauri 2 (Rust) + React 18 + TypeScript + Zustand + Tailwind CSS

---

## RF-01 — Cofre Local

### RF-01.1 Criação de Cofre
- O usuário deve poder criar um novo cofre protegido por senha mestra
- A senha mestra deve ter mínimo de 8 caracteres
- O cofre recém-criado é salvo como arquivo `.keep` no dispositivo

### RF-01.2 Abertura de Cofre
- O usuário pode abrir um cofre local (`.keep`) via seletor de arquivo
- A senha mestra correta descriptografa o cofre em memória
- Senha incorreta deve exibir mensagem de erro sem revelar informações sobre a chave

### RF-01.3 Auto-lock por Inatividade
- O cofre deve ser bloqueado automaticamente após 5 minutos sem interação do usuário
- Eventos de atividade: mouse, teclado, scroll, toque
- Ao bloquear, o estado em memória (senha mestra e dados descriptografados) é limpo

### RF-01.4 Bloqueio Manual
- O usuário pode bloquear o cofre manualmente a qualquer momento via menu

---

## RF-02 — Criptografia

### RF-02.1 Algoritmo
- Todos os dados em repouso devem ser criptografados com AES-256-GCM
- A chave é derivada da senha mestra via PBKDF2-SHA256 com 310.000 iterações
- Cada arquivo usa salt e IV gerados aleatoriamente

### RF-02.2 Formato Envelope v2
- O formato padrão é o envelope multi-slot: payload único + array de `keySlots`
- Cada key slot contém a chave de dados (`dataKey`) criptografada com uma senha diferente (mestra ou de compartilhamento)
- Permite que múltiplas senhas abram o mesmo cofre sem re-encriptar o payload

### RF-02.3 Compatibilidade Legada
- O sistema deve suportar leitura do formato legado (salt+IV+dados concatenados em base64)
- Abertura de arquivos legados deve funcionar de forma transparente sem interação do usuário

### RF-02.4 Troca de Senha
- O usuário pode trocar a senha mestra sem perder dados
- A operação re-encripta apenas o key slot correspondente à senha mestra
- O cofre é salvo/sincronizado automaticamente após a troca

---

## RF-03 — Gerenciamento de Entradas

### RF-03.1 Criação de Entrada
- Campos obrigatórios: nome
- Campos opcionais: descrição, ícone (emoji), usuário, senha, URL, notas, grupo
- O gerador de senha integrado pode ser acionado no campo senha

### RF-03.2 Edição e Exclusão
- Entradas podem ser editadas a qualquer momento
- Exclusão solicita confirmação antes de remover definitivamente

### RF-03.3 Favoritos
- O usuário pode marcar/desmarcar entradas como favoritas
- A view "Favoritas" lista todas as entradas favoritadas

### RF-03.4 Cópia para Área de Transferência
- Copiar usuário: limpa automaticamente após 60 segundos
- Copiar senha: limpa automaticamente após 30 segundos
- Ambos exibem feedback visual de confirmação

### RF-03.5 Visualização de Senha
- A senha é ocultada por padrão (pontos)
- Botão de olho alterna a visibilidade
- Indicador de força da senha calculado em tempo real (Fraca / Média / Boa / Excelente)

---

## RF-04 — Grupos

### RF-04.1 Criação e Edição de Grupos
- O usuário pode criar grupos com nome, descrição e ícone personalizado
- Grupos podem ser editados e excluídos
- Ao excluir um grupo, as entradas associadas podem ser movidas ou excluídas junto

### RF-04.2 Navegação por Grupo
- A sidebar lista todos os grupos disponíveis
- Selecionar um grupo filtra as entradas exibidas no grid principal

### RF-04.3 Drag-and-Drop
- Entradas podem ser arrastadas entre grupos via interface de drag-and-drop
- A operação atualiza o `groupId` da entrada e marca o cofre como sujo (`isDirty`)

---

## RF-05 — Gerador de Senhas

### RF-05.1 Configuração
- Comprimento ajustável de 8 a 64 caracteres (padrão: 20)
- Seleção de charsets: maiúsculas, minúsculas, números, símbolos
- Ao menos um charset deve estar ativo

### RF-05.2 Geração Segura
- A geração usa `crypto.getRandomValues` para garantir aleatoriedade criptográfica
- O resultado é preenchido diretamente no campo senha e pode ser regenerado

---

## RF-06 — Sincronização com Google Drive

### RF-06.1 Autenticação OAuth
- O usuário autentica com Google via OAuth 2.0 PKCE
- Desktop: servidor TCP local na porta 8899; Android: fluxo nativo Kotlin
- O token de acesso e o refresh token são persistidos apenas no Tauri Store (nunca em `localStorage`)

### RF-06.2 Salvar no Drive
- O cofre é salvo como `meu-cofre.keep` na raiz do Google Drive do usuário
- O upload é criptografado antes do envio

### RF-06.3 Auto-save
- O cofre é salvo automaticamente 5 segundos após qualquer alteração (`isDirty`)
- O auto-save inclui arquivo local (se houver caminho) e Drive (se conectado e não for vault colaborativo de proprietário)

### RF-06.4 Refresh Automático
- O token de acesso é renovado automaticamente via refresh token antes de expirar
- O cofre principal do Drive é verificado por mudanças a cada 10 segundos
- A revisão do arquivo é rastreada para evitar downloads redundantes

### RF-06.5 Sincronização Manual
- O usuário pode forçar sincronização imediata clicando no banner de "alterações pendentes"
- Um banner com spinner indica sincronização em andamento
- Erros de sincronização são exibidos em banner vermelho com opção de dismissar

---

## RF-07 — Compartilhamento Colaborativo

### RF-07.1 Escopo do Compartilhamento
- O usuário pode compartilhar uma entrada, um grupo ou o cofre completo
- O destinatário é identificado pelo e-mail Google

### RF-07.2 Permissões
- **Leitor:** visualiza apenas, sem editar
- **Editor:** pode editar entradas e grupos do documento compartilhado
- **Proprietário:** controle total, pode aprovar exclusões

### RF-07.3 Arquivo Colaborativo
- Um documento compartilhado é um arquivo separado `pk-collab-<documentId>.keep` no Drive
- O arquivo tem sua própria senha de compartilhamento independente da senha mestra
- O formato envelope multi-slot permite que proprietário e editores abram com senhas diferentes

### RF-07.4 Polling de Atualizações
- Fontes compartilhadas são verificadas por mudanças a cada 3 segundos
- Atualizações recebidas exibem uma notificação temporária (3 segundos)

### RF-07.5 Namespacing de IDs
- IDs de entradas e grupos de fontes compartilhadas seguem o padrão `shared:<sourceId>:entry:<id>` para evitar colisões com o cofre principal

### RF-07.6 Solicitações de Exclusão
- Editores podem solicitar exclusão de uma entrada (não excluem diretamente)
- O proprietário vê e aprova/rejeita solicitações pendentes

---

## RF-08 — Backup e Importação

### RF-08.1 Exportação Local
- O usuário pode exportar uma cópia do cofre criptografado para qualquer local do sistema

### RF-08.2 Importação de Arquivo
- O usuário pode importar um arquivo `.keep` externo
- O merge é feito por nome+usuário para evitar duplicatas

### RF-08.3 Download do Drive
- O usuário pode baixar o cofre do Drive para um arquivo local

---

## RF-09 — Interface e Usabilidade

### RF-09.1 Modos de Visualização
- **Grade:** entradas exibidas como cards com ícone, nome e usuário
- **Lista:** entradas em linhas compactas
- A preferência é persistida entre sessões

### RF-09.2 Busca
- Busca em tempo real por nome e usuário de entrada
- A busca filtra tanto o cofre principal quanto as fontes compartilhadas

### RF-09.3 Layout Responsivo
- Desktop: sidebar fixa + área de conteúdo principal
- Android: sidebar como drawer deslizante, safe areas para notch/barra de navegação

### RF-09.4 Ícones de Entrada
- Ícones são emojis selecionáveis via picker
- No desktop, o usuário pode também escolher uma imagem do sistema

---

## RF-10 — Plataforma e Infraestrutura

### RF-10.1 HTTP Multiplataforma
- Desktop: HTTP direto via `reqwest`
- Android: HTTP via Kotlin `HttpURLConnection` (DNS funciona; NDK não resolve DNS em threads nativas)
- O frontend acessa HTTP via comando Tauri `native_fetch` de forma transparente

### RF-10.2 Persistência de Estado
- Dados de cofre: Tauri Plugin Store (primário) + `localStorage` (fallback de arranque a frio)
- Tokens Google: somente Tauri Plugin Store (nunca `localStorage`)

### RF-10.3 Build e Release
- Builds de produção disparados por tags `v*` via GitHub Actions
- Targets: Linux, Windows, macOS, Android
- Assinatura Android via keystore em secret `ANDROID_KEYSTORE_B64`

---

## RNF-01 — Segurança

- A senha mestra nunca é persistida em nenhum storage
- Tokens Google são armazenados apenas no Tauri Store (sem localStorage)
- A área de transferência com senha é limpa automaticamente após 30 segundos
- PBKDF2 usa 310.000 iterações, acima do mínimo recomendado pelo NIST
- Cada arquivo `.keep` usa salt e IV únicos gerados com CSPRNG

## RNF-02 — Desempenho

- O auto-save introduz no máximo 5 segundos de delay após a última alteração
- O polling de fontes compartilhadas não deve introduzir lag perceptível na UI
- A derivação de chave (PBKDF2) pode levar alguns segundos; a UI deve exibir loading durante esse processo

## RNF-03 — Compatibilidade

- Suporte a cofres no formato legado (v1) e atual (v2 envelope)
- A mesma base de código serve desktop (Linux/Windows/macOS) e Android via Tauri

## RNF-04 — Disponibilidade

- O app funciona completamente offline para operações locais (criar/editar/abrir cofre)
- Drive sync só está disponível com conectividade
