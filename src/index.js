const express = require("express");
const bodyParser = require("body-parser");
const bot = require("./telegram/botConfig");
const telegramBotMessage = require("./telegram/handleMessage");
const pingServer = require("./modules/pingServer");
const isDev = process.env.NODE_ENV === "development";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const webhookPath = "/webhook-path";
app.post(webhookPath, (req, res) => {
  const update = req.body;
  bot.processUpdate(update);
  res.sendStatus(200);
});

telegramBotMessage();

setInterval(pingServer, 840000); // 14 minutes

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);
});

const webhookUrl = isDev
  ? "https://a7ef-103-50-33-107.ngrok-free.app" + webhookPath
  : "https://telegram-bot-denona.onrender.com" + webhookPath;
bot.setWebHook(webhookUrl).catch((error) => {
  console.error(error);
});
