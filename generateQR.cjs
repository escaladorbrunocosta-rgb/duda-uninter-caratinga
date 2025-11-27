const qrcode = require('qrcode');

// Altere esta URL se quiser que o QR Code leve para outro lugar!
const textToEncode = 'https://www.youtube.com/@escaladorbrunocosta'; 

const options = {
    type: 'terminal' 
};

qrcode.toString(textToEncode, options, (err, url) => {
  if (err) throw err;
  console.log(url);
});