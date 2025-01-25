const axios = require('axios');

class OllamaClient {
    constructor(host) {
        this.host = host;
    }

    async getSuggestion(userAnswers) {
        const prompt = `با توجه به پاسخ‌های کاربر، لطفا یک فیلم یا سریال یا انیمه پیشنهاد بده و دلیل پیشنهادت رو توضیح بده.
        پاسخ‌های کاربر:
        ${Object.entries(userAnswers).map(([key, value]) => `${key}: ${value}`).join('\n')}
        
        لطفا پاسخ رو به این صورت بده:
        عنوان:
        نوع: (فیلم/سریال/انیمه)
        سال ساخت:
        خلاصه:
        چرا این پیشنهاد:`;

        try {
            const response = await axios.post(`${this.host}/api/generate`, {
                model: 'llama2',
                prompt: prompt,
                stream: false
            });

            return response.data.response;
        } catch (error) {
            console.error('Error getting suggestion from Ollama:', error);
            throw error;
        }
    }
}

module.exports = OllamaClient; 