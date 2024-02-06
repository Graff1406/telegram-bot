const createBot = require("../config");

const chat = createBot(process.env.TELEGRAM_SEARCH_BOT_TOKEN);

module.exports = chat;
