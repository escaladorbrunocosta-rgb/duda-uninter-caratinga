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

// ===========================
// FUNÇÃO PRINCIPAL DE CONEXÃO
// ===========================
async function connectToWhatsApp() {
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
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logger.error(`Conexão fechada. Código: ${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
        logger.fatal("Sessão expirada. Será necessário gerar novo QR ou nova SESSION_DATA.");
        return;
      }

      logger.warn("Reconectando automaticamente...");
      connectToWhatsApp();
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

      // 🚫 BLOQUEIO ABSOLUTO DE GRUPOS
      if (from.endsWith("@g.us")) {
        logger.warn(`Mensagem ignorada (grupo detectado): ${from}`);
        return;
      }

      // ====================
      // LÓGICA DE RESPOSTA AUTOMÁTICA
      // ====================
      const text = msg.message.conversation 
        || msg.message.extendedTextMessage?.text 
        || "";

      if (!text) return;

      logger.info(`Mensagem recebida de ${from}: ${text}`);

      const user = text.trim().toLowerCase();

      if (user === "oi" || user === "olá" || user.includes("bom dia") || user.includes("boa tarde") || user.includes("boa noite")) {
        await sock.sendMessage(from, { text: "Olá! Eu sou a Duda 🤖. Como posso ajudar você hoje?" });
        return;
      }

      if (user.includes("mensalidade")) {
        await sock.sendMessage(from, {
          text: "💳 *Informações sobre mensalidade*\n\n• Pagamento via boleto ou cartão\n• Descontos para pagamento antecipado\n• 2ª via direto no portal do aluno\n\nQuer que eu gere o link para você?",
        });
        return;
      }

      if (user.includes("matrícula") || user.includes("matricula")) {
        await sock.sendMessage(from, {
          text: "📝 *Informações sobre matrícula*\n\nTemos vagas abertas! Posso te enviar:\n1️⃣ Cursos disponíveis\n2️⃣ Documentação necessária\n3️⃣ Formas de ingresso\n\nO que deseja?",
        });
        return;
      }

      if (user.includes("ead") || user.includes("curso")) {
        await sock.sendMessage(from, {
          text: "🎓 *Cursos EAD Uninter*\n\nTemos graduação, pós e cursos livres.\nQuer ver lista completa ou falar com um atendente?",
        });
        return;
      }

      // Resposta padrão se não entender
      await sock.sendMessage(from, {
        text: "🤖 Não entendi exatamente… mas posso ajudar com:\n\n• Matrícula\n• Mensalidade\n• Cursos\n• Polo Caratinga\n\nDigite uma palavra-chave (ex: *matrícula*).",
      });

    } catch (e) {
      logger.error("Erro no handler de mensagens", e);
    }
  });
}

// ===========================
// INICIAR BOT
// ===========================
connectToWhatsApp();
