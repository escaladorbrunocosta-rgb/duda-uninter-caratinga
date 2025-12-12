import axios from 'axios';

/**
 * Envia uma notificação para um webhook do Discord.
 * @param {string} webhookUrl A URL do webhook do Discord.
 * @param {string} message A mensagem a ser enviada.
 */
async function sendDiscordNotification(webhookUrl, message) {
    if (!webhookUrl) {
        console.warn('DISCORD_WEBHOOK_URL não configurada. Pulando notificação.');
        return;
    }

    try {
        await axios.post(webhookUrl, {
            content: message,
            username: 'Alerta do Bot Duda',
        });
        console.log('✅ Notificação de sessão inválida enviada com sucesso!');
    } catch (error) {
        console.error('❌ Falha ao enviar notificação de sessão inválida:', error.message);
    }
}

/**
 * Prepara e envia uma mensagem de notificação de sessão inválida.
 */
export async function sendSessionInvalidNotification() {
    const message = `
🚨 **ALERTA: Sessão do WhatsApp Inválida!** 🚨

O bot Duda foi desconectado porque a sessão expirou ou foi invalidada.
É necessário gerar uma nova sessão e atualizar a variável de ambiente no Render.

**Ação necessária:**
1.  Execute o comando \`npm run update-session:render\` no seu ambiente local.
2.  Escaneie o novo QR Code para autenticar.
3.  O script atualizará a sessão no Render automaticamente.

O bot permanecerá offline até que a sessão seja renovada.
    `;
    await sendDiscordNotification(process.env.DISCORD_WEBHOOK_URL, message.trim());
}