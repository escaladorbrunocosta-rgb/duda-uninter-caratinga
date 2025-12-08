// =================================================================
// ARQUIVO: index.js
// =================================================================

// --- Polyfill de Criptografia (ESSENCIAL PARA BAILEYS) ---
import './crypto-polyfill.js';

// --- Módulos e Dependências ---
import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import qrcode from 'qrcode-terminal';
import { useSessionAuthState } from './session-auth.js';
import { getResponse, loadKnowledgeBase } from './knowledgeBase.js';

console.log('✅ Script iniciado. Carregando dependências...');
const AUTH_DIR = 'auth_info_multi';

// --- Função Principal de Conexão ---
async function connectToWhatsApp() {
  console.log('▶️  Iniciando a função connectToWhatsApp...');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`▶️  Usando a versão do Baileys: ${version.join('.')}, é a mais recente: ${isLatest}`);

  const { state, saveCreds } = await useSessionAuthState(process.env.SESSION_DATA, process.env.NODE_ENV === 'production');

  const sock = makeWASocket({
    // A opção printQRInTerminal foi removida para usar um método manual mais robusto.
    auth: state,
    version, // Adiciona a versão dinamicamente
    logger: pino({ level: 'silent' }),
    browser: ['DudaBot', 'Chrome', '1.0'],
  });

  // --- Gerenciamento de Eventos da Conexão ---
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('▶️  QR Code recebido. Escaneie com seu WhatsApp abaixo:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const boomError = lastDisconnect?.error;
      const statusCode = boomError instanceof Boom ? boomError.output.statusCode : 500;

      // Lógica de reconexão aprimorada
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.connectionReplaced &&
        statusCode !== DisconnectReason.multideviceMismatch;

      console.log(`❌ Conexão fechada. Motivo: ${DisconnectReason[statusCode] || 'Desconhecido'} | Código: ${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚫 Logout detectado. A sessão é inválida e será limpa.');
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        console.log('🧹 Pasta de autenticação limpa. Reinicie o bot para gerar um novo QR Code.');
        process.exit(1); // Encerra para forçar uma nova inicialização manual
      } else if (shouldReconnect && statusCode !== 405) { // Evita reconectar no erro 405
        console.log('🔄 Tentando reconectar...');
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!');
    }
  });

  // --- Lógica para Responder Mensagens (será implementada depois) ---
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    // Ignora mensagens sem texto, de status ou que não são do usuário
    if (!msg.message || msg.key.fromMe || !msg.message.conversation) {
      return;
    }

    const chatId = msg.key.remoteJid;
    const messageText = msg.message.conversation;
    const userName = msg.pushName || 'Usuário';

    console.log(`💬 Mensagem recebida de ${userName} (${chatId}): "${messageText}"`);

    // Obtém a resposta do "cérebro" do bot
    const response = await getResponse(chatId, messageText, userName);

    // Envia a resposta para o usuário
    await sock.sendMessage(chatId, { text: response });
    console.log(`✉️ Resposta enviada para ${userName}: "${response.substring(0, 60)}..."`);
  });

  console.log('▶️  Configuração dos eventos do socket concluída.');
}

// --- Ponto de Entrada do Script ---
console.log('▶️  Chamando a função principal para iniciar a conexão...');
// Carrega a base de conhecimento antes de iniciar a conexão
loadKnowledgeBase()
  .then(() => {
    connectToWhatsApp().catch((err) => {
      console.error('❌ Erro fatal ao iniciar o bot:', err);
    });
  })
  .catch((err) => console.error('❌ Falha crítica ao carregar a base de conhecimento:', err));
