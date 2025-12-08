import {
    makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useSingleFileAuthState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";

async function startBot() {
    const { state, saveCreds } = useSingleFileAuthState("auth.json");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false  // Render NÃO imprime QR visual
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Converte QR para imagem PNG em Base64
            const pngBase64 = await QRCode.toString(qr, { type: "png" });
            const htmlLine = `<img src="data:image/png;base64,${pngBase64}" />`;

            // ANSI para amarelo brilhante
            const YELLOW = "\x1b[33;1m";
            const RESET = "\x1b[0m";

            console.log("\n=====================================================");
            console.log(YELLOW + "COPIE APENAS ESTA LINHA HTML ABAIXO:" + RESET);
            console.log(YELLOW + htmlLine + RESET);
            console.log("=====================================================\n");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error instanceof Boom &&
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }

        if (connection === "open") {
            console.log("WhatsApp conectado!");
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

startBot();
