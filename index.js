// =================================================================
// ARQUIVO: index.js
// DESCRIÇÃO: Bot WhatsApp Baileys integrado com Express para deploy no Render.
// =================================================================

import dotenv from 'dotenv';
dotenv.config();
import express from 'express';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import logger from './logger.js'; // Assumindo que logger.js existe e está configurado
import { loadKnowledgeBase, getResponse } from './knowledgeBase.js'; // Assumindo que knowledgeBase.js existe
// Não precisamos de config.js ou notifications.js para o modo efêmero
// import { config } from './config.js'; // Removido: Não usado para reconexão efêmera
// import { sendSessionInvalidNotification } from './notifications.js'; // Removido: Não usado para sessão efêmera

// ===========================
// CONFIGURAÇÃO DO SERVIDOR EXPRESS
// ===========================
const app = express();
const port = process.env.PORT || 3000;

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
export async function startBot() { // Exporta a função para ser usada por start.js
  // Carrega a base de conhecimento antes de iniciar a conexão
  await loadKnowledgeBase();

  // Em ambiente efêmero, não persistimos a sessão.
  // O Baileys gerará um novo QR Code a cada inicialização.
  logger.info("Iniciando autenticação... Gerando novo QR Code a cada inicialização.");

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Baileys versão: ${version.join('.')} (mais recente: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true, // IMPRIME O QR CODE NO TERMINAL
    // Não passamos 'auth' para forçar um novo QR Code a cada inicialização
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

    if (connection === "open") { // Conexão bem-sucedida
      console.clear();
      logger.info("🎉 BOT CONECTADO AO WHATSAPP COM SUCESSO!");
    }

    if (connection === "close") { // Conexão fechada
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logger.error(`Conexão fechada devido a: ${lastDisconnect?.error?.message || 'Erro desconhecido'}. Código: ${statusCode}`);

      // Em um ambiente efêmero, qualquer desconexão (exceto talvez um erro irrecuperável que exija intervenção)
      // deve levar a uma nova tentativa de conexão, que gerará um novo QR.
      logger.warn("Conexão fechada. Tentando iniciar uma nova sessão (novo QR Code).");
      // Pequeno delay para evitar loop muito rápido em caso de falha imediata
      setTimeout(startBot, 5000);
    }
  });

  // Não há 'creds.update' para salvar, pois a sessão não é persistente.

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
// ROTA KEEP-ALIVE PARA O RENDER
// ===========================
app.get('/', (req, res) => {
  logger.info('Rota GET / foi acessada (Keep-Alive).');
  res.send('🤖 Duda Uninter Bot está no ar e saudável!');
});

// ===========================
// INICIAR BOT
// ===========================
app.listen(port, () => {
  logger.info(`🚀 Servidor Express rodando na porta ${port}.`);
  logger.info('Iniciando conexão com o WhatsApp...');
  // Inicia o bot do WhatsApp APÓS o servidor web estar no ar.
  startBot();
});
