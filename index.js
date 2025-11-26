// index.js - Bot Uninter Caratinga
import qrcode from "qrcode";
import { Client, LocalAuth } from "whatsapp-web.js";
import { GoogleGenAI } from "@google/generative-ai";
import http from "http";

// --- CONFIGURAÇÕES GLOBAIS ---
const MODELO_GEMINI = 'gemini-2.5-flash';
const CHATS = new Map(); // Sessões de chat por ID
const PORT = process.env.PORT || 3000;

// --- VARIÁVEIS EDITÁVEIS (Menus e Links) ---
const MENU_PRINCIPAL = `Desculpe, [NOME]! Não entendi o que você procura. Sua dúvida principal é sobre:
1. 💰 *Financeiro* (Boletos, Dívidas, FIES)
2. 📚 *Acadêmico* (Provas, Notas, Tutoria)
3. 🎓 *Cursos/Matrícula* (Catálogo, Inscrição, ENEM)
Responda com o número (1, 2 ou 3) ou digite *MENU* a qualquer momento!`;

const SUBMENU_CURSOS = `🎓 Cursos e Ingresso
Digite sua dúvida específica, como:
- catálogo de cursos
- como fazer matrícula
- nota do ENEM`;

const LINK_CATALOGO = "https://www.uninter.com/catalogo-de-cursos"; // Atualize com o link real

// --- INICIALIZAÇÃO DO GEMINI ---
let aiInstance;
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");
    aiInstance = new GoogleGenAI({ apiKey });
} catch (error) {
    console.error('ERRO FATAL NA CONFIGURAÇÃO DA API:', error.message);
    process.exit(1);
}

// --- INICIALIZAÇÃO DO CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    puppeteer: {
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- QR CODE NO TERMINAL E VIA HTTP ---
let latestQR = null;
client.on('qr', qr => {
    qrcode.generate(qr, { small: true }); // Terminal
    latestQR = qr;
    console.log('QR Code gerado. Escaneie com seu celular.');
});

// --- EVENTOS DO CLIENTE ---
client.on('ready', () => {
    console.log('✅ WhatsApp conectado. Bot ONLINE.');
});

client.on('authenticated', () => console.log('✅ Autenticado com sucesso.'));
client.on('disconnected', reason => console.log('⚠️ Cliente desconectado:', reason));

// --- FUNÇÃO AUXILIAR ---
const sendMessageAndBypassAI = async (chatId, text, contactName) => {
    await client.sendMessage(chatId, text.replace('[NOME]', contactName));
};

// --- LÓGICA DE MENSAGEM ---
client.on('message', async msg => {
    if (msg.isStatus || msg.fromMe || !msg.body) return;

    const chatId = msg.from;
    const userMessage = msg.body.trim();
    const cleanMessage = userMessage.toLowerCase();
    const contactName = (await msg.getContact()).pushname || msg.from.split('@')[0];

    // Comandos rápidos
    if (['menu','ajuda','duda'].includes(cleanMessage)) {
        await sendMessageAndBypassAI(chatId, MENU_PRINCIPAL, contactName);
        CHATS.delete(chatId);
        return;
    }

    // Nova sessão de chat
    if (!CHATS.has(chatId)) {
        await sendMessageAndBypassAI(chatId, MENU_PRINCIPAL, contactName);
        const chatSession = aiInstance.chats.create({
            model: MODELO_GEMINI,
            config: {
                systemInstruction: `Você é assistente UNINTER Caratinga. Responda de forma cordial, profissional e direta. Nome do usuário: ${contactName}`
            }
        });
        CHATS.set(chatId, chatSession);
        return;
    }

    const chatSession = CHATS.get(chatId);

    // --- Menu fixo ---
    if (cleanMessage === '1') {
        await sendMessageAndBypassAI(chatId, `💰 FINANCEIRO\nBoletos, FIES ou dívidas: acesse o AVA ou ligue 0800 702 0500, Opção 1.`, contactName);
        return;
    } else if (cleanMessage === '2') {
        await sendMessageAndBypassAI(chatId, `📚 ACADÊMICO\nProvas, notas ou tutoria: acesse o AVA.`, contactName);
        return;
    } else if (cleanMessage === '3') {
        await sendMessageAndBypassAI(chatId, SUBMENU_CURSOS, contactName);
        return;
    }

    // --- Palavras-chave Cursos ---
    if (cleanMessage.includes('catalogo') || cleanMessage.includes('cursos')) {
        await sendMessageAndBypassAI(chatId, `📘 CATÁLOGO DE CURSOS\nAcesse: ${LINK_CATALOGO}`, contactName);
        return;
    } else if (cleanMessage.includes('matricula') || cleanMessage.includes('inscrição')) {
        await sendMessageAndBypassAI(chatId, `📝 MATRÍCULA\nInicie sua inscrição pelo site ou ligue para o Polo Caratinga: (33) 9807-2110.`, contactName);
        return;
    } else if (cleanMessage.includes('enem') || cleanMessage.includes('vestibular')) {
        await sendMessageAndBypassAI(chatId, `🎓 ENEM E VESTIBULAR\nVerifique condições de ingresso e descontos ligando para o Polo Caratinga: (33) 9807-2110.`, contactName);
        return;
    }

    // --- Resposta via Gemini ---
    try {
        const response = await chatSession.sendMessage({ message: userMessage });
        await client.sendMessage(chatId, response.text);
    } catch (error) {
        console.error('Erro IA:', error);
        await sendMessageAndBypassAI(chatId, '🚨 ERRO DE IA 🚨 Tente refazer a pergunta ou digite MENU.', contactName);
    }
});

// Inicializa o cliente WhatsApp
client.initialize();

// --- SERVIDOR HTTP ---
const server = http.createServer(async (req, res) => {
    if (req.url === '/qr') {
        if (!latestQR) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('QR ainda não gerado. Aguarde alguns segundos.');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        const qrBuffer = await qrcode.toBuffer(latestQR, { type: 'png' });
        res.end(qrBuffer);
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor rodando. Use /qr para visualizar o QR Code.');
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
