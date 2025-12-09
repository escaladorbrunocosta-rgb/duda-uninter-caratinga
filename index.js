// =================================================================
// ARQUIVO: index.js
// =================================================================

// --- Módulos e Dependências ---
import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore, // Importação adicionada
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal'; // Importação corrigida
import { usePostgreSQLAuthState } from 'postgres-baileys';
import { Pool } from 'pg'; // Importação adicionada
import { getResponse, loadKnowledgeBase } from './knowledgeBase.js';

console.log('✅ Script iniciado. Carregando dependências...');

// --- Detecção Robusta de Ambiente e Configuração ---

// Função para verificar se um módulo pode ser resolvido.
// Isso nos permite detectar se 'pino-pretty' está disponível.
const isModuleAvailable = (path) => {
  try {
    require.resolve(path);
    return true;
  } catch (e) {
    return false;
  }
};

const isProduction = !isModuleAvailable('pino-pretty');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false, // SSL apenas em produção
});

// --- Função Principal de Conexão ---
async function connectToWhatsApp() {
  console.log('▶️  Iniciando a função connectToWhatsApp...');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`▶️  Usando a versão do Baileys: ${version.join('.')}, é a mais recente: ${isLatest}`);

  console.log('▶️  Carregando sessão do banco de dados...');
  const { state, saveCreds, removeCreds } = await usePostgreSQLAuthState(pool, 'duda-uninter-bot');

  // Configuração do logger que se adapta automaticamente ao ambiente.
  // Se 'pino-pretty' estiver instalado (desenvolvimento), ele será usado.
  // Caso contrário (produção), ele será ignorado.
  const logger = pino({
    level: 'silent',
    ...(isModuleAvailable('pino-pretty') && { transport: { target: 'pino-pretty' } }),
  });

  const sock = makeWASocket({
    printQRInTerminal: false, // Desativa o QR Code no terminal
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version, // Adiciona a versão dinamicamente
    logger,
    browser: ['DudaUninter', 'Chrome', '1.0'],
  });

  // --- Lógica de Código de Pareamento (para Render) ---
  if (!sock.authState.creds.registered && !isProduction) {
    console.log('▶️  QR Code recebido. Escaneie com seu WhatsApp abaixo:');
    sock.ev.on('connection.update', (update) => {
      const { qr } = update;
      if (qr) {
        qrcode.generate(qr, { small: true });
      }
    });
  } else if (!sock.authState.creds.registered && isProduction) {
    const phoneNumber = process.env.BOT_PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('❌ ERRO: BOT_PHONE_NUMBER não definido nas variáveis de ambiente do Render.');
      return;
    }
    console.log('▶️  Solicitando código de pareamento para o número:', phoneNumber);
    setTimeout(async () => {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('=================================================');
      console.log('||   Seu código de pareamento do WhatsApp é:   ||');
      console.log(`||             ${code.toUpperCase()}                  ||`);
      console.log('=================================================');
    }, 3000);
  }

  // --- Gerenciamento de Eventos da Conexão ---
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => { // <--- CORREÇÃO: Adicionado 'async'
    const { connection, lastDisconnect } = update;

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
        // Limpa a sessão do banco de dados
        await removeCreds();
        console.log('🧹 Sessão do banco de dados limpa. Reinicie o bot para gerar um novo código.');
        process.exit(1); // Encerra para forçar uma nova inicialização manual
      } else if (shouldReconnect) {
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
    try {
      await sock.sendMessage(chatId, { text: response });
      console.log(`✉️ Resposta enviada para ${userName}: "${response.substring(0, 60)}..."`);
    } catch (error) {
      console.error(`❌ Falha ao enviar mensagem para ${userName} (${chatId}):`, error);
      // Aqui você poderia adicionar uma lógica para tentar reenviar a mensagem ou notificar um administrador.
    }
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
