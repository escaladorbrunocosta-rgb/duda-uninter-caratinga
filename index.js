// index.js

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenAI } = require("@google/generative-ai");
const http = require('http'); // Necessário para manter o processo ativo em hospedagem

// --- CONFIGURAÇÃO DO GOOGLE GEMINI ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    // Isso ocorrerá no seu Mac. No Heroku, a variável deve ser configurada.
    throw new Error("A variável de ambiente GEMINI_API_KEY não está configurada.");
}

const ai = new GoogleGenAI(apiKey);
// CORREÇÃO: Usando um modelo atual e funcional para evitar 404 Not Found.
const MODELO_GEMINI = 'gemini-2.5-flash'; 

// Inicializa a sessão de chat para manter o contexto, armazenada por ID do chat.
const chats = new Map();

// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    // CORREÇÃO: Configuração crucial para AMBIENTES DE HOSPEDAGEM (Heroku/Render)
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- VARIÁVEIS DE FLUXO DE CONVERSAÇÃO ---
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

// --- EVENTOS DO CLIENTE WHATSAPP ---

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado. Escaneie com seu celular.');
});

client.on('ready', () => {
    console.log('Client is ready! Bot Uninter Caratinga está ONLINE, com MEMÓRIA e comandos.');
});

client.on('authenticated', (session) => {
    console.log('AUTENTICADO COM SUCESSO! Conexão estabelecida.');
});

client.on('disconnected', (reason) => {
    console.log('Client foi desconectado!', reason);
});

// --- LÓGICA DE MENSAGEM ---

client.on('message', async msg => {
    const chatId = msg.from;
    const userMessage = msg.body.trim();
    const cleanMessage = userMessage.toLowerCase();
    
    // Extrai o nome do usuário (simulação)
    const userNameMatch = msg.author || 'Bruno';
    const userName = userNameMatch.split('@')[0] || 'Aluno'; 

    if (msg.isStatus || msg.fromMe || userMessage === '') return;

    // Função auxiliar para enviar resposta e evitar o fallback
    const sendMessageAndBypassAI = (text) => client.sendMessage(chatId, text.replace('[NOME]', userName));

    // --- LÓGICA DE NAVEGAÇÃO RÁPIDA (Comandos Fixos) ---
    if (cleanMessage === 'menu' || cleanMessage === 'ajuda' || cleanMessage === 'duda') {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        // Reseta o estado para garantir que a IA não tente responder
        chats.delete(chatId); 
        return;
    }
    
    // Se o chat não tem sessão (é uma nova conversa ou foi resetada), inicia com o menu.
    if (!chats.has(chatId)) {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        // Cria a sessão com a IA (isso permite que a IA trate as respostas que não são 1, 2, 3)
        const chatSession = ai.chats.create({ model: MODELO_GEMINI });
        chats.set(chatId, chatSession);
        return;
    }
    
    // Obtém a sessão de chat
    const chatSession = chats.get(chatId);
    
    // --- LÓGICA DE FLUXO DO MENU ---
    
    let respostaDoMenu = null;
    
    if (cleanMessage === '1') {
        // Opção 1: Financeiro
        respostaDoMenu = `💰 FINANCEIRO\n\nPara boletos, FIES ou negociação de dívidas, acesse o *AVA* ou ligue para a Central Uninter (0800 702 0500, Opção 1).`;
    } else if (cleanMessage === '2') {
        // Opção 2: Acadêmico
        respostaDoMenu = `📚 ACADÊMICO\n\nPara provas, notas ou falar com a Tutoria, acesse o *AVA* (Ambiente Virtual de Aprendizagem).`;
    } else if (cleanMessage === '3') {
        // Opção 3: Cursos/Matrícula
        respostaDoMenu = SUBMENU_CURSOS;
        // Não retorna aqui. Deixa a IA processar a próxima palavra-chave.
    }
    
    if (respostaDoMenu) {
        sendMessageAndBypassAI(respostaDoMenu);
        return;
    }

    // --- LÓGICA PARA RECONHECIMENTO DE PALAVRAS-CHAVE DA OPÇÃO 3 (CORREÇÃO) ---
    
    if (cleanMessage.includes('catalogo') || cleanMessage.includes('catálogo') || cleanMessage.includes('cursos') || cleanMessage.includes('graduação') || cleanMessage.includes('pos')) {
         sendMessageAndBypassAI(
            "📘 CATÁLOGO DE CURSOS UNINTER 📘\n\nAcesse a lista completa de Graduação, Pós-Graduação e Extensão diretamente no portal oficial: \n\n🔗 *[INSIRA O LINK OFICIAL AQUI]*\n\nSe precisar de ajuda com a matrícula, me pergunte 'como me matricular'!"
        );
        return;
    } else if (cleanMessage.includes('matricular') || cleanMessage.includes('matricula') || cleanMessage.includes('inscrição') || cleanMessage.includes('inscreva')) {
        sendMessageAndBypassAI(
            "📝 MATRÍCULA E INSCRIÇÃO\n\nVocê pode iniciar sua inscrição diretamente pelo site ou ligar para o Polo Caratinga: (33) 9807-2110. Eles te guiarão no processo!"
        );
        return;
    } else if (cleanMessage.includes('enem') || cleanMessage.includes('vestibular') || cleanMessage.includes('nota')) {
        sendMessageAndBypassAI(
            "🎓 ENEM E VESTIBULAR\n\nA Uninter aceita a nota do ENEM para ingresso! Para verificar as condições e descontos, ligue para o nosso Polo Caratinga: (33) 9807-2110."
        );
        return;
    }

    // --- RESPOSTA VIA IA (GEMINI) ---
    
    try {
        console.log(`DEBUG: Enviando para Gemini: "${userMessage}"`);
        const response = await chatSession.sendMessage({ message: userMessage });
        
        // 4. Responde no WhatsApp
        client.sendMessage(chatId, response.text);
        
    } catch (error) {
        console.error('ERRO ao processar mensagem com Gemini:', error);
        // Fallback de erro da IA
        client.sendMessage(chatId, '🚨 ERRO DE IA 🚨 Desculpe, houve um erro ao processar sua solicitação no sistema de IA. Tente refazer sua pergunta, ou digite MENU.');
    }
});

// Inicializa o cliente WhatsApp
client.initialize();

// Configuração básica do servidor web (necessário para manter o processo ativo em hospedagem)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor web rodando. O bot está ativo se o QR Code foi escaneado.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor web rodando na porta ${PORT}`);
});
