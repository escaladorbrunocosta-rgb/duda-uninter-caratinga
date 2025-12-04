import { promises as fs } from 'fs';
import path from 'path';

/**
 * Converte a pasta de sessão do Baileys em uma string JSON base64.
 * Esta é a maneira mais confiável de serializar a sessão para uma variável de ambiente.
 */
async function convertSessionToString() {
    const sessionDir = 'session';
    const sessionData = {};

    try {
        const files = await fs.readdir(sessionDir);
        for (const file of files) {
            // Apenas inclua arquivos JSON essenciais
            if (file.endsWith('.json')) {
                const filePath = path.join(sessionDir, file);
                const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
                sessionData[file] = JSON.parse(fileContent);
            }
        }
        console.log('✅ Sessão convertida com sucesso! Copie a string abaixo e guarde-a em um local seguro.\n');
        console.log(JSON.stringify(sessionData));
    } catch (error) {
        console.error('❌ Falha ao converter a sessão. Certifique-se de que a pasta "session" existe e o bot conectou com sucesso pelo menos uma vez.', error);
    }
}

convertSessionToString();