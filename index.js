import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuração da IA
// Certifique-se de que a variável de ambiente GEMINI_API_KEY está configurada no Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 10000;

// IMPORTANTE: Obter o caminho do novo navegador leve
const chromium = require('chromium-for-lambda');
const executablePath = await chromium.executablePath;


// Configuração do WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'auth' }), 
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wwebjs/builds/main/html/2.2413.51-beta/index.html',
    },
    // Corrigido para usar o novo caminho do navegador
    puppeteer: {
        executablePath: executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Necessário para alguns ambientes gratuitos
            '--disable-gpu'
        ],
    },
    printQRInTerminal: true, 
});


// Funções de Gerenciamento do Bot
client.on('qr', (qr) => {
    // ESTA É A STRING QUE VOCÊ PRECISA COPIAR
    console.log('QR CODE STRING:', qr);
});

client.on('ready', () => {
    console.log('Client is ready! O Duda-Bot está conectado.');
});

client.on('message', async (msg) => {
    // Ignora mensagens de grupos
    if (msg.from.endsWith('@g.us')) return;

    if (msg.body === 'Oi') {
        client.sendMessage(msg.from, 'Olá! Eu sou o Duda, seu assistente virtual. Em que posso ajudar?');
    }
    
    // Processamento da IA (Gemini)
    if (msg.body.startsWith('!ai')) {
        const prompt = msg.body.substring(4).trim();
        if (!prompt) {
            client.sendMessage(msg.from, 'Por favor, forneça um prompt após !ai.');
            return;
        }

        try {
            const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            // Verifica se a mensagem tem mídia (imagem)
            let imagePart = [];
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media.mimetype.startsWith('image/')) {
                    imagePart = [{
                        inlineData: {
                            data: media.data,
                            mimeType: media.mimetype
                        }
                    }];
                }
            }

            const textPart = { text: prompt };

            const response = await model.generateContent([
                ...imagePart,
                textPart
            ]);

            const responseText = response.text;
            client.sendMessage(msg.from, responseText);
        } catch (error) {
            console.error('Erro ao chamar a API Gemini:', error);
            client.sendMessage(msg.from, 'Desculpe, houve um erro ao processar sua solicitação de IA. Verifique sua chave API.');
        }
    }
});

client.initialize();

// Servidor Express para manter o Render ativo
app.get('/', (req, res) => {
    res.send('Duda-Bot está rodando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
