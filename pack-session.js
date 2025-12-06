/**
 * Este script lê todos os arquivos da pasta 'session',
 * os combina em um único objeto JSON e o imprime no console.
 * O resultado pode ser copiado diretamente para a variável de ambiente WHATSAPP_SESSION.
 * 
 * Como usar:
 * 1. Autentique seu bot localmente para gerar a pasta 'session'.
 * 2. Execute: node pack-session.js
 * 3. Copie a saída do terminal.
 * 4. Cole no campo 'Value' da variável de ambiente WHATSAPP_SESSION no seu serviço de hospedagem (Render, etc.).
 */
import { promises as fs } from 'fs';
import path from 'path';

async function packSession() {
    const sessionDir = path.resolve('session');
    const sessionData = {};

    try {
        // Verifica se o diretório 'session' existe antes de continuar.
        await fs.access(sessionDir);
    } catch (error) {
        console.error('❌ Erro: A pasta "session" não foi encontrada.');
        console.error('Certifique-se de autenticar localmente primeiro para gerar a pasta "session".');
        return; // Encerra a execução se a pasta não existir.
    }

    try {
        const files = await fs.readdir(sessionDir);
        for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            sessionData[path.parse(file).name] = JSON.parse(fileContent);
        }
        console.log(JSON.stringify(sessionData));
    } catch (error) {
        console.error('❌ Erro ao ler ou processar os arquivos da sessão:', error.message);
    }
}

packSession();