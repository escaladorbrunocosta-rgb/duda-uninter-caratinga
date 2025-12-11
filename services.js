import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Você precisará de uma chave de API de um serviço de meteorologia, como o OpenWeatherMap.
// É uma boa prática armazená-la em variáveis de ambiente.
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'SUA_CHAVE_DE_API_AQUI';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Busca a previsão do tempo para uma cidade específica.
 * @param {string} city - O nome da cidade.
 * @returns {Promise<string>} Uma string formatada com a previsão do tempo.
 */
export async function getWeather(city) {
    if (!WEATHER_API_KEY || WEATHER_API_KEY === 'SUA_CHAVE_DE_API_AQUI') {
        return 'O serviço de meteorologia não está configurado. O administrador precisa definir a WEATHER_API_KEY.';
    }

    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`);
        const { weather, main } = response.data;
        return `Tempo em ${city}: ${weather[0].description}, com temperatura de ${main.temp}°C.`;
    } catch (error) {
        return `Não consegui encontrar a previsão do tempo para "${city}". Verifique o nome da cidade e tente novamente.`;
    }
}

/**
 * Envia uma pergunta para a API do Google Gemini e retorna a resposta.
 * @param {string} prompt - A pergunta para a IA.
 * @returns {Promise<string>} A resposta da IA.
 */
export async function getGeminiResponse(prompt) {
    if (!GEMINI_API_KEY) {
        return '🤖 O serviço de IA não está configurado. O administrador precisa definir a variável de ambiente `GEMINI_API_KEY`.';
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;
    } catch (error) {
        console.error("❌ Erro ao chamar a API do Gemini:", error);
        return "🤖 Desculpe, não consegui processar sua pergunta com a IA no momento. Tente novamente mais tarde.";
    }
}