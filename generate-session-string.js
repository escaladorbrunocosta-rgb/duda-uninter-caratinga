// =================================================================
// ARQUIVO: generate-session-string.js
// DESCRIÇÃO: Lê a pasta de autenticação do Baileys e gera
//            uma string JSON para ser usada como variável de ambiente.
// =================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { BufferJSON } from '@whiskeysockets/baileys';

const AUTH_DIR = 'auth_info_multi';

/**
 * Lê os arquivos de sessão da pasta de autenticação e os compila em
 * uma única string JSON para ser usada como variável de ambiente.
 */
async function generateSessionString() {
  try {
    console.log(`Lendo arquivos de sessão da pasta "${AUTH_DIR}"...`);

    const sessionData = {
      creds: null,
      keys: {},
    };

    // Lê o creds.json principal
    const credsContent = await fs.readFile(path.join(AUTH_DIR, 'creds.json'), 'utf-8');
    sessionData.creds = JSON.parse(credsContent);

    // Lê todos os outros arquivos .json da pasta (pre-key, session, etc.)
    const files = await fs.readdir(AUTH_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'creds.json') {
        const content = await fs.readFile(path.join(AUTH_DIR, file), 'utf-8');
        sessionData.keys[file] = JSON.parse(content);
      }
    }

    // Converte o objeto completo para uma string JSON, usando o replacer do Baileys
    const jsonString = JSON.stringify(sessionData, BufferJSON.replacer, 2);

    console.log('\n✅ String de sessão gerada com sucesso! Copie o conteúdo abaixo e cole na sua variável de ambiente (ex: SESSION_DATA no Render):\n');
    console.log('================================ SESSION STRING ================================\n');
    console.log(jsonString);
    console.log('\n================================================================================\n');

  } catch (error) {
    console.error('❌ Erro ao gerar a string de sessão:', error);
    console.error(`\nCertifique-se de que a pasta "${AUTH_DIR}" existe e contém os arquivos de sessão. Você precisa rodar o bot localmente e escanear o QR Code primeiro.`);
  }
}

generateSessionString();