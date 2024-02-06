const createBot = require("../config");

const chat = createBot(process.env.TELEGRAM_CRM_BOT_TOKEN);

module.exports = chat;
