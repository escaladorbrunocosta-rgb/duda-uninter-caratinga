// index.js

import { default as makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import { useSingleFileAuthState } from '@whiskeysockets/baileys/lib/Utils';
import { GoogleGenAI } from '@google/generative-ai';
import qrcode from 'qrcode-terminal';
import http from 'http';

// --- Configuração de autenticação Baileys ---
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const client = makeWASocket({
    auth: state,
    printQRInTerminal: true
});

client.ev.on('creds.update', saveState);

client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('QR Code gerado. Escaneie com seu celular.');
    }

    if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
        console.log('Conexão fechada. Tentando reconectar:', shouldReconnect);
        if (shouldReconnect) startBot();
    } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado com sucesso! Bot ONLINE.');
    }
});

// --- Configuração Google Gemini ---
const MODELO_GEMINI = 'gemini-2.5-flash';

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada no .env');
    process.exit(1);
}

const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Sessões de chat ---
const CHATS = new Map();

// --- Mensagens de menu ---
const MENU_PRINCIPAL = `Desculpe, [NOME]! Não entendi. Sua dúvida é sobre:
1. 💰 *Financeiro* (Boletos, Dívidas, FIES)
2. 📚 *Acadêmico* (Provas, Notas, Tutoria)
3. 🎓 *Cursos/Matrícula* (Catálogo, Inscrição, ENEM)
Responda com o número ou digite *MENU*.`;

const SUBMENU_CURSOS = `🎓 Cursos e Ingresso
Digite sua dúvida específica, por exemplo:
- catálogo de cursos
- como fazer matrícula
- nota do ENEM`;

// --- Função de envio ---
const sendMessageAndBypassAI = async (chatId, text, contactName) => {
    await client.sendMessage(chatId, text.replace('[NOME]', contactName));
};

// --- Lógica de mensagens ---
client.ev.on('messages.upsert', async (m) => {
    if (!m.messages) return;
    const msg = m.messages[0];
    const chatId = msg.key.remoteJid;
    if (!msg.message || msg.key.fromMe) return;

    const userMessage = msg.message.conversation || '';
    const cleanMessage = userMessage.trim().toLowerCase();

    const contact = await client.getContact(chatId);
    const contactName = contact.pushname || 'Aluno(a)';

    // Reset menu
    if (['menu', 'ajuda', 'duda'].includes(cleanMessage)) {
        CHATS.delete(chatId);
        await sendMessageAndBypassAI(chatId, MENU_PRINCIPAL, contactName);
        return;
    }

    // Se chat não existe
    if (!CHATS.has(chatId)) {
        CHATS.set(chatId, aiInstance.chats.create({
            model: MODELO_GEMINI,
            config: {
                systemInstruction: `Você é assistente UNINTER Caratinga. Não interrompa o menu fixo. Nome do usuário: ${contactName}`
            }
        }));
        await sendMessageAndBypassAI(chatId, MENU_PRINCIPAL, contactName);
        return;
    }

    // Opções menu
    if (cleanMessage === '1') {
        await sendMessageAndBypassAI(chatId, '💰 FINANCEIRO\nPara boletos, FIES ou negociação, acesse o AVA ou ligue: 0800 702 0500, Opção 1.', contactName);
        return;
    } else if (cleanMessage === '2') {
        await sendMessageAndBypassAI(chatId, '📚 ACADÊMICO\nPara provas, notas ou Tutoria, acesse o AVA.', contactName);
        return;
    } else if (cleanMessage === '3') {
        await sendMessageAndBypassAI(chatId, SUBMENU_CURSOS, contactName);
        return;
    }

    // Submenu cursos
    if (/catalogo|cursos|gradua|pos/i.test(cleanMessage)) {
        await sendMessageAndBypassAI(chatId, "📘 CATÁLOGO DE CURSOS\nAcesse no portal oficial: 🔗 [INSIRA O LINK]", contactName);
        return;
    } else if (/matricul|inscrição|inscrev/i.test(cleanMessage)) {
        await sendMessageAndBypassAI(chatId, "📝 MATRÍCULA\nVocê pode iniciar pelo site ou ligar para o Polo Caratinga: (33) 9807-2110.", contactName);
        return;
    } else if (/enem|vestibular|nota/i.test(cleanMessage)) {
        await sendMessageAndBypassAI(chatId, "🎓 ENEM\nA Uninter aceita ENEM. Ligue para o Polo Caratinga para mais informações.", contactName);
        return;
    }

    // IA Gemini
    try {
        const chatSession = CHATS.get(chatId);
        const response = await chatSession.sendMessage({ message: userMessage });
        await client.sendMessage(chatId, response.text);
    } catch (err) {
        console.error('Erro IA:', err);
        await sendMessageAndBypassAI(chatId, '🚨 ERRO DE IA 🚨 Tente novamente ou digite MENU.', contactName);
    }
});

// --- Servidor Web ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Duda ativo!');
}).listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// --- Inicializa ---
const startBot = () => client;
startBot();
