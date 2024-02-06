const express = require("express");
const bodyParser = require("body-parser");
const bot = require("./telegram/botConfig");
const telegramCRMBot = require("./telegram/bots/crm/chat");
const telegramSearchBot = require("./telegram/bots/search/chat");

// Bots

const { watchingTelegramCRMBot } = require("./telegram/bots/exports");

const telegramBotMessage = require("./telegram/handleMessage");

// Modules
const pingServer = require("./modules/pingServer");

const isDev = process.env.NODE_ENV === "development";

const telegramCRMBotDir = "/telegram-crm-bot";
const telegramSearchBotDir = "/telegram-search-bot";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post(telegramCRMBotDir, (req, res) => {
  const update = req.body;
  // bot.processUpdate(update);
  telegramCRMBot.processUpdate(update);
  res.sendStatus(200);
});

app.post(telegramSearchBotDir, (req, res) => {
  const update = req.body;
  // bot.processUpdate(update);
  telegramSearchBot.processUpdate(update);
  res.sendStatus(200);
});

watchingTelegramCRMBot();

// telegramBotMessage();

setInterval(pingServer, 270000); // 4,5 minutes

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);
});

const ngrok = "https://4a3c-185-6-123-219.ngrok-free.app";
const prod = "https://telegram-bot-denona.onrender.com";

const telegramCRMBotUrl = isDev
  ? ngrok + telegramCRMBotDir
  : prod + telegramCRMBotDir;

const telegramSearchBotUrl = isDev
  ? ngrok + telegramSearchBotDir
  : prod + telegramSearchBotDir;

telegramCRMBot.setWebHook(telegramCRMBotUrl).catch((error) => {
  console.error(error);
});

telegramSearchBot.setWebHook(telegramSearchBotUrl).catch((error) => {
  console.error(error);
});
