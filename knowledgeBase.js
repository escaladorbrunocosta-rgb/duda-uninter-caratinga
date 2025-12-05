/**
 * Este é o cérebro do bot. Ele contém toda a lógica para interpretar
 * as mensagens dos usuários e gerar as respostas apropriadas.
 */

// Objeto para rastrear o estado da conversa de cada usuário.
// Em um bot real, isso seria armazenado em um banco de dados.
const userState = new Map();

// Define as palavras-chave e as respostas correspondentes.
const responses = {
    'cursos': 'Olá! 📚 Nossos cursos disponíveis são:\n\n1. Análise e Desenvolvimento de Sistemas\n2. Engenharia de Software\n3. Marketing Digital\n4. Gestão Financeira\n\nDigite o número do curso para saber mais!',
    'preços': 'Os valores variam por curso. Para qual curso você gostaria de saber o preço?',
    'contato': 'Você pode falar com um de nossos consultores pelo número (XX) XXXX-XXXX durante o horário comercial.',
    'horário': 'Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00.',
    '1': 'Ótima escolha! O curso de Análise e Desenvolvimento de Sistemas foca em... (mais detalhes aqui).',
    '2': 'Excelente! O curso de Engenharia de Software prepara você para... (mais detalhes aqui).',
};

/**
 * Gera a mensagem de saudação inicial.
 * @param {string} userName - O nome do usuário.
 * @returns {string} A mensagem de boas-vindas.
 */
function getWelcomeMessage(userName) {
    return `👋 Olá, ${userName}! Bem-vindo(a) ao atendimento automatizado da Uninter Caratinga.\n\nEu sou a Duda, sua assistente virtual. Como posso te ajudar hoje?\n\nDigite uma das opções abaixo:\n*- Cursos*\n*- Preços*\n*- Contato*\n*- Horário*`;
}

/**
 * Gera a mensagem de fallback quando o bot não entende o comando.
 * @returns {string} A mensagem de fallback.
 */
function getFallbackMessage() {
    return 'Desculpe, não entendi o que você quis dizer. 🤔\n\nPoderia tentar uma das opções abaixo?\n\n*- Cursos*\n*- Preços*\n*- Contato*\n*- Horário*';
}

/**
 * Gera a mensagem de transbordo para um atendente humano.
 * @returns {string} A mensagem de transbordo.
 */
function getHandoverMessage() {
    return 'Entendi. Estou transferindo você para um de nossos atendentes. Por favor, aguarde um momento. 🧑‍💼';
}

/**
 * Processa a mensagem do usuário e retorna a resposta adequada.
 * @param {string} chatId - O ID do chat do usuário.
 * @param {string} messageText - O texto da mensagem recebida.
 * @param {string} userName - O nome do usuário.
 * @returns {string} A resposta do bot.
 */
export function getResponse(chatId, messageText, userName) {
    const normalizedText = messageText.toLowerCase().trim();

    // Verifica se é a primeira mensagem do usuário na sessão atual
    if (!userState.has(chatId)) {
        userState.set(chatId, { lastInteraction: Date.now() });
        return getWelcomeMessage(userName);
    }

    // Atualiza o tempo da última interação
    userState.set(chatId, { lastInteraction: Date.now() });

    // Lógica para transbordo (atendimento humano)
    if (normalizedText.includes('falar com atendente') || normalizedText.includes('humano')) {
        return getHandoverMessage();
    }

    // Procura por uma resposta direta baseada na palavra-chave
    if (responses[normalizedText]) {
        return responses[normalizedText];
    }

    // Procura por palavras-chave dentro da frase
    for (const keyword in responses) {
        if (normalizedText.includes(keyword)) {
            return responses[keyword];
        }
    }

    // Se nenhuma palavra-chave for encontrada, retorna a mensagem de fallback
    return getFallbackMessage();
}
