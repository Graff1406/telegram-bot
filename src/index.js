const express = require("express");
const telegramBotMessage = require("./telegram/handleMessage");
const pingServer = require("./modules/pingServer");

const app = express();
const port = 3000;

app.use(express.json());

telegramBotMessage();

setInterval(pingServer, 840000); // 14 minutes

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);
});
