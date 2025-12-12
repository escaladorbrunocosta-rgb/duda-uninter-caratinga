// =================================================================
// ARQUIVO: utils/git.js
// DESCRIÇÃO: Funções para automatizar commits e pushes da sessão para o GitHub.
// =================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import logger from '../logger.js';

const execAsync = promisify(exec);

const SESSION_DIR = path.join(process.cwd(), 'session_data');

/**
 * Configura o Git com nome de usuário e e-mail para poder fazer commits.
 * Essencial para ambientes como o Render.
 */
async function configureGit() {
    try {
        // Use variáveis de ambiente para o nome e e-mail do autor do commit
        const gitUser = process.env.GIT_USER || "DudaBot";
        const gitEmail = process.env.GIT_EMAIL || "dudabot@example.com";

        await execAsync(`git config --global user.name "${gitUser}"`);
        await execAsync(`git config --global user.email "${gitEmail}"`);
        logger.info('[GIT] Configuração do Git realizada com sucesso.');
    } catch (error) {
        logger.error('[GIT] Falha ao configurar o Git. Commits podem falhar.', error);
        throw error; // Interrompe se não conseguir configurar o git
    }
}

/**
 * Puxa as últimas alterações do repositório Git.
 * Útil para garantir que a sessão mais recente seja usada ao iniciar.
 */
export async function pullLatestChanges() {
    try {
        logger.info('[GIT] Puxando últimas alterações do repositório...');
        const { stdout, stderr } = await execAsync('git pull');
        if (stdout) logger.info(`[GIT] Saída do git pull: ${stdout}`);
        if (stderr) logger.warn(`[GIT] Avisos do git pull: ${stderr}`);
    } catch (error) {
        logger.error('[GIT] Falha ao executar "git pull". O bot continuará com a sessão local, se existir.', error);
        // Não lançamos o erro aqui para permitir que o bot tente iniciar mesmo offline.
    }
}

/**
 * Verifica se há alterações na pasta da sessão, faz o commit e o push.
 * Protegido contra commits vazios.
 */
export async function autoGitPush() {
    try {
        // 1. Verificar se há alterações
        const { stdout: statusOutput } = await execAsync(`git status --porcelain "${SESSION_DIR}"`);

        if (statusOutput.trim() === '') {
            logger.info('[GIT] Nenhuma alteração na sessão para comitar.');
            return; // Sai se não houver alterações
        }

        logger.info('[GIT] Alterações detectadas na sessão. Iniciando processo de commit...');

        // 2. Adicionar arquivos ao stage
        await execAsync(`git add "${SESSION_DIR}"`);

        // 3. Criar o commit
        const commitMessage = `[BOT] Atualiza sessão do WhatsApp - ${new Date().toISOString()}`;
        await execAsync(`git commit -m "${commitMessage}"`);
        logger.info(`[GIT] Commit criado com sucesso: "${commitMessage}"`);

        // 4. Fazer o push para o repositório
        // O Render usa 'origin' por padrão para o repositório de onde foi clonado.
        await execAsync('git push origin');
        logger.info('[GIT] Push para o repositório realizado com sucesso!');

    } catch (error) {
        logger.error('[GIT] Falha no processo de auto-push.', error);
        // Em caso de falha (ex: conflito), logar o erro mas não parar o bot.
        // Uma falha de push não deve quebrar a aplicação em execução.
    }
}

/**
 * Função principal que inicializa a configuração do Git e puxa as alterações.
 * Deve ser chamada no início da aplicação.
 */
export async function initializeGit() {
    try {
        await configureGit();
        await pullLatestChanges();
    } catch (error) {
        logger.error('[GIT] Erro fatal durante a inicialização do Git. O bot pode não conseguir salvar a sessão.', error);
        // Dependendo da criticidade, você pode querer parar o processo:
        // process.exit(1);
    }
}