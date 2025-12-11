# Duda - Assistente Virtual para WhatsApp

Este é o repositório do Duda, um bot para WhatsApp desenvolvido com Node.js e a biblioteca Baileys. Ele é projetado para fornecer respostas automáticas, navegar por menus e se integrar com serviços de IA como o Google Gemini.

## Funcionalidades

*   Respostas automáticas baseadas em uma base de conhecimento (`knowledgeBase.json`).
*   Sistema de menu navegável.
*   Lógica de fallback progressivo para quando o bot não entende a pergunta.
*   Integração com o Google Gemini para respostas generativas (comando `!gemini`).
*   Notificações de status para o Discord.
*   Geração de sessão para deploy em plataformas como o Render.

## Instalação

1.  Clone este repositório:
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd duda-uninter-caratinga
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis:
    ```env
    # Chave da API do Google Gemini para o comando !gemini
    GEMINI_API_KEY=SUA_CHAVE_AQUI

    # (Opcional) Webhook do Discord para receber notificações de erro
    DISCORD_WEBHOOK_URL=SEU_WEBHOOK_AQUI
    ```

## Como Executar

### Ambiente de Desenvolvimento

Para rodar o bot localmente e gerar o QR Code para autenticação:

```bash
npm run dev
```

### Gerar Sessão para Deploy

Após escanear o QR Code e conectar o bot localmente, pare o processo (`Ctrl+C`) e execute o seguinte comando para gerar a string de sessão para o deploy:

```bash
npm run session
```

Isso criará um arquivo `session_for_render.txt`. Copie o conteúdo e cole na variável de ambiente `SESSION_DATA` da sua plataforma de hospedagem (ex: Render).