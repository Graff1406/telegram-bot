const express = require("express");
const bodyParser = require("body-parser");
// const bot = require("./telegram/botConfig");
const telegramCRMBot = require("./telegram/bots/crm/chat");
const telegramSearchBot = require("./telegram/bots/search/chat");
const telegramReminderBot = require("./telegram/bots/reminder/chat");
const telegram365proBot = require("./telegram/bots/365pro/chat");

const setViberWebhook = require("./modules/setViberWebhook");
// const {
//   autoRefreshAccessTokenFacebook,
// } = require("./helpers/postToFacebookGroup");

// Bots

const {
  watchingTelegramCRMBot,
  watchingTelegramReminderBot,
} = require("./telegram/bots/exports");

// Modules

const pingServer = require("./modules/pingServer");

// API

// const {
//   createReadStreamFilesForOpenAIAssistant,
// } = require("./api/openai/openaiService");

const isDev = process.env.NODE_ENV === "development";

const telegramCRMBotDir = "/telegram-crm-bot";
const telegramSearchBotDir = "/telegram-search-bot";
const telegramReminderBotDir = "/telegram-reminder-bot";
const telegram365proBotDir = "/telegram-365pro-bot";
const viberChannelTbilisi = "/viber-channel-tbilisi";
const viberChannelBatumi = "/viber-channel-batumi";
const facebookDenonaPage = "/facebook-denona-page";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendStatus(200);
});

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

app.post(telegram365proBotDir, (req, res) => {
  const update = req.body;
  // console.log("🚀 ~ app.post ~ update:", update);

  telegram365proBot.processUpdate(update);
  res.sendStatus(200);
});

app.post(viberChannelTbilisi, (req, res) => {
  res.sendStatus(200);
});

app.post(viberChannelBatumi, (req, res) => {
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

const ngrok = "https://96aa-185-6-123-144.ngrok-free.app";
const prod = "https://telegram-bot-denona.onrender.com";

pingServer(isDev ? ngrok : prod);

// telegramBotMessage();

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);

  setViberWebhook(
    ngrok + viberChannelTbilisi,
    process.env.VIBER_CHANNEL_TBILISI_REAL_ESTATE
  );
  setViberWebhook(
    ngrok + viberChannelBatumi,
    process.env.VIBER_CHANNEL_BATUMI_REAL_ESTATE
  );
  // autoRefreshAccessTokenFacebook();
  // createReadStreamFilesForOpenAIAssistant();
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

const telegram365proBotUrl = isDev
  ? ngrok + telegram365proBotDir
  : prod + telegram365proBotDir;

telegramCRMBot.setWebHook(telegramCRMBotUrl).catch((error) => {
  console.error(error);
});

telegramSearchBot.setWebHook(telegramSearchBotUrl).catch((error) => {
  console.error(error);
});

telegramReminderBot.setWebHook(telegramReminderBotUrl).catch((error) => {
  console.error(error);
});

telegram365proBot.setWebHook(telegram365proBotUrl).catch((error) => {
  console.error(error);
});

watchingTelegramCRMBot();

watchingTelegramReminderBot();
