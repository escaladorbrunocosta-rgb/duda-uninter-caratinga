// index.js

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenAI } = require("@google/generative-ai");
const http = require('http');
const chromium = require('chromium');   // << ESSENCIAL PARA FUNCIONAR NO RENDER

// --- CONFIGURAÇÃO DO GOOGLE GEMINI ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("A variável de ambiente GEMINI_API_KEY não está configurada.");
}

const ai = new GoogleGenAI(apiKey);
const MODELO_GEMINI = 'gemini-2.5-flash';

// Mantém contexto por chat
const chats = new Map();

// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    puppeteer: {
        executablePath: chromium.path,   // << AQUI ESTÁ A CORREÇÃO FUNDAMENTAL
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// --- TEXTOS DO FLUXO ---
const MENU_PRINCIPAL = `Desculpe, [NOME]! Não entendi o que você procura. Sua dúvida principal é sobre:
\n1. 💰 *Financeiro* (Boletos, Dívidas, FIES)
\n2. 📚 *Acadêmico* (Provas, Notas, Tutoria)
\n3. 🎓 *Cursos/Matrícula* (Catálogo, Inscrição, ENEM)
\n\nPor favor, responda com o número (1, 2 ou 3) ou digite *MENU* a qualquer momento!`;

const SUBMENU_CURSOS = `🎓 Cursos e Ingresso
\nCerto! Por favor, digite sua dúvida específica, como:
\n* catálogo de cursos
* como fazer matrícula
* nota do ENEM`;

// --- EVENTOS DO CLIENTE ---
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado. Escaneie com seu celular.');
});

client.on('ready', () => {
    console.log('Client is ready! Bot Uninter Caratinga ONLINE.');
});

client.on('authenticated', () => {
    console.log('AUTENTICADO COM SUCESSO!');
});

client.on('disconnected', (reason) => {
    console.log('Desconectado:', reason);
});

// --- LÓGICA DE MENSAGENS ---
client.on('message', async msg => {
    const chatId = msg.from;
    const userMessage = msg.body.trim();
    const cleanMessage = userMessage.toLowerCase();
    const userName = (msg.author || 'Aluno').split('@')[0];

    if (msg.isStatus || msg.fromMe || userMessage === '') return;

    const sendMessage = (text) =>
        client.sendMessage(chatId, text.replace('[NOME]', userName));

    // --- Comandos fixos ---
    if (['menu', 'ajuda', 'duda'].includes(cleanMessage)) {
        sendMessage(MENU_PRINCIPAL);
        chats.delete(chatId);
        return;
    }

    // --- Nova conversa ---
    if (!chats.has(chatId)) {
        sendMessage(MENU_PRINCIPAL);
        const chatSession = ai.chats.create({ model: MODELO_GEMINI });
        chats.set(chatId, chatSession);
        return;
    }

    const chatSession = chats.get(chatId);

    // --- Fluxo do menu principal ---
    if (cleanMessage === '1') {
        sendMessage(`💰 FINANCEIRO\n\nBoletos, FIES e dívidas podem ser acessados no *AVA* ou pela Central: 0800 702 0500.`);
        return;
    }
    if (cleanMessage === '2') {
        sendMessage(`📚 ACADÊMICO\n\nProvas, notas e tutoria estão no *AVA* (Ambiente Virtual de Aprendizagem).`);
        return;
    }
    if (cleanMessage === '3') {
        sendMessage(SUBMENU_CURSOS);
        return;
    }

    // --- Palavras-chave ---
    if (cleanMessage.includes('catalogo') || cleanMessage.includes('catálogo') ||
        cleanMessage.includes('cursos') || cleanMessage.includes('graduação') ||
        cleanMessage.includes('pos')) {

        sendMessage(
            "📘 CATÁLOGO DE CURSOS UNINTER 📘\n\nVeja a lista completa aqui:\n🔗 https://www.uninter.com\n\nPode me perguntar sobre matrícula!"
        );
        return;
    }

    if (cleanMessage.includes('matricular') || cleanMessage.includes('matricula') ||
        cleanMessage.includes('inscrição') || cleanMessage.includes('inscreva')) {

        sendMessage(
            "📝 MATRÍCULA\n\nFaça pelo site ou ligue para o Polo Caratinga: (33) 9807-2110."
        );
        return;
    }

    if (cleanMessage.includes('enem') || cleanMessage.includes('vestibular') ||
        cleanMessage.includes('nota')) {

        sendMessage(
            "🎓 ENEM/VESTIBULAR\n\nUse sua nota do ENEM para ingressar com desconto! Ligue: (33) 9807-2110."
        );
        return;
    }

    // --- IA Gemini ---
    try {
        console.log(`Enviando para Gemini: "${userMessage}"`);
        const response = await chatSession.sendMessage({ message: userMessage });
        client.sendMessage(chatId, response.text);
    } catch (error) {
        console.error("Erro Gemini:", error);
        client.sendMessage(chatId, "🚨 Erro ao consultar IA. Tente novamente ou digite MENU.");
    }
});

// --- Inicializa WhatsApp ---
client.initialize();

// --- Servidor HTTP para Render ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot ativo.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
