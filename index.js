// =================================================================
// ARQUIVO: index.js
// DESCRIÇÃO: Bot WhatsApp Baileys - QR destacado, bloqueio de grupos, respostas automáticas
// =================================================================

import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  BufferJSON,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import logger from './logger.js';
import { loadKnowledgeBase, getResponse } from './knowledgeBase.js';
import { config } from './config.js';
import { sendSessionInvalidNotification } from './notifications.js';

// ===========================
// FUNÇÃO: Mostrar QR no Terminal (bem destacado)
// ===========================
function printBigQR(qr) {
  console.clear();
  console.log("\n\n===========================================================");
  console.log("==============    ESCANEIE O QR CODE ABAIXO    ============");
  console.log("===========================================================\n");
  qrcode.generate(qr, { small: false });
  console.log("\n===========================================================");
  console.log("====================    AGUARDANDO...    ==================");
  console.log("===========================================================\n\n");
}

let reconnectAttempts = 0;

// ===========================
// FUNÇÃO PRINCIPAL DE CONEXÃO
// ===========================
async function connectToWhatsApp() {
  // Carrega a base de conhecimento antes de iniciar a conexão
  await loadKnowledgeBase();

  let state, saveCreds;

  if (process.env.SESSION_DATA) {
    logger.info("Carregando sessão da variável de ambiente...");
    const sessionData = JSON.parse(process.env.SESSION_DATA, BufferJSON.reviver);
    saveCreds = async () => {};
    state = {
      creds: sessionData.creds,
      keys: {
        get: (type, ids) => sessionData.keys[type]?.get(ids),
        set: (data) => Object.assign(sessionData.keys, data)
      }
    };
  } else {
    logger.info("Usando autenticação local (auth_info_multi)...");
    ({ state, saveCreds } = await useMultiFileAuthState("auth_info_multi"));
  }

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Baileys versão: ${version.join('.')} (mais recente: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["DudaBot", "Chrome", "1.0"],
    // Reforço: Ignora jids de grupo para evitar erros de descriptografia de sessão dupla.
    shouldIgnoreJid: jid => jid.endsWith('@g.us'),
  });

  // ===========================
  // MONITORAR EVENTOS DE CONEXÃO
  // ===========================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) printBigQR(qr);

    if (connection === "open") {
      console.clear();
      logger.info("🎉 BOT CONECTADO AO WHATSAPP COM SUCESSO!");
      reconnectAttempts = 0; // Reseta o contador de tentativas ao conectar com sucesso
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logger.error(`Conexão fechada. Código: ${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
        logger.fatal("Sessão expirada. Será necessário gerar novo QR ou nova SESSION_DATA.");
        sendSessionInvalidNotification(); // Envia notificação para o Discord
        return;
      }

      if (reconnectAttempts < config.MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        logger.warn(`Tentando reconectar... (Tentativa ${reconnectAttempts} de ${config.MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectToWhatsApp, 5000); // Espera 5 segundos antes de tentar novamente
      } else {
        logger.fatal(`Falha ao reconectar após ${config.MAX_RECONNECT_ATTEMPTS} tentativas. O bot será desligado.`);
        process.exit(1); // Desliga o processo se não conseguir reconectar
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // ====================
  // RECEBIMENTO DE MENSAGENS
  // ====================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message) return;

      const from = msg.key.remoteJid;

      // ====================
      // LÓGICA DE RESPOSTA AUTOMÁTICA
      // ====================
      const text = msg.message.conversation 
        || msg.message.extendedTextMessage?.text 
        || "";

      if (!text) return;

      logger.info(`Mensagem recebida de ${from}: ${text}`);

      // Extrai o nome do usuário (se disponível)
      const userName = msg.pushName || "pessoa";
      
      // Centraliza toda a lógica de resposta no knowledgeBase.js
      const replyText = await getResponse(from, text, userName);
      
      // Envia a resposta obtida
      await sock.sendMessage(from, { text: replyText });

    } catch (e) {
      logger.error("Erro no handler de mensagens", e);
    }
  });
}

// ===========================
// INICIAR BOT
// ===========================
connectToWhatsApp();
