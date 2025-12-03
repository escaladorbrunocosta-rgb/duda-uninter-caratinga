import pkg from 'whatsapp-web.js';
const { Client } = pkg;

const client = new Client({
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox"]
  }
});

client.on('qr', () => console.log("QR OK"));
client.on('ready', () => console.log("READY OK"));

client.initialize();
