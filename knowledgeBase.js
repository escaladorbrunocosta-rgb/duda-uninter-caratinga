/**
 * Este é o cérebro do bot. Ele contém toda a lógica para interpretar
 * as mensagens dos usuários e gerar as respostas apropriadas, lendo
 * a base de conhecimento do arquivo knowledgeBase.json.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { getWeather, getGeminiResponse } from './services.js';

// Carrega a base de conhecimento do arquivo JSON.
// Usamos uma função assíncrona para carregar o JSON no início.
let knowledge;
export async function loadKnowledgeBase() {
    const jsonPath = path.join(process.cwd(), 'knowledgeBase.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    knowledge = JSON.parse(fileContent);
}

/**
 * Retorna uma saudação apropriada baseada na hora do dia.
 * @returns {string} Saudação (Bom dia, Boa tarde, Boa noite).
 */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) {
        return "Bom dia";
    } else if (hour < 18) {
        return "Boa tarde";
    } else {
        return "Boa noite";
    }
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
 * Seleciona uma resposta de forma inteligente. Se a resposta for um array,
 * escolhe uma aleatoriamente.
 * @param {string|string[]} response - A resposta ou array de respostas.
 * @returns {string} A resposta final.
 */
function chooseResponse(response) {
    if (Array.isArray(response)) {
        return response[Math.floor(Math.random() * response.length)];
    }
    return response;
}

/**
 * Processa a mensagem do usuário e retorna a resposta adequada.
 * @param {string} chatId - O ID do chat do usuário.
 * @param {string} messageText - O texto da mensagem recebida.
 * @param {string} userName - O nome do usuário.
 * @returns {Promise<string>} A resposta do bot.
 */
export async function getResponse(chatId, messageText, userName) { // A função agora é async
    if (!knowledge) {
        return "Desculpe, estou inicializando minha base de conhecimento. Tente novamente em um instante.";
    }

    const normalizedText = messageText.toLowerCase().trim();

    // --- Lógica de Comando para Habilidade Social (API Externa) ---
    if (normalizedText.startsWith('!clima')) {
        const city = normalizedText.substring(7).trim();
        if (!city) return 'Por favor, informe uma cidade. Exemplo: `!clima São Paulo`';
        return await getWeather(city); // Retorna a promessa do serviço
    }

    // --- Lógica de Comando para IA Generativa (Gemini) ---
    if (normalizedText.startsWith('!gemini')) {
        const prompt = normalizedText.substring(8).trim();
        if (!prompt) return 'Por favor, faça uma pergunta. Exemplo: `!gemini Qual a capital da Mongólia?`';
        return await getGeminiResponse(prompt);
    }

    // Resetar para o menu principal com saudações ou comando de menu
    if (knowledge.greetings.includes(normalizedText) || normalizedText === knowledge.menu_trigger) {
        const greeting = getGreeting();
        const welcomeMessage = knowledge.menu_tree.main.text.replace('Olá!', `${greeting}, ${userName}!`);
        return formatMenu({ ...knowledge.menu_tree.main, text: welcomeMessage });
    }

    // Lógica de transferência para humano (Handover)
    if (knowledge.human_handover.keywords.some(kw => normalizedText.includes(kw))) {
        return knowledge.human_handover.message;
    }

    // Lógica de navegação no menu
    const currentNode = knowledge.menu_tree['main']; // Sempre começa do menu principal em um modelo stateless
    if (currentNode.options && currentNode.options[normalizedText]) {
        const nextMenuKey = `${state.menu}-${normalizedText}`;
        const nextNode = knowledge.menu_tree[nextMenuKey] || knowledge.menu_tree[normalizedText];

        if (nextNode) {
            // Se o próximo nó tiver mais opções, atualiza o estado do usuário
            if (nextNode.options) {
                return formatMenu(nextNode); // Apenas retorna o próximo menu, sem salvar estado
            } 
        }
    }

    // Lógica de busca por palavras-chave se não for um comando de menu
    const words = normalizedText.split(/\s+/);
    let bestMatch = { score: 0, answer: null, keywords: [] };

    for (const response of knowledge.responses) {
        let currentScore = 0;
        // Damos um bônus se a pergunta estiver relacionada ao tópico anterior

        for (const keyword of response.keywords) {
            if (normalizedText.includes(keyword)) {
                currentScore++;
            }
        }

        if (currentScore > bestMatch.score) {
            bestMatch = { score: finalScore, answer: response.answer, keywords: response.keywords };
        }
    }

    // Se encontrou uma resposta com uma pontuação mínima, retorna ela.
    if (bestMatch.score > 0) {
        // ATUALIZA o estado do usuário com o novo tópico da conversa,
        return chooseResponse(bestMatch.answer);
    }

    // --- LÓGICA DE FALLBACK SIMPLES ---
    // Se nenhuma outra lógica funcionou, retorna a primeira mensagem de fallback.
    // Em um modelo stateless, não há como ter um fallback progressivo.
    return chooseResponse(knowledge.fallback[0]);
}
