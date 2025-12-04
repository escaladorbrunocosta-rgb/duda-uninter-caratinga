import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

        const client = makeWASocket({
            auth: state
        });

        client.ev.on('creds.update', saveCreds);

        client.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Imprime QR no terminal manualmente
                qrcode.generate(qr, { small: true });
                console.log("📱 Escaneie este QR com seu WhatsApp!");
            }

            if(connection === 'open') console.log('✅ WhatsApp conectado!');
            if(connection === 'close') {
                const reason = new Boom(lastDisconnect?.error).output.statusCode;
                console.log(`❌ Conexão fechada (reason=${reason}). Reiniciando...`);
                setTimeout(startBot, 5000);
            }
        });

        client.ev.on('messages.upsert', async (msg) => {
            if(msg.messages && msg.messages[0]?.message?.conversation){
                const text = msg.messages[0].message.conversation;
                const from = msg.messages[0].key.remoteJid;
                console.log(`📩 Mensagem de ${from}: ${text}`);
                if(text.toLowerCase() === 'oi'){
                    await client.sendMessage(from, { text: 'Olá! Estou online ✅' });
                }
            }
        });

    } catch (e) {
        console.error('🔥 Erro crítico, reiniciando...', e);
        setTimeout(startBot, 5000);
    }
}

startBot();

