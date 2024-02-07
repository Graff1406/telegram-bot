const createBot = require("../config");

const chat = createBot(process.env.TELEGRAM_REMINDER_BOT_TOKEN);

module.exports = chat;
