// config.js
export const config = {
  // Número máximo de tentativas de reconexão antes de desistir.
  MAX_RECONNECT_ATTEMPTS: 5,

  // Porta padrão para o servidor web do QR Code.
  WEB_PORT: process.env.PORT || 3000,

  // ID do administrador para receber notificações de erro ou escalonamentos.
  // Ex: '5531999999999@c.us'
  ADMIN_ID: process.env.ADMIN_ID || ''
};