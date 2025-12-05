/**
 * Este é o cérebro do bot. Ele contém toda a lógica para interpretar
 * as mensagens dos usuários e gerar as respostas apropriadas, lendo
 * a base de conhecimento do arquivo knowledgeBase.json.
 */
import { promises as fs } from 'fs';
import path from 'path';

// Carrega a base de conhecimento do arquivo JSON.
// Usamos uma função assíncrona para carregar o JSON no início.
let knowledge;
async function loadKnowledgeBase() {
    const jsonPath = path.join(process.cwd(), 'knowledgeBase.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    knowledge = JSON.parse(fileContent);
}
// Chamamos a função para garantir que a base de conhecimento seja carregada.
loadKnowledgeBase().catch(err => {
    console.error("❌ Falha ao carregar knowledgeBase.json:", err);
    process.exit(1); // Encerra o processo se a base de conhecimento não puder ser carregada.
});

// Objeto para rastrear o estado da conversa de cada usuário.
// Em um bot real, isso seria armazenado em um banco de dados para persistência.
const userState = new Map();

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
 * @returns {string} A resposta do bot.
 */
export function getResponse(chatId, messageText, userName) {
    if (!knowledge) {
        return "Desculpe, estou inicializando minha base de conhecimento. Tente novamente em um instante.";
    }

    const normalizedText = messageText.toLowerCase().trim();
    const state = userState.get(chatId) || { menu: 'main' };

    // Resetar para o menu principal com saudações ou comando de menu
    if (knowledge.greetings.includes(normalizedText) || normalizedText === knowledge.menu_trigger) {
        userState.set(chatId, { menu: 'main' });
        const welcomeMessage = knowledge.menu_tree.main.text.replace('Olá!', `Olá, ${userName}!`);
        return formatMenu({ ...knowledge.menu_tree.main, text: welcomeMessage });
    }

    // Lógica de navegação no menu
    const currentNode = knowledge.menu_tree[state.menu] || knowledge.menu_tree['main'];
    if (currentNode.options && currentNode.options[normalizedText]) {
        const nextMenuKey = `${state.menu}-${normalizedText}`;
        const nextNode = knowledge.menu_tree[nextMenuKey] || knowledge.menu_tree[normalizedText];

        if (nextNode) {
            // Se o próximo nó tiver mais opções, atualiza o estado do usuário
            if (nextNode.options) {
                userState.set(chatId, { menu: nextMenuKey });
            } else {
                // Se for uma resposta final, reseta o estado para o menu principal
                userState.set(chatId, { menu: 'main' });
            }
            return formatMenu(nextNode);
        }
    }

    // Lógica de busca por palavras-chave se não for um comando de menu
    const words = normalizedText.split(/\s+/);
    let bestMatch = { score: 0, answer: null };

    for (const response of knowledge.responses) {
        let currentScore = 0;
        for (const keyword of response.keywords) {
            if (normalizedText.includes(keyword)) {
                currentScore++;
            }
        }
        if (currentScore > bestMatch.score) {
            bestMatch = { score: currentScore, answer: response.answer };
        }
    }

    // Se encontrou uma resposta com uma pontuação mínima, retorna ela.
    if (bestMatch.score > 0) {
        // Reseta o estado do usuário após dar uma resposta direta
        userState.set(chatId, { menu: 'main' });
        return bestMatch.answer;
    }

    // Se for a primeira interação e não entendeu, mostra o menu principal
    if (!userState.has(chatId)) {
        userState.set(chatId, { menu: 'main' });
        const welcomeMessage = knowledge.menu_tree.main.text.replace('Olá!', `Olá, ${userName}!`);
        return formatMenu({ ...knowledge.menu_tree.main, text: welcomeMessage });
    }

    // Se nenhuma lógica acima funcionou, retorna o fallback.
    return knowledge.fallback;
}
