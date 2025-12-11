import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, BufferJSON } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

async function main() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_temp');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
        const { qr, connection } = update;
        if (qr) {
            console.clear();
            console.log("==================================================");
            console.log("========== ESCANEIE O QR CODE ABAIXO ===========");
            console.log("==================================================\n");
            qrcode.generate(qr, { small: false });
        }
        if (connection === 'open') {
            console.log("\n🎉 Conectado! Agora vamos gerar a SESSION_DATA...");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            const fs = await import('fs');
            const sessionData = JSON.stringify(state, BufferJSON.replacer, 2);
            fs.writeFileSync('SESSION_DATA.json', sessionData);
            console.log("\n✅ SESSION_DATA gerada e salva em SESSION_DATA.json\n");
            process.exit(0);
        }
    });
}

main();
