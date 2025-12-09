// =================================================================
// ARQUIVO: index.js
// Ponto de entrada da aplicação.
// Este arquivo é responsável por iniciar o bot com a configuração
// correta para o ambiente (produção ou desenvolvimento).
// =================================================================

import { startBot } from './src/bot.js';

// Inicia o bot. A configuração de ambiente (dev/prod) é lida
// a partir da variável de ambiente NODE_ENV.
startBot();
