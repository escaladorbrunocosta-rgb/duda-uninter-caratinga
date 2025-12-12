/**
 * =================================================================
 * ARQUIVO: bot-inteligente/knowledgeBase.js
 * DESCRIÇÃO: Base de Conhecimento centralizada do bot.
 * CONTÉM: Saudações, menus, respostas por palavras-chave e fallbacks.
 * =================================================================
 */

export const knowledgeBase = {
  greetings: ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "opa", "e aí", "tudo bem?", "tudo bem"],
  menu_trigger: "menu",
  
  menu_tree: {
    main: {
      text: "Olá, {userName}! Eu sou a Duda, sua assistente virtual da Uninter Caratinga. Como posso te ajudar hoje?",
      options: {
        "1": "Secretaria",
        "2": "Financeiro (Boletos)",
        "3": "Cursos e Matrículas",
        "4": "Falar com um atendente",
      }
    },
    "1": { // Secretaria
      text: "Certo, sobre a Secretaria, qual sua dúvida?",
      options: {
        "1.1": "Pedir uma declaração",
        "1.2": "Entregar documentos",
        "9": "Voltar ao menu principal"
      }
    },
    "2": { // Financeiro
      text: "Entendi, Financeiro. Para gerar a segunda via do seu boleto, acesse o portal do aluno em uninter.com/ava. Se precisar de ajuda com negociação, digite *4* para falar com um atendente.",
    },
    "3": { // Cursos
      text: "Temos dezenas de cursos de Graduação e Pós-Graduação! Para conhecer todos e fazer sua matrícula, acesse nosso site: uninter.com. Qual área você tem mais interesse?",
    },
    "4": { // Handover
      text: "Ok! Para garantir que você receba a melhor assistência, estou transferindo sua conversa para um de nossos consultores. Por favor, aguarde um momento.",
    },
    "1.1": {
      text: "Para solicitar sua declaração de matrícula ou qualquer outra, por favor, abra um atendimento no portal do aluno (AVA). É rápido e fácil!",
    },
    "1.2": {
      text: "Você pode entregar seus documentos presencialmente em nosso polo em Caratinga, ou digitalizá-los e enviar através do portal do aluno (AVA).",
    }
  },

  fallback: [
    "Desculpe, não entendi o que você quis dizer. Poderia tentar com outras palavras? Se preferir, digite *menu* para ver as opções.",
    "Hmm, essa eu não aprendi ainda. Digite *menu* para ver tudo o que eu posso fazer por você ou digite *4* para falar com um de nossos atendentes."
  ]
};