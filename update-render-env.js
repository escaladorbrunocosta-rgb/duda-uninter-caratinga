/**
 * Script para automatizar a atualização da variável de ambiente WHATSAPP_SESSION no Render.
 * Ele tentará ler as credenciais do arquivo .env, mas se não encontrar, pedirá interativamente.
 *
 * Como usar:
 * 1. Obtenha seu Service ID e uma API Key no painel do Render.
 * 2. Instale as dependências: `npm install @whiskeysockets/baileys @hapi/boom pino qrcode-terminal axios dotenv`
 * 3. Crie um arquivo .env com suas credenciais (opcional, mas recomendado):
 *    RENDER_API_KEY="sua_api_key"
 *    RENDER_SERVICE_ID="srv-seu_service_id"
 * 4. Execute o script: `node update-render-env.js`
 */

import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason,
    BufferJSON,
    useInMemoryAuthState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import axios from 'axios';
import readline from 'readline';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

let RENDER_API_KEY = process.env.RENDER_API_KEY;
let RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

/**
 * Cria uma interface para ler input do usuário no terminal.
 * @param {string} query A pergunta a ser feita ao usuário.
 * @returns {Promise<string>} A resposta do usuário.
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

/**
 * Função auxiliar para solicitar uma credencial ao usuário até que ela seja válida.
 * @param {string} prompt - A mensagem para o usuário.
 * @param {string} prefix - O prefixo que a entrada válida deve ter.
 * @param {string} errorMessage - A mensagem de erro para uma entrada inválida.
 * @returns {Promise<string>} A credencial validada.
 */
async function askForValidatedCredential(prompt, prefix, errorMessage) {
    let credential = '';
    let isValid = false;
    while (!isValid) {
        credential = await askQuestion(prompt);
        isValid = credential.startsWith(prefix);
        if (!isValid) {
            console.error(errorMessage);
        }
    }
    return credential;
}

async function ensureCredentials() {
    if (!RENDER_API_KEY) {
        console.warn('⚠️  RENDER_API_KEY não encontrada no ambiente.');
        RENDER_API_KEY = await askForValidatedCredential('🔑 Por favor, cole sua Render API Key (deve começar com "rnd_") e pressione Enter: ', 'rnd_', '❌ Chave de API inválida. Você a encontra em "Account Settings" > "API Keys" no painel do Render.');
    }
    if (!RENDER_SERVICE_ID) {
        console.warn('⚠️  RENDER_SERVICE_ID não encontrado no ambiente.');
        RENDER_SERVICE_ID = await askForValidatedCredential('🆔 Por favor, cole seu Render Service ID (deve começar com "srv-") e pressione Enter: ', 'srv-', '❌ ID inválido. O Service ID deve começar com "srv-". Você o encontra na URL do seu painel do Render.');
    }
}

/**
 * Gera uma nova sessão do WhatsApp e retorna a string em Base64.
 * @returns {Promise<string>} Uma promessa que resolve com a string da sessão em Base64.
 */
function generateSessionString() {
    return new Promise(async (resolve, reject) => {
        let connectionAttempts = 0;
        const MAX_ATTEMPTS = 3; // Define um limite de tentativas de reconexão

        console.log('ℹ️  Iniciando a geração da sessão do WhatsApp...');

        // Usamos um armazenamento em memória, pois não precisamos salvar em disco.
        const { state, saveCreds } = await useInMemoryAuthState();

        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ['DudaBot (Updater)', 'Chrome', '1.0'],
            // Adiciona suporte para o código de pareamento
            printQRInTerminal: false
        });

        // Se o socket não tiver um ID de registro e o pareamento for suportado, pergunta ao usuário.
        if (!sock.authState.creds.registered) {
            const usePairingCode = (await askQuestion('❔ Você gostaria de usar um Código de Pareamento (sim/não)? ')).toLowerCase() === 'sim';
            if (usePairingCode) {
                const phoneNumber = await askQuestion('📞 Por favor, digite o número do seu WhatsApp (com código do país, ex: 55119...): ');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\n================================================\nSeu código de pareamento é: \x1b[32m${code}\x1b[0m\n================================================\n`);
            }
        }

        // A função saveCreds, retornada por useInMemoryAuthState, lida com o salvamento das credenciais em memória.
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.clear();
                console.log('\n📱 Escaneie o QR Code abaixo com o seu WhatsApp:');
                console.log('   (Vá para WhatsApp > Aparelhos Conectados > Conectar um aparelho)');
                qrcodeTerminal.generate(qr, { small: true }, (qrString) => {
                    console.log('\n\n================================================================================');
                    console.log('   INSTRUÇÕES PARA GERAR O QR CODE (se não conseguir escanear)');
                    console.log('================================================================================');
                    console.log('\nSe o QR code acima aparecer "quebrado", use a string de texto para gerá-lo.');
                    console.log('1. Copie a linha de texto que começa com "COPIE ISTO:".');
                    console.log('2. Cole em um gerador de QR Code online para criar a imagem.');
                    console.log('\n\x1b[32m%s\x1b[0m', `COPIE ISTO: ${qrString}`); // Imprime a string do QR code em verde
                });
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

                if (statusCode === DisconnectReason.loggedOut) {
                    console.error('❌ Erro de logout. A sessão foi invalidada.');
                    return reject(new Error('Logout do WhatsApp. A sessão foi desconectada remotamente.'));
                } else if (connectionAttempts < MAX_ATTEMPTS) {
                    connectionAttempts++;
                    console.error(`❌ Conexão fechada (código: ${statusCode}). Tentando reconectar... (${connectionAttempts}/${MAX_ATTEMPTS})`);
                    // A biblioteca Baileys tenta reconectar automaticamente por padrão.
                    // Apenas registramos a tentativa.
                } else {
                    const errorMessage = `Falha ao conectar ao WhatsApp após ${MAX_ATTEMPTS} tentativas. Verifique sua conexão com a internet ou se há um firewall bloqueando a porta.`;
                    console.error(`❌ ${errorMessage}`);
                    return reject(new Error(errorMessage));
                }
            }
        });
    });
};

/**
 * Atualiza a variável de ambiente no Render.
 * @param {string} sessionBase64 A nova string da sessão.
 */
async function updateRenderEnvVar(renderAPI, sessionBase64) {
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
        const saveOption = (await askQuestion('❓ Onde você deseja salvar a sessão? Digite "render" ou "local": ')).toLowerCase();

        const session = await generateSessionString();

        if (saveOption === 'local') {
            const fileName = 'whatsapp_session.txt';
            await fs.writeFile(fileName, session);
            console.log(`\n✅ Sessão salva com sucesso no arquivo local: \x1b[32m${fileName}\x1b[0m`);
            console.log('   Você pode copiar o conteúdo deste arquivo e colá-lo manualmente na variável de ambiente WHATSAPP_SESSION no Render.');
        } else if (saveOption === 'render') {
            await ensureCredentials();

            const renderAPI = axios.create({
                baseURL: 'https://api.render.com/v1',
                headers: {
                    'Authorization': `Bearer ${RENDER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });

            await updateRenderEnvVar(renderAPI, session);
        } else {
            console.error('\n❌ Opção inválida. Por favor, execute novamente e escolha "render" ou "local".');
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ O processo falhou. Por favor, tente novamente.');
        process.exit(1);
    }
}

main();