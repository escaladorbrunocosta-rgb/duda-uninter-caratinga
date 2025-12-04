import { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log('\n📡 Scan QR below:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      // Aqui pode enviar mensagem, iniciar lógica, etc.
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Conexão fechada:', reason);
      if (reason !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log('❗ Sessão desconectada. Apague a pasta session/ para reconectar.');
      }
    }
  });
}

startBot();
