// =================================================================
// ARQUIVO: index.js
// DESCRIÇÃO: Ponto de entrada do Bot WhatsApp com Baileys.
// Gerencia a conexão, eventos e o servidor web para keep-alive.
// =================================================================

import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import express from 'express';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import path from 'path';

import logger from './logger.js';
import { loadKnowledgeBase, getResponse } from './knowledgeBase.js';
import { initializeGit, autoGitPush } from './utils/git.js';
import { ensureDirExists, deleteDir } from './utils/file.js';
// ===========================
// CONFIGURAÇÃO DO SERVIDOR EXPRESS
// ===========================
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SESSION_DIR = path.join(process.cwd(), 'session_data');

const execAsync = promisify(exec);

// ===========================
// FUNÇÃO: Mostrar QR no Terminal
// ===========================
function printBigQR(qr) {
  console.clear();
  console.log("\n\n===========================================================");
  console.log("==============    ESCANEIE O QR CODE ABAIXO    ============");
  console.log("======   Abra o WhatsApp > Aparelhos Conectados > Conectar  ======");
  console.log("===========================================================");
  // Usamos qrcode-terminal para garantir a exibição em qualquer ambiente.
  qrcode.generate(qr, { small: true });
  console.log("====================    AGUARDANDO...    ==================\n\n");
}

// ===========================
// FUNÇÃO PRINCIPAL DE CONEXÃO
// ===========================
async function startBot() {
  logger.info("Iniciando o bot...");

  // Garante que o diretório da sessão exista antes de usar
  await ensureDirExists(SESSION_DIR);
  logger.info(`[AUTH] Diretório de sessão verificado em: ${SESSION_DIR}`);

  // Carrega o estado de autenticação da pasta
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  logger.info("[AUTH] Estado de autenticação carregado da pasta local.");

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Baileys versão: ${version.join('.')} (mais recente: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // Desativamos o padrão para usar nossa função customizada
    auth: state, // Carrega a sessão
    browser: ["DudaBot", "Chrome", "1.0"],
    shouldIgnoreJid: jid => jid.endsWith('@g.us'),
  });

  // ===========================
  // SALVAR CREDENCIAIS E SINCRONIZAR COM GIT
  // O evento 'creds.update' é o gatilho para salvar o estado de autenticação.
  // ===========================
  sock.ev.on('creds.update', saveCreds); // Salva localmente
  sock.ev.on('creds.update', autoGitPush); // Envia para o GitHub

  // ===========================
  // MONITORAR EVENTOS DE CONEXÃO
  // ===========================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) printBigQR(qr);

    if (connection === "open") { // Conexão bem-sucedida
      console.clear();
      logger.info("🎉 BOT CONECTADO COM SUCESSO AO WHATSAPP!");
      logger.info("[GIT] Iniciando sincronização da sessão com o GitHub...");
      await autoGitPush(); // Salva a sessão no GitHub assim que conectar
    }

    if (connection === "close") { // Conexão fechada
      const reason = lastDisconnect?.error?.output?.statusCode;
      logger.error(`Conexão fechada. Razão: ${DisconnectReason[reason] || 'Desconhecido'}. Código: ${reason}`);

      // Lógica para lidar com sessão corrompida (Logged Out)
      if (reason === DisconnectReason.loggedOut) {
        logger.warn("[AUTH] Sessão corrompida ou desconectada remotamente. Apagando dados locais para gerar novo QR Code.");
        await deleteDir(SESSION_DIR);
        logger.info("[AUTH] Pasta da sessão local apagada. Reiniciando o bot...");
        // O commit da remoção será feito na próxima conexão bem-sucedida
        startBot();
      } else {
        logger.info("Tentando reconectar em 10 segundos...");
        setTimeout(startBot, 10000);
      }
    }
  });

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
      const text = msg.message?.conversation 
        || msg.message.extendedTextMessage?.text 
        || "";

      if (!text) return;

      logger.info(`Mensagem recebida de ${from}: ${text}`);

      // Extrai o nome do usuário (se disponível)
      const userName = msg.pushName || "você";
      
      // Centraliza toda a lógica de resposta no knowledgeBase.js
      const replyText = await getResponse(from, text, userName);
      
      // Envia a resposta obtida
      await sock.sendMessage(from, { text: replyText });
      logger.info(`Resposta enviada para ${from}: ${replyText.substring(0, 50)}...`);
    } catch (e) {
      logger.error("Erro no handler de mensagens", e);
    }
  });
}

// ===========================
// ROTA KEEP-ALIVE PARA O RENDER
// ===========================
app.get('/', (req, res) => {
  // logger.info('Rota GET / foi acessada (Keep-Alive).'); // Opcional: pode poluir os logs.
  res.send('🤖 Duda Uninter Bot está no ar e saudável!');
});

// ===========================
// INICIALIZAÇÃO DA APLICAÇÃO
// ===========================
app.listen(port, async () => {
  logger.info(`🚀 Servidor Express rodando na porta ${port}.`);

  try {
    await loadKnowledgeBase(); // 1. Carrega a base de conhecimento
    await initializeGit();     // 2. Sincroniza o repositório Git para obter a sessão mais recente
    await startBot();          // 3. Inicia o bot do WhatsApp
  } catch (error) {
    logger.fatal("Falha crítica durante a inicialização do bot.", error);
    process.exit(1); // Encerra o processo se a inicialização falhar
  }
});
