/**
 * Este script lê a pasta 'session', combina os arquivos em um objeto JSON,
 * comprime esse objeto usando Gzip e o codifica em Base64.
 * O resultado é uma string muito menor e segura para ser usada em variáveis de ambiente.
 *
 * Como usar:
 * 1. Autentique seu bot localmente para gerar a pasta 'session'.
 * 2. Execute: node pack-compressed.js
 * 3. Copie a string Base64 da saída.
 * 4. Cole no campo 'Value' da variável de ambiente WHATSAPP_SESSION na Render.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

async function packAndCompressSession() {
    const sessionDir = path.resolve('session');
    const sessionData = {};

    try {
        await fs.access(sessionDir);
    } catch (error) {
        console.error('❌ Erro: A pasta "session" não foi encontrada.');
        console.error('Certifique-se de autenticar localmente primeiro para gerar a pasta "session".');
        return;
    }

    try {
        const files = await fs.readdir(sessionDir);
        for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            sessionData[path.parse(file).name] = JSON.parse(fileContent);
        }

        const jsonString = JSON.stringify(sessionData);
        const compressed = gzipSync(jsonString);
        const base64String = compressed.toString('base64');

        console.log(base64String);

    } catch (error) {
        console.error('❌ Erro ao processar e comprimir a sessão:', error.message);
    }
}

packAndCompressSession();