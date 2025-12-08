import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Este script automatiza a atualização da variável de ambiente SESSION_DATA
 * diretamente no Render usando a API da plataforma.
 *
 * Requer que as seguintes variáveis de ambiente estejam definidas no seu .env local:
 * - RENDER_API_KEY: Sua chave de API do Render.
 * - RENDER_SERVICE_ID: O ID do serviço do seu bot no Render.
 */
async function updateRenderEnv() {
    console.log('🚀 Iniciando atualização da variável de ambiente no Render...');

    const { RENDER_API_KEY, RENDER_SERVICE_ID } = process.env;

    if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
        console.error('❌ Erro: As variáveis de ambiente RENDER_API_KEY e RENDER_SERVICE_ID são obrigatórias.');
        console.error('Adicione-as ao seu arquivo .env local.');
        return;
    }

    try {
        // 1. Ler a sessão do arquivo .env (que foi gerado pelo pack-session.js)
        const envContent = await fs.readFile(path.resolve('.env'), 'utf-8');
        const match = envContent.match(/SESSION_DATA="([^"]+)"/);

        if (!match || !match[1]) {
            throw new Error('A variável SESSION_DATA não foi encontrada no arquivo .env. Execute "npm run pack-session" primeiro.');
        }
        const sessionData = match[1];

        // 2. Montar a requisição para a API do Render
        const url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`;
        const headers = {
            'Authorization': `Bearer ${RENDER_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        const body = [
            {
                key: 'SESSION_DATA',
                value: sessionData,
            },
        ];

        console.log('📡 Enviando nova sessão para a API do Render...');

        // 3. Enviar a requisição
        await axios.put(url, body, { headers });

        console.log('✅ Sucesso! A variável de ambiente SESSION_DATA foi atualizada no Render.');
        console.log('ℹ️ O Render irá iniciar um novo deploy automaticamente com a sessão atualizada.');

    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error('❌ Falha ao atualizar a variável de ambiente no Render:', errorMessage);
        process.exit(1);
    }
}

updateRenderEnv();