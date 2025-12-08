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
    const creds = JSON.parse(await fs.readFile(path.join(AUTH_DIR, 'creds.json'), 'utf-8'), BufferJSON.reviver);
    const keys = JSON.parse(await fs.readFile(path.join(AUTH_DIR, 'keys.json'), 'utf-8'), BufferJSON.reviver);

    const sessionData = { creds, keys };
    const sessionString = JSON.stringify(sessionData, BufferJSON.replacer, 0); // Minificado

    console.log('\n✅ String de sessão gerada com sucesso! Copie a linha abaixo:\n');
    console.log(sessionString);
  } catch (error) {
    console.error('❌ Erro ao gerar a string de sessão. Verifique se a pasta "auth_info_multi" existe e contém os arquivos "creds.json" e "keys.json".', error);
  }
}

generateSessionString();