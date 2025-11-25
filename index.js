// index.js

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const GoogleGenAI = require("@google/generative-ai").GoogleGenAI;
const http = require('http'); // Necessário para manter o processo ativo em hospedagem

// --- Variáveis Globais ---
const MODELO_GEMINI = 'gemini-2.5-flash';
const CHATS = new Map(); // Armazena as sessões de chat da IA por ID do chat.
let aiInstance; // Armazena a instância da GoogleGenAI.

// --- CONFIGURAÇÃO DO GOOGLE GEMINI (Inicialização Segura) ---
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("A variável de ambiente GEMINI_API_KEY não está configurada.");
    }
    aiInstance = new GoogleGenAI(apiKey);
    console.log("Instância do GoogleGenAI criada com sucesso.");
} catch (error) {
    console.error('ERRO FATAL NA CONFIGURAÇÃO DA API:', error.message);
    // Encerra o processo se a chave da API não estiver configurada.
    process.exit(1); 
}

// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    // CORREÇÃO ESSENCIAL PARA AMBIENTES DE HOSPEDAGEM (Render/Heroku)
    puppeteer: {
        // ESSENCIAL: Define o caminho para o binário do Chromium no ambiente Linux/Docker
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', 
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
    // CORREÇÃO: Inicializa o chat da IA com um system instruction logo após o cliente estar pronto.
    // Isso garante que a IA esteja pronta para manter o contexto.
    console.log('IA está pronta para começar a conversar.');
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
    // O `msg.author` só funciona em grupos, então usamos o `chatId` se não for um grupo.
    const userNameMatch = msg.author || msg.from;
    const userName = userNameMatch.split('@')[0] || 'Aluno(a)'; 
    const contactName = await (await msg.getContact()).pushname || userName;

    if (msg.isStatus || msg.fromMe || userMessage === '') return;

    // Função auxiliar para enviar resposta e evitar o fallback
    const sendMessageAndBypassAI = (text) => client.sendMessage(chatId, text.replace('[NOME]', contactName));

    // --- LÓGICA DE NAVEGAÇÃO RÁPIDA (Comandos Fixos) ---
    if (cleanMessage === 'menu' || cleanMessage === 'ajuda' || cleanMessage === 'duda') {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        // Reseta o estado para garantir que a IA não tente responder
        CHATS.delete(chatId); 
        return;
    }
    
    // Se o chat não tem sessão (é uma nova conversa ou foi resetada), inicia com o menu.
    if (!CHATS.has(chatId)) {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        
        // Cria a sessão de chat com a IA
        const chatSession = aiInstance.chats.create({ 
            model: MODELO_GEMINI,
            // Instrução para a IA para dar contexto e evitar que ela se intrometa no fluxo do menu.
            config: {
                systemInstruction: "Você é um assistente da UNINTER Caratinga, focado em fornecer informações de apoio e tirar dúvidas gerais. O fluxo inicial do menu é tratado por regras fixas. Se o usuário fizer uma pergunta que não seja um número (1, 2, 3), responda de forma útil e direta, mencionando que a resposta completa pode ser encontrada no portal ou no AVA. Mantenha o tom cordial e profissional. Use o nome do usuário se ele for extraído. O nome do usuário é: " + contactName,
            }
        });
        CHATS.set(chatId, chatSession);
        return;
    }
    
    // Obtém a sessão de chat
    const chatSession = CHATS.get(chatId);
    
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
        // Não retorna aqui. Permite que o código caia no próximo bloco para tratamento de palavras-chave.
    }
    
    if (respostaDoMenu && cleanMessage.length === 1) { // Só dispara se for exatamente '1', '2' ou '3'
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
        
        // Responde no WhatsApp
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

// Usa a porta fornecida pelo ambiente de hospedagem ou 3000 como padrão
const PORT = process.env.PORT || 3000; 
server.listen(PORT, () => {
    console.log(`Servidor web rodando na porta ${PORT}`);
});
