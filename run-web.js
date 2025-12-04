import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { getResponse } from './knowledgeBase.js';

const { Client, LocalAuth } = pkg;
const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });

logger.info('Iniciando o bot com whatsapp-web.js...');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: 'session_web' }), // Usaremos uma pasta de sessão separada
    puppeteer: {
        headless: true,
        // No Render ou Linux, pode ser necessário adicionar '--no-sandbox'
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    logger.info('Novo QR Code recebido, escaneie por favor:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    logger.info('✅ Cliente está pronto! Conexão com o WhatsApp aberta.');
});

client.on('message', async (msg) => {
    // Ignora mensagens próprias para evitar loops
    if (msg.fromMe) {
        return;
    }

    // Ignora mensagens de grupo
    const chat = await msg.getChat();
    if (chat.isGroup) {
        // Opcional: logar que a mensagem foi ignorada
        logger.info({ chatId: chat.id._serialized }, 'Mensagem recebida de um grupo. Ignorando.');
        return;
    }

    const chatId = msg.from;
    const messageText = msg.body;

    if (!messageText) {
        logger.info({ chatId }, 'Mensagem recebida sem texto. Ignorando.');
        return;
    }

    logger.info({ chatId, message: messageText }, 'Mensagem recebida');

    try {
        // Obtém o contato para pegar o nome do usuário para uma resposta mais pessoal
        const contact = await msg.getContact();
        const userName = contact.pushname || 'você'; // Usa 'você' se o nome não estiver disponível

        const response = getResponse(chatId, messageText, userName);

        // Verifica se a resposta não é vazia antes de enviar
        if (response) {
            await client.sendMessage(chatId, response);
            logger.info({ chatId, response }, 'Resposta enviada');
        } else {
            logger.warn({ chatId, message: messageText }, 'Nenhuma resposta foi gerada pela knowledgeBase.');
        }
    } catch (error) {
        logger.error({ err: error, stack: error.stack }, '❌ Erro ao processar mensagem');
    }
});

client.on('disconnected', (reason) => {
    logger.error({ reason }, '❌ Cliente foi desconectado!');
});

client.initialize();