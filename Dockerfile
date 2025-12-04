# Use uma imagem oficial do Node.js como base. A versão 18 é uma boa escolha.
FROM node:18-slim

# Instala as dependências necessárias para o Puppeteer (Chromium) funcionar.
# Referência: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker
RUN apt-get update \
    && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libxshmfence-dev

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de dependência e instala
COPY package*.json ./
RUN npm install

# Copia o resto do código do seu aplicativo
COPY . .

# Define o comando para iniciar o bot quando o contêiner for executado
CMD [ "node", "run-web.js" ]