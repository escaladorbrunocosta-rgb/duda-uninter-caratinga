// =================================================================
// ARQUIVO: start-dev.js
// Ponto de entrada EXCLUSIVO para desenvolvimento local.
// =================================================================

import { connectToWhatsApp } from './index.js';
import { loadKnowledgeBase } from './knowledgeBase.js';
import { promises as fs } from 'fs';
import path from 'path';

// Carrega as variáveis de ambiente do arquivo .env
async function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envFile = await fs.readFile(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length > 0) {
        process.env[key.trim()] = value.join('=').trim().replace(/"/g, '');
      }
    });
  } catch (error) {
    console.warn('⚠️  Arquivo .env não encontrado. Usando variáveis de ambiente do sistema.');
  }
}

console.log('🔧 Iniciando o bot em MODO DE DESENVOLVIMENTO...');

async function start() {
  await loadEnv();
  await loadKnowledgeBase();
  await connectToWhatsApp(false); // Passa 'false' para usar o QR Code
}

start().catch((err) => console.error('❌ Erro fatal ao iniciar o bot:', err));