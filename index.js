import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  isJidBroadcast,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import http from 'http';

// --- CONFIGURAÇÃO DO SERVIDOR HTTP PARA O RENDER.COM ---
import { getResponse, loadKnowledgeBase } from './knowledgeBase.js';

// --- CONFIGURAÇÃO DO SERVIDOR HTTP PARA O RENDER.COM ---
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Bot is running'
  }));
});

server.listen(PORT, () => {
  console.log(`✅ Servidor HTTP iniciado na porta ${PORT} para health checks do Render.`);
});
// --- FIM DA CONFIGURAÇÃO DO SERVIDOR ---

// Diretório para armazenar a autenticação
const AUTH_DIR = './auth_info_multi';

// Configuração do Logger Pino para não imprimir o QR Code no terminal
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});

// Carrega a base de conhecimento no início.
loadKnowledgeBase().catch(err => {
    console.error("❌ Falha fatal ao carregar knowledgeBase.json:", err);
    process.exit(1);
});

// Função principal para iniciar a conexão com o WhatsApp
async function startConnection() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false, // Garante que o QR não seja impresso no terminal pela biblioteca
    browser: ['DudaBot', 'Chrome', '1.0'],
    syncFullHistory: true,
    shouldIgnoreJid: (jid) => jid.includes('@broadcast'),
  });

  // Listener para eventos de conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Imprime APENAS a linha de HTML com o conteúdo do QR Code.
      console.log(`<div style="color:red; font-weight:bold;">QR_CODE: ${qr}</div>`);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

      console.log('❌ Conexão fechada. Motivo:', lastDisconnect?.error, 'Reconectando:', shouldReconnect);

      if (shouldReconnect) {
        await startConnection();
      } else {
        console.error('🚫 Logout detectado. Não foi possível reconectar. Delete a pasta de autenticação e reinicie.');
        // Em caso de logout, o Render pode reiniciar o serviço, mas ele não vai reconectar.
        // O ideal é apagar a pasta auth_info_multi e fazer o deploy novamente.
      }
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!');
    }
  });

  // Listener para salvar credenciais
  sock.ev.on('creds.update', saveCreds);

  // Listener para novas mensagens (aqui você implementará a lógica do knowledgeBase.json)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    // Ignora mensagens sem conteúdo, de status, ou enviadas pelo próprio bot
    if (!msg.message || msg.key.fromMe || !msg.message.conversation) {
      return;
    }

    const chatId = msg.key.remoteJid;
    const messageText = msg.message.conversation.trim();
    const userName = msg.pushName || 'Usuário';

    console.log(`💬 Mensagem recebida de ${userName} (${chatId}): "${messageText}"`);

    const response = await getResponse(chatId, messageText, userName);

    try {
      await sock.sendMessage(chatId, { text: response });
    } catch (error) {
      console.error(`❌ Falha ao enviar mensagem para ${chatId}:`, error);
    }
  });
}

// Inicia o bot
startConnection().catch(err => console.error("Erro ao iniciar o bot:", err));


// --- Lógica de graceful shutdown ---
const cleanup = (signal) => {
  console.log(`\nRecebido ${signal}. Desligando graciosamente...`);
  // Aqui você pode adicionar lógicas para fechar conexões com o banco de dados, etc.
  server.close(() => {
    console.log('Servidor HTTP fechado.');
    process.exit(0);
  });

  // Força o encerramento se o desligamento gracioso demorar muito
  setTimeout(() => {
    console.error('Desligamento gracioso demorou muito, forçando encerramento.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));