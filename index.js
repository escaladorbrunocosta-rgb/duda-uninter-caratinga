const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    puppeteer: {
        headless: true,
        executablePath: "/usr/bin/chromium-browser",
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

client.on("qr", (qr) => {
    console.log("QR GERADO — ESCANEIE:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("🤖 Bot WhatsApp iniciado no Render!");
});

client.on("message", async (msg) => {
    try {
        const texto = msg.body.trim();
        if (!texto) return;

        const resposta = await model.generateContent(texto);
        const output = resposta.response.text();

        await msg.reply(output);

    } catch (erro) {
        console.error("❌ ERRO:", erro);
        await msg.reply("⚠ Ocorreu um erro ao processar sua mensagem.");
    }
});

client.initialize();
