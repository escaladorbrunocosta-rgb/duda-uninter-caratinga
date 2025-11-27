import { default as makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys"
import fs from "fs"
import qrcode from "qrcode"

async function generateQR() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state
    })

    sock.ev.on("connection.update", async (u) => {
        const { qr, connection } = u

        if (qr) {
            console.log("📸 Gerando QR Code em arquivo...")
            await qrcode.toFile("qr.png", qr)
            console.log("✅ QR gerado como qr.png")
            process.exit(0)   // 👉 Sai sem precisar CTRL-C
        }

        if (connection === "open") {
            console.log("🔗 Conectado com sucesso!")
            process.exit(0)
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

generateQR()
