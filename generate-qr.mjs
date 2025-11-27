import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import fs from "fs";

async function gerarQR() {
  console.log("🔄 Iniciando geração de QR válido...");

  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", async ({ qr }) => {
    if (qr) {
      console.log("📸 QR RECEBIDO! Criando arquivo qr.png...");
      await QRCode.toFile("qr.png", qr);
      console.log("✅ QR GERADO! Abra o arquivo qr.png e escaneie no WhatsApp.");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

gerarQR();
