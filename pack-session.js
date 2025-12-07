/**
 * Este script faz duas coisas:
 * 1. Inicia o bot localmente para gerar ou validar uma sessão.
 * 2. Se a conexão for bem-sucedida, ele empacota TODOS os arquivos da pasta 'session'
 *    em uma única string Base64 e a imprime no console.
 *
 * Como usar:
 * 1. Execute este script com: `npm run pack-session`
 * 2. Se a pasta 'session' não existir, um QR Code será exibido no terminal. Escaneie-o com seu WhatsApp.
 * 3. Aguarde a mensagem "✅ Sessão empacotada em Base64!".
 * 4. Copie a longa string que será impressa logo abaixo.
 * 5. Cole essa string no valor da variável de ambiente `WHATSAPP_SESSION` no seu painel da Render.
 */
import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { BufferJSON } from '@whiskeysockets/baileys';
import path from 'path';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import { useSessionAuthState } from './session-auth.js';

async function generateAndPackSession() {
    console.log('Iniciando processo para gerar/empacotar a sessão...');
    const { state, saveCreds, clearState } = await useSessionAuthState(null, false);
    // Busca a versão mais recente do Baileys para garantir compatibilidade
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'info' }), // Alterado para 'info' para depuração
        // A opção printQRInTerminal foi descontinuada.
        // O QR Code será tratado manualmente no evento 'connection.update'.
        browser: ['DudaBot (Gerador)', 'Chrome', '1.0']
    });

    // Variável para garantir que o empacotamento só ocorra após a escrita dos arquivos
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n\n==================================================================');
            console.log('PASSO 1: IGNORE o QR Code quebrado que aparecerá abaixo.');
            console.log('PASSO 2: COPIE a linha de texto em VERDE que começa com "QR_CODE_STRING:".');
            console.log('PASSO 3: COLE o texto copiado em um gerador de QR Code online para escanear.');
            console.log('==================================================================\n');
            console.log('\x1b[32m%s\x1b[0m', `QR_CODE_STRING: ${qr}`); // Imprime a string em verde
            console.log('\n'); // Adiciona espaço antes do QR quebrado
            qrcodeTerminal.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Conexão estabelecida com sucesso. Empacotando a sessão...');

            // Aguarda um breve momento para garantir que o último 'creds.update' foi salvo no disco.
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                // A função `state.toJSON()` da biblioteca serializa toda a sessão em um objeto JSON.
                const sessionObject = state.toJSON();
                // Convertemos o objeto para uma string e depois para Base64.
                // Isso garante que todos os dados, incluindo buffers, sejam preservados corretamente.
                const sessionString = JSON.stringify(sessionObject, BufferJSON.replacer);
                const sessionBase64 = Buffer.from(sessionString).toString('base64');

                console.log('\n\n==================================================================');
                console.log('✅ Sessão empacotada em Base64! Copie a string abaixo:');
                console.log('==================================================================\n');
                console.log(sessionBase64);
                console.log('\nCopie a string acima e cole na sua variável de ambiente `WHATSAPP_SESSION`.\n');

            } catch (error) {
                console.error('❌ Erro ao empacotar a sessão:', error.message);
            } finally {
                process.exit(0);
            }
        } else if (connection === 'close') {
            const error = lastDisconnect?.error;
            const statusCode = (error instanceof Boom) ? error.output.statusCode : (error ? 500 : 0);
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.error(`❌ Conexão fechada. Motivo: ${error} (código: ${statusCode})`);

            // Se o erro for de logout (dispositivo desconectado), limpa a sessão para forçar um novo QR Code.
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.warn('⚠️ Erro de autenticação (401). A sessão foi invalidada.');
                clearState(); // Limpa a sessão da memória
                console.log('Sessão limpa. Por favor, execute o script novamente para gerar um novo QR Code.');
                process.exit(1); // Encerra com erro para indicar falha de autenticação.
            } else {
                // Para outros erros, apenas encerra para que o usuário possa tentar novamente.
                console.log('A conexão falhou. Tente executar o script novamente.');
                process.exit(1);
            }
        }
    });
}

generateAndPackSession().catch(err => console.error('❌ Erro inesperado:', err));