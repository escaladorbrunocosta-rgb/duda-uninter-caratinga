// =================================================================
// ARQUIVO: start-prod.js
// Ponto de entrada EXCLUSIVO para produção (Render).
// =================================================================

import { connectToWhatsApp } from './index.js';
import { loadKnowledgeBase } from './knowledgeBase.js';

console.log('🚀 Iniciando o bot em MODO DE PRODUÇÃO...');

loadKnowledgeBase()
  .then(() => connectToWhatsApp(true)) // Passa 'true' para forçar o modo produção
  .catch((err) => console.error('❌ Erro fatal ao iniciar o bot:', err));