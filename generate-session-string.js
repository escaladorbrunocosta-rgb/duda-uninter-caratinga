import { promises as fs, existsSync } from 'fs';
import path from 'path';

/**
 * Este script lê todos os arquivos da pasta 'session',
 * monta um único objeto JSON e o imprime no console.
 * O resultado deve ser copiado e colado na variável de ambiente WHATSAPP_SESSION.
 */
async function generateSessionString() {
    const sessionDir = path.resolve('session');

    if (!existsSync(sessionDir)) {
        console.error('❌ Pasta "session" não encontrada. Execute o bot e escaneie o QR Code primeiro.');
        process.exit(1);
    }

    const sessionData = {};
    try {
        const files = await fs.readdir(sessionDir);

        for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            sessionData[file] = JSON.parse(fileContent);
        }

        console.log('✅ String da sessão gerada com sucesso! Copie a linha abaixo:\n');
        console.log(JSON.stringify(sessionData));
    } catch (error) {
        console.error('❌ Erro ao gerar a string da sessão:', error);
    }
}

generateSessionString();