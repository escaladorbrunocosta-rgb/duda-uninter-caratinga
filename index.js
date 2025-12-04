// Polyfill para a API de criptografia global esperada pelo Baileys.
// Isso é necessário em alguns ambientes Node.js onde `globalThis.crypto` não está disponível por padrão.
// Referência: https://github.com/WhiskeySockets/Baileys/issues/962
import { webcrypto } from 'node:crypto';
if (typeof globalThis.crypto !== 'object') {
    globalThis.crypto = webcrypto;
}

import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs'; // Importa o módulo de sistema de arquivos nativo do Node.js
import qrcode from 'qrcode-terminal'; // Importa a biblioteca para gerar QR Code no terminal
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
    const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });
    const sessionDir = 'session';
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: logger.child({ level: 'silent' }) // Usamos nosso próprio logger
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info('Gerando QR Code para escanear no terminal...');
            qrcode.generate(qr, { small: true });
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
                logger.error('❗ Conexão permanente perdida (Logged Out).');
                if (fs.existsSync(sessionDir)) {
                    logger.info('Limpando sessão antiga para gerar um novo QR Code na próxima inicialização...');
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                }
                logger.info('Encerrando o processo. O serviço deve reiniciar automaticamente e gerar um novo QR Code.');
                // Encerra o processo. Em ambientes como Render, o serviço será reiniciado.
                process.exit(1);
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
