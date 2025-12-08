/**
 * Lógica de autenticação para o Baileys que gerencia a sessão.
 * - Em ambiente de DESENVOLVIMENTO (local), salva a sessão em arquivos na pasta `auth_info_multi`.
 * - Em ambiente de PRODUÇÃO (Render), lê a sessão de uma string JSON (da variável de ambiente `SESSION_DATA`).
 */
import {
    proto,
    initAuthCreds,
    BufferJSON
} from '@whiskeysockets/baileys';
import { promises as fs, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino().child({ stream: 'store' });
const SESSION_DIR = path.join(process.cwd(), 'auth_info_multi');

/**
 * Gerencia o estado de autenticação, adaptando-se ao ambiente.
 * @param {string} sessionAsString - A string JSON da sessão (usada em produção).
 * @param {boolean} isProduction - Flag que indica se está em ambiente de produção.
 * @returns {Promise<{state: object, saveCreds: Function}>} O objeto de estado de autenticação e a função para salvar credenciais.
 */
const useSessionAuthState = async (sessionAsString, isProduction) => {
    let creds;
    let keys = {};

    if (isProduction) {
        // --- LÓGICA DE PRODUÇÃO ---
        if (sessionAsString) {
            logger.info('Usando sessão da variável de ambiente.');
            try {
                const parsedSession = JSON.parse(sessionAsString, BufferJSON.reviver);
                creds = parsedSession.creds;
                keys = parsedSession.keys || {};
            } catch (error) {
                logger.fatal({ err: error }, 'Falha ao parsear a string da sessão. A string pode estar mal formatada.');
                throw new Error('A variável de ambiente SESSION_DATA está corrompida.');
            }
        } else {
            logger.fatal('Variável de ambiente SESSION_DATA não encontrada em ambiente de produção.');
            throw new Error('Sessão não fornecida para o ambiente de produção.');
        }
    } else {
        // --- LÓGICA DE DESENVOLVIMENTO ---
        logger.info('Usando armazenamento de sessão local (MultiFileAuthState).');
        if (!existsSync(SESSION_DIR)) {
            mkdirSync(SESSION_DIR, { recursive: true });
        }

        const readData = async (file) => {
            try {
                const data = await fs.readFile(path.join(SESSION_DIR, `${file}.json`), { encoding: 'utf-8' });
                return JSON.parse(data, BufferJSON.reviver);
            } catch (error) {
                return null;
            }
        };
        creds = (await readData('creds')) || initAuthCreds();
    }

    const saveCreds = async () => {
        // Em produção, a sessão é efêmera e não deve ser salva no disco.
        if (isProduction) {
            return;
        }

        const writeData = (data, file) => {
            return fs.writeFile(path.join(SESSION_DIR, `${file}.json`), JSON.stringify(data, BufferJSON.replacer, 2));
        };

        return Promise.all([
            writeData(creds, 'creds'),
            writeData(keys, 'keys'),
        ]);
    };

    // O objeto de estado que o Baileys espera
    return {
        state: {
            creds,
            keys: {
                get: (type, jids) => {
                    return jids.reduce((dict, jid) => {
                        const value = keys[type]?.[jid];
                        if (value) {
                            dict[jid] = value;
                        }
                        return dict;
                    }, {});
                },
                set: (data) => {
                    for (const key in data) {
                        keys[key] = { ...(keys[key] || {}), ...data[key] };
                    }
                    saveCreds();
                },
            },
        },
        saveCreds,
    };
};

export { useSessionAuthState };