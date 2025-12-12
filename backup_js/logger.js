import pino from 'pino';

const transport = pino.transport({
  targets: [
    // O único alvo agora será o console, formatado para leitura.
    // O Render irá capturar esta saída automaticamente.
    {
      level: 'info',
      target: 'pino-pretty', // Exibe logs coloridos e legíveis no terminal
      options: { destination: 1 }, // 1 = stdout
    },
  ],
});

const logger = pino(transport);

export default logger;