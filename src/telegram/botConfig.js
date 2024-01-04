const TelegramBot = require("node-telegram-bot-api");
const dotenv = require("dotenv");
dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

module.exports = bot;
