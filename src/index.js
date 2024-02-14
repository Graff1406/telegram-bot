const express = require("express");
const bodyParser = require("body-parser");
// const bot = require("./telegram/botConfig");
const telegramCRMBot = require("./telegram/bots/crm/chat");
const telegramSearchBot = require("./telegram/bots/search/chat");
const telegramReminderBot = require("./telegram/bots/reminder/chat");
const setViberWebhook = require("./modules/setViberWebhook");

// Bots

const {
  watchingTelegramCRMBot,
  watchingTelegramReminderBot,
} = require("./telegram/bots/exports");

// const telegramBotMessage = require("./telegram/handleMessage");

// Modules
const pingServer = require("./modules/pingServer");

const isDev = process.env.NODE_ENV === "development";

const telegramCRMBotDir = "/telegram-crm-bot";
const telegramSearchBotDir = "/telegram-search-bot";
const telegramReminderBotDir = "/telegram-reminder-bot";
const viberChannel = "/viber-channel";
const facebookDenonaPage = "/facebook-denona-page";

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

app.post(telegramReminderBotDir, (req, res) => {
  const update = req.body;
  // bot.processUpdate(update);
  telegramReminderBot.processUpdate(update);
  res.sendStatus(200);
});

app.post(viberChannel, (req, res) => {
  const update = req.body;
  // console.log("🚀 ~ app.post ~ update:", update);
  res.sendStatus(200);
});

app.get(facebookDenonaPage, (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode && token) {
    if (mode === "subscribe" && token === "facebookDenonaPage") {
      console.log("Webhook подтвержден");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

watchingTelegramCRMBot();

watchingTelegramReminderBot();

// telegramBotMessage();

setInterval(pingServer, 270000); // 4,5 minutes

const ngrok = "https://ae58-103-50-33-200.ngrok-free.app";
const prod = "https://telegram-bot-denona.onrender.com";

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);

  setViberWebhook(ngrok + viberChannel);
});

const telegramCRMBotUrl = isDev
  ? ngrok + telegramCRMBotDir
  : prod + telegramCRMBotDir;

const telegramSearchBotUrl = isDev
  ? ngrok + telegramSearchBotDir
  : prod + telegramSearchBotDir;

const telegramReminderBotUrl = isDev
  ? ngrok + telegramReminderBotDir
  : prod + telegramReminderBotDir;

telegramCRMBot.setWebHook(telegramCRMBotUrl).catch((error) => {
  console.error(error);
});

telegramSearchBot.setWebHook(telegramSearchBotUrl).catch((error) => {
  console.error(error);
});

telegramReminderBot.setWebHook(telegramReminderBotUrl).catch((error) => {
  console.error(error);
});
