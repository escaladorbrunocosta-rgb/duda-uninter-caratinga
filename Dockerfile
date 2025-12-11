# ====================================================================================
# ESTÁGIO 1: Builder - Instala dependências e prepara a aplicação
# ====================================================================================
# Correção: Atualizado para node:20 para ser compatível com as dependências.
FROM node:20-slim AS builder

# Instala as dependências necessárias para o Puppeteer (Chromium) funcionar.
# Referência: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker
RUN apt-get update \
    && apt-get install -y \
    # Dependências do Chromium
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de dependência e instala
COPY package*.json ./

# Reforço: Usar 'npm ci' para instalações mais rápidas e consistentes em CI/CD.
RUN npm ci

# Copia o resto do código do seu aplicativo
COPY . .

# ====================================================================================
# ESTÁGIO 2: Produção - Imagem final, limpa e segura
# ====================================================================================
FROM node:20-slim

# Reforço de Segurança: Cria um usuário não-root para executar a aplicação.
USER node

WORKDIR /home/node/app

# Copia apenas os artefatos necessários do estágio 'builder'.
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

# Define o comando para iniciar o bot.
CMD [ "node", "index.js" ]