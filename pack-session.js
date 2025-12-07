/**
 * Este script faz duas coisas:
 * 1. Inicia o bot localmente para gerar ou validar uma sessão.
 * 2. Se a conexão for bem-sucedida, ele empacota a sessão da pasta 'session'
 *    em uma única string JSON e a imprime no console.
 *
 * Como usar:
 * 1. Execute este script com: `node pack-session.js`
 * 2. Se a pasta 'session' não existir, um QR Code será exibido no terminal. Escaneie-o com seu WhatsApp.
 * 3. Aguarde a mensagem "✅ Sessão empacotada com sucesso!".
 * 4. Copie a longa string JSON que será impressa logo abaixo da mensagem.
 * 5. Cole essa string no valor da variável de ambiente `WHATSAPP_SESSION` no painel da Render.
 */
import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { BufferJSON } from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';
import path from 'path';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import { useSessionAuthState } from './session-auth.js';

async function generateAndPackSession() {
    console.log('Iniciando processo para gerar/empacotar a sessão...');
    const { state, saveCreds } = await useSessionAuthState(null, false);
    // Busca a versão mais recente do Baileys para garantir compatibilidade
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'info' }), // Alterado para 'info' para depuração
        // A opção printQRInTerminal foi descontinuada.
        // O QR Code será tratado manualmente no evento 'connection.update'.
        browser: ['DudaBot (Gerador)', 'Chrome', '1.0']
    });

    // Variável para garantir que o empacotamento só ocorra após a escrita dos arquivos
    let isCredsSaved = false;

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        isCredsSaved = true;
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR Code recebido! Escaneie com o WhatsApp no seu celular:');
            // Para ambientes como o Render que não exibem o QR Code corretamente no terminal,
            // imprimimos a string do QR Code para que possa ser copiada e gerada externamente.
            console.log('\n✅ Se o QR Code não aparecer, copie a linha abaixo e use um gerador de QR Code online:');
            console.log(`QR_CODE_STRING: ${qr}\n`);
            qrcodeTerminal.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Conexão estabelecida com sucesso. Empacotando a sessão...');

            // Atraso para garantir que todos os arquivos de sessão foram escritos
            // Espera um pouco para garantir que o evento 'creds.update' finalizou.
            while (!isCredsSaved) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const sessionDir = path.resolve('session');
            const sessionData = {};

            try {
                const files = ['creds.json', 'keys.json']; // Apenas os arquivos que criamos
                for (const file of files) {
                    const filePath = path.join(sessionDir, file);
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    sessionData[path.parse(file).name] = JSON.parse(fileContent, BufferJSON.reviver);
                }
                console.log('\n\n✅ Sessão empacotada com sucesso! Copie a string abaixo e cole na sua variável de ambiente `WHATSAPP_SESSION`:\n');
                console.log(JSON.stringify({ creds: sessionData.creds, keys: sessionData.keys }, BufferJSON.replacer, 2));
            } catch (error) {
                console.error('❌ Erro ao ler ou processar os arquivos da sessão:', error.message);
            } finally {
                process.exit(0);
            }
        } else if (connection === 'close') {
            // Correção: Acessa o statusCode de forma segura, sem a sintaxe 'as' do TypeScript.
            const error = lastDisconnect?.error;
            const statusCode = (error instanceof Boom) ? error.output.statusCode : (error ? 500 : 0);
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.error(`❌ Conexão fechada. Motivo: ${error} (código: ${statusCode})`);

            // Se o erro for de logout (dispositivo desconectado), limpa a sessão para forçar um novo QR Code.
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.warn('⚠️ Erro de autenticação (401). A sessão foi invalidada. Limpando sessão antiga para gerar um novo QR Code...');
                await fs.rm(path.resolve('session'), { recursive: true, force: true });
            }

            console.log(`Tente executar o script novamente. Reconexão automática: ${shouldReconnect}`);
            process.exit(1); // Encerra o script em caso de falha para evitar loops
        }
    });
}

generateAndPackSession().catch(err => console.error('❌ Erro inesperado:', err));