import { promises as fs } from 'fs';
import path from 'path';

/**
 * Lê todos os arquivos JSON de uma pasta e os combina em um único objeto.
 * As chaves do objeto são os nomes dos arquivos, e os valores são o conteúdo dos arquivos.
 */
async function packSession() {
    const sessionDir = path.resolve('session');
    const output = {};

    try {
        const files = await fs.readdir(sessionDir);
        for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            output[file] = JSON.parse(content);
        }
        console.log(JSON.stringify(output));
    } catch (error) {
        console.error('Erro ao empacotar a sessão. A pasta "session" existe e contém arquivos válidos?', error);
    }
}

packSession();