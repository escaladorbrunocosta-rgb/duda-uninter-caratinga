
// Endpoint de saúde para Keep-Alive
app.get('/', (req, res) => {
    res.status(200).send('Duda Bot is Running and Awake!');
});

// NOVO: Endpoint para exibir o QR Code como imagem
app.get('/qr', async (req, res) => {
    if (currentQrCode) {
        const qrcodeSVG = require('qrcode'); // Necessário porque qrcode-terminal não gera imagem
        try {
            const svg = await qrcodeSVG.toString(currentQrCode, { type: 'svg' });
            res.type('image/svg+xml');
            res.send(svg);
        } catch (err) {
            console.error('Erro ao gerar SVG do QR Code:', err);
            res.status(500).send('Erro ao gerar QR Code.');
        }
    } else {
        res.status(200).send('QR Code não disponível ou bot já conectado. Verifique os logs da Render.');
    }
});


});


// Keep-alive HTTP server for Render

const express = require('express);

const app = express();

const PORT = process.env.PORT || 3000;



app.get('/, (req, res) => {

});



app.get('/qr, (req, res) => {

  if (currentQrCodeData) {

    qrcode.toDataURL(currentQrCodeData, (err, url) => {

      if (err) {

        console.error('Erro
