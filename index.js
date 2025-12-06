import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup,
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore
} from 'baileys'; // Nome do pacote atualizado
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { promises as fs, existsSync, mkdirSync, rmSync } from 'fs'; // Usa a versão de promises do fs
import path from 'path';
import qrcodeTerminal from 'qrcode-terminal'; // Renomeado para clareza
import qrcode from 'qrcode'; // Biblioteca para gerar imagem do QR Code
import http from 'http'; // Módulo para criar o servidor web
import { getResponse } from './knowledgeBase.js';

// Cria uma instância de logger global para ser usada em handlers de processo
const globalLogger = pino({
    level: 'info',
    transport: {
        // O Pino pode ter múltiplos "alvos" (transportes) para os logs.
        targets: [
            // Alvo 1: Logs gerais e bonitos para o console de desenvolvimento.
            { target: 'pino-pretty', level: 'info', options: { colorize: true, ignore: 'pid,hostname' } },
            // Alvo 2: Logs gerais da aplicação em um arquivo (erros, conexões, etc.).
            { target: 'pino/file', level: 'info', options: { destination: './app.log', mkdir: true } },
            // Alvo 3: Um arquivo dedicado APENAS para as conversas, em formato JSON para fácil análise.
            { target: 'pino/file', level: 'info', options: { destination: './conversas.log', mkdir: true } }
        ]
    }
});
// Variável global para armazenar a string do QR Code
let qrCodeString = '';

let reconnectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Processa as mensagens recebidas.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - A instância do socket do Baileys.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} msg - O objeto da mensagem recebida.
 * @param {pino.Logger} logger - A instância do logger.
 */
async function handleMessage(sock, msg, logger) {
    try {
        const chatId = msg.key.remoteJid;

        // Ignora se não houver conteúdo na mensagem, se for de um grupo ou se for uma atualização de status
        if (!msg.message || msg.key.fromMe || isJidGroup(chatId) || chatId === 'status@broadcast') {
            return;
        }

        // Extrai o ID do chat e o texto da mensagem de forma mais completa
        const messageText = msg.message.conversation ||
                            msg.message.extendedTextMessage?.text ||
                            msg.message.imageMessage?.caption ||
                            msg.message.videoMessage?.caption;

        const userName = msg.pushName || 'Usuário'; // Obtém o nome do usuário

        // Ignora se a mensagem não tiver texto
        if (!messageText) {
            logger.info({ chatId }, 'Mensagem recebida sem texto (ex: áudio, sticker). Ignorando.');
            return;
        }

        // Log da mensagem recebida, com um marcador para facilitar a filtragem.
        // Este log irá para TODOS os transportes, incluindo 'conversas.log'.
        logger.info({
            log_type: 'conversation', chatId, userName, direction: 'in', message: messageText
        }, 'Mensagem recebida');

        // Simula que o bot está "digitando" para uma melhor experiência do usuário
        await sock.sendPresenceUpdate('composing', chatId);

        // Obtém a resposta da nossa base de conhecimento
        const response = getResponse(chatId, messageText, userName);

        // Verifica o tipo de resposta para decidir como enviar
        if (typeof response === 'string') {
            // --- Envio de Texto Simples ---
            await sock.sendMessage(chatId, { text: response });
            logger.info({
                log_type: 'conversation', chatId, direction: 'out', response
            }, 'Resposta de texto enviada');

        } else if (typeof response === 'object' && response.type) {
            // --- Envio de Mídia ---
            if (response.type === 'image' && response.url) {
                // Envia imagem a partir de uma URL
                await sock.sendMessage(chatId, {
                    image: { url: response.url },
                    caption: response.caption || '' // Legenda é opcional
                });
                logger.info({
                    log_type: 'conversation', chatId, direction: 'out', response
                }, 'Resposta de imagem enviada');

            } else if (response.type === 'document' && response.path) {
                // Envia documento a partir de um arquivo local
                const docPath = path.resolve(response.path);
                if (existsSync(docPath)) {
                    await sock.sendMessage(chatId, {
                        document: await fs.readFile(docPath),
                        mimetype: 'application/pdf', // Ajuste o mimetype conforme o tipo de arquivo
                        fileName: response.fileName || 'documento.pdf'
                    });
                    logger.info({
                        log_type: 'conversation', chatId, direction: 'out', response
                    }, 'Resposta de documento enviada');
                } else {
                    logger.error({ chatId, path: docPath }, 'Arquivo de documento não encontrado no caminho especificado.');
                    await sock.sendMessage(chatId, { text: 'Desculpe, não consegui encontrar o documento solicitado no momento.' });
                }
            }
        }

        // Limpa a presença (para de "digitar")
        await sock.sendPresenceUpdate('paused', chatId);

    } catch (error) {
        logger.error({ error, messageData: msg }, '❌ Erro ao processar uma mensagem específica.');
    }
}

async function startBot() {
    const logger = globalLogger;
    // Garante que o caminho para a pasta da sessão seja absoluto
    const sessionDir = path.resolve('session');

    let state, saveCreds;

    // Prioriza o uso da sessão via variável de ambiente para ambientes de produção (Render, etc.)
    if (process.env.WHATSAPP_SESSION) {
        logger.info('Carregando sessão da variável de ambiente...');
        try {
            const sessionData = JSON.parse(process.env.WHATSAPP_SESSION);
            if (!existsSync(sessionDir)) {
                mkdirSync(sessionDir);
            }
            // Escreve os arquivos de sessão de forma assíncrona
            const writePromises = Object.entries(sessionData).map(([fileName, fileContent]) =>
                fs.writeFile(path.join(sessionDir, fileName), JSON.stringify(fileContent, null, 2))
            );
            await Promise.all(writePromises);
            logger.info('Sessão carregada e arquivos recriados na pasta "session".');
        } catch (error) { 
            logger.error({ error }, 'Falha ao carregar sessão da variável de ambiente. Verifique o formato do JSON.');
            process.exit(1); // Encerra se a sessão do ambiente estiver corrompida
        }
    } else {
        logger.info('Usando autenticação baseada em arquivo (pasta session)...');
    }

    ({ state, saveCreds } = await useMultiFileAuthState(sessionDir));

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys versão: ${version.join('.')}`);

    // O logger para o Baileys e para a camada de sinal (signal)
    const baileysLogger = pino({ level: 'silent' });

    const sock = makeWASocket({
        version,
        // Injeta o logger silencioso na camada de sinal para evitar os logs de "Closing session"
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        logger: baileysLogger,
        // Usar um User-Agent mais padrão pode aumentar a estabilidade da conexão inicial.
        // Este simula o WhatsApp Web rodando em um navegador Chrome no Windows.
        browser: ['Chrome (Windows)', 'Chrome', '114.0.5735.199']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Só mostra o QR Code se não estivermos usando a sessão da variável de ambiente
            qrCodeString = qr; // Armazena o QR para o servidor web
            if (!process.env.WHATSAPP_SESSION) {
                // Tenta exibir no terminal como fallback
                qrcodeTerminal.generate(qr, { small: true });
                
                // A mensagem principal agora aponta para a URL
                const port = process.env.PORT || 3000;
                logger.info(`✅ QR Code gerado. O QR Code no terminal pode aparecer quebrado em alguns ambientes.`);
                logger.info(`➡️ Para escanear, acesse a URL do seu serviço: http://localhost:${port}/qrcode ou https://seu-bot.onrender.com/qrcode`);
            }
        }

        if (connection === 'open') {
            logger.info('✅ Conexão com o WhatsApp aberta!');
            reconnectionAttempts = 0; // Reseta o contador de tentativas ao conectar
        } else if (connection === 'close') {
            // A reconexão deve ocorrer em qualquer erro, exceto 'loggedOut' (desconectado manualmente).
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = (lastDisconnect.error instanceof Boom) && statusCode !== DisconnectReason.loggedOut;
            
            const errorMessage = lastDisconnect.error?.output?.payload?.message || lastDisconnect.error?.message;
            logger.warn(`❌ Conexão fechada: "${errorMessage}". Tentando reconectar: ${shouldReconnect}`);

            if (shouldReconnect && reconnectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectionAttempts++;
                const delay = Math.pow(2, reconnectionAttempts) * 1000; // Backoff exponencial

                // Se o erro for 401 (não autorizado), 408 (timeout) ou 500 (erro de servidor),
                // a sessão provavelmente está inválida ou irrecuperável. Limpar a sessão força uma nova autenticação.
                const criticalErrors = [401, 408, 500];
                if (criticalErrors.includes(statusCode) && existsSync(sessionDir)) {
                    logger.warn(`⚠️ Erro ${statusCode} detectado. Limpando a sessão para forçar uma nova autenticação...`);
                    rmSync(sessionDir, { recursive: true, force: true });
                }
                logger.info(`Tentando reconectar em ${delay / 1000} segundos... (Tentativa ${reconnectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(() => startBot(), delay);
            } else {
                if (reconnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    logger.error(`❗ Atingido o número máximo de tentativas de reconexão. Encerrando.`);
                } else {
                    // Se a desconexão foi por 'loggedOut', a sessão é inválida.
                    if (statusCode === DisconnectReason.loggedOut) {
                        logger.error(`🚫 Logout detectado (código ${statusCode}). A sessão foi invalidada e será removida.`);
                    } else {
                        logger.error(`❗ Conexão permanente perdida, código: ${statusCode || 'desconhecido'}. A sessão pode ser inválida.`);
                    }
                }
                
                if (existsSync(sessionDir)) {
                    logger.info('Limpando sessão antiga para gerar um novo QR Code na próxima inicialização...');
                    rmSync(sessionDir, { recursive: true, force: true });
                }
                // Em um ambiente de produção, queremos que o serviço pare e seja reiniciado pelo gerenciador (como o Render).
                // Isso força uma reinicialização limpa em vez de um loop de reconexão com falha.
                logger.info('Encerrando o processo. O serviço de hospedagem deve reiniciar o bot automaticamente. Se estiver rodando localmente, inicie novamente.');
                process.exit(1); // Encerra o processo com um código de erro.
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            // Itera sobre todas as mensagens recebidas no evento
            for (const msg of m.messages) {
                await handleMessage(sock, msg, logger);
            }
        } catch (error) {
            logger.error({ error }, '❌ Erro ao processar mensagem');
        }
    });
}

// Inicia o servidor web APENAS se não houver uma sessão via variável de ambiente.
// A lógica de existir a pasta 'session' é tratada dentro do startBot.
// Isso garante que o servidor esteja pronto para exibir um novo QR Code se a sessão local for limpa.
if (!process.env.WHATSAPP_SESSION) {
    const port = process.env.PORT || 3000;
    const server = http.createServer(async (req, res) => {
        if (req.url === '/qrcode') {
            res.setHeader('Content-Type', 'image/png');
            try {
                // Usa a variável GLOBAL que armazena a string do QR Code
                const qrCodeData = await qrcode.toBuffer(qrCodeString);
                res.end(qrCodeData);
            } catch (err) {
                console.error('Erro ao gerar imagem do QR Code:', err);
                res.statusCode = 500;
                res.end('Erro ao gerar QR Code.');
            }
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Bot está rodando. Acesse /qrcode para ver o QR Code, se necessário.');
        }
    });

    server.listen(port, () => {
        console.log(`Servidor web iniciado na porta ${port}. Aguardando geração do QR Code...`);
    });
}

// Inicia a lógica principal do bot
startBot();

process.on('unhandledRejection', (reason, promise) => {
    // Usa o logger para registrar o erro, garantindo que ele vá para o arquivo de log
    globalLogger.error({ reason, promise }, 'Unhandled Rejection detectada.');
    // Considerar encerrar o processo para forçar uma reinicialização limpa
    // process.exit(1);
});

process.on('uncaughtException', (error) => {
    globalLogger.fatal({ error }, 'Uncaught Exception detectada. O bot será encerrado.');
    // Em caso de exceção não capturada, é mais seguro encerrar o processo.
    process.exit(1);
});
