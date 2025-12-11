// =================================================================
// ARQUIVO: run-bot.js
// DESCRIÇÃO: Script para iniciar o servidor web e o bot do WhatsApp.
//            Ideal para plataformas como o Render (Free).
// =================================================================

import express from 'express';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

// Carrega variáveis de ambiente do arquivo .env (para desenvolvimento local)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Render define a porta via process.env.PORT

// Endpoint básico para o Render Free não derrubar o serviço por inatividade
app.get('/', (req, res) => {
  res.status(200).send('🤖 Duda Uninter Bot está no ar e operando!');
});

// Inicia o servidor web
app.listen(port, () => {
  console.log(`✅ Servidor web iniciado com sucesso na porta ${port}.`);
  
  // Verifica se as variáveis de ambiente necessárias estão presentes
  if (process.env.SESSION_DATA) {
    console.log("🔑 Variável de ambiente SESSION_DATA encontrada.");
  }
  if (process.env.TOKEN) {
    console.log("🔑 Variável de ambiente TOKEN encontrada.");
  }

  console.log('🚀 Iniciando o processo do bot (index.js)...');
  
  // Inicia o bot em um processo filho e redireciona a saída para o console principal
  const botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });

  botProcess.on('close', (code) => {
    console.log(`O processo do bot foi encerrado com o código ${code}`);
  });
});