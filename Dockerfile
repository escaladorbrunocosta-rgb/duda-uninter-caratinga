# ====================================================================================
# ESTÁGIO 1: Builder - Instala dependências e prepara a aplicação
# ====================================================================================
# Correção: Atualizado para node:20 para ser compatível com as dependências.
FROM node:20-slim AS builder

# Instala as dependências necessárias para o Puppeteer (Chromium) funcionar.
# As dependências do Chromium/Puppeteer foram removidas, pois não são mais necessárias
# para as versões recentes do Baileys, resultando em uma imagem menor e build mais rápido.

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