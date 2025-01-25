const { Telegraf } = require('telegraf');
const questions = require('./questions');
const OllamaClient = require('./ollama');
const userManager = require('./userManager');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ollama = new OllamaClient(process.env.OLLAMA_HOST);

// Store user states
const userStates = new Map();

// Initialize user state
function initUserState(userId) {
    return {
        currentQuestion: 0,
        answers: {},
        awaitingResponse: false
    };
}

// Start command
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    userStates.set(userId, initUserState(userId));
    
    // Save user data
    const userData = {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        language_code: ctx.from.language_code,
        joined_at: new Date().toISOString()
    };
    userManager.saveUser(userData);
    
    ctx.reply('سلام! من میتونم بهت در انتخاب فیلم، سریال یا انیمه کمک کنم. بیا شروع کنیم!', {
        reply_markup: {
            keyboard: [['شروع']],
            resize_keyboard: true
        }
    });
});

// Add broadcast command for admin
bot.command('broadcast', async (ctx) => {
    // Check if user is admin (you should replace this with your admin user ID)
    const adminUserId = parseInt(process.env.ADMIN_USER_ID);
    
    if (ctx.from.id !== adminUserId) {
        return;
    }

    const message = ctx.message.text.split('/broadcast ')[1];
    if (!message) {
        ctx.reply('لطفا متن پیام را وارد کنید. مثال:\n/broadcast پیام شما');
        return;
    }

    const results = await userManager.broadcastMessage(bot, message);
    ctx.reply(`پیام با موفقیت ارسال شد!\nموفق: ${results.success}\nناموفق: ${results.failed}`);
});

// Handle "شروع" button
bot.hears('شروع', (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId) || initUserState(userId);
    state.currentQuestion = 0;
    state.answers = {};
    
    askQuestion(ctx, userId);
});

// Ask question function
function askQuestion(ctx, userId) {
    const state = userStates.get(userId);
    const question = questions[state.currentQuestion];
    
    if (!question) {
        getSuggestion(ctx, userId);
        return;
    }

    ctx.reply(question.text, {
        reply_markup: {
            keyboard: question.options.map(opt => [opt]),
            resize_keyboard: true
        }
    });
}

// Handle answers
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);
    
    if (!state || state.awaitingResponse) return;

    const currentQuestion = questions[state.currentQuestion];
    if (!currentQuestion) return;

    if (currentQuestion.options.includes(ctx.message.text)) {
        state.answers[currentQuestion.id] = ctx.message.text;
        state.currentQuestion++;
        
        if (state.currentQuestion >= questions.length) {
            await getSuggestion(ctx, userId);
        } else {
            askQuestion(ctx, userId);
        }
    }
});

// Get suggestion from Ollama
async function getSuggestion(ctx, userId) {
    const state = userStates.get(userId);
    state.awaitingResponse = true;

    ctx.reply('لطفا کمی صبر کنید، در حال پیدا کردن بهترین پیشنهاد برای شما هستم...');

    try {
        const suggestion = await ollama.getSuggestion(state.answers);
        
        // Save user answers
        userManager.saveUser({
            id: userId,
            answers: state.answers,
            last_suggestion: new Date().toISOString()
        });
        
        ctx.reply(suggestion, {
            reply_markup: {
                keyboard: [['شروع دوباره']],
                resize_keyboard: true
            }
        });
    } catch (error) {
        ctx.reply('متأسفانه در دریافت پیشنهاد مشکلی پیش آمد. لطفا دوباره تلاش کنید.');
    }

    state.awaitingResponse = false;
}

// Handle "شروع دوباره" button
bot.hears('شروع دوباره', (ctx) => {
    const userId = ctx.from.id;
    userStates.set(userId, initUserState(userId));
    askQuestion(ctx, userId);
});

// Add admin commands
bot.command('stats', async (ctx) => {
    const adminUserId = parseInt(process.env.ADMIN_USER_ID);
    
    if (ctx.from.id !== adminUserId) {
        return;
    }

    const stats = userManager.getStatistics();
    const answerStats = userManager.getUserAnswerStats();

    const message = `📊 آمار کاربران:

👥 تعداد کل کاربران: ${stats.totalUsers}
✅ کاربران فعال:
   • 24 ساعت گذشته: ${stats.activeLastDay}
   • هفته گذشته: ${stats.activeLastWeek}
   • ماه گذشته: ${stats.activeLastMonth}

🌍 توزیع زبان:
${Object.entries(stats.languageDistribution)
    .map(([lang, count]) => `   • ${lang}: ${count}`)
    .join('\n')}

📈 ثبت نام ماهانه:
${Object.entries(stats.usersByMonth)
    .sort()
    .map(([month, count]) => `   • ${month}: ${count}`)
    .join('\n')}

🎯 آمار پاسخ‌ها:
تعداد کل تعاملات: ${answerStats.totalInteractions}

ژانرهای محبوب:
${Object.entries(answerStats.genrePreferences)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => `   • ${genre}: ${count}`)
    .join('\n')}

ترجیح طول محتوا:
${Object.entries(answerStats.lengthPreferences)
    .sort((a, b) => b[1] - a[1])
    .map(([length, count]) => `   • ${length}: ${count}`)
    .join('\n')}

حال و هوای کاربران:
${Object.entries(answerStats.moodPreferences)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => `   • ${mood}: ${count}`)
    .join('\n')}`;

    ctx.reply(message);
});

// Update user activity on any interaction
bot.on('text', async (ctx, next) => {
    userManager.updateUserActivity(ctx.from.id);
    await next();
});

bot.launch().then(() => {
    console.log('Bot started successfully!');
}).catch((err) => {
    console.error('Error starting bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 