/**
 * =================================================================
 * ARQUIVO: bot-inteligente/connection.js
 * DESCRIÇÃO: Módulo de Conexão Compartilhado com o WhatsApp.
 * RESPONSABILIDADE: Abstrair a complexidade da conexão Baileys,
 * reconexão e gerenciamento de sessão.
 * =================================================================
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';

/**
 * Inicializa e gerencia a conexão do bot com o WhatsApp.
 * @param {string} sessionDir - O diretório para salvar/carregar a sessão.
 * @param {pino.Logger} logger - A instância do logger para registrar eventos.
 * @param {Function} onConnectionUpdate - Callback para eventos de conexão.
 * @param {Function} onMessagesUpsert - Callback para novas mensagens.
 * @param {boolean} [printQRInTerminal=false] - Se deve imprimir o QR no terminal.
 * @returns {Promise<WASocket>} A instância do socket do Baileys.
 */
export async function initializeWhatsAppClient({
  sessionDir,
  logger,
  onConnectionUpdate,
  onMessagesUpsert,
  printQRInTerminal = false,
}) {
  logger.info(`[AUTH] Usando diretório de sessão: ${sessionDir}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`[BAILEYS] Versão: ${version.join('.')} (É a mais recente: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal,
    auth: state,
    browser: ["DudaBot", "Chrome", "1.0"],
    shouldIgnoreJid: jid => jid.endsWith('@g.us'),
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reasonText = DisconnectReason[reason] || 'Desconhecido';
      logger.error(`Conexão fechada. Razão: ${reasonText} (${reason})`);

      // Se deslogado, limpa a sessão para gerar novo QR
      if (reason === DisconnectReason.loggedOut) {
        logger.warn("[AUTH] Desconectado. Limpando sessão para nova autenticação.");
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }
    // Delega o tratamento mais específico para o chamador
    onConnectionUpdate(update, () => initializeWhatsAppClient(arguments[0]));
  });

  if (onMessagesUpsert) {
    sock.ev.on('messages.upsert', onMessagesUpsert);
  }

  return sock;
}