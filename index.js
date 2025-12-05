// Polyfill para a API de criptografia global esperada pelo Baileys.
// Isso é necessário em alguns ambientes Node.js onde `globalThis.crypto` não está disponível por padrão.
// A importação direta para o escopo global é mais robusta em alguns ambientes de produção.
// Referência: https://github.com/WhiskeySockets/Baileys/issues/962
import crypto from 'node:crypto';
if (typeof globalThis.crypto !== 'object' || !globalThis.crypto.subtle) {
    globalThis.crypto = crypto.webcrypto;
}

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup,
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { promises as fs, existsSync, mkdirSync, rmSync } from 'fs'; // Usa a versão de promises do fs
import path from 'path'; // Importa o módulo para lidar com caminhos de arquivos
import qrcode from 'qrcode-terminal'; // Importa a biblioteca para gerar QR Code no terminal
import { getResponse } from './knowledgeBase.js';

let reconnectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Processa as mensagens recebidas.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - A instância do socket do Baileys.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} msg - O objeto da mensagem recebida.
 * @param {pino.Logger} logger - A instância do logger.
 */
async function handleMessage(sock, msg, logger) {
    try {
        const chatId = msg.key.remoteJid;

        // Ignora se não houver conteúdo na mensagem, se for de um grupo ou se for uma atualização de status
        if (!msg.message || msg.key.fromMe || isJidGroup(chatId) || chatId === 'status@broadcast') {
            return;
        }

        // Extrai o ID do chat e o texto da mensagem de forma mais completa
        const messageText = msg.message.conversation ||
                            msg.message.extendedTextMessage?.text ||
                            msg.message.imageMessage?.caption ||
                            msg.message.videoMessage?.caption;

        const userName = msg.pushName || 'Usuário'; // Obtém o nome do usuário

        // Ignora se a mensagem não tiver texto
        if (!messageText) {
            logger.info({ chatId }, 'Mensagem recebida sem texto (ex: áudio, sticker). Ignorando.');
            return;
        }

        logger.info({ chatId, userName, message: messageText }, 'Mensagem recebida');

        // Simula que o bot está "digitando" para uma melhor experiência do usuário
        await sock.sendPresenceUpdate('composing', chatId);

        // Obtém a resposta da nossa base de conhecimento
        const response = getResponse(chatId, messageText, userName);

        // Envia a resposta
        await sock.sendMessage(chatId, { text: response });
        logger.info({ chatId, response }, 'Resposta enviada');

        // Limpa a presença (para de "digitar")
        await sock.sendPresenceUpdate('paused', chatId);

    } catch (error) {
        logger.error({ error, messageData: msg }, '❌ Erro ao processar uma mensagem específica.');
    }
}

async function startBot() {
    const logger = pino({
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: { ignore: 'pid,hostname,error' } // Ignora o objeto de erro completo no log formatado
        }
    });
    const sessionDir = 'session'; // Nome da pasta da sessão

    let state, saveCreds;

    // Prioriza o uso da sessão via variável de ambiente para ambientes de produção (Render, etc.)
    if (process.env.WHATSAPP_SESSION) {
        logger.info('Carregando sessão da variável de ambiente...');
        try {
            const sessionData = JSON.parse(process.env.WHATSAPP_SESSION);
            if (!existsSync(sessionDir)) {
                mkdirSync(sessionDir);
            }
            // Escreve os arquivos de sessão de forma assíncrona
            const writePromises = Object.entries(sessionData).map(([fileName, fileContent]) =>
                fs.writeFile(path.join(sessionDir, fileName), JSON.stringify(fileContent, null, 2))
            );
            await Promise.all(writePromises);
            logger.info('Sessão carregada e arquivos recriados na pasta "session".');
        } catch (error) {
            logger.error({ error }, 'Falha ao carregar sessão da variável de ambiente. Verifique o formato do JSON.');
            process.exit(1); // Encerra se a sessão do ambiente estiver corrompida
        }
    } else {
        logger.info('Usando autenticação baseada em arquivo (pasta session)...');
    }

    ({ state, saveCreds } = await useMultiFileAuthState(sessionDir));

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    // O logger para o Baileys e para a camada de sinal (signal)
    const baileysLogger = pino({ level: 'silent' });

    const sock = makeWASocket({
        version,
        // Injeta o logger silencioso na camada de sinal para evitar os logs de "Closing session"
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        logger: baileysLogger,
        // Usar um User-Agent mais padrão pode aumentar a estabilidade da conexão inicial.
        // Este simula o WhatsApp Web rodando em um navegador Chrome no Windows.
        browser: ['Chrome (Windows)', 'Chrome', '114.0.5735.199']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Só mostra o QR Code se não estivermos usando a sessão da variável de ambiente
            if (!process.env.WHATSAPP_SESSION) {
                qrcode.generate(qr, { small: true });
                console.log('📡 Escaneie o QR Code com o seu WhatsApp (Configurações > Aparelhos conectados > Conectar um aparelho).');
            }
        }

        if (connection === 'open') {
            logger.info('✅ Conexão com o WhatsApp aberta!');
            reconnectionAttempts = 0; // Reseta o contador de tentativas ao conectar
        } else if (connection === 'close') {
            // A reconexão deve ocorrer em qualquer erro, exceto 'loggedOut' (desconectado manualmente).
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = (lastDisconnect.error instanceof Boom) && statusCode !== DisconnectReason.loggedOut;
            
            const errorMessage = lastDisconnect.error?.output?.payload?.message || lastDisconnect.error?.message;
            logger.warn(`❌ Conexão fechada: "${errorMessage}". Tentando reconectar: ${shouldReconnect}`);

            if (shouldReconnect && reconnectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectionAttempts++;
                const delay = Math.pow(2, reconnectionAttempts) * 1000; // Backoff exponencial

                // Se o erro for um 500 (Internal Server Error), é provável que a sessão esteja corrompida.
                // Vamos limpá-la para forçar a geração de um novo QR Code.
                if (statusCode === 500 && existsSync(sessionDir)) {
                    logger.warn('Erro 500 detectado. Limpando a sessão para forçar uma nova autenticação...');
                    rmSync(sessionDir, { recursive: true, force: true });
                }
                logger.info(`Tentando reconectar em ${delay / 1000} segundos... (Tentativa ${reconnectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(startBot, delay);
            } else {
                if (reconnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    logger.error(`❗ Atingido o número máximo de tentativas de reconexão. Encerrando.`);
                } else {
                    // Se a desconexão foi por 'loggedOut', a sessão é inválida.
                    if (statusCode === DisconnectReason.loggedOut) {
                        logger.error(`🚫 Logout detectado (código ${statusCode}). A sessão foi invalidada e será removida.`);
                    } else {
                        logger.error(`❗ Conexão permanente perdida, código: ${statusCode}. A sessão é inválida.`);
                    }
                }
                
                if (existsSync(sessionDir)) {
                    logger.info('Limpando sessão antiga para gerar um novo QR Code na próxima inicialização...');
                    rmSync(sessionDir, { recursive: true, force: true });
                }
                // Em um ambiente de produção, queremos que o serviço pare e seja reiniciado pelo gerenciador (como o Render).
                // Isso força uma reinicialização limpa em vez de um loop de reconexão falho.
                logger.info('Encerrando o processo. O serviço de hospedagem deve reiniciar o bot automaticamente. Se estiver rodando localmente, inicie novamente.');
                process.exit(1); // Encerra o processo com um código de erro.
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            // Itera sobre todas as mensagens recebidas no evento
            for (const msg of m.messages) {
                await handleMessage(sock, msg, logger);
            }
        } catch (error) {
            logger.error({ error }, '❌ Erro ao processar mensagem');
        }
    });
}

startBot();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Aplicações podem querer registrar isso e/ou sair
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // É recomendado reiniciar o processo em caso de exceções não capturadas
    process.exit(1);
});
