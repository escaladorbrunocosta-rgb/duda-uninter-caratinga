import makeWASocket, { useSingleFileAuthState, DisconnectReason } from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

function notifyTelegram(message) {
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
        }).catch(e => console.error('Erro ao notificar Telegram:', e));
    }
}

const startBot = () => {
    const client = makeWASocket({ auth: state, printQRInTerminal: false });

    // Logs completos
    const logFile = './logs/bot.log';
    if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(logFile, entry);
        console.log(entry);
    }

    client.ev.on('connection.update', update => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) { qrcode.generate(qr, { small: true }); log('📱 Escaneie o QR com seu WhatsApp!'); }
        if (connection === 'open') log('✅ WhatsApp conectado!');
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error).output?.statusCode || lastDisconnect?.error?.status || 'Desconhecido';
            log(`❌ Conexão fechada (reason=${reason}). Reiniciando...`);
            notifyTelegram(`⚠️ Bot caiu! Motivo: ${reason}. Reiniciando...`);
            setTimeout(startBot, 5000);
        }
    });

    client.ev.on('creds.update', saveState);
    log('Bot iniciado e aguardando conexões...');
    notifyTelegram('✅ Bot iniciado com sucesso!');
};

startBot();
