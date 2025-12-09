// =================================================================
// ARQUIVO: generate-session.js
// DESCRIÇÃO: Script para gerar a string de sessão para o Render.
// USO:
// 1. Execute o bot localmente com `npm start`.
// 2. Escaneie o QR Code e espere a conexão ser estabelecida.
// 3. Pare o bot (Ctrl+C).
// 4. Execute `node generate-session.js`.
// 5. Copie a string gerada e cole na variável de ambiente SESSION_DATA no Render.
// =================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { BufferJSON } from '@whiskeysockets/baileys';

const AUTH_DIR = 'auth_info_multi';

async function generateSessionString() {
  try {
    console.log('▶️  Lendo arquivos de sessão da pasta:', AUTH_DIR);
    const files = await fs.readdir(AUTH_DIR);
    const credsFile = files.find(file => file === 'creds.json');

    if (!credsFile) {
      throw new Error('Arquivo "creds.json" não encontrado na pasta "auth_info_multi". Certifique-se de que o bot foi iniciado e o QR Code escaneado com sucesso antes de executar este script.');
    }

    const creds = JSON.parse(await fs.readFile(path.join(AUTH_DIR, credsFile), 'utf-8'), BufferJSON.reviver);

    const keys = {};
    for (const file of files) {
      if (file !== 'creds.json') {
        const filePath = path.join(AUTH_DIR, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'), BufferJSON.reviver);
        
        // O nome do arquivo é a chave (ex: 'pre-key-1'), e o conteúdo é o valor
        const key = file.replace('.json', '');
        keys[key] = data;
      }
    }

    const sessionData = { creds, keys };
    // Usamos 2 espaços para indentação para facilitar a visualização, mas o Render aceita sem problemas.
    // Se preferir minificado, troque o 2 por 0.
    const sessionString = JSON.stringify(sessionData, BufferJSON.replacer, 2);

    console.log('\n✅ String de sessão gerada com sucesso! Copie o bloco de texto abaixo:\n');
    console.log(sessionString);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Erro: O diretório "%s" não foi encontrado.', AUTH_DIR);
      console.error('   Certifique-se de iniciar o bot (`npm start`) e escanear o QR Code primeiro.');
    } else {
      console.error('❌ Erro ao gerar a string de sessão:', error.message);
    }
  }
}

generateSessionString();