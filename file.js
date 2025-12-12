// =================================================================
// ARQUIVO: utils/file.js
// DESCRIÇÃO: Funções utilitárias para manipulação de arquivos e diretórios.
// =================================================================

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Garante que um diretório exista. Se não existir, cria-o.
 * @param {string} dirPath - O caminho do diretório.
 */
export const ensureDirExists = (dirPath) => fs.mkdir(dirPath, { recursive: true });

/**
 * Remove um diretório e todo o seu conteúdo de forma recursiva.
 * @param {string} dirPath - O caminho do diretório a ser removido.
 */
export const deleteDir = (dirPath) => fs.rm(dirPath, { recursive: true, force: true });