import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { getResponse } from './knowledgeBase.js';

// Desestruturação para facilitar o acesso
const {
    makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = pkg;

/**
 * Processa as mensagens recebidas.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - A instância do socket do Baileys.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} m - O objeto da mensagem recebida.
 * @param {pino.Logger} logger - A instância do logger.
 */
async function handleMessage(sock, m, logger) {
    // Extrai a primeira mensagem do evento
    const msg = m.messages[0];

    // Ignora se não houver mensagem ou se for uma atualização de status
    if (!msg.message || msg.key.fromMe) return;

    // Extrai o ID do chat e o texto da mensagem
    const chatId = msg.key.remoteJid;
    const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

    // Ignora se a mensagem não tiver texto
    if (!messageText) {
        logger.info({ chatId }, 'Mensagem recebida sem texto (ex: áudio, imagem). Ignorando.');
        return;
    }

    logger.info({ chatId, message: messageText }, 'Mensagem recebida');

    // Obtém a resposta da nossa base de conhecimento
    const response = getResponse(messageText);

    // Envia a resposta
    await sock.sendMessage(chatId, { text: response });
    logger.info({ chatId, response }, 'Resposta enviada');
}

async function startBot() {
    const logger = pino({ level: 'info' });
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: logger.child({ level: 'silent' }) // Usamos nosso próprio logger
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // O Render vai capturar este console.log e exibir nos logs.
            // Não use qrcode-terminal aqui, pois ele não funciona bem em logs de servidores.
            console.log('--- INÍCIO DO QR CODE ---');
            console.log('Copie o texto abaixo e cole em um gerador de QR Code online ou use o terminal para escanear.');
            console.log(qr);
            console.log('--- FIM DO QR CODE ---');
            console.log('📡 Escaneie o QR Code com o seu WhatsApp (Configurações > Aparelhos conectados > Conectar um aparelho).');
        }

        if (connection === 'open') {
            logger.info('✅ Conexão com o WhatsApp aberta!');
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

            logger.warn({ error: lastDisconnect.error }, `❌ Conexão fechada. Deve reconectar: ${shouldReconnect}`);

            if (shouldReconnect) {
                logger.info('Tentando reconectar em 10 segundos...');
                setTimeout(startBot, 10000); // Tenta reconectar após 10 segundos
            } else {
                logger.error('❗ Conexão fechada permanentemente (Logged Out). Você precisa escanear o QR Code novamente. Se estiver no Render, reinicie o serviço e apague o disco de sessão.');
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            await handleMessage(sock, m, logger);
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
