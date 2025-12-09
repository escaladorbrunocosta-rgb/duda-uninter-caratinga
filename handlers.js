// =================================================================
// ARQUIVO: src/handlers.js
// Módulo para gerenciar todos os eventos do Baileys.
// =================================================================

import { Boom } from '@hapi/boom';
import { DisconnectReason } from '@whiskeysockets/baileys';
// import { getResponse } from './knowledgeBase.js'; // Descomente quando o arquivo existir

/**
 * Registra todos os handlers de eventos para a instância do socket.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - A instância do socket do Baileys.
 * @param {() => Promise<void>} removeCreds - Função para limpar as credenciais do banco de dados.
 */
export function registerEventHandlers(sock, removeCreds) {
  // Evento principal: atualização da conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Lógica para obter o QR Code em formato de texto (para Render.com)
    if (qr) {
      console.log('=================================================');
      console.log('QR_CODE_HTML: <div style="color:red; font-weight:bold;">QR_CODE: ' + qr + '</div>');
      console.log('=================================================');
      console.log('Copie o texto do QR Code acima e use um gerador online para escanear.');
    }

    if (connection === 'close') {
      const boomError = lastDisconnect?.error;
      const statusCode = boomError instanceof Boom ? boomError.output.statusCode : 500;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.connectionReplaced &&
        statusCode !== DisconnectReason.multideviceMismatch;

      console.log(`❌ Conexão fechada. Motivo: ${DisconnectReason[statusCode] || 'Desconhecido'} | Código: ${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚫 Logout detectado. A sessão é inválida e será limpa.');
        await removeCreds();
        console.log('🧹 Sessão do banco de dados limpa. Reinicie o bot para gerar um novo código/QR.');
        // Encerra o processo para que o Render possa reiniciá-lo do zero.
        process.exit(1);
      } else if (shouldReconnect) {
        console.log('🔄 Tentando reconectar... O Render irá reiniciar o serviço.');
        // Força o encerramento para que o Render reinicie. É mais estável que um loop de reconexão.
        process.exit(2); // Usar um código de saída diferente para identificar reinicializações
      }
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!');
    }
  });

  // Evento para salvar as credenciais atualizadas no banco de dados
  sock.ev.on('creds.update', sock.authState.saveCreds);

  // Evento de recebimento de novas mensagens
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    // Ignora mensagens sem conteúdo, de status, ou enviadas pelo próprio bot
    if (!msg.message || msg.key.fromMe || !msg.message.conversation) {
      return;
    }

    const chatId = msg.key.remoteJid;
    const messageText = msg.message.conversation.trim();
    const userName = msg.pushName || 'Usuário';

    console.log(`💬 Mensagem recebida de ${userName} (${chatId}): "${messageText}"`);

    // --- Lógica de Resposta (Exemplo) ---
    // Substitua pela sua lógica real de obtenção de resposta.
    // const response = await getResponse(chatId, messageText, userName);
    let response = `Olá, ${userName}! Recebi sua mensagem: "${messageText}". Em breve minha IA estará funcionando.`;

    // Simulação de uma busca na base de conhecimento
    if (messageText.toLowerCase() === 'oi') {
      response = `Olá, ${userName}! Como posso ajudar?`;
    }

    // Envia a resposta para o usuário
    try {
      await sock.sendMessage(chatId, { text: response });
      console.log(`✉️ Resposta enviada para ${userName}: "${response.substring(0, 60)}..."`);
    } catch (error) {
      console.error(`❌ Falha ao enviar mensagem para ${userName} (${chatId}):`, error);
    }
  });

  console.log('▶️  Handlers de eventos registrados com sucesso.');
}