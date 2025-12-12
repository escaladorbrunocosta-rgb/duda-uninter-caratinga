// Define o ambiente como 'production'
process.env.NODE_ENV = 'production';

import express from 'express';
import { startBot } from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Rota básica para o health check do Render
app.get('/', (req, res) => {
  // Adiciona um log para confirmar que o health check está sendo atingido
  console.log('Health check endpoint atingido.');
  res.status(200).send('Bot Duda Uninter está ativo e rodando!');
});

app.listen(PORT, () => {
  console.log(`Servidor web iniciado na porta ${PORT}.`);
  console.log('Iniciando o bot do WhatsApp...');
  // Inicia o bot depois que o servidor web estiver pronto e escutando
  startBot();
});