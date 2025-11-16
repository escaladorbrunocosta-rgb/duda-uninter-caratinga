const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('ERRO: A variável de ambiente GEMINI_API_KEY não foi definida.');
    console.error('Por favor, crie um arquivo .env na mesma pasta do index.js');
    console.error('e adicione a linha: GEMINI_API_KEY=SUA_CHAVE_AQUI');
    console.error('Substitua SUA_CHAVE_AQUI pela sua chave real da API do Gemini.');
    process.exit(1);
}

const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
const modelName = "gemini-1.5-flash";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const activeChats = new Map();

const systemInstructionText = `Você é Duda, o assistente virtual da UNINTER Caratinga. Sua principal missão é fornecer informações EXATAS, CONCISAS e ATUALIZADAS.

REGRAS DE RESPOSTA:
1. PRIORIDADE DA BASE: Use a Base de Conhecimento abaixo para responder às perguntas sobre FIES, Prouni, Vestibular e vida acadêmica, garantindo que as respostas sejam idênticas às fornecidas.
2. FALLBACK/CONTATO: Se a resposta não estiver na Base de Conhecimento e a informação não puder ser fornecida com precisão, responda de forma cortês e **sugira imediatamente** que o usuário entre em contato com o Polo para informações mais específicas, fornecendo o **Telefone Fixo: (33) 3322-4001** e o **Instagram: @unintercaratinga**.
3. Contatos Completos: Forneça o Endereço Físico e o Linktree SOMENTE quando explicitamente solicitados. NÃO APENDE estes contatos a toda resposta.

INFORMAÇÕES ESSENCIAIS DO POLO:
Endereço Físico: Rua Coronel Antônio Salim, 74, Bairro Dário Grossi, Caratinga - MG.
Telefone Fixo: (33) 3322-4001.
Instagram: @unintercaratinga.
Linktree (Todos os links): https://linktr.ee/Uninter_Caratinga.

BASE DE CONHECIMENTO (Use estas respostas como fonte primária):
Pergunta: Como acesso a UNIVIRTUS?
Resposta: Pelo navegador, acesse univirtus.uninter.com/ava/web/. Por smartphone ou tablet, baixe o aplicativo na loja oficial (no momento, somente para aparelhos Android).

Pergunta: Como funcionam os cursos semipresenciais?
Resposta: No formato semipresencial da Uninter, você acessa os conteúdos teóricos pela nossa plataforma digital e realiza atividades práticas presenciais conforme o planejamento do curso. Essas práticas ocorrem nos polos, em laboratórios especializados, em empresas parceiras e por meio de estágios supervisionados, sempre com o apoio de mediadores pedagógicos que acompanham e orientam o seu desenvolvimento. Assim, você alia flexibilidade a experiências reais que fortalecem sua formação para o mercado de trabalho.

Pergunta: O Fies financia todos os cursos?
Resposta: Dúvidas relacionadas ao FIES: www.mec.gov.br, ou pela central do atendimento 0800-726-0101. Das 9h às 18h, horário de Brasília. Dúvidas pelo e-mail: fies@uninter.com

Pergunta: Quando deverá ocorrer o início do pagamento do saldo devedor?
Resposta: A partir do primeiro mês após a conclusão do curso, desde que o usuário possua renda. Quando o contratante passar a auferir renda, a parcela devida será descontada na fonte, no limite dos percentuais previstos em portaria, calculados sobre o maior valor entre o pagamento mínimo e o resultante da aplicação do percentual mensal vinculado à renda ou aos proventos mensais brutos do estudante financiado.

Pergunta: O estudante deverá efetuar algum pagamento durante a realização do curso?
Resposta: Sim. O estudante deverá pagar mensalmente o valor referente ao encargo operacional fixado em contrato, de acordo com a Lei 10.260/01, diretamente à Instituição Financeira que ficar com a atribuição de Agente Operador. Além disso, o seguro de vida também deverá ser pago durante todo o financiamento ou a realização do curso diretamente à Instituição Financeira com a qual o estudante contratou o seguro.

Pergunta: Qual a taxa de juros do FIES?
Resposta: A taxa efetiva de juros da modalidade Fies é de juros zero.

Pergunta: O que é a Comissão Permanente de Supervisão e Acompanhamento (CPSA)?
Resposta: A CPSA é responsável pela validação das informações prestadas pelo candidato no ato da inscrição, bem como pela validação das informações prestadas pelos estudantes quando dos aditamentos dos contratos.

Pergunta: Como posso ganhar desconto nas mensalidades?
Resposta: Além dos descontos para empresas conveniadas, você pode participar do Bônus Amigo Uninter, nosso programa de indicação. Saiba como participar em www.uninter.com/addamigos/

Pergunta: Ainda não conclui minha graduação, posso me matricular?
Resposta: Não. É obrigatório apresentar o diploma no ato da inscrição.

Pergunta: Faço o curso a distância, posso trocar de Polo depois de me matricular?
Resposta: Sim. Você pode solicitar transferência de Polo quando quiser, desde que esteja regularmente matriculado. O atendimento ao protocolo vai depender da existência de vaga no Polo de destino e você só poderá iniciar as aulas no novo Polo após deferimento da solicitação. O prazo para atendimento da solicitação é de 10 dias úteis a partir do pagamento da taxa e o deferimento por parte do acadêmico e do financeiro. Atenção! Caso você seja beneficiário do Prouni, consulte previamente o setor para verificar a disponibilidade de transferência da bolsa. Solicite em: Único >> Taxas e Serviços >> Transferência de Polo

Pergunta: Posso mudar de curso depois de me matricular?
Resposta: Sim. A solicitação deve ser feita por meio do Único até a segunda semana de aula e estará sujeita à disponibilidade de vaga no curso pretendido. O prazo para atendimento é de 10 dias a partir da confirmação de pagamento da taxa. Solicite em: Único >> Taxas e Serviços >> Mudança de Curso de Ingresso. Não se esqueça de preencher o campo Observações com o curso destino pretendido.

Pergunta: Onde posso me inscrever para o processo seletivo?
Resposta: Cursos presenciais: Pelo site uninter.com, no teleatendimento (0800 702 0500) ou no Campus Garcez (R. Luiz Xavier, 103, Centro). Cursos semipresenciais: Pelo site uninter.com, no teleatendimento (0800 702 0500) ou no Campus Garcez (R. Luiz Xavier, 103, Centro). Cursos a distância: Pelo site uninter.com, no teleatendimento (0800 702 0500) ou no Polo de Apoio Presencial de sua escolha.

Pergunta: Os cursos ofertados são autorizados pelo MEC?
Resposta: Os centros universitários possuem autonomia para abrir novos cursos, dessa forma não há necessidade de autorização prévia do poder público para oferecer cursos superiores. Todos os cursos que a Uninter oferece são autorizados pelo MEC, por meio da sua autonomia como centro universitário.

Pergunta: Quem registra e emite os diplomas do Centro Universitário Internacional UNINTER?
Resposta: Com o credenciamento do Centro Universitário Uninter, os diplomas dos alunos são registrados e emitidos pela própria instituição. Os Centros Universitários atendem às disposições do Decreto nº 5.786, de 24 de maio de 2006, o qual determina que os centros universitários poderão registrar diplomas dos cursos por eles oferecidos. O registro de diploma de graduação é o ato formal que dá validade nacional ao documento expedido pelas IES.

Pergunta: Os cursos ofertados são reconhecidos pelo MEC?
Resposta: O reconhecimento do curso pelo MEC é solicitado pelo Centro Universitário após o início da primeira turma. A partir do momento em que é solicitada a visita de avaliação junto ao MEC, dá-se início ao processo de reconhecimento. Muitos deles já são reconhecidos. Verifique o andamento do processo de cada um dos cursos no site emec.mec.gov.br.

Pergunta: Qual a legalidade do Centro Universitário Internacional UNINTER?
Resposta: Conforme Portaria MEC nº 688, publicada no Diário Oficial da União (DOU) de 28 de maio de 2012, a Faculdade Internacional de Curitiba (Facinter) e a Faculdade de Tecnologia Internacional (Fatec Internacional), instituições que compunham o Grupo Educacional Uninter, passam a ser o Centro Universitário Internacional UNINTER. De acordo com a legislação, o Centro Universitário Uninter possui autonomia para criar cursos sem que a autorização precise passar pelo MEC. Além disso, poderá emitir e registrar diplomas dos formados, e desenvolver programas de iniciação científica.

Pergunta: O que é Credenciamento/Autorização/Reconhecimento?
Resposta: São modalidades de atos autorizativos: credenciamento e recredenciamento de instituições de educação superior e de autorização, reconhecimento e renovação de reconhecimento de cursos de graduação. Credenciamento e recredenciamento: Para iniciar suas atividades, as instituições de educação superior devem solicitar o credenciamento junto ao MEC. O primeiro credenciamento tem prazo máximo de três anos para faculdades e centros universitários, e de cinco anos para as universidades. Autorização: Para iniciar a oferta de um curso de graduação, a IES depende de autorização do MEC. A exceção são as universidades e centros universitários que, por terem autonomia, independem de autorização. Reconhecimento: O reconhecimento deve ser solicitado pela IES quando o curso de graduação tiver completado 50% de sua carga horária. É condição necessária para a validade nacional dos diplomas. (fonte: portal.mec.gov.br/)

Pergunta: O que é um Centro Universitário?
Resposta: De acordo com o Decreto 5.773/06 a denominação Centro Universitário é dada apenas para as Instituições de Ensino Superior pluricurriculares, que abrangem uma ou mais áreas do conhecimento, que se caracterizam pela excelência do ensino oferecido. Os centros universitários credenciados têm autonomia para criar, organizar e extinguir, em sua sede, cursos e programas de educação superior. Para mais informações acesse o site emec.mec.gov.br.

Pergunta: Quais são as fases do processo seletivo do Prouni?
Resposta: Inscrição (no site do Prouni); Pré-seleção (melhores notas do Enem); Confirmação de dados (comprovar dados na instituição); Concessão da bolsa (assinatura do Termo de Concessão). A perda do prazo ou a não comprovação das informações implica sua reprovação.

Pergunta: É possível escolher qualquer curso em qualquer instituição?
Resposta: Sim, desde que a instituição escolhida seja participante do Prouni. O candidato escolhe até duas opções de curso, turno e instituição. É necessária muita atenção ao efetuar as opções, pois a matrícula deverá ser efetuada única e exclusivamente no perfil aprovado.

Pergunta: Como comprovar quando não possui renda?
Resposta: Com cópia da carteira de trabalho das seguintes páginas: parte da foto, dados pessoais e o último registro, próxima página em branco e declaração reconhecida em cartório de não obtenção de renda com duas testemunhas.

Pergunta: O que é renda bruta?
Resposta: Total dos vencimentos ou proventos. Descontam-se somente as férias, o décimo terceiro salário e a participação nos lucros e nos resultados (se este for recebível anualmente; se for auferido mensalmente, também contará como renda).

Pergunta: Se não houver formação de turma para o curso em que fui pré-selecionado?
Resposta: A bolsa do Prouni só poderá ser concedida ao candidato caso haja formação de turma no período letivo inicial do curso. Candidatos reprovados por não formação de turma continuarão concorrendo nas chamadas seguintes e, em caso de não serem pré-selecionados, poderão manifestar interesse em participar da Lista de Espera do Prouni.

Pergunta: É preciso fazer vestibular para concorrer a uma bolsa do Prouni?
Resposta: Não. O candidato à bolsa do Prouni não precisa fazer vestibular nem estar matriculado na instituição. Entretanto, é facultado às instituições participantes submeterem os candidatos pré-selecionados a um processo seletivo específico e isento de cobrança de taxa.

Pergunta: Como comprovar pensão alimentícia?
Resposta: Com determinação judicial.

Pergunta: Em relação à moradia, se for cedida como devo proceder?
Resposta: Você deve apresentar declaração de casa cedida assinada pelo proprietário do imóvel, registrada em cartório e com duas testemunhas, acompanhada do carnê do IPTU em nome do proprietário.

Pergunta: Qual é a renda per capita máxima para concorrer à bolsa parcial e integral?
Resposta: Parcial: não ultrapassar três salários mínimos por pessoa. Integral: não ultrapassar um salário mínimo e meio por pessoa.

Pergunta: Devo apresentar Histórico Escolar?
Resposta: Sim, nos casos em que o estudante se enquadre na escolaridade: quando todos os períodos letivos do ensino médio tiverem sido concluídos ou em instituição pública, ou em instituição privada na condição de bolsista integral; ou quando concluídos parcialmente em escola da rede pública e parcialmente em instituição privada (bolsista parcial ou sem condição de bolsista).

Pergunta: Quem compõe o grupo familiar?
Resposta: Pai, mãe, irmão/a, enteado, avô, avó, madrasta e padrasto ou membro familiar que comprove que reside com o candidato.

Pergunta: Como são as provas do vestibular UNINTER?
Resposta: A prova terá tempo de duração total de 1h (uma hora) e será on-line. Ela é dividida em Língua Portuguesa e Conhecimentos Gerais (comuns a todos) e, para completar, questões de Matemática ou Específicas da Área (somente Jurídica). A nota mínima para aprovação é de 200 pontos.

Pergunta: Onde é aplicada a prova do vestibular?
Resposta: 100% on-line para todos os cursos (presenciais, semipresenciais e a distância).

Pergunta: Quais são as formas de ingressar nos cursos de graduação?
Resposta: Além do vestibular, os candidatos podem utilizar a nota do Enem ou pedir transferência de outras instituições.

Pergunta: Como utilizo minha nota do ENEM para participar do processo seletivo?
Resposta: No momento da inscrição, selecione a opção SOMENTE ENEM para concorrer com a nota do Exame Nacional do Ensino Médio, sem precisar participar do vestibular.

Pergunta: Posso mudar de curso depois do vestibular?
Resposta: Cursos presenciais e semipresenciais: Sim, desde que haja vagas. Solicite a alteração pelo e-mail vestibular@grupouninter.com.br e aguarde retorno (em até 2 dias úteis). Cursos a distância: Sim. Acesse uninter.com/graduacao-ead/vestibular >> comprovante de inscrição, informe seu CPF e clique em Atualizar Informações de Curso e Local.

Pergunta: Fui aprovado no vestibular, mas ainda não conclui o ensino médio. Posso me matricular?
Resposta: Não. De acordo com a Lei de Diretrizes e Bases da Educação, só podem se matricular no ensino superior alunos com ensino médio completo. Você pode participar do vestibular para treinar e se preparar.

Pergunta: A inscrição é valida apenas para um curso?
Resposta: Sim, os candidatos realizam o vestibular apenas para uma das opções de cursos disponíveis. Aqueles que desejam frequentar dois cursos devem enviar solicitação para o e-mail vestibular@uninter.com.

Pergunta: A inscrição é paga?
Resposta: Cursos presenciais e semipresenciais: Inscrição isenta (100% gratuita). Cursos a distância: Sim. Ao final da inscrição, é gerado um boleto que pode ser pago diretamente no Polo de Apoio selecionado ou na rede bancária credenciada.`;

const generativeModel = ai.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstructionText,
});


// Configuração de cliente
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-uninter-caratinga" }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security'
        ],
        // Configurações para rodar headless (sem interface gráfica) na Render
        headless: true, // Garante que o navegador não tente abrir uma janela
    },
});

let currentQrCode = null; // Variável para armazenar o QR Code atual

// Inicialização e QR Code
client.on('qr', (qr) => {
    // qrcode.generate(qr, { small: true }); // Comentado para não gerar no log
    currentQrCode = qr; // Armazena o QR Code na variável
    console.log('----------------------------------------------------');
    console.log('🚨 NOVO QR CODE GERADO! Acesse a URL do seu serviço Render para escanear:');
    console.log('   (Ex: https://01-robo-duda.onrender.com/qr)');
    console.log('   Este QR Code expira em alguns segundos. Seja rápido!');
    console.log('----------------------------------------------------');
});

// Confirmação de que o cliente está pronto
client.on('ready', () => {
    console.log('Client is ready! Bot Uninter Caratinga está ONLINE, com MEMÓRIA e comandos.');
    currentQrCode = null; // Limpa o QR Code assim que o bot conecta
});

// Evento de desconexão (útil para saber se a sessão expirou)
client.on('disconnected', (reason) => {
    console.log('Client foi desconectado:', reason);
    // Tenta inicializar novamente para gerar um novo QR Code
    client.initialize();
});

client.initialize();

/**
 * Função para chamar a API do Gemini com lógica de repetição (retry) para erros 503/400.
 * @param {object} chatInstance - A instância do chat (com memória).
 * @param {string} prompt - A mensagem de entrada.
 * @param {number} retryCount - Contador de tentativas (interno).
 * @returns {Promise<string>} A resposta do Gemini.
 */
async function getGeminiResponseWithRetry(chatInstance, prompt, retryCount = 0) {
    const standardizedErrorMessage = "Desculpe, a inteligência artificial está sobrecarregada no momento. Por favor, entre em contato diretamente com a Central UNINTER: *Telefone Geral: 0800 702 0500* ou acesse *www.uninter.com*.";

    if (retryCount >= MAX_RETRIES) {
        console.error(`Falha após ${MAX_RETRIES} tentativas. O modelo Gemini continua indisponível.`);
        return standardizedErrorMessage;
    }

    try {
        const result = await chatInstance.sendMessage(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        const status = error.status || (error.message.includes('400') || error.message.includes('503') ? 400 : 0);

        if (status === 503 || status === 400) {
            console.warn(`[GEMINI - Tentativa ${retryCount + 1}] Erro ${status}. Tentando novamente em ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return getGeminiResponseWithRetry(chatInstance, prompt, retryCount + 1);
        } else {
            console.error('Erro não tratado na API do Gemini:', error);
            return standardizedErrorMessage;
        }
    }
}


client.on('message', async (msg) => {
    if (msg.fromMe || msg.isGroup) {
        return;
    }

    if (msg.type !== 'chat') {
        await msg.reply("Desculpe, Duda só consegue processar mensagens de texto por enquanto. Por favor, digite sua pergunta.");
        return;
    }

    const userId = msg.from;
    const chat = await msg.getChat();

    if (msg.body.toLowerCase().startsWith('/')) {
        const command = msg.body.toLowerCase().trim();

        if (command === '/limpar') {
            if (activeChats.has(userId)) {
                activeChats.delete(userId);
                await msg.reply("✅ Memória de conversa limpa! Podemos começar um novo assunto.");
                console.log(`[COMANDO] Sessão de chat do usuário ${userId} limpa.`);
            } else {
                await msg.reply("A memória já está limpa! Podemos começar um novo assunto.");
            }
            return;
        }

        await msg.reply("Desculpe, esse comando não é reconhecido. Tente `/limpar` para resetar a conversa.");
        return;
    }

    chat.sendStateTyping();

    let chatInstance = activeChats.get(userId);

    if (!chatInstance) {
        console.log(`Iniciando nova sessão de chat para o usuário: ${userId}`);
        chatInstance = generativeModel.startChat({});
        activeChats.set(userId, chatInstance);
    }

    const geminiText = await getGeminiResponseWithRetry(chatInstance, msg.body);
    await msg.reply(geminiText);
    chat.clearState();
});


// =======================================================
// === BLOCO KEEP-ALIVE HTTP SERVER PARA RENDER ====
// =======================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint de saúde para Keep-Alive
app.get('/', (req, res) => {
    res.status(200).send('Duda Bot is Running and Awake!');
});

// NOVO: Endpoint para exibir o QR Code como imagem
app.get('/qr', async (req, res) => {
    if (currentQrCode) {
        // Se houver um QR Code, gera uma imagem SVG (melhor qualidade) e envia
        const qrcodeSVG = require('qrcode'); // Precisamos instalar 'qrcode'
        try {
            const svg = await qrcodeSVG.toString(currentQrCode, { type: 'svg' });
            res.type('image/svg+xml');
            res.send(svg);
        } catch (err) {
            console.error('Erro ao gerar SVG do QR Code:', err);
            res.status(500).send('Erro ao gerar QR Code.');
        }
    } else {
        // Se não houver QR Code (bot já conectado ou não gerado ainda)
        res.status(200).send('QR Code não disponível ou bot já conectado. Verifique os logs da Render.');
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Server running for Keep-Alive on port ${PORT}`);
});
