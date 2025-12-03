import fs from 'fs';
import path from 'path';

let KB = [];

try {
  // Lê o arquivo JSON de forma síncrona na inicialização
  const jsonPath = path.resolve('knowledgeBase.json');
  const jsonData = fs.readFileSync(jsonPath, 'utf-8');
  KB = JSON.parse(jsonData);
} catch (error) {
  console.error('❌ Erro ao ler ou processar o arquivo knowledgeBase.json:', error);
  // Se o arquivo não puder ser lido, o bot continuará com uma base de conhecimento vazia.
}

export function getResponse(text) {
  if (!text) return null;
  const lowerText = String(text).toLowerCase();

  // Encontra um item na base de conhecimento onde pelo menos uma das palavras-chave 'match' corresponde ao texto recebido.
  const found = KB.find(item => item.match.some(keyword => lowerText.includes(keyword)));

  // Retorna uma cópia profunda da resposta para evitar mutações acidentais no objeto KB original.
  return found ? JSON.parse(JSON.stringify(found.response)) : null;
}