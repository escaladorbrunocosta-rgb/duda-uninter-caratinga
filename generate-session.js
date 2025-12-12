import { promises as fs } from 'fs';
import path from 'path';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';

const AUTH_DIR = 'auth_info_multi';
const OUTPUT_FILE = 'session_for_render.txt';

async function generateSession() {
    console.log('Iniciando a geração da sessão...');

    // Limpa o diretório de autenticação anterior para garantir uma nova sessão
    if (await fs.stat(AUTH_DIR).catch(() => false)) {
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        console.log('Diretório de autenticação anterior removido.');
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log('Escaneie o QR Code com seu WhatsApp. Ele irá desaparecer assim que for escaneado.');
        }

        if (connection === 'open') {
            console.log('✅ Conexão estabelecida com sucesso!');
            console.log('Aguarde, estamos compactando os dados da sessão...');

            // Compacta os dados da sessão em uma única string JSON
            const sessionData = JSON.stringify(state.creds);
            await fs.writeFile(OUTPUT_FILE, sessionData);

            console.log(`\n========================= SESSÃO GERADA =========================`);
            console.log(`✅ Os dados da sessão foram salvos e compactados no arquivo: ${OUTPUT_FILE}`);
            console.log(`\nINSTRUÇÕES PARA O RENDER:`);
            console.log(`1. Copie TODO o conteúdo do arquivo '${OUTPUT_FILE}'.`);
            console.log(`2. No seu serviço do Render, vá para "Environment".`);
            console.log(`3. Crie uma nova variável de ambiente com a chave 'SESSION_DATA'.`);
            console.log(`4. Cole o conteúdo copiado no campo de valor.`);
            console.log(`=================================================================\n`);

            await sock.end(undefined);
            process.exit(0);
        }

        if (connection === 'close') {
            const { lastDisconnect } = update;
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== 401; // 401 = Logout
            if (shouldReconnect) {
                console.log('Conexão fechada. Tentando reconectar...');
                generateSession();
            } else {
                console.log('Conexão fechada permanentemente. Verifique suas credenciais.');
                process.exit(1);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

generateSession().catch(err => console.error('Ocorreu um erro:', err));