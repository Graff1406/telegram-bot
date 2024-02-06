const TelegramBot = require("node-telegram-bot-api");
const dotenv = require("dotenv");
dotenv.config();

const createBot = (token) => {
  if (!token) throw new Error("You just have not passed a token");

  const bot = new TelegramBot(token);
  return bot;
};

module.exports = createBot;
