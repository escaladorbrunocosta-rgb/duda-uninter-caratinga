import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import http from 'http';
import { existsSync } from 'fs';
import path from 'path';

// --- Variáveis Globais ---
const MODELO_GEMINI = 'gemini-2.5-flash';
const CHATS = new Map(); // Armazena sessões da IA por chatId

// --- Configuração Google Gemini ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("ERRO FATAL: GEMINI_API_KEY não configurada.");
    process.exit(1);
}
const aiInstance = new GoogleGenerativeAI({ apiKey });

// --- Configuração Baileys ---
const authFile = './auth_info.json';
async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const client = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true
    });

    client.ev.on('connection.update', update => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('QR Code gerado. Escaneie no WhatsApp Web.');
        }
        if (connection === 'close') {
            const reason = (lastDisconnect.error)?.output?.statusCode;
            console.log('Desconectado:', reason);
            if (reason !== DisconnectReason.loggedOut) {
                startBot(); // reconecta automaticamente
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado com sucesso!');
        }
    });

    client.ev.on('creds.update', saveState);

    // --- Lógica de mensagens ---
    client.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const userMessage = msg.message.conversation || '';
        const cleanMessage = userMessage.trim().toLowerCase();

        // Resposta rápida de menu
        const sendMessage = text => client.sendMessage(chatId, { text });

        if (cleanMessage === 'menu' || cleanMessage === 'ajuda') {
            sendMessage(
                `Desculpe! Não entendi. Escolha:\n1. Financeiro\n2. Acadêmico\n3. Cursos/Matrícula`
            );
            CHATS.delete(chatId);
            return;
        }

        if (!CHATS.has(chatId)) {
            // cria sessão da IA
            const chatSession = aiInstance.chats.create({
                model: MODELO_GEMINI,
                config: {
                    systemInstruction: "Você é um assistente UNINTER Caratinga. Responda de forma cordial e profissional."
                }
            });
            CHATS.set(chatId, chatSession);
        }

        const chatSession = CHATS.get(chatId);

        // Menu simples
        if (cleanMessage === '1') {
            sendMessage("💰 FINANCEIRO: Boletos, FIES e dívidas - acesse o AVA ou ligue 0800 702 0500.");
            return;
        } else if (cleanMessage === '2') {
            sendMessage("📚 ACADÊMICO: Provas, Notas e Tutoria - acesse o AVA.");
            return;
        } else if (cleanMessage === '3') {
            sendMessage("🎓 CURSOS: Digite 'catálogo', 'matrícula' ou 'ENEM' para detalhes.");
            return;
        }

        // Palavras-chave opção 3
        if (cleanMessage.includes('catálogo') || cleanMessage.includes('cursos')) {
            sendMessage("📘 Catálogo completo: [INSIRA LINK OFICIAL]");
            return;
        } else if (cleanMessage.includes('matrícula') || cleanMessage.includes('inscrição')) {
            sendMessage("📝 Matrícula: Ligue (33) 9807-2110 ou acesse o portal para instruções.");
            return;
        } else if (cleanMessage.includes('enem') || cleanMessage.includes('nota')) {
            sendMessage("🎓 ENEM: Aceito para ingresso! Ligue para o Polo Caratinga (33) 9807-2110.");
            return;
        }

        // Resposta via IA
        try {
            const response = await chatSession.sendMessage({ message: userMessage });
            sendMessage(response.text);
        } catch (error) {
            console.error('ERRO IA:', error);
            sendMessage("🚨 ERRO DE IA. Tente novamente ou digite MENU.");
        }
    });
}

// Inicializa
startBot();

// Servidor HTTP simples para Render/Heroku
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WhatsApp ativo!');
}).listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
