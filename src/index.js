const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");
const deepl = require("deepl-node");

const app = express();
const port = 3000;

const corsOptions = {
  origin: ["http://localhost:5173", "https://denona-4b33c.web.app"],
};

app.use(cors(corsOptions));
app.use(express.json());

dotenv.config();

app.get("/", (req, res) => {
  res.status(404).send("No page exist");
});

app.post("/openai-gpt", (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.status(200).send("Open ai");
});

app.post("/deepl-translate", async (req, res) => {
  console.log(req.body);
  const apiKey = process.env.DEEPL_API_KEY;
  const sourceLang = req.body.source_lang || "EN";
  const targetLang = req.body.target_lang || "FR";
  const textToTranslate = req.body.text || "Hello, world!";
  const translator = new deepl.Translator(apiKey);

  if (!apiKey) {
    return res.status(500).send("DeepL API key not found.");
  }

  try {
    const response = await translator.translateText(
      textToTranslate,
      sourceLang,
      targetLang
    );

    if (response.text) {
      res.status(200).send(response.text);
    } else {
      res.status(500).send("Translation error.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error when making a request to the DeepL API.");
  }
});

app.listen(port, () => {
  console.log(`The server is running on the port ${port}`);
});
