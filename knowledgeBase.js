import fs from 'fs';
import path from 'path';

// Carrega a base de conhecimento do arquivo JSON.
// Usar `readFileSync` aqui é aceitável, pois é uma operação de inicialização
// que acontece apenas uma vez, e o bot precisa desses dados para funcionar.
const knowledgeBasePath = path.resolve(process.cwd(), 'knowledgeBase.json');
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

// Armazena o estado da conversa para cada usuário (ex: contagem de falhas)
const conversationState = {};
const MAX_FALLBACKS = 2; // O transbordo ocorrerá na terceira tentativa
const MEMORY_SIZE = 5; // Número de mensagens anteriores a serem lembradas

/**
 * Formata e constrói uma mensagem de menu a partir de um nó da árvore de menu.
 * @param {object} menuNode - O nó do menu contendo texto e opções.
 * @returns {string} A mensagem de menu formatada.
 */
function buildMenuMessage(menuNode, userName) {
  let message = menuNode.text;
  if (menuNode.options) {
    message += '\n';
    for (const [key, value] of Object.entries(menuNode.options)) {
      message += `\n${key}️⃣. ${value}`;
    }
    message += '\n\nA qualquer momento, digite "menu" para voltar ao início.';
  }

  // Adiciona o nome do usuário na saudação principal do menu
  if (menuNode === knowledgeBase.menu_tree.main) {
    message = message.replace('Olá!', `Olá, ${userName}!`);
  }
  return message;
}

/**
 * Retorna uma resposta baseada no texto da mensagem recebida.
 * @param {string} chatId - O ID do chat do usuário.
 * @param {string} messageText - O texto da mensagem do usuário.
 * @param {string} userName - O nome do usuário.
 * @returns {string} A resposta do robô.
 */
export function getResponse(chatId, messageText, userName) {
  // --- GERENCIAMENTO DE ESTADO E MEMÓRIA ---
  if (!conversationState[chatId]) {
    conversationState[chatId] = { fallbackCount: 0, history: [] };
  }
  const state = conversationState[chatId];

  // Adiciona a mensagem atual ao histórico
  state.history.push(messageText);
  // Mantém o histórico com o tamanho definido
  if (state.history.length > MEMORY_SIZE) {
    state.history.shift(); // Remove a mensagem mais antiga
  }
  let lowerCaseText = messageText.toLowerCase().trim();

  // Verifica se a mensagem é um comando (começa com '!')
  if (lowerCaseText.startsWith('!')) {
    // Remove o '!' para processar o comando
    lowerCaseText = lowerCaseText.substring(1);
  }

  // Verifica se a mensagem é uma saudação ou um pedido de menu
  const isGreeting = knowledgeBase.greetings.some(greeting => lowerCaseText.includes(greeting));
  if (isGreeting || lowerCaseText === knowledgeBase.menu_trigger || lowerCaseText === 'inicio' || lowerCaseText === 'voltar') {
    // Ao voltar para o menu principal, limpa o estado de conversa
    if (conversationState[chatId]) {
      delete conversationState[chatId];
    }
    return buildMenuMessage(knowledgeBase.menu_tree.main, userName);
  }

  // --- LÓGICA DE BUSCA INTELIGENTE POR PALAVRAS-CHAVE ---
  let bestMatch = { score: 0, answer: null };

  // Constrói um texto de contexto com as últimas mensagens
  const contextText = state.history.join(' ');

  for (const item of knowledgeBase.responses) {
    let currentScore = 0;
    for (const keyword of item.keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(contextText)) {
        currentScore++;
      }
    }

    if (currentScore > bestMatch.score) {
      bestMatch = { score: currentScore, answer: item.answer };
    }
  }

  // Considera uma correspondência válida se pelo menos uma palavra-chave for encontrada.
  // Você pode aumentar o `bestMatch.score > 0` para `> 1` para exigir mais palavras-chave.
  if (bestMatch.score > 0) {
    state.fallbackCount = 0; // Reseta o estado de fallback ao encontrar uma resposta
    return bestMatch.answer;
  }
  // --- FIM DA LÓGICA DE BUSCA INTELIGENTE ---

  // Se não encontrou por keyword, verifica se é uma opção de menu (ex: "1", "2")
  // Verifica se o usuário está em um submenu
  const currentMenu = conversationState[chatId]?.currentMenu;
  let nextMenuKey = lowerCaseText;

  if (currentMenu && /^\d+$/.test(lowerCaseText)) {
    // Se está em um menu e digitou um número, constrói a chave do submenu (ex: "2-4")
    nextMenuKey = `${currentMenu}-${lowerCaseText}`;
  }

  const menuNode = knowledgeBase.menu_tree[nextMenuKey];
  if (menuNode) {
    // Se o nó encontrado for um novo menu (tem opções), atualiza o estado
    if (menuNode.options) {
      conversationState[chatId] = { ...conversationState[chatId], currentMenu: nextMenuKey };
    } else {
      // Se for uma resposta final, limpa o estado do menu
      delete conversationState[chatId]?.currentMenu;
    }
    return buildMenuMessage(menuNode, userName);
  }

  // --- LÓGICA DE FALLBACK E TRANSBORDO ---
  // Se nenhuma resposta foi encontrada, incrementa o contador de falhas.
  state.fallbackCount++;

  // Se o limite de falhas for atingido, envia a mensagem de transbordo.
  if (conversationState[chatId].fallbackCount > MAX_FALLBACKS) {
    delete conversationState[chatId]; // Reseta para não entrar em loop
    return "Parece que não estou conseguindo te ajudar com essa questão específica. 😥\n\nPara garantir que você seja atendido da melhor forma, por favor, entre em contato com a nossa Central de Mediação Acadêmica (CMA) pelo telefone 0800-702-0500 (opção 2). Eles estão preparados para resolver seu caso.";
  }

  // Se ainda não atingiu o limite, retorna a mensagem de fallback padrão.
  return knowledgeBase.fallback;
}