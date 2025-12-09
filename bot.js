// =================================================================
// ARQUIVO: src/bot.js
// Módulo principal do bot (lógica de conexão e configuração)
// =================================================================

import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Pool } from 'pg';
import { usePostgreSQLAuthState } from 'postgres-baileys';
import { registerEventHandlers } from './handlers.js';

const isProduction = process.env.NODE_ENV === 'production';

// --- Configuração do Banco de Dados ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Em produção (Render), SSL é obrigatório.
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// --- Logger ---
// Em produção, gera logs em JSON. Em desenvolvimento, o pino-pretty formata a saída.
const logger = pino({ level: isProduction ? 'info' : 'debug' });

/**
 * Inicia a conexão com o WhatsApp, configura os eventos e o armazenamento de sessão.
 */
export async function startBot() {
  console.log('▶️  Iniciando o bot...');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`▶️  Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

  console.log('▶️  Carregando sessão do banco de dados PostgreSQL...');
  const { state, saveCreds, removeCreds } = await usePostgreSQLAuthState(pool, 'duda-uninter-bot');

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // NUNCA imprimir QR no terminal
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ['DudaUninter', 'Chrome', '1.0'],
    // Sugestão: Adicionar um timeout para a conexão
    connectTimeoutMs: 60_000,
    // Sugestão: Manter a conexão viva
    keepAliveIntervalMs: 20_000,
  });

  // Registra todos os handlers de eventos do Baileys (conexão, mensagens, etc.)
  registerEventHandlers(sock, removeCreds);

  // --- Lógica de Autenticação para Render.com ---
  // Se não estiver registrado, tenta obter o código de pareamento ou o QR.
  if (!sock.authState.creds.registered) {
    // Em produção, usa o código de pareamento via variável de ambiente.
    if (isProduction) {
      const phoneNumber = process.env.BOT_PHONE_NUMBER;
      if (!phoneNumber) {
        console.error('❌ ERRO: BOT_PHONE_NUMBER não definido nas variáveis de ambiente.');
        process.exit(1);
      }
      console.log(`▶️  Solicitando código de pareamento para o número: ${phoneNumber}`);
      setTimeout(async () => {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('=================================================');
        console.log('||   Seu código de pareamento do WhatsApp é:   ||');
        console.log(`||             ${code.toUpperCase()}                  ||`);
        console.log('=================================================');
      }, 3000);
    }
  }
}