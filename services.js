import axios from 'axios';

// Você precisará de uma chave de API de um serviço de meteorologia, como o OpenWeatherMap.
// É uma boa prática armazená-la em variáveis de ambiente.
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'SUA_CHAVE_DE_API_AQUI';

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