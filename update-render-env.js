/**
 * Script para automatizar a atualização da variável de ambiente WHATSAPP_SESSION no Render.
 *
 * Como usar:
 * 1. Obtenha seu Service ID e uma API Key no painel do Render.
 * 2. Instale o axios: `npm install axios`
 * 3. Execute o script passando as credenciais como variáveis de ambiente:
 *    RENDER_API_KEY="sua_api_key" RENDER_SERVICE_ID="srv-seu_service_id" node update-render-env.js
 */

import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason,
    BufferJSON
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import axios from 'axios';

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.error('❌ Erro: As variáveis de ambiente RENDER_API_KEY e RENDER_SERVICE_ID são obrigatórias.');
    console.log('Uso: RENDER_API_KEY="sua_key" RENDER_SERVICE_ID="seu_id" node update-render-env.js');
    process.exit(1);
}

const renderAPI = axios.create({
    baseURL: 'https://api.render.com/v1',
    headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

/**
 * Gera uma nova sessão do WhatsApp e retorna a string em Base64.
 * @returns {Promise<string>} Uma promessa que resolve com a string da sessão em Base64.
 */
function generateSessionString() {
    return new Promise(async (resolve, reject) => {
        console.log('ℹ️  Iniciando a geração da sessão do WhatsApp...');

        // Usamos um armazenamento em memória, pois não precisamos salvar em disco.
        const { state, saveCreds } = { state: { creds: {} }, saveCreds: () => {} };

        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ['DudaBot (Updater)', 'Chrome', '1.0']
        });

        sock.ev.on('creds.update', (newCreds) => {
            // Atualiza as credenciais em memória
            state.creds = { ...state.creds, ...newCreds };
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.clear();
                console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
                qrcodeTerminal.generate(qr, { small: true });
            }

            if (connection === 'open') {
                console.log('✅ Conexão estabelecida com sucesso. Empacotando a sessão...');
                
                // A função `toJSON` serializa a sessão em um objeto JSON.
                const sessionObject = state.creds;
                const sessionString = JSON.stringify(sessionObject, BufferJSON.replacer);
                const sessionBase64 = Buffer.from(sessionString).toString('base64');

                console.log('📦 Sessão empacotada com sucesso.');
                sock.end(); // Fecha a conexão do WhatsApp
                resolve(sessionBase64);
            } else if (connection === 'close') {
                const error = lastDisconnect?.error;
                const statusCode = (error instanceof Boom) ? error.output.statusCode : 500;

                if (statusCode !== DisconnectReason.loggedOut) {
                    console.error(`❌ Conexão fechada inesperadamente. Tentando reconectar...`);
                    // A biblioteca tentará reconectar automaticamente.
                } else {
                    console.error('❌ Erro de logout. A sessão foi invalidada.');
                    reject(new Error('Logout do WhatsApp.'));
                }
            }
        });
    });
};

/**
 * Atualiza a variável de ambiente no Render.
 * @param {string} sessionBase64 A nova string da sessão.
 */
async function updateRenderEnvVar(sessionBase64) {
    try {
        console.log(`\n☁️  Buscando variáveis de ambiente do serviço ${RENDER_SERVICE_ID}...`);
        
        // 1. Busca as variáveis de ambiente atuais para não sobrescrever outras.
        const { data: envVars } = await renderAPI.get(`/services/${RENDER_SERVICE_ID}/env-vars`);

        // 2. Encontra e atualiza a variável `WHATSAPP_SESSION`, ou a cria se não existir.
        const sessionVar = envVars.find(v => v.envVar.key === 'WHATSAPP_SESSION');
        
        let updatedVars;
        if (sessionVar) {
            // Atualiza o valor se a variável já existe
            updatedVars = envVars.map(v => 
                v.envVar.key === 'WHATSAPP_SESSION' ? { key: 'WHATSAPP_SESSION', value: sessionBase64 } : v.envVar
            );
        } else {
            // Adiciona a nova variável se ela não existe
            updatedVars = [...envVars.map(v => v.envVar), { key: 'WHATSAPP_SESSION', value: sessionBase64 }];
        }

        console.log('🚀 Enviando a nova sessão para o Render...');

        // 3. Envia o array completo de variáveis de ambiente de volta para a API.
        await renderAPI.put(`/services/${RENDER_SERVICE_ID}/env-vars`, updatedVars);

        console.log('✅ Sucesso! A variável de ambiente WHATSAPP_SESSION foi atualizada no Render.');
        console.log('ℹ️  Uma nova implantação será iniciada automaticamente no Render para aplicar a alteração.');

    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`❌ Erro ao atualizar a variável no Render: ${errorMessage}`);
        if (error.response?.status === 401) {
            console.error('   Verifique se sua RENDER_API_KEY está correta e tem as permissões necessárias.');
        }
        if (error.response?.status === 404) {
            console.error('   Verifique se seu RENDER_SERVICE_ID está correto.');
        }
        throw error; // Propaga o erro para o bloco catch principal.
    }
}

async function main() {
    try {
        const session = await generateSessionString();
        await updateRenderEnvVar(session);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ O processo falhou. Por favor, tente novamente.');
        process.exit(1);
    }
}

main();