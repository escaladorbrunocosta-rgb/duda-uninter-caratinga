import baileys, {
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import express from "express";
import 'dotenv/config';
import logger from "./logger.js";
import { handleMessage } from "./messageHandler.js";

let botInstance = null; // Variável para armazenar a instância do bot

async function iniciarBot() {
  if (botInstance) return botInstance; // Se já existe uma instância, não cria outra

  // --- LÓGICA DE AUTENTICAÇÃO MODIFICADA ---
  let state;
  const session = process.env.BAILEYS_SESSION;

  if (session?.length) {
    // Se a sessão existir, decodifica e a usa
    const creds = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
    state = { creds, keys: {} }; // Apenas as credenciais são necessárias
    logger.info("🔑 Usando sessão existente da variável de ambiente.");
  } else {
    // Se não houver sessão, inicia do zero
    state = { creds: {}, keys: {} };
    logger.warn("⚠️ Nenhuma sessão encontrada. Iniciando do zero.");
  }

  const saveCreds = async () => {
    // Converte o estado atual para uma string base64
    const sessionString = Buffer.from(JSON.stringify(state.creds)).toString("base64");
    logger.info("💾 Nova string de sessão gerada. Salve-a na variável de ambiente BAILEYS_SESSION.");
  };
  // --- FIM DA LÓGICA DE AUTENTICAÇÃO ---

  const { version } = await fetchLatestBaileysVersion();

  const sock = baileys.default({
    auth: state,
    version,
    printQRInTerminal: true,
    logger: logger,
    syncFullHistory: false,
  });

  botInstance = sock; // Armazena a instância do bot

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];

    // Ignora mensagens sem conteúdo ou enviadas pelo próprio bot
    if (!message.message || message.key.fromMe) {
      return;
    }

    const sender = message.key.remoteJid;
    const text = (
      message.message.conversation ||
      message.message.extendedTextMessage?.text || // Mensagens de texto normais
      message.message.buttonsResponseMessage?.selectedButtonId || // Respostas de botões
      ""
    ).trim();

    if (!text) return; // Ignora mensagens vazias (ex: status, chamadas)

    logger.info(`[MENSAGEM] De: ${sender} | Texto: "${text}"`);

    const isButtonResponse = !!message.message.buttonsResponseMessage;
    const response = handleMessage(sender, text, isButtonResponse);

    if (response) {
      // Lógica para enviar diferentes tipos de mensagem
      switch (response.type) {
        case 'text':
          await sock.sendMessage(sender, { text: response.content });
          break;
        case 'image':
          await sock.sendMessage(sender, { 
            image: { url: response.content },
            caption: response.caption 
          });
          break;
        case 'document':
          await sock.sendMessage(sender, { 
            document: { url: response.content },
            mimetype: 'application/pdf',
            fileName: response.fileName
          });
          break;
        case 'buttons':
          const buttons = response.buttons.map(btn => ({
            buttonId: btn.id,
            buttonText: { displayText: btn.text },
            type: 1
          }));

          const buttonMessage = {
            text: response.content,
            footer: response.footer,
            buttons: buttons,
            headerType: 1
          };
          await sock.sendMessage(sender, buttonMessage);
          break;
      }
    } else {
      logger.info(`[RESPOSTA] Nenhuma resposta encontrada para a mensagem de ${sender}. Lógica de fallback acionada.`);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      botInstance = null; // Limpa a instância ao desconectar

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.error(`🔌 Conexão fechada: ${lastDisconnect?.error}, reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(iniciarBot, 5000); // Tenta reconectar após 5 segundos
      }
    } else if (update.connection === "open") {
      console.log("✅ Bot conectado ao WhatsApp!");
    }
  });
  // Retorna uma promessa que resolve quando a conexão é aberta
  return new Promise((resolve, reject) => {
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        resolve(sock);
      }
      // Se a conexão fechar ANTES de abrir, rejeitamos a promessa
      if (update.connection === 'close') {
        const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        // Rejeita apenas se não for um logout, pois isso indica um erro real de conexão
        if (shouldReconnect) reject(update.lastDisconnect?.error);
      }
    });
  });
}

async function pararBot() {
  if (botInstance) {
    logger.warn('🔌 Desconectando o bot...');
    // Envia um logout para invalidar a sessão e fechar a conexão
    await botInstance.logout();
    botInstance = null;
    return true;
  }
  return false;
}

async function reiniciarBot() {
  logger.warn('🔄 Reiniciando o bot...');
  await pararBot();
  // Aguarda um pouco para garantir que a desconexão foi processada
  await new Promise(resolve => setTimeout(resolve, 2000));
  await iniciarBot();
  logger.info('✅ Bot reiniciado e tentando conectar.');
}

// 1. Inicia o servidor web para responder ao Render
const app = express();
const PORT = process.env.PORT || 8080;

// Endpoint de status para o Render saber que o servidor está no ar
app.get("/", (req, res) => res.send("Servidor online. Iniciando conexão com o WhatsApp..."));

// Endpoint de saúde simplificado
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Endpoint para reiniciar o bot de forma segura
app.post("/restart", async (req, res) => {
  const secret = req.query.secret;

  if (!process.env.RESTART_SECRET || secret !== process.env.RESTART_SECRET) {
    logger.warn(`[SEGURANÇA] Tentativa de reinicialização não autorizada.`);
    return res.status(401).json({ error: "Não autorizado" });
  }

  try {
    await reiniciarBot();
    res.status(200).json({ message: "O bot está sendo reiniciado." });
  } catch (error) {
    logger.error({ err: error }, "❌ Falha ao reiniciar o bot.");
    res.status(500).json({ error: "Falha ao reiniciar o bot." });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Servidor HTTP iniciado na porta ${PORT}.`);
  // 2. Inicia a conexão com o WhatsApp DEPOIS que o servidor está no ar
  iniciarBot().catch(err => logger.fatal({ err }, "❌ Falha crítica ao iniciar o bot."));
});
