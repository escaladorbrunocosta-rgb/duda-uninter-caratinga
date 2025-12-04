// index.cjs — 100% compatível com Node 18 e Baileys 6.x em CommonJS

const baileys = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = baileys;

async function connectBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info_multi");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: ["DudaBot", "Chrome", "1.0"]
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        console.clear();
        console.log("📲 ESCANEIE O QR NO SEU WHATSAPP:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        console.log("✅ BOT CONECTADO AO WHATSAPP!");
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        console.log("❌ Conexão fechada. Código:", code);
        console.log("🔄 Deve reconectar?", shouldReconnect);

        if (shouldReconnect) {
          setTimeout(connectBot, 2000);
        } else {
          console.log("🚫 Logout detectado. Delete a pasta auth_info_multi e gere novo QR.");
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (msg) => {
      const m = msg.messages[0];
      if (!m.message) return;
      if (m.key.fromMe) return;

      const sender = m.key.remoteJid;
      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        "";

      console.log(`📩 Mensagem recebida de ${sender}: ${text}`);

      await sock.sendMessage(sender, {
        text: `Recebi sua mensagem: "${text}"`
      });
    });

    console.log("▶️ Aguardando QR...");
  } catch (e) {
    console.error("Erro fatal:", e);
  }
}

connectBot();
