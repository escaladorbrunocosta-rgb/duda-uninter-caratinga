import baileys, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import express from "express";
import fs from "fs/promises"; // 1. Importar o módulo File System
import qrcode from "qrcode-terminal";
import pino from "pino";
import { getResponse } from "./knowledgeBase.js";

// 2. Definir o nome do arquivo de log
const CONVERSATION_LOG_FILE = "conversations.log";

// Objeto para armazenar o estado da conversa de cada usuário
const userStates = {};

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = baileys.default({
    auth: state,
    version,
    printQRInTerminal: true,
    logger: pino({ level: "info" }),
    syncFullHistory: false,
  });

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
      message.message.extendedTextMessage?.text ||
      ""
    ).trim();

    console.log(`📩 Mensagem recebida de ${sender}: "${text}"`);

    // --- LÓGICA DE CONTEXTO ---
    // 1. Verifica se há um estado salvo para este usuário
    if (userStates[sender] === 'awaiting_course_area') {
      const expectedAnswers = ['saúde', 'tecnologia', 'educação'];
      // Verifica se a resposta do usuário é uma das esperadas
      if (expectedAnswers.includes(text.toLowerCase())) {
        // Resposta válida! Processa normalmente.
        console.log(`🗣️  Contexto: Usuário ${sender} escolheu a área "${text}"`);
        // Limpa o estado para a próxima mensagem ser processada normalmente
        delete userStates[sender];
      } else {
        // Resposta inválida! O usuário não respondeu o que era esperado.
        console.log(`⚠️ Contexto: Resposta inesperada de ${sender}: "${text}"`);
        // Relembra o usuário das opções e NÃO limpa o estado.
        await sock.sendMessage(sender, { 
          text: "Desculpe, não entendi sua resposta. Por favor, escolha uma das áreas que sugeri (Saúde, Tecnologia ou Educação)." 
        });
        // Interrompe o processamento desta mensagem para não procurar na base de conhecimento.
        return; 
      }
    }
    // --- FIM DA LÓGICA DE CONTEXTO ---

    // Procura por uma resposta na base de conhecimento
    const response = getResponse(text);

    // 3. Criar a entrada de log e salvá-la no arquivo
    const logResponse = response ? `(${response.type}) ${response.content}` : 'Nenhuma resposta definida';
    const logEntry = `[${new Date().toISOString()}] [FROM: ${sender}] User: "${text}" | Bot: "${logResponse}"\n`;

    try {
      await fs.appendFile(CONVERSATION_LOG_FILE, logEntry);
    } catch (err) {
      console.error("❌ Erro ao salvar log da conversa:", err);
    }
    
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

          // 2. Define o estado do usuário após fazer a pergunta
          userStates[sender] = 'awaiting_course_area';
          console.log(`📝 Estado definido para ${sender}: awaiting_course_area`);
          break;
      }
    } else {
      // Opcional: Enviar uma mensagem padrão se nenhum comando for encontrado
      // await sock.sendMessage(sender, { text: "Desculpe, não entendi o que você disse. Pode tentar de outra forma?" });
      // Se quiser logar também as mensagens não entendidas, o código acima já faz isso.
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (update.connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("🔌 Conexão fechada por: ", lastDisconnect?.error, ", reconectando: ", shouldReconnect);

      if (shouldReconnect) {
        iniciarBot();
      }
    } else if (update.connection === "open") {
      console.log("✅ Bot conectado ao WhatsApp!");
    }
  });
}

const app = express();
app.get("/", (req, res) => res.send("Bot rodando!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado na porta ${PORT}`));

iniciarBot();
