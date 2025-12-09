// =================================================================
// ARQUIVO: index.js
// DESCRIÇÃO: Ponto de entrada principal para o Bot de WhatsApp.
// =================================================================

import { promises as fs } from 'fs';
import path from 'path';
import pino from 'pino';
import qrcode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

const AUTH_DIR = 'auth_info_multi';
const HTML_OUTPUT_FILE = 'qrcode.html';

const logger = pino({ level: 'info' });

/**
 * Gera um arquivo HTML completo contendo o QR Code como uma imagem Base64.
 * @param {string} qrString - A string do QR Code recebida do Baileys.
 */
async function generateQrHtml(qrString) {
  try {
    console.log('✅ QR Code recebido. Gerando arquivo HTML...');
    // Converte a string do QR para uma URL de dados Base64
    const base64Image = await qrcode.toDataURL(qrString);

    // Monta o conteúdo do arquivo HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-g">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code de Conexão</title>
    <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
        img { max-width: 90%; max-height: 90%; }
    </style>
</head>
<body>
    <img src="${base64Image}" alt="Escaneie este QR Code no seu WhatsApp">
</body>
</html>
    `.trim();

    await fs.writeFile(HTML_OUTPUT_FILE, htmlContent);
    console.log(`✅ Resultado FINAL gerado: ${HTML_OUTPUT_FILE}`);
    console.log('   Abra este arquivo em um navegador para escanear o QR Code.');

  } catch (err) {
    console.error('❌ Erro ao gerar o arquivo HTML com o QR Code:', err);
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`▶️  Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true, // Mantemos a impressão no terminal como fallback
    auth: state,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('▶️  Aguardando QR...');
      // Gera o arquivo HTML com o QR Code
      await generateQrHtml(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : false;

      console.log(`❌ Conexão fechada. Código: ${lastDisconnect.error?.output?.statusCode}`);
      console.log(`🔄 Deve reconectar? ${shouldReconnect}`);

      if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
        console.log(`🚫 Logout detectado. Delete a pasta ${AUTH_DIR} e gere um novo QR.`);
        // Opcional: remover a pasta automaticamente
        // await fs.rm(AUTH_DIR, { recursive: true, force: true });
      }

      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!');
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Inicia a conexão
connectToWhatsApp();