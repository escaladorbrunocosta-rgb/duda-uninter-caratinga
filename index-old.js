import makeWASocket, { fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import P from 'pino';
import fs from 'fs';

const logger = P({ level: 'info' });
const SESSION_FILE = './session.json';

// Função para criar um estado de autenticação válido
function loadAuthState() {
  if(fs.existsSync(SESSION_FILE)) {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE));
    // Garantir que creds e keys existam
    return {
      creds: data.creds || {},
      keys: data.keys || {}
    };
  }
  return {
    creds: {},
    keys: {}
  };
}

// Salvar authState
function saveAuthState(authState) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(authState, null, 2));
}

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  let authState = loadAuthState();

  const sock = makeWASocket({
    logger,
    auth: authState,
    printQRInTerminal: true,
    version,
    browser: ['DudaBot', 'Chrome', '1.0']
  });

  // Salvar credenciais sempre que atualizarem
  sock.ev.on('creds.update', () => {
    saveAuthState(sock.authState);
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if(connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Conexão fechada. Código: ${reason}`);
      if(reason !== DisconnectReason.loggedOut) startBot();
    } else if(connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!');
    }
  });
}

startBot().catch(err => console.log('❌ Erro ao iniciar o bot:', err));
