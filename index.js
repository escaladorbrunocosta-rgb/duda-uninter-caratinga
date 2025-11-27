const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Inicializa WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu"
        ]
    }
});

// Gera QR Code no terminal
client.on("qr", (qr) => {
    console.log("QR RECEBIDO — ESCANEIE:");
    qrcode.generate(qr, { small: true });
});

// Confirmou login
client.on("ready", () => {
    console.log("🤖 Bot WhatsApp iniciado com sucesso!");
});

// Mensagens recebidas
client.on("message", async (msg) => {
    try {
        const texto = msg.body.trim();

        // Ignora mensagens vazias
        if (!texto) return;

        console.log("📩 Mensagem recebida:", texto);

        // Envia para o Gemini
        const resposta = await model.generateContent(texto);
        const output = resposta.response.text();

        // Responde no WhatsApp
        await msg.reply(output);

    } catch (erro) {
        console.error("❌ ERRO ao responder:", erro);
        await msg.reply("⚠ Ocorreu um erro ao processar sua mensagem.");
    }
});

// Inicializa o bot
client.initialize();
