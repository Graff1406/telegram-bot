const express = require("express");
const cors = require("cors");
const axios = require("axios");
const telegramBotMessage = require("./telegram/handleMessage");

const app = express();
const port = 3000;

const corsOptions = {
  origin: ["http://localhost:5173", "https://denona-4b33c.web.app"],
};

app.use(cors(corsOptions));
app.use(express.json());

telegramBotMessage();

app.post("/openai-gpt", (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.status(200).send("Open ai");
});

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);
});
