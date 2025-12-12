import { promises as fs } from 'fs';
import path from 'path';
import logger from '../logger.js';

/**
 * Garante que um diretório exista. Se não existir, ele o cria.
 * @param {string} dirPath - O caminho do diretório a ser verificado/criado.
 */
export async function ensureDirExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info(`[FS] Diretório ${dirPath} não encontrado. Criando...`);
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

/**
 * Deleta um diretório recursivamente.
 * @param {string} dirPath - O caminho do diretório a ser deletado.
 */
export const deleteDir = async (dirPath) => fs.rm(dirPath, { recursive: true, force: true });