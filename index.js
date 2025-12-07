import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import qrcodeTerminal from 'qrcode-terminal'; // Renomeado para clareza
import { getResponse, loadKnowledgeBase } from './knowledgeBase.js';
import { config } from './config.js';
import { useSessionAuthState } from './session-auth.js';
import { sendSessionInvalidNotification } from './notifications.js';

// Cria uma instância de logger global para ser usada em handlers de processo
const globalLogger = pino({
    level: 'info',
    transport: {
        // O Pino pode ter múltiplos "alvos" (transportes) para os logs.
        targets: [
            // Alvo 1: Logs gerais e bonitos para o console de desenvolvimento.
            { target: 'pino-pretty', level: 'info', options: { colorize: true, ignore: 'pid,hostname' } },
        ]
    }
});

let reconnectionAttempts = 0;

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

        // --- Lógica do Comando de Recarga ---
        if (messageText.trim() === '/reloadkb') {
            // Verifica se o remetente é o administrador definido no config.js
            if (chatId === config.ADMIN_ID) {
                logger.warn({ adminId: chatId }, 'Comando de recarga da Knowledge Base recebido do administrador.');
                try {
                    await loadKnowledgeBase();
                    await sock.sendMessage(chatId, { text: '✅ Base de conhecimento (knowledgeBase.json) recarregada com sucesso!' });
                    logger.info('Knowledge Base recarregada com sucesso.');
                } catch (error) {
                    logger.error({ error }, '❌ Falha ao recarregar a Knowledge Base.');
                    await sock.sendMessage(chatId, { text: '❌ Erro ao recarregar a base de conhecimento. Verifique os logs.' });
                }
            } else {
                logger.warn({ chatId }, 'Tentativa não autorizada de recarregar a Knowledge Base.');
            }
            return; // Encerra o processamento aqui para comandos
        }

        // Log da mensagem recebida, com um marcador para facilitar a filtragem.
        // Este log irá para TODOS os transportes, incluindo 'conversas.log'.
        logger.info({
            log_type: 'conversation', chatId, userName, direction: 'in', message: messageText
        }, 'Mensagem recebida');

        // Simula que o bot está "digitando" para uma melhor experiência do usuário
        await sock.sendPresenceUpdate('composing', chatId);

        // Obtém a resposta da nossa base de conhecimento
        const response = getResponse(chatId, messageText, userName);

        // Verifica o tipo de resposta para decidir como enviar
        if (typeof response === 'string') {
            // --- Envio de Texto Simples ---
            await sock.sendMessage(chatId, { text: response });
            logger.info({
                log_type: 'conversation', chatId, direction: 'out', response
            }, 'Resposta de texto enviada');

        } else if (typeof response === 'object' && response.type) {
            // --- Envio de Mídia ---
            if (response.type === 'image' && response.url) {
                // Envia imagem a partir de uma URL
                await sock.sendMessage(chatId, {
                    image: { url: response.url },
                    caption: response.caption || '' // Legenda é opcional
                });
                logger.info({
                    log_type: 'conversation', chatId, direction: 'out', response
                }, 'Resposta de imagem enviada');

            } else if (response.type === 'document' && response.path) {
                // Envia documento a partir de um arquivo local
                const docPath = path.resolve(response.path);
                if (existsSync(docPath)) {
                    await sock.sendMessage(chatId, {
                        document: await fs.readFile(docPath),
                        mimetype: 'application/pdf', // Ajuste o mimetype conforme o tipo de arquivo
                        fileName: response.fileName || 'documento.pdf'
                    });
                    logger.info({
                        log_type: 'conversation', chatId, direction: 'out', response
                    }, 'Resposta de documento enviada');
                } else {
                    logger.error({ chatId, path: docPath }, 'Arquivo de documento não encontrado no caminho especificado.');
                    await sock.sendMessage(chatId, { text: 'Desculpe, não consegui encontrar o documento solicitado no momento.' });
                }
            }
        }

        // Limpa a presença (para de "digitar")
        await sock.sendPresenceUpdate('paused', chatId);

    } catch (error) {
        logger.error({ error, messageData: msg }, '❌ Erro ao processar uma mensagem específica.');
    }
}

/**
 * Modo 'START': Roda no Render para iniciar o bot.
 */
async function startBot() {
    const logger = globalLogger;
    const sessionDir = path.resolve('session');

    // Usa o novo hook de autenticação que lê da variável de ambiente
    // O segundo argumento 'true' indica que estamos em produção e não devemos gerar QR Code no terminal.
    const { state, saveCreds } = await useSessionAuthState(process.env.WHATSAPP_SESSION, true);
    
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['DudaBot', 'Chrome', '1.0'],
        shouldIgnoreJid: jid => isJidGroup(jid),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.warn('QR Code recebido em ambiente de produção. Isso não deveria acontecer se a WHATSAPP_SESSION estivesse configurada. O bot será encerrado.');
            process.exit(1); // Encerra para evitar loops
        }

        if (connection === 'open') {
            logger.info('✅ Conexão com o WhatsApp aberta!');
            reconnectionAttempts = 0;
        } else if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = (lastDisconnect.error instanceof Boom) && ![DisconnectReason.loggedOut, 401].includes(statusCode);

            logger.warn(`❌ Conexão fechada (código: ${statusCode}). Reconectar: ${shouldReconnect}`);

            if (shouldReconnect && reconnectionAttempts < config.MAX_RECONNECT_ATTEMPTS) {
                reconnectionAttempts++;
                const delay = Math.pow(2, reconnectionAttempts) * 1000;
                logger.info(`Tentando reconectar em ${delay / 1000}s (tentativa ${reconnectionAttempts})...`);
                setTimeout(startBot, delay); // Tenta reconectar
            } else {
                logger.error(`🚫 Desconexão permanente (código: ${statusCode}). Encerrando.`);
                // Se for um erro de logout, envia a notificação antes de encerrar.
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    logger.warn('Enviando notificação de sessão inválida...');
                    await sendSessionInvalidNotification();
                }
                if (existsSync(sessionDir)) {
                    rmSync(sessionDir, { recursive: true, force: true });
                }
                process.exit(1); // Encerra o processo
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        for (const msg of m.messages) {
            await handleMessage(sock, msg, logger);
        }
    });
}

// --- Lógica de Inicialização ---
(async () => {
    globalLogger.info('Iniciando bot...');
    await startBot();
})();

process.on('unhandledRejection', (reason, promise) => {
    globalLogger.error({ reason, promise }, 'Unhandled Rejection detectada.');
});

process.on('uncaughtException', (error) => {
    globalLogger.fatal({ error }, 'Uncaught Exception detectada. O bot será encerrado.');
    // Em caso de exceção não capturada, é mais seguro encerrar o processo.
    process.exit(1);
});
