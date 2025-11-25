// index.js

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenAI } = require("@google/generative-ai");

// --- CONFIGURAÇÃO DO GOOGLE GEMINI ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("A variável de ambiente GEMINI_API_KEY não está configurada.");
}

const ai = new GoogleGenAI(apiKey);
// CORREÇÃO: Usando um modelo atual e funcional para evitar 404 Not Found.
const MODELO_GEMINI = 'gemini-2.5-flash'; 

// Inicializa a sessão de chat para manter o contexto, armazenada por ID do chat.
const chats = new Map();

// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dudabot" }),
    // CORREÇÃO: Configuração crucial para AMBIENTES DE HOSPEDAGEM (Heroku/Render)
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- VARIÁVEIS DE FLUXO DE CONVERSAÇÃO ---
const MENU_PRINCIPAL = `Desculpe, [NOME]! Não entendi o que você procura. Sua dúvida principal é sobre:
\n1. 💰 *Financeiro* (Boletos, Dívidas, FIES)
\n2. 📚 *Acadêmico* (Provas, Notas, Tutoria)
\n3. 🎓 *Cursos/Matrícula* (Catálogo, Inscrição, ENEM)
\n\nPor favor, responda com o número (1, 2 ou 3) ou digite *MENU* a qualquer momento!`;

const SUBMENU_CURSOS = `🎓 Cursos e Ingresso
\nCerto! Por favor, digite sua dúvida específica, como:
\n* catálogo de cursos
* como fazer matrícula
* nota do ENEM`;

// --- EVENTOS DO CLIENTE WHATSAPP ---

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado. Escaneie com seu celular.');
});

client.on('ready', () => {
    console.log('Client is ready! Bot Uninter Caratinga está ONLINE, com MEMÓRIA e comandos.');
});

client.on('authenticated', (session) => {
    console.log('AUTENTICADO COM SUCESSO! Conexão estabelecida.');
});

client.on('disconnected', (reason) => {
    console.log('Client foi desconectado!', reason);
});

// --- LÓGICA DE MENSAGEM ---

client.on('message', async msg => {
    const chatId = msg.from;
    const userMessage = msg.body.trim();
    const cleanMessage = userMessage.toLowerCase();
    
    // Extrai o nome do usuário (simulação)
    const userNameMatch = msg.author || 'Bruno';
    const userName = userNameMatch.split('@')[0] || 'Aluno'; 

    if (msg.isStatus || msg.fromMe || userMessage === '') return;

    // Função auxiliar para enviar resposta e evitar o fallback
    const sendMessageAndBypassAI = (text) => client.sendMessage(chatId, text.replace('[NOME]', userName));

    // --- LÓGICA DE NAVEGAÇÃO RÁPIDA (Comandos Fixos) ---
    if (cleanMessage === 'menu' || cleanMessage === 'ajuda' || cleanMessage === 'duda') {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        // Reseta o estado para garantir que a IA não tente responder
        chats.delete(chatId); 
        return;
    }
    
    // Se o chat não tem sessão (é uma nova conversa ou foi resetada), inicia com o menu.
    if (!chats.has(chatId)) {
        sendMessageAndBypassAI(MENU_PRINCIPAL);
        // Cria a sessão com a IA (isso permite que a IA trate as respostas que não são 1, 2, 3)
        const chatSession = ai.chats.create({ model: MODELO_GEMINI });
        chats.set(chatId, chatSession);
        return;
    }
    
    // Obtém a sessão de chat
    const chatSession = chats.get(chatId);
    
    // --- LÓGICA DE FLUXO DO MENU ---
    
    let respostaDoMenu = null;
    
    if (cleanMessage === '1') {
        // Opção 1: Financeiro
        respostaDoMenu = `💰 FINANCEIRO\n\nPara boletos, FIES ou negociação de dívidas, acesse o *AVA* ou ligue para a Central Uninter (0800 702 0500, Opção 1).`;
    } else if (cleanMessage === '2') {
        // Opção 2: Acadêmico
        respostaDoMenu = `📚 ACADÊMICO\n\nPara provas, notas ou falar com a Tutoria, acesse o *AVA* (Ambiente Virtual de Aprendizagem).`;
    } else if (cleanMessage === '3') {
        // Opção 3: Cursos/Matrícula
        respostaDoMenu = SUBMENU_CURSOS;
        // Não retorna aqui. Deixa a IA processar a próxima palavra-chave.
    }
    
    if (respostaDoMenu) {
        sendMessageAndBypassAI(respostaDoMenu);
        return;
    }

    // --- LÓGICA PARA RECONHECIMENTO DE PALAVRAS-CHAVE DA OPÇÃO 3 (CORREÇÃO) ---
    
    if (cleanMessage.includes('catalogo') || cleanMessage.includes('catálogo') || cleanMessage.includes('cursos')) {
         sendMessageAndBypassAI(
            "📘 CATÁLOGO DE CURSOS UNINTER 📘\n\nAcesse a lista completa de Graduação, Pós-Graduação e Extensão diretamente no portal oficial: \n\n🔗 *[INSIRA O LINK OFICIAL AQUI]*\n\nSe precisar de ajuda com a matrícula, me pergunte 'como me matricular'!"
        );
        return;
    } else if (cleanMessage.includes('matricular') || cleanMessage.includes('matricula') || cleanMessage.includes('inscrição') || cleanMessage.includes('inscreva')) {
        sendMessageAndBypassAI(
            "📝 MATRÍCULA E INSCRIÇÃO\n\nVocê pode iniciar sua inscrição diretamente pelo site ou ligar para o Polo Caratinga: (33) 9807-2110. Eles te guiarão no processo!"
        );
        return;
    } else if (cleanMessage.includes('enem') || cleanMessage.includes('vestibular') || cleanMessage.includes('nota')) {
        sendMessageAndBypassAI(
            "🎓 ENEM E VESTIBULAR\n\nA Uninter aceita a nota do ENEM para ingresso! Para verificar as condições e descontos, ligue para o nosso Polo Caratinga: (33) 9807-2110."
        );
        return;
    }

    // --- RESPOSTA VIA IA (GEMINI) ---
    
    try {
        console.log(`DEBUG: Enviando para Gemini: "${userMessage}"`);
        const response = await chatSession.sendMessage({ message: userMessage });
        
        // 4. Responde no WhatsApp
        client.sendMessage(chatId, response.text);
        
    } catch (error) {
        console.error('ERRO ao processar mensagem com Gemini:', error);
        // Fallback de erro da IA
        client.sendMessage(chatId, '🚨 ERRO DE IA 🚨 Desculpe, houve um erro ao processar sua solicitação no sistema de IA. Tente refazer sua pergunta, ou digite MENU.');
    }
});

// Inicializa o cliente WhatsApp
client.initialize();

// Configuração básica do servidor web (necessário para manter o processo ativo em hospedagem)
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor web rodando. O bot está ativo se o QR Code foi escaneado.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor web rodando na porta ${PORT}`);
});const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Caminhos dos arquivos de persistência
const HISTORY_FILE = 'chatHistory.json';
const ERROR_LOG_FILE = 'error_log.txt';

// Lista de Stop Words comuns em português (MANTIDA)
const stopWords = [
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 
    'e', 'ou', 'nem', 'mas', 'porém', 'contudo', 'todavia', 
    'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 
    'em', 'para', 'com', 'por', 'sobre', 'sob', 'entre', 'aquelas',
    'que', 'qual', 'quais', 'quem', 'meu', 'minha', 'meus', 'minhas',
    'seu', 'sua', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas',
    'isto', 'isso', 'aquilo', 'este', 'esta', 'estes', 'estas',
    'aquele', 'aquela', 'aqueles', 'dele', 'dela', 'deles', 'delas',
    'nele', 'nela', 'neles', 'nelas', 'tem', 'ter', 'estar', 'ser', 
    'pode', 'posso', 'fazer', 'ir', 'gostaria', 'quero', 'eu', 'voce',
    'você', 'como', 'onde', 'quando', 'porque', 'pra', 'pro', 'pra',
    'pode', 'me', 'mim', 'meu', 'minha', 'te', 'ti', 'seu', 'sua',
    'se', 'nos', 'nossa', 'nosso', 'nossas', 'nossos', 'também', 'ainda',
    'muito', 'muita', 'mais', 'menos', 'algum', 'alguma', 'alguns', 'algumas',
    'nenhum', 'nenhuma', 'quase', 'vez', 'sem', 'até', 'cujo', 'cuja', 
    'cujos', 'cujas', 'qualquer', 'alguns', 'algumas', 'o que', 'um',
    'quero', 'qual', 'quais', 'gostaria', 'existe', 'tem', 'faço', 'faculdade',
    'duvidas', 'dúvidas', 'problema', 'preciso de ajuda', 'ajuda', 'queria', 'ver' 
];

// --- LISTA DE REFERÊNCIA DE CURSOS (V6.34 - Nova Estrutura) ---
const courseList = [
    // Seus exemplos e nomes de curso comuns (Graduação)
    'administracao', 'arquitetura', 'artes visuais', 'biomedicina', 'ciencias contabeis',
    'ciencias economicas', 'ciencias sociais', 'ciencias politicas', 'direito', 'educacao fisica',
    'enfermagem', 'engenharia agronomica', 'engenharia ambiental', 'engenharia biomedica', 
    'engenharia civil', 'engenharia de computacao', 'engenharia de producao', 'engenharia eletrica', 
    'engenharia mecanica', 'farmacia', 'fisioterapia', 'fonoaudiologia', 'geografia', 'historia',
    'jornalismo', 'letras', 'matematica', 'medicina veterinaria', 'nutricao', 'psicopedagogia', 
    'quimica', 'relacoes internacionais', 'servico social', 'sociologia', 'teologia',
    
    // Tecnólogos (Nomes Curto/Compostos)
    'analise e desenvolvimento de sistemas', 'administracao rural', 'banco de dados', 'ciencia de dados', 
    'comercio exterior', 'criminologia', 'design de animacao', 'design de interiores', 
    'design de moda', 'design de produto', 'design grafico', 'estetica e cosmetica', 'gastronomia',
    'gestao comercial', 'gestao de cooperativas', 'gestao de midias sociais', 'gestao de turismo',
    'gestao da producao industrial', 'gestao da tecnologia da informacao', 'gestao de recursos humanos',
    'gestao de servicos juridicos', 'gestao de servicos penais', 'gestao do transito', 
    'gestao financeira', 'gestao hospitalar', 'logistica', 'marketing', 'marketing digital',
    'negocios imobiliarios', 'pericia judicial', 'processos gerenciais', 'seguranca publica',
    
    // Pós-Graduação (Exemplos Comuns)
    'alfabetizacao', 'ciencias de dados', 'educacao especial', 'psicopedagogia clinica', 'mba',
    'engenharia de software', 'psicologia', 'filosofia', 'seguranca', 'contabilidade',
    
    // Variações e palavras-chave de apoio
    'veterinaria', 'biomedicina', 'jornalismo', 'publicidade', 'propaganda', 'comunicacao', 'ciencias biologicas',
    'quimica', 'fisica', 'tecnologia', 'ead', 'presencial', 'semipresencial', 'direito', 'educacao', 'ti'
];


// --- VARIÁVEIS GLOBAIS DE CONTROLE (V6.34) ---
let chatHistory = {}; 
const GREETING_COOLDOWN = 24 * 60 * 60 * 1000; 
const FALLBACK_LIMIT = 3; 
const simpleGreetings = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'eae', 'olá', 'alô', 'alo', 'olá duda', 'ola duda'];

// --- BASE DE CONHECIMENTO V6.34 ---
const knowledgeBase = {
    'todos os cursos': {
        response: 
            `📚 *CATÁLOGO COMPLETO UNINTER* 📚\n\n` +
            `A Uninter oferece mais de 600 opções de cursos. Para encontrar o ideal, escolha a modalidade que você procura:\n\n` +
            `*1. Graduação (EAD, Semipresencial, Presencial):* Veja todos os cursos por área de conhecimento, como Engenharia, Saúde, Gestão e Humanas.\n` +
            `*Link:* https://www.uninter.com/graduacao/areas-do-conhecimento\n\n` +
            `*2. Pós-Graduação (EAD):* Mais de 400 opções de especialização em diversas áreas.\n` +
            `*Link:* https://www.uninter.com/pos-graduacao/\n\n` +
            `*3. Cursos Técnicos e Profissionalizantes:* Formação rápida para o mercado de trabalho.\n` +
            `*Link:* https://www.uninter.com/cursos-tecnicos-e-profissionalizantes/`,
        link: null
    },
    'pos graduação': {
        response: 
            `✨ *FAQ Pós-Graduação UNINTER* ✨\n\n` +
            `Nossa Pós-Graduação (EAD) oferece mais de 400 opções de especialização.\n\n` +
            `*Dúvidas Comuns:*\n` +
            `1. **Duração:** A maioria dos cursos tem duração de 6, 9 ou 12 meses.\n` +
            `2. **Certificação:** O certificado de conclusão de Pós-Graduação é emitido pela Uninter e é reconhecido pelo MEC.\n` +
            `3. **Inscrição:** Você pode se inscrever a qualquer momento. Basta ter o diploma de graduação.\n\n` +
            `*Acesse o catálogo completo:*`,
        link: 'https://www.uninter.com/pos-graduacao/'
    },
    'certificação pos': {
        response: 'O certificado de conclusão de Pós-Graduação é emitido pela Uninter e é reconhecido pelo MEC. Você pode solicitá-lo após a conclusão de todas as disciplinas e do TCC (se houver) através do módulo Serviços no AVA.',
        link: null
    },
    // FINANCEIRO (V6.34)
    'boleto': {
        response: 'Para acessar seu boleto, 2ª via ou consultar a mensalidade, você deve entrar no **Ambiente Virtual Único (AVA)**. No menu lateral, procure por **"Financeiro"** ou **"Extrato de Cobrança"**.',
        link: 'https://univirtus.uninter.com/ava/web/'
    },
    'correção de boletos': {
        response: 'Para **correção de boletos**, envie um e-mail para: **financeiro@uninter.com**.',
        link: null
    },
    'negociação de dívidas': {
        response: 'Para assuntos relacionados a inadimplência ou negociação de dívidas, entre em contato via e-mail: **cobranca@uninter.com** ou WhatsApp: **(41) 2104-2700** (seg. a sex., das 8h às 20h48).',
        link: null
    },
    'fies': {
        response: 'Você pode utilizar o **FIES** (Fundo de Financiamento Estudantil) para estudar agora e ter muito mais tempo para pagar. Saiba como se inscrever e as condições:',
        link: 'https://www.uninter.com/fies'
    },
    // ACADÊMICO (V6.34)
    'cma': {
        response: 'Para ajuda sobre procedimentos acadêmicos (postagens, notas, dispensa de disciplina, provas), acesse a **Central de Mediação Acadêmica (CMA)** no AVA Univirtus ou ligue para 0800-702-0500 (Opção 2 - Sou Aluno).',
        link: 'https://univirtus.uninter.com/ava/web/' 
    },
    'tutoria': {
        response: 'Para dúvidas de conteúdo de aula, exercícios e avaliações, entre em contato diretamente com o seu Tutor. Acesse o ícone **Tutoria** dentro da sua disciplina no AVA Univirtus.',
        link: 'https://univirtus.uninter.com/ava/web/' 
    },
    'diploma': {
        response: 'A emissão e registro do diploma são feitos pela própria Uninter. Para solicitar ou acompanhar o status, utilize o **módulo Serviços** no AVA Univirtus.',
        link: 'https://univirtus.uninter.com/ava/web/' 
    },
    'trancamento': {
        response: 'Para solicitar **trancamento ou cancelamento da matrícula**, você deve usar os canais de atendimento do FICA, EXCLUSIVAMENTE via telefone: **0800 727 0530**. Atendimento de seg. a sex., das 09h às 20h.',
        link: null
    },
    // INSCRIÇÃO (V6.34)
    'matricula': {
        response: 'O processo de matrícula na Uninter pode ser feito por Vestibular Online, pela nota do ENEM, ou como portador de diploma. Você pode se inscrever no site, por teleatendimento (0800 702 0500) ou no Polo. Acesse o site para iniciar sua inscrição:',
        link: 'https://www.uninter.com/graduacao/inscricao/'
    },
    'enem': {
        response: 'Você pode usar sua nota do ENEM para: 1) Concorrer a descontos (Bolsa ENEM); ou 2) Participar do processo seletivo (sem fazer vestibular).',
        link: 'https://www.uninter.com/bolsa-enem'
    },
    // ACESSO E CONTATOS (V6.34)
    'univirtus': { 
        response: 'O acesso ao Ambiente Virtual de Aprendizagem (AVA Univirtus) pode ser feito de duas formas: Pelo navegador ou por smartphone/tablet, baixando o aplicativo na loja oficial (no momento, somente para aparelhos Android).',
        link: 'https://univirtus.uninter.com/ava/web/'
    },
    'polo de atendimento': { 
        response: 
            `📍 *Polo UNINTER Caratinga*\n\n` +
            `**Endereço:** RUA JOÃO PINHEIRO, Nº 204, SALA 15, Caratinga - MG.\n` +
            `**Contato:** (33) 9807-2110 (Telefone/WhatsApp).\n\n` +
            `--- \n` +
            `*OBS:* Se você for de outra cidade, pode encontrar o polo mais próximo no link abaixo:`,
        link: 'https://www.uninter.com/graduacao/polos/' 
    },
    'falar com atendente': {
        response: 'Para falar com um atendente ou obter informações sobre cursos e matrículas, ligue para **0800 702 0500**.',
        link: null
    },
    'ouvidoria': {
        response: 'Se você precisa registrar uma reclamação ou sugestão, acesse o canal oficial da Ouvidoria da Uninter:',
        link: 'https://portal.uninter.com/ouvidoria/' 
    },
};


// --- FUNÇÕES DE PERSISTÊNCIA E LOGS (V6.34) ---
const loadHistory = () => {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(data);
            // ESTA É A LINHA QUE DEVE MUDAR NO LOG
            console.log(`[V6.34] Histórico carregado com sucesso. ${Object.keys(chatHistory).length} chats persistidos.`);
        } else {
            console.log('[V6.34] Arquivo de histórico não encontrado. Iniciando novo.');
        }
    } catch (error) {
        console.error('[V6.34] Erro ao carregar histórico:', error.message);
    }
};

const saveHistory = () => {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2), 'utf8');
    } catch (error) {
        console.error('[V6.34] Erro ao salvar histórico:', error.message);
    }
};

const logError = (type, chatId, message, details) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] Chat: ${chatId} | Mensagem: "${message}" | Detalhes: ${details}\n`;
    
    fs.appendFile(ERROR_LOG_FILE, logEntry, (err) => {
        if (err) console.error('[V6.34] Erro ao escrever no log de erro:', err.message);
    });
};


// --- FUNÇÕES DE LÓGICA GERAL (V6.34) ---

const processText = (input) => {
    // Remove pontuação e filtra stop words
    return input
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") 
        .split(/\s+/) 
        .filter(token => token.length > 0 && !stopWords.includes(token)); 
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return "Bom dia";
    } else if (hour >= 12 && hour < 18) {
        return "Boa tarde";
    } else {
        return "Boa noite";
    }
};

let indexedKnowledgeBase = [];
const indexKnowledgeBase = () => {
    const keys = Object.keys(knowledgeBase);
    const index = [];

    for (const keyword of keys) {
        const keywordTokens = processText(keyword);
        
        if (keywordTokens.length > 0) {
            index.push({
                originalKeyword: keyword,
                keywordTokens: keywordTokens,
                response: knowledgeBase[keyword].response,
                link: knowledgeBase[keyword].link,
            });
        }
    }
    indexedKnowledgeBase = index;
};

// FUNÇÃO DETECTCOURSEINTENT (V6.34)
const detectCourseIntent = (text) => {
    const courseKeywords = ['curso de', 'faculdade de', 'graduação de', 'pós de', 'quero fazer', 'vocês tem', 'procuro curso'];
    const listKeywords = ['todos os cursos', 'lista de cursos', 'quais cursos tem', 'ofertas de cursos', 'catálogo de cursos', 'cursos']; 
    const lowerText = text.toLowerCase();
    
    // 1. Verifica se a frase se encaixa em um comando de LISTA AMPLA
    for (const listPhrase of listKeywords) {
        if (lowerText.includes(listPhrase)) {
             const masterCourse = indexedKnowledgeBase.find(entry => entry.originalKeyword === 'todos os cursos');
             return masterCourse || null; 
        }
    }
    
    // 2. Verifica se a frase se encaixa em um padrão de CURSO INDIVIDUAL com prefixo
    for (const phrase of courseKeywords) {
        if (lowerText.includes(phrase)) {
            
            const courseNameAttempt = lowerText.substring(lowerText.indexOf(phrase) + phrase.length).trim();
            const potentialCourseTokens = processText(courseNameAttempt);
            
            if (potentialCourseTokens.length > 0) {
                return {
                    response: `Entendi que você está procurando pelo curso de *${potentialCourseTokens.join(' ')}*! A Uninter oferece uma vasta gama de opções.`,
                    link: 'https://www.uninter.com/graduacao/areas-do-conhecimento',
                    courseName: potentialCourseTokens.join(' ')
                };
            }
        }
    }
    
    return null;
};


// --- FUNÇÕES DE FLUXO E ESCALA (V6.34) ---
// ... (funções sendMenu, getMenuResponse, getContextRefinementResponse, isUserInFlow, handleDataCollection, escalateToHuman - V6.34)

const sendMenu = async (chatId, client) => {
    const menuText = 
        `*🤖 Menu Principal de Dúvidas 🤖*\n\n` +
        `Por favor, escolha uma categoria abaixo para refinar sua busca. Você também pode digitar sua dúvida a qualquer momento!\n\n` +
        `*1.* 💰 Financeiro (Boletos, FIES, Bolsas)\n` +
        `*2.* 🎓 Cursos e Inscrição (Graduação, Pós, ENEM)\n` +
        `*3.* 📚 Acadêmico e Secretaria (Provas, Notas, Tutoria, Documentos)\n` +
        `*4.* 📍 Acesso e Contatos (AVA/Univirtus, Polo, Falar com Atendente)\n\n` +
        `*Digite o número da opção (ex: 1) ou sua dúvida.*`;

    await client.sendMessage(chatId, menuText);
};

const getMenuResponse = (option) => {
    let response = '';
    let examples = '';
    
    switch (option) {
        case '1':
            response = '💰 *Opções Financeiras*\n\n';
            examples = 'Você pode me perguntar sobre: \n* boleto / 2ª via\n* negociação de dívidas\n* FIES / Fundacred\n* bolsas / descontos';
            break;
        case '2':
            response = '🎓 *Cursos e Ingresso*\n\n';
            examples = 'Você pode me perguntar sobre: \n* catálogo de cursos / graduação / pós\n* matrícula / inscrição\n* nota do ENEM / vestibular';
            break;
        case '3':
            response = '📚 *Acadêmico e Secretaria*\n\n';
            examples = 'Você pode me perguntar sobre: \n* provas / notas\n* tutoria / professores\n* documentos (atestado, diploma)\n* trancamento / transferência';
            break;
        case '4':
            response = '📍 *Acesso e Contatos*\n\n';
            examples = 'Você pode me perguntar sobre: \n* AVA / Univirtus / login\n* contato polo / endereço\n* ouvidoria\n* falar com atendente / 0800';
            break;
        default:
            return null;
    }

    return `${response}Certo! Por favor, digite sua dúvida específica usando as palavras-chave abaixo como exemplo.\n\n${examples}`;
};

const getContextRefinementResponse = (option) => {
    switch (option) {
        case '1':
            return getMenuResponse('1'); // Financeiro
        case '2':
            return getMenuResponse('3'); // Acadêmico (Opção 3 no menu principal)
        case '3':
            return getMenuResponse('2'); // Matrícula/Cursos (Opção 2 no menu principal)
        default:
            return null;
    }
};

const isUserInFlow = (chatId) => {
    return chatHistory[chatId] && chatHistory[chatId].currentStep;
};

const handleDataCollection = async (msg, client) => {
    const chatId = msg.from;
    const text = msg.body ? msg.body.trim() : '';
    const step = chatHistory[chatId].currentStep;
    
    if (text.toLowerCase() === 'não' || text.toLowerCase() === 'nao' || text.toLowerCase() === 'menu') {
        chatHistory[chatId].currentStep = null;
        await client.sendMessage(chatId, "Entendido! Sem problemas. Retornando ao menu principal.");
        await sendMenu(chatId, client);
        saveHistory(); 
        return true; 
    }

    switch (step) {
        case 'ask_name':
            chatHistory[chatId].name = text;
            chatHistory[chatId].currentStep = 'ask_registration';
            await client.sendMessage(chatId, `Obrigada, ${chatHistory[chatId].name}! Agora, por favor, me informe seu *número de Matrícula ou CPF* (somente números), para que eu possa verificar seu status.`);
            saveHistory(); 
            break;

        case 'ask_registration':
            const registration = text.replace(/\D/g, ''); 
            
            if (registration.length >= 9) { 
                chatHistory[chatId].registration = registration;
                chatHistory[chatId].currentStep = null; 
                
                await client.sendMessage(chatId, `Registro salvo! Agora que sei que você é o(a) *${chatHistory[chatId].name}* (Mat. ${registration}), posso começar a te ajudar.`);
                await sendMenu(chatId, client);
                saveHistory(); 
            } else {
                await client.sendMessage(chatId, "Ops! O número que você digitou parece incorreto. Por favor, digite apenas seu número de Matrícula ou CPF (somente números). Se não for aluno, digite 'não'.");
            }
            break;

        case 'ask_context':
            const refinementResponse = getContextRefinementResponse(text);
            
            if (refinementResponse) {
                chatHistory[chatId].currentStep = null;
                await client.sendMessage(chatId, refinementResponse);
                saveHistory();
            } else {
                await client.sendMessage(chatId, `Por favor, responda com o *número da opção* (1, 2 ou 3) ou digite 'menu' para voltar.`);
            }
            break;
        
        default:
            chatHistory[chatId].currentStep = null; 
            await sendMenu(chatId, client);
            saveHistory();
    }

    return true; 
};

const escalateToHuman = async (chatId, client, userMessage) => {
    const userData = chatHistory[chatId] || {};
    const userName = userData.name ? userData.name.split(' ')[0] : 'colega';
    const userRegistration = userData.registration ? `(Mat./CPF: ${userData.registration})` : '';

    logError('ESCALADA', chatId, userMessage, `Motivo: ${FALLBACK_LIMIT} falhas consecutivas. Dados do usuário: ${userName} ${userRegistration}`);

    userData.fallbackCount = 0;
    userData.currentStep = null; 
    saveHistory(); 

    let escalationMessage = 
        `🚨 *ATENÇÃO, ${userName.toUpperCase()}!* 🚨\n\n` +
        `Infelizmente, não consegui encontrar uma resposta exata para sua dúvida em minhas buscas automáticas. Sinto muito por isso! 😔\n\n` +
        `Para resolvermos seu problema, sugiro o contato com a central de atendimento especializada. Seu contexto foi registrado como: ${userRegistration}\n\n` +
        `*Opções de Contato Rápido:*\n` +
        `1. **Central Uninter (Geral/Matrícula):** 0800 702 0500\n` +
        `2. **Polo Caratinga (Local):** (33) 9807-2110 (Telefone/WhatsApp)\n` +
        `3. **Acadêmico (CMA - Sou Aluno):** 0800 702 0500 (Opção 2)\n\n` +
        `Você pode tentar refazer sua pergunta com outras palavras-chave, ou escolher uma opção no *MENU* principal.`;

    await client.sendMessage(chatId, escalationMessage);
};

// --------------------------------------------------------
// INICIALIZAÇÃO E CLIENTE (V6.34)
// --------------------------------------------------------

loadHistory(); 
indexKnowledgeBase();

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html',
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('--- NOVO QR CODE GERADO NO TERMINAL! ESCANEIE AGORA! ---');
});

client.on('ready', () => {
    console.log('✅ CLIENTE CONECTADO E PRONTO! Robô Duda Funcionando! (Lista de Cursos V6.34 Ativa)');
});

client.on('auth_failure', (msg) => {
    console.error('🚨 FALHA NA AUTENTICAÇÃO:', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ CLIENTE DESCONECTADO. Motivo:', reason);
});


// --------------------------------------------------------
// LÓGICA PRINCIPAL (V6.34)
// --------------------------------------------------------

const humanizedFooter = 
    `\n\nSe precisar de algo urgente ou se a dúvida persistir, ligue para a Central Uninter no **0800 702 0500** ou acesse o site oficial. Conte comigo!`;

const vagueTriggers = ['duvidas', 'dúvidas', 'problema', 'ajuda', 'ajuda', 'não entendi', 'o que fazer'];

client.on('message', async (msg) => {
    const text = msg.body ? msg.body.toLowerCase().trim() : '';
    const chatId = msg.from; 
    const currentTime = Date.now();
    
    if (!text || (msg.key && msg.key.fromMe)) return; 
    
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = { fallbackCount: 0 };
    }
    
    const userData = chatHistory[chatId] || {};
    const userName = userData.name ? userData.name.split(' ')[0] : 'colega'; 

    // 0. Verifica e trata o fluxo de Coleta de Dados ou Contexto (PRIORIDADE MÁXIMA)
    if (isUserInFlow(chatId)) {
        const flowHandled = await handleDataCollection(msg, client);
        if (flowHandled) return;
    }

    // 1. Lógica de Saudação/Menu (Alta Prioridade)
    if (simpleGreetings.includes(text)) {
        // ... (Lógica de Saudação/Menu)
        chatHistory[chatId].fallbackCount = 0; 
        const lastGreetingTime = chatHistory[chatId].lastGreetingTime;
        
        if (lastGreetingTime && (currentTime - lastGreetingTime) < GREETING_COOLDOWN) {
            await client.sendMessage(chatId, `👋 Olá novamente! ${getGreeting().split(' ')[1]}. Para te ajudar mais rápido, escolha uma opção no menu ou digite sua dúvida:`);
            await sendMenu(chatId, client);
        } else {
            const timeBasedGreeting = getGreeting();
            chatHistory[chatId].lastGreetingTime = currentTime; 
            chatHistory[chatId].currentStep = 'ask_name'; 
            
            await client.sendMessage(chatId, 
                `${timeBasedGreeting}! Sou a Duda, sua assistente virtual.\n\nPara que eu possa te dar respostas mais precisas e personalizadas, você me permite anotar seu *Nome* e *Matrícula/CPF*?\n\n*Por favor, me diga seu nome completo para começarmos (ou digite 'não').*`
            );
        }
        saveHistory(); 
        return;
    }
    
    const menuCommands = ['menu', 'opções', 'ajuda', 'ajuda rapida', 'start', '1', '2', '3', '4'];
    
    if (menuCommands.includes(text)) {
        chatHistory[chatId].fallbackCount = 0;
        
        if (['menu', 'opções', 'ajuda', 'ajuda rapida', 'start'].includes(text)) { 
            await sendMenu(chatId, client);
        }
        
        const menuResponse = getMenuResponse(text); 
        if (menuResponse) {
            await client.sendMessage(chatId, `${menuResponse}${humanizedFooter}`);
        }
        saveHistory(); 
        return;
    }


    // 2. LÓGICA DE RECONHECIMENTO DE CURSO POR LISTA (V6.34)
    // Checa se a mensagem tem 1 ou 2 palavras E se elas correspondem a um curso conhecido.
    const rawTextClean = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const rawTokens = rawTextClean.split(/\s+/).filter(token => token.length > 0); 
    const isMenuCommand = ['1', '2', '3', '4'].includes(text);
    
    if (rawTokens.length > 0 && rawTokens.length <= 3 && !isMenuCommand) {
        
        // 2.1. Normaliza a entrada do usuário para comparação (ex: 'medicina veterinaria')
        const courseNameAttempt = rawTokens.join(' ').toLowerCase();

        // 2.2. Verifica se a tentativa do usuário é um curso na nossa lista de referência
        const isKnownCourse = courseList.some(knownCourse => 
            knownCourse.includes(courseNameAttempt) || courseNameAttempt.includes(knownCourse)
        );

        if (isKnownCourse) {
            chatHistory[chatId].fallbackCount = 0; 

            const response = 
                `Ótima escolha! Você está perguntando sobre o curso de *${courseNameAttempt.toUpperCase()}*.\n\n` +
                `Como temos mais de 600 opções, para ter certeza do currículo e modalidade (EAD/Semipresencial), utilize o nosso buscador e matricule-se no Polo Caratinga!`;
            
            const searchLink = `https://www.uninter.com/graduacao/?search_cursos=${encodeURIComponent(courseNameAttempt)}`;

            await client.sendMessage(chatId, `${response}\n\n*Link direto para a busca:* ${searchLink}${humanizedFooter}`);
            saveHistory(); 
            return;
        }
        // Se não for um curso conhecido, o fluxo continua para as regras de frase (Item 3) e busca (Item 4).
    }


    // 3. LÓGICA DE RECONHECIMENTO DINÂMICO DE CURSOS POR FRASE (V6.34)
    const courseIntent = detectCourseIntent(text);
    if (courseIntent) {
        chatHistory[chatId].fallbackCount = 0; 
        
        let response = courseIntent.response;
        if (courseIntent.link) {
            response += `\n\n*Acesse o link para ver os detalhes:* ${courseIntent.link}`;
        }

        const finalResponse = `${response}${humanizedFooter}`;
        await client.sendMessage(chatId, finalResponse);
        saveHistory(); 
        return; 
    }


    // 4. Lógica de Busca de Palavras-Chave (V6.34)
    // ... (Lógica de Busca)
    let bestMatch = null;
    let bestKeywordLength = 0;
    const userTokens = processText(text); // Tokens sem stop words
    if (userTokens.length === 0) return;

    for (const entry of indexedKnowledgeBase) {
        const isMatch = entry.keywordTokens.every(token => userTokens.includes(token));

        if (isMatch) {
            if (entry.originalKeyword === 'polo de atendimento' && (text.includes('polo') || text.includes('unidade'))) {
                bestMatch = entry;
                bestKeywordLength = 999; 
                break;
            }
            
            if (entry.originalKeyword.length > bestKeywordLength) { 
                bestKeywordLength = entry.originalKeyword.length;
                bestMatch = entry;
            }
        }
    }

    // 5. Define a resposta e lógica de Fallback (V6.34)
    
    let responseText = '';
    let foundLink = '';

    if (bestMatch) {
        chatHistory[chatId].fallbackCount = 0; 
        
        responseText = bestMatch.response;
        foundLink = bestMatch.link;

        if (foundLink) {
            responseText += `\n\n*Aqui está o link direto que você precisa:* ${foundLink}`;
        }
        
        const finalResponse = `${responseText}${humanizedFooter}`;
        await client.sendMessage(chatId, finalResponse);
        saveHistory(); 
    } else {
        // Resposta de Fallback: incrementa o contador
        chatHistory[chatId].fallbackCount = (chatHistory[chatId].fallbackCount || 0) + 1;
        
        if (chatHistory[chatId].fallbackCount >= FALLBACK_LIMIT) {
            await escalateToHuman(chatId, client, text);
        } else if (chatHistory[chatId].fallbackCount === 1 || vagueTriggers.some(trigger => text.includes(trigger))) {
            // PRIMEIRO FALLBACK ou mensagem VAGA: Ativa a coleta proativa de contexto
            chatHistory[chatId].currentStep = 'ask_context';
            
            const refinementQuestion = 
                `Desculpe, ${userName}! Não entendi o que você procura. Sua dúvida principal é sobre:\n\n` +
                `*1.* 💰 **Financeiro** (Boletos, Dívidas, FIES)\n` +
                `*2.* 📚 **Acadêmico** (Provas, Notas, Tutoria)\n` +
                `*3.* 🎓 **Cursos/Matrícula** (Catálogo, Inscrição, ENEM)\n\n` +
                `*Por favor, responda com o número (1, 2 ou 3) para eu te direcionar!*`;

            await client.sendMessage(chatId, refinementQuestion);
            logError('FALLBACK/CONTEXTO', chatId, text, `Ativado fluxo de refinamento. Tentativa: ${chatHistory[chatId].fallbackCount}`);
            saveHistory(); 

        } else {
            // Segundo fallback: envia fallback padrão e LOGA
            responseText = `Desculpe, ${userName}! Não encontrei essa informação na minha base. Tente ser mais específico ou peça o *MENU* para refinar sua busca.`;
            const finalResponse = `${responseText}${humanizedFooter}`;
            await client.sendMessage(chatId, finalResponse);
            logError('FALLBACK', chatId, text, `Tentativa: ${chatHistory[chatId].fallbackCount} de ${FALLBACK_LIMIT}`);
            saveHistory(); 
        }
    }
});


client.initialize();
