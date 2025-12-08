import { promises as fs } from 'fs';
import path from 'path';

/**
 * Este script lê os arquivos de sessão da pasta 'auth_info_multi',
 * os combina em um único objeto JSON, o converte para uma string Base64
 * e a salva em um arquivo .env na variável SESSION_DATA.
 *
 * Este processo é essencial para "transportar" a sessão de autenticação
 * do seu ambiente local para um ambiente de produção como o Render.
 */
async function packSession() {
    const sessionDir = path.resolve('auth_info_multi');
    const envFilePath = path.resolve('.env');
    console.log(`🔎 Procurando pela pasta de sessão em: ${sessionDir}`);

    try {
        // 1. Ler todos os arquivos na pasta de sessão
        const files = await fs.readdir(sessionDir);
        if (files.length === 0) {
            throw new Error('A pasta de sessão está vazia. Você precisa escanear o QR Code primeiro executando "npm run dev".');
        }

        // 2. Ler o conteúdo de cada arquivo e montar um objeto
        const sessionData = {};
        for (const file of files) {
            // O nome do arquivo (sem a extensão .json) será a chave
            const key = path.basename(file, '.json');
            const content = await fs.readFile(path.join(sessionDir, file), 'utf-8');
            sessionData[key] = JSON.parse(content);
        }

        // 3. Converter o objeto para uma string JSON e depois para Base64
        const jsonString = JSON.stringify(sessionData);
        const base64String = Buffer.from(jsonString).toString('base64');

        // 4. Salvar a string Base64 no arquivo .env
        const envContent = `SESSION_DATA="${base64String}"\n`;
        await fs.writeFile(envFilePath, envContent);

        console.log('✅ Sessão empacotada com sucesso!');
        console.log(`A variável SESSION_DATA foi salva em ${envFilePath}`);
        console.log('🚀 Agora, copie o conteúdo desta variável e cole nas "Environment Variables" do seu serviço no Render.');

    } catch (error) {
        console.error('❌ Erro ao empacotar a sessão:', error.message);
        process.exit(1);
    }
}

packSession();