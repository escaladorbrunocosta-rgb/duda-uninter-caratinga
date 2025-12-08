/**
 * Script para gerar a string de sessão a partir dos arquivos locais.
 *
 * Como usar:
 * 1. Autentique seu bot no ambiente de desenvolvimento (npm run start).
 *    Isso criará a pasta `auth_info_multi` com os arquivos de sessão.
 * 2. Execute este script: `npm run session`
 * 3. Copie a string JSON exibida no terminal.
 * 4. Cole a string na variável de ambiente `SESSION_DATA` no Render.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { BufferJSON } from '@whiskeysockets/baileys';

const SESSION_DIR = path.join(process.cwd(), 'auth_info_multi');

async function generateSessionString() {
    try {
        // É crucial usar o BufferJSON.reviver para ler os arquivos corretamente,
        // pois eles podem conter Buffers serializados.
        const creds = JSON.parse(await fs.readFile(path.join(SESSION_DIR, 'creds.json'), { encoding: 'utf-8' }), BufferJSON.reviver);
        const keys = JSON.parse(await fs.readFile(path.join(SESSION_DIR, 'keys.json'), { encoding: 'utf-8' }), BufferJSON.reviver);

        const sessionData = { creds, keys };

        // Ao gerar a string, é igualmente crucial usar o BufferJSON.replacer
        // para que o `session-auth.js` no servidor possa decodificá-la corretamente.
        console.log('\n\n--- SUA STRING DE SESSÃO (SESSION_DATA) ---\n');
        console.log(JSON.stringify(sessionData, BufferJSON.replacer));
        console.log('\n--- COPIE O CONTEÚDO ACIMA E COLE NA SUA VARIÁVEL DE AMBIENTE ---\n\n');
    } catch (error) {
        console.error('\n\nFalha ao gerar a string de sessão. Verifique se você já autenticou localmente e se a pasta "auth_info_multi" existe.\n\n', error);
    }
}

generateSessionString();