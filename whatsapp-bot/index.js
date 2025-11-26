import makeWASocket, { useSingleFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false // desliga impressão automática de base64
});

sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) {
        console.log('\n🔗 Escaneie este QR code no WhatsApp:\n');
        qrcode.generate(qr, { small: false }); // ASCII maior, legível
    }
    if (connection === 'open') console.log('✅ WhatsApp conectado!');
});

sock.ev.on('creds.update', saveState);
