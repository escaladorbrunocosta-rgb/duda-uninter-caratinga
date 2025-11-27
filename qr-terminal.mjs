import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"

async function start() {
    console.log("🚀 Gerando QR no terminal...")

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false
    })

    sock.ev.on("connection.update", ({ qr, connection }) => {
        if (qr) {
            console.log("📲 Escaneie o QR abaixo:\n")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "open") {
            console.log("✅ CONECTADO COM SUCESSO!")
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

start()
