import fs from 'fs';
import path from 'path';

// Carrega a base de conhecimento do arquivo JSON.
// Usar `readFileSync` aqui é aceitável, pois é uma operação de inicialização
// que acontece apenas uma vez, e o bot precisa desses dados para funcionar.
const knowledgeBasePath = path.resolve(process.cwd(), 'knowledgeBase.json');
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

/**
 * Retorna uma resposta baseada no texto da mensagem recebida.
 * @param {string} messageText - O texto da mensagem do usuário.
 * @returns {string} A resposta do robô.
 */
export function getResponse(messageText) {
  const lowerCaseText = messageText.toLowerCase().trim();

  // Verifica se a mensagem é uma saudação ou um pedido de menu
  const isGreeting = knowledgeBase.greetings.some(greeting => lowerCaseText.includes(greeting));
  if (isGreeting || lowerCaseText === knowledgeBase.menu_trigger) {
    return knowledgeBase.menu;
  }

  // Procura por uma palavra-chave correspondente nas respostas
  for (const response of knowledgeBase.responses) {
    // Verifica se alguma palavra-chave da resposta corresponde a uma palavra inteira na mensagem do usuário.
    // Isso evita correspondências parciais (ex: "2" em "21").
    const foundKeyword = response.keywords.find(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i'); // \b representa uma fronteira de palavra
      return regex.test(lowerCaseText);
    });
    if (foundKeyword) {
      return response.answer;
    }
  }

  // Se nenhuma resposta for encontrada, retorna a mensagem de fallback
  return knowledgeBase.fallback;
}