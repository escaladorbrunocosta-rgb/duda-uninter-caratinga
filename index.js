import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, rmSync, promises as fs } from 'fs';
import path from 'path';
import qrcodeTerminal from 'qrcode-terminal'; // Renomeado para clareza
import { getResponse, loadKnowledgeBase } from './knowledgeBase.js';
import { config } from './config.js';
import { useSessionAuthState } from './session-auth.js';
import { sendSessionInvalidNotification } from './notifications.js';

// Determina se o ambiente é de produção (ex: Render)
const isProduction = !!process.env.RENDER || process.env.NODE_ENV === 'production';

// Cria uma instância de logger global para ser usada em handlers de processo
const globalLogger = pino({
    level: 'info',
    transport: {
        // Pino pode ter múltiplos "alvos" (transportes) para os logs.
        targets: [
            // Alvo 1: Logs para o console. Em produção (Render), será JSON. Em dev, será formatado.
            {
                target: isProduction ? 'pino/file' : 'pino-pretty', // 'pino/file' para stdout em JSON
                level: 'info',
                options: isProduction ? {} : { colorize: true, ignore: 'pid,hostname' }
            },
            // Alvo 2: Salva um log separado apenas com as conversas.
            {
                target: 'pino/file',
                level: 'info',
                options: { destination: 'conversas.log', mkdir: true, append: true }
            }
        ].filter(Boolean) // Filtra alvos nulos se necessário
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
        const response = await getResponse(chatId, messageText, userName); // Adiciona await

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
                        document: await fs.readFile(docPath), // CORREÇÃO: fs.readFile importado
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
    const logger = globalLogger.child({ service: 'bot-main' });
    const sessionDir = path.resolve('auth_info_multi');

    // Em produção, usa a sessão da variável de ambiente. Em dev, usa o armazenamento local.
    const { state, saveCreds } = await useSessionAuthState(
        process.env.SESSION_DATA,
        isProduction // Passa o status de produção corretamente
    );

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['DudaBot', 'Chrome', '1.0'],
        printQRInTerminal: false, // Desativa a impressão automática do QR no terminal
        shouldIgnoreJid: jid => isJidGroup(jid),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Em vez de usar qrcode-terminal ou sair, imprimimos o QR bruto em uma linha HTML.
            // Isso permite copiar o valor do log do Render e gerar o QR Code manualmente.
            logger.info('QR Code recebido. Imprimindo como HTML para captura manual.');
            console.log(`QR_CODE_HTML: <div style="color:red; font-weight:bold;">QR_CODE: ${qr}</div>`);
        }

        if (connection === 'open') {
            logger.info('✅ Conexão com o WhatsApp aberta!');
            reconnectionAttempts = 0;
        } else if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            // A reconexão só deve acontecer em erros de rede, não em erros de autenticação.
            const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                                    statusCode !== DisconnectReason.loggedOut &&
                                    statusCode !== DisconnectReason.connectionReplaced &&
                                    statusCode !== 401;

            logger.warn({ statusCode, shouldReconnect }, `❌ Conexão fechada.`);

            if (shouldReconnect && reconnectionAttempts < config.MAX_RECONNECT_ATTEMPTS) {
                reconnectionAttempts++;
                // Usa "exponential backoff" para evitar sobrecarregar o servidor ao tentar reconectar.
                const delay = Math.pow(2, reconnectionAttempts) * 1000;
                logger.info(`Tentando reconectar em ${delay / 1000}s (tentativa ${reconnectionAttempts})...`);
                setTimeout(startBot, delay);
            } else {
                if (reconnectionAttempts >= config.MAX_RECONNECT_ATTEMPTS) {
                    logger.error(`Número máximo de tentativas de reconexão (${config.MAX_RECONNECT_ATTEMPTS}) atingido.`);
                }
                logger.error(`🚫 Desconexão permanente (código: ${statusCode}). Encerrando.`);
                // Se for um erro de logout, envia a notificação antes de encerrar.
                if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.connectionReplaced) {
                    logger.warn('Sessão inválida (logout). A variável de ambiente SESSION_DATA precisa ser atualizada.');
                    // Limpa a sessão local para forçar a geração de um novo QR na próxima execução
                    if (existsSync(sessionDir)) {
                        logger.info('Limpando diretório de sessão local...');
                        rmSync(sessionDir, { recursive: true, force: true });
                    }
                    // Em produção, a notificação é mais útil para o desenvolvedor
                    await sendSessionInvalidNotification();
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
    globalLogger.info({
        isProduction,
        nodeVersion: process.version
    }, 'Iniciando bot...');

    await loadKnowledgeBase();
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
