import { getResponse } from './knowledgeBase.js';
import logger from './logger.js';

// Objeto para armazenar o estado da conversa de cada usuário
const userStates = {};
const MAX_FALLBACKS = 3;

/**
 * Processa a mensagem recebida e retorna a resposta apropriada.
 * @param {string} sender - O ID do remetente.
 * @param {string} text - O texto da mensagem.
 * @param {boolean} isButtonResponse - Se a mensagem é uma resposta de botão.
 * @returns {object|null} A resposta a ser enviada ou null.
 */
export function handleMessage(sender, text, isButtonResponse) {
  // --- LÓGICA DE CONTEXTO ---
  const currentState = userStates[sender]?.state;

  if (currentState === 'awaiting_course_area') {
    if (isButtonResponse) {
      logger.info(`[CONTEXTO] Chat: ${sender} | Resposta de botão: "${text}"`);
      // Limpa o estado, pois o usuário respondeu à pergunta.
      delete userStates[sender];
      // A busca na knowledgeBase continuará normalmente com o ID do botão.
    } else {
      logger.warn(`[CONTEXTO/FALHA] Chat: ${sender} | Resposta inesperada: "${text}"`);
      // Retorna uma mensagem instruindo o usuário a usar os botões.
      return { type: 'text', content: 'Por favor, clique em um dos botões que enviei para que eu possa te ajudar melhor.' };
    }
  }
  // --- FIM DA LÓGICA DE CONTEXTO ---

  const response = getResponse(text);

  if (response) {
    // Se encontramos uma resposta, resetamos o contador de fallback.
    if (userStates[sender]) {
      delete userStates[sender];
    }

    // Se a resposta for do tipo botões, definimos o estado de espera.
    if (response.type === 'buttons') {
      userStates[sender] = { state: 'awaiting_course_area', fallbackCount: 0 };
      logger.info(`[ESTADO] Chat: ${sender} | Estado definido para: awaiting_course_area`);
    }
    return response;
  } else {
    // --- LÓGICA DE FALLBACK ---
    handleFallback(sender, text);
    return null; // Nenhuma resposta encontrada
  }
}

/**
 * Gerencia a lógica de fallback quando nenhuma resposta é encontrada.
 * @param {string} sender - O ID do remetente.
 * @param {string} text - O texto da mensagem não compreendida.
 */
function handleFallback(sender, text) {
  if (!userStates[sender]) {
    userStates[sender] = { fallbackCount: 0 };
  }

  userStates[sender].fallbackCount++;
  const attempt = userStates[sender].fallbackCount;

  logger.warn(`[FALLBACK] Chat: ${sender} | Mensagem: "${text}" | Tentativa: ${attempt} de ${MAX_FALLBACKS}`);

  if (attempt >= MAX_FALLBACKS) {
    logger.error(`[ESCALADA] Chat: ${sender} | Mensagem: "${text}" | Motivo: ${MAX_FALLBACKS} falhas consecutivas.`);
    // Aqui você pode adicionar a lógica para escalar para um atendente humano.
    // Por exemplo, enviar uma notificação ou salvar os dados do usuário.
    // Por enquanto, vamos resetar o estado para evitar loops de escalada.
    delete userStates[sender];
    // Poderíamos enviar uma mensagem de escalada, mas por enquanto vamos silenciar.
  }
}

/**
 * Retorna o estado atual de um usuário (útil para depuração).
 */
export function getUserState(sender) {
    return userStates[sender];
}