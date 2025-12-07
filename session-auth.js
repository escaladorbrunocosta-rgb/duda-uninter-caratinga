/**
 * Lógica de autenticação para o Baileys que gerencia a sessão.
 * - Em ambiente de desenvolvimento (local), usa `useMultiFileAuthState` para salvar a sessão em arquivos na pasta `session`.
 * - Em ambiente de produção (Render), lê a sessão de uma string JSON (da variável de ambiente `WHATSAPP_SESSION`).
 */
import {
    proto,
    initAuthCreds,
    BufferJSON
} from '@whiskeysockets/baileys';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import path from 'path';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';

const logger = pino().child({ level: 'silent', stream: 'store' });
const SESSION_DIR = path.join(process.cwd(), 'session');

/**
 * Converte a string da sessão (de uma variável de ambiente) em um formato que o Baileys entende.
 * @param {string} sessionAsString - A string JSON da sessão.
 * @returns O objeto de estado de autenticação.
 */
const useSessionAuthState = async (sessionAsString, isProduction = false) => {
    const readData = async (file) => {
        try {
            const data = await fs.readFile(path.join(SESSION_DIR, `${file}.json`), { encoding: 'utf-8' });
            return JSON.parse(data, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    const writeData = (data, file) => {
        return fs.writeFile(path.join(SESSION_DIR, `${file}.json`), JSON.stringify(data, BufferJSON.replacer, 2));
    };

    const clearState = () => {
        // Lógica para limpar o estado se necessário (não usada por padrão)
    };
    let creds;
    let keys = {};

    // Se estiver em produção e a string da sessão existir, parseia ela.
    if (isProduction && sessionAsString) {
        const parsedSession = JSON.parse(sessionAsString, BufferJSON.reviver);
        creds = parsedSession.creds;
        keys = parsedSession.keys;
    } else {
        // Em desenvolvimento, cria o diretório de sessão se não existir.
        if (!existsSync(SESSION_DIR)) {
            mkdirSync(SESSION_DIR, { recursive: true });
        }
        creds = (await readData('creds')) || initAuthCreds();
    }

    const saveState = () => {
        // Em produção, não fazemos nada, pois a sessão é efêmera.
        if (isProduction) return;

        // Em desenvolvimento, salva os dados nos arquivos.
        return Promise.all([
            writeData(creds, 'creds'),
            writeData(keys, 'keys'),
        ]);
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, jids) => {
                    const key = type;
                    return jids.reduce((dict, jid) => {
                        const value = keys[key]?.[jid];
                        if (value) {
                            if (type === 'app-state-sync-key') {
                                dict[jid] = proto.Message.AppStateSyncKeyData.fromObject(value);
                            } else {
                                dict[jid] = value;
                            }
                        }
                        return dict;
                    }, {});
                },
                set: (data) => {
                    for (const key in data) {
                        const Ckey = key;
                        if (!keys[Ckey]) {
                            keys[Ckey] = {};
                        }
                        Object.assign(keys[Ckey], data[key]);
                    }
                    saveState();
                },
            },
        },
        saveCreds: saveState,
    };
};

export { useSessionAuthState };