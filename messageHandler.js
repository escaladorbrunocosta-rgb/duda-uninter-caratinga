/**
 * =================================================================
 * ARQUIVO: bot-inteligente/messageHandler.js
 * DESCRIÇÃO: Cérebro do BOT-INTELIGENTE.
 * RESPONSABILIDADE: Processar mensagens, navegar em menus,
 * usar NLP simples e devolver a resposta correta.
 * =================================================================
 */

import { knowledgeBase } from './knowledgeBase.js';
import { JaroWinklerDistance } from 'natural';
import fs from 'fs';
import path from 'path';

// --- Gerenciamento de Estado Persistente ---
const STATES_FILE = path.join(process.cwd(), 'userStates.json');
let userStates = new Map();

/**
 * Carrega os estados dos usuários do arquivo JSON.
 */
function loadUserStates() {
    try {
        if (fs.existsSync(STATES_FILE)) {
            const data = fs.readFileSync(STATES_FILE, 'utf-8');
            userStates = new Map(JSON.parse(data));
        }
    } catch (error) {
        console.error("Erro ao carregar estados dos usuários:", error);
        userStates = new Map();
    }
}

/**
 * Retorna uma saudação apropriada baseada na hora do dia.
 * @returns {string} Saudação (Bom dia, Boa tarde, Boa noite).
 */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

/**
 * Salva o estado atual dos usuários no arquivo JSON.
 */
function saveUserStates() {
    const data = JSON.stringify(Array.from(userStates.entries()));
    fs.writeFileSync(STATES_FILE, data, 'utf-8');
}
/**
 * Formata um nó do menu para exibição.
 * @param {object} menuNode - O nó do menu da base de conhecimento.
 * @returns {string} A mensagem do menu formatada.
 */
function formatMenu(menuNode) {
    let message = menuNode.text;
    if (menuNode.options) {
        message += '\n\n' + Object.entries(menuNode.options)
            .map(([key, value]) => `*${key}* - ${value}`)
            .join('\n');
    }
    return message;
}

/**
 * Processa a mensagem do usuário e retorna a resposta adequada.
 * @param {string} chatId - O ID do chat do usuário.
 * @param {string} messageText - O texto da mensagem recebida.
 * @param {string} userName - O nome do usuário.
 * @returns {Promise<string>} A resposta do bot.
 */
export async function getResponse(chatId, messageText, userName) {
    // Garante que os estados estejam carregados
    loadUserStates();

    const normalizedText = messageText.toLowerCase().trim();

    // --- Lógica de Reset e Menu Principal ---
    // Verifica se a mensagem é uma saudação ou um pedido de menu
    const isGreeting = knowledgeBase.greetings.some(greeting => JaroWinklerDistance(normalizedText, greeting) > 0.85);

    if (isGreeting || normalizedText === knowledgeBase.menu_trigger || normalizedText === '9') {
        const greeting = getGreeting();
        const welcomeMessage = knowledgeBase.menu_tree.main.text.replace('{userName}', userName);
        const fullMessage = `${greeting}, ${welcomeMessage}`;
        
        // Atualiza o estado para o menu principal
        userStates.set(chatId, { menu: 'main' });
        saveUserStates();
        
        return formatMenu({ ...knowledgeBase.menu_tree.main, text: fullMessage.replace('Olá, Bom dia, ', '') });
    }

    // --- Lógica de Navegação no Menu ---
    const currentState = userStates.get(chatId) || { menu: 'main' };
    const currentNode = knowledgeBase.menu_tree[currentState.menu];

    // Verifica se a entrada corresponde a uma opção do menu atual
    if (currentNode && currentNode.options && knowledgeBase.menu_tree[normalizedText]) {
        const nextNode = knowledgeBase.menu_tree[normalizedText];
        
        // Se o próximo nó for um menu, atualiza o estado
        if (nextNode.options) {
            userStates.set(chatId, { menu: normalizedText });
            saveUserStates();
        } else {
            // Se for uma resposta final, reseta o estado para o menu principal
            userStates.set(chatId, { menu: 'main' });
            saveUserStates();
        }
        return formatMenu(nextNode);
    }

    // --- Lógica de Fallback ---
    // Se nenhuma lógica anterior funcionou, usa uma mensagem de fallback.
    // Poderíamos adicionar um contador para respostas de fallback progressivas.
    const fallbackCount = (currentState.fallbackCount || 0) % knowledgeBase.fallback.length;
    const fallbackMessage = knowledgeBase.fallback[fallbackCount];
    
    // Atualiza o contador de fallback no estado do usuário
    userStates.set(chatId, { ...currentState, fallbackCount: fallbackCount + 1 });
    saveUserStates();

    return fallbackMessage;
}