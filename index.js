// =========================================================================
// BOT DUDA UNINTER CARATINGA - INICIALIZAÇÃO
// =========================================================================

require('dotenv').config();
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
// Importar a biblioteca Gemini (necessária para a IA, mesmo que a lógica esteja pendente)
const { GoogleGenAI } = require('@google/genai'); 

// Inicializa a GoogleGenAI com a variável de ambiente GEMINI_API_KEY
// O Render deve ter essa variável configurada!
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// Configuração do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'duda-uninter-caratinga' // Nome do arquivo de sessão
    }),
    puppeteer: {
        headless: true, // Mantenha como true para o Render (sem tela)
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

// =========================================================================
// EVENTOS DE AUTENTICAÇÃO
// =========================================================================

client.on('qr', (qr) => {
    // BLOCO CORRIGIDO: Imprime a string pura do QR Code para uso no Render.
    console.log('----------------------------------------------------');
    console.log('🚨 NOVO CÓDIGO SECRETO GERADO: COPIE A LINHA ABAIXO!');
    console.log(qr); // <<< AQUI ESTÁ A STRING PURA: 2@...==
    console.log('----------------------------------------------------');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready! Bot Uninter Caratinga está ONLINE.');
});

client.on('authenticated', () => {
    console.log('AUTENTICADO COM SUCESSO! Conexão estabelecida.');
});

client.on('auth_failure', msg => {
    // Disparado se a autenticação falhar
    console.error('Falha na autenticação. Verifique se o QR code foi escaneado a tempo.', msg);
});

// =========================================================================
// INICIALIZAÇÃO DO BOT
// =========================================================================

console.log('Iniciando o bot Duda UNINTER Caratinga...');
client.initialize();

// =========================================================================
// LOGICA DE RESPOSTAS (A SER IMPLEMENTADA)
// =========================================================================

client.on('message', async msg => {
    // Aqui estaria sua lógica robusta usando o objeto 'ai' (GoogleGenAI)
    // Exemplo básico:
    if (msg.body.toLowerCase() === 'olá') {
        msg.reply('Olá! Sou a Duda, o assistente virtual da UNINTER Caratinga. Em que posso ajudar hoje?');
    }
});
