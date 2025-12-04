/**
 * Retorna uma resposta baseada no texto da mensagem recebida.
 * @param {string} messageText - O texto da mensagem do usuário.
 * @returns {string} A resposta do robô.
 */
export function getResponse(messageText) {
    const lowerCaseText = messageText.toLowerCase().trim();

    // --- MENU PRINCIPAL ---
    const menu = `🤖 Olá! Eu sou a Duda, sua assistente virtual do Polo EAD Uninter de Caratinga.

Como posso te ajudar hoje? Digite o número da opção desejada:

1️⃣. Cursos e Matrículas
2️⃣. Informações para Alunos (Secretaria)
3️⃣. Suporte Técnico
4️⃣. Falar com o Setor Comercial

A qualquer momento, digite "menu" para ver estas opções novamente.`;

    // --- LÓGICA DE RESPOSTAS ---

    if (lowerCaseText.includes('oi') || lowerCaseText.includes('ola') || lowerCaseText.includes('olá') || lowerCaseText === 'menu') {
        return menu;
    }

    switch (lowerCaseText) {
        case '1':
            return 'Para informações sobre nossos cursos e como fazer sua matrícula, por favor, entre em contato com nosso setor comercial pelo número (XX) XXXX-XXXX ou aguarde para ser transferido.';
        case '2':
            return 'Para assuntos da secretaria, como prazos, documentos e notas, acesse seu portal do aluno ou entre em contato pelo e-mail secretaria.caratinga@uninter.com.';
        case '3':
            return 'Se você está com problemas técnicos no seu portal ou AVA, por favor, descreva seu problema em detalhes para que eu possa tentar ajudar ou encaminhar para o suporte.';
        case '4':
            return 'Para falar com o setor comercial, ligue para (XX) XXXX-XXXX ou envie uma mensagem para o WhatsApp deste número.';
        default:
            return `Desculpe, não entendi sua solicitação. Por favor, digite "menu" para ver as opções disponíveis.`;
    }
}