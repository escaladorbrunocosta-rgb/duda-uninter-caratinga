# DUDA-BOT - Assistente Virtual para WhatsApp

Este projeto implementa um chatbot para WhatsApp robusto e modular, utilizando a biblioteca `@whiskeysockets/baileys`. Ele é dividido em duas camadas independentes: `bot-base` e `bot-inteligente`.

## Estrutura do Projeto

```
/
├── auth/                   # Pasta de sessão (gerada automaticamente, NÃO ENVIAR PARA O GIT)
├── bot-base/               # Camada responsável apenas pela conexão e sessão
│   ├── index.js
│   └── package.json
├── bot-inteligente/        # Camada com a lógica de atendimento e IA
│   ├── index.js
│   ├── messageHandler.js
│   ├── knowledgeBase.js
│   └── connection.js       # Módulo de conexão compartilhado
├── logs-base/              # Logs do bot-base
├── logs-inteligente/       # Logs do bot-inteligente
├── userStates.json         # Arquivo com o estado das conversas
└── .gitignore              # Arquivo para ignorar pastas sensíveis no Git
```

### Camadas

#### 🤖 `bot-base`
- **Responsabilidade**: Conectar-se ao WhatsApp, gerar o QR Code, salvar a sessão na pasta `/auth` e manter a conexão estável.
- **Características**: Não possui nenhuma lógica de resposta. É o "motor" da conexão.

#### 🧠 `bot-inteligente`
- **Responsabilidade**: Carregar a sessão criada pelo `bot-base` e gerenciar toda a interação com o usuário.
- **Características**: Contém a base de conhecimento, o fluxo de menus, processamento de linguagem natural (NLP) simples e a lógica de respostas.

## Pré-requisitos

- Node.js (versão 20.x ou superior)

## Instalação

1. Clone o repositório:
   ```bash
   git clone <url-do-seu-repositorio>
   cd duda-uninter-caratinga
   ```

2. Instale as dependências para ambos os bots. Este comando entrará em cada pasta e executará `npm install`.
   ```bash
   (cd bot-base && npm install) && (cd bot-inteligente && npm install)
   ```

## Como Executar

A execução é feita em dois passos:

### Passo 1: Gerar a Sessão com o `bot-base`
Execute o bot base para escanear o QR Code.
```bash
node bot-base/index.js
```
Escaneie o QR Code com seu celular. Após ver a mensagem de "conectado com sucesso", você pode parar o processo (`Ctrl+C`). A sessão estará salva na pasta `/auth`.

### Passo 2: Iniciar o Atendimento com o `bot-inteligente`
Com a sessão já criada, inicie o bot que responde aos usuários.
```bash
node bot-inteligente/index.js
```
O bot agora está online e pronto para atender, usando a sessão persistida.