/**
 * =================================================================
 * ARQUIVO: bot-inteligente/index.js
 * DESCRIÇÃO: BOT_INTELIGENTE - Ponto de entrada e orquestração do atendimento.
 * RESPONSABILIDADE: Usar a sessão existente para conectar,
 * receber mensagens e delegar o processamento para o messageHandler.
 * =================================================================
 */

import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import fs from 'fs';
import { initializeWhatsAppClient } from './connection.js';
import { getResponse } from './messageHandler.js';

// --- Configuração de Caminhos e Logger ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// O diretório da sessão é o mesmo do bot-base, na raiz do projeto.
const SESSION_DIR = path.join(__dirname, '..', 'auth'); // Caminho compartilhado
const LOGS_DIR = path.join(__dirname, 'logs-inteligente'); // Corrigido para pasta local

// Garante que o diretório de logs exista
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const logger = pino({
    level: 'info',
}, pino.destination(path.join(LOGS_DIR, 'bot-inteligente.log')));

/**
 * Função principal que inicializa e gerencia a conexão do bot.
 */
async function startBot() {
  logger.info("Iniciando o BOT-INTELIGENTE...");

  // Verifica se a pasta de sessão existe. Se não, instrui o usuário.
  if (!fs.existsSync(SESSION_DIR) || fs.readdirSync(SESSION_DIR).length === 0) {
    console.error("🟥 ERRO: A pasta de sessão 'auth' está vazia ou não existe.");
    console.error("👉 Por favor, execute o 'bot-base' primeiro para gerar a sessão com o QR Code.");
    logger.error("[AUTH] Falha ao iniciar: diretório de sessão não encontrado ou vazio.");
    process.exit(1); // Encerra o processo com código de erro
  }

  const onConnectionUpdate = (update, restart) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      console.clear();
      logger.info("🎉 BOT-INTELIGENTE conectado e pronto para atender!");
      console.log("🎉 BOT-INTELIGENTE conectado e pronto para atender!");
    }
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode === 401) { // 401 = Logged Out
        logger.fatal("[AUTH] Sessão inválida. O bot-base precisa ser executado para gerar uma nova sessão.");
        console.error("🟥 ERRO: Sessão do WhatsApp desconectada. Execute o 'bot-base' novamente.");
        process.exit(1);
      } else {
        logger.info("Tentando reconectar em 10 segundos...");
        setTimeout(restart, 10000);
      }
    }
  };

  const onMessagesUpsert = async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message.extendedTextMessage?.text || "";
    const userName = msg.pushName || "aluno(a)";
    if (!text) return;
    
    logger.info(`[MSG] Mensagem de ${userName} (${from}): "${text}"`);

    const replyText = await getResponse(from, text, userName);
    await sock.sendMessage(from, { text: replyText });
    logger.info(`[REPLY] Resposta para ${from}: "${replyText.substring(0, 80)}..."`);
  };

  const sock = await initializeWhatsAppClient({
    sessionDir: SESSION_DIR,
    logger,
    onConnectionUpdate,
    onMessagesUpsert,
  });
}

startBot().catch(err => {
    logger.fatal({ err }, "Falha crítica ao iniciar o BOT-INTELIGENTE.");
});