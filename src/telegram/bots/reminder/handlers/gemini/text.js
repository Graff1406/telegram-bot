const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../../../../models/instructions");
// const sendMessageToViber = require("../../../../../modules/sendMessageToViber");
// const {
//   postToFacebookGroup,
// } = require("../../../../../helpers/postToFacebookGroup");

const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const util = require("util");
const pdf = require("pdf-parse");
const axios = require("axios");
const openaiInstance = require("../../../../../api/openai/config");

const speechFile = path.join(__dirname, "../../../../../../my-mind.mp3");

module.exports = () => {
  // let chatHistory = {};

  let settimeoutID;
  let lastMessage = "";
  let lastCallTime = 0;
  let langCode = "ru";
  let stopGeneration = false;
  let stopAudio = false;
  let stopText = false;

  const saveFile = util.promisify(gTTS.prototype.save);

  const createVoice = async (chatId, userMessage) => {
    if (stopAudio) return;

    try {
      const gtts = new gTTS(userMessage, langCode);

      const mp3FilePath = path.join(__dirname, "../../../../../../Voice.mp3");
      await saveFile.call(gtts, mp3FilePath);

      if (stopAudio || stopGeneration) return;

      await chat.sendAudio(chatId, mp3FilePath);

      console.log("Аудиофайл отправлен.");

      fs.unlinkSync(mp3FilePath);
      console.log("Аудиофайл удален.");
    } catch (error) {
      console.error("Ошибка при создании и отправке аудиофайла:", error);
    }
  };

  const keyboard = {
    reply_markup: JSON.stringify({
      keyboard: [["Stop/Start Audio", "Stop/Start Text", "Stop Generation"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    }),
  };

  const callAgain = async (chatId, userMessage) => {
    if (stopGeneration) return;

    const currentTime = Date.now();
    const timeDiff = currentTime - lastCallTime;

    if (timeDiff < 4000) {
      return;
    }

    lastMessage = userMessage;
    lastCallTime = currentTime;

    settimeoutID = setTimeout(() => {
      callAgain(chatId, lastMessage);
    }, 15000);

    const res = await geminiService.generateChatText({
      userMessage,
      instructions: instructions.coach,
    });

    clearTimeout(settimeoutID);

    const postMessage = async (id, message, options) => {
      if (!stopAudio) await createVoice(chatId, message);

      if (!stopText)
        await chat.sendMessage(
          id,
          !!options && options.parse_mode ? `*${message}*` : message,
          options
        );
    };

    try {
      const data = JSON.parse(res);

      if (data.message && !stopGeneration) {
        await postMessage(chatId, data.message.replace(/\*/g, ""), keyboard);
      }

      if (data.question && !stopGeneration) {
        await postMessage(chatId, data.question.replace(/\*/g, ""), {
          parse_mode: "MarkdownV2",
        });
      }

      if (data.question || data.message) {
        await callAgain(chatId, data.question || data.message);
      }

      if (!data & !stopGeneration) callAgain(chatId, lastMessage);
    } catch (err) {
      if (typeof res === "string" && !stopGeneration)
        callAgain(chatId, lastMessage);
    }
  };

  chat.on("text", async (msg) => {
    // sendMessageToViber({
    //   type: "picture",
    //   text: "Click [+380979061991](https://t.me/denona_ai) to view the picture. ",
    //   media:
    //     "https://avatars.mds.yandex.net/get-kinopoisk-image/1704946/76e32e4c-996d-4647-9f75-7dfd4c41059c/1920x",
    // });

    // postToFacebookGroup("testMessage");

    // return;

    const chatId = msg.chat.id;
    const userMessage = msg.text;

    langCode = msg.from.language_code;

    if (userMessage.toLocaleLowerCase() === "stop generation") {
      stopGeneration = true;
      clearTimeout(settimeoutID);
      return;
    } else if (userMessage.toLocaleLowerCase() === "stop/start audio") {
      stopAudio = !stopAudio;
      if (stopText) stopText = !stopText;
      return;
    } else if (userMessage.toLocaleLowerCase() === "stop/start text") {
      stopText = !stopText;
      if (stopAudio) stopAudio = !stopAudio;
      return;
    } else {
      stopGeneration = false;
    }

    callAgain(chatId, userMessage, langCode);
  });

  chat.on("document", async (msg) => {
    const chatId = msg.chat.id;
    const fileType = msg.document.mime_type;
    const fileId = msg.document.file_id;
    const fileUrl = await chat.getFileLink(fileId);
    const fileName = msg.document.file_name;

    const splitText = (text, maxLength) => {
      const parts = [];
      for (let i = 0; i < text.length; i += maxLength) {
        parts.push(text.substring(i, i + maxLength));
      }
      return parts;
    };

    const processText = async (openaiInstance, text) => {
      const maxLength = 4000;
      const textParts = splitText(text, maxLength);
      const audioParts = [];

      for (const part of textParts) {
        const mp3 = await openaiInstance.audio.speech.create({
          model: "tts-1",
          voice: "onyx",
          input: part,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioParts.push(buffer);
      }

      return Buffer.concat(audioParts);
    };

    if (fileType !== "application/pdf") {
      chat.sendMessage(chatId, "Тип файла не PDF");
      return;
    }

    try {
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      const { text } = await pdf(response.data);

      if (text) {
        // const gtts = new gTTS(text, "ru");

        // await saveFile.call(
        //   gtts,
        //   path.join(__dirname, "../../../../../../my-mind.mp3")
        // );

        // await chat.sendAudio(chatId, gtts);

        // fs.unlinkSync(mp3FilePath);
        const maxLength = 4000;
        const textParts = splitText(text, maxLength);
        const audioParts = [];

        for (const part of textParts) {
          const mp3 = await openaiInstance.audio.speech.create({
            model: "tts-1",
            voice: "onyx",
            input: part,
          });
          const buffer = Buffer.from(await mp3.arrayBuffer());
          audioParts.push(buffer);

          const audioBuffer = Buffer.concat(audioParts);
          await fs.promises.writeFile(speechFile, audioBuffer);

          await chat.sendAudio(chatId, buffer);
        }

        // fs.unlinkSync(speechFile);
        return;
      }

      chat.sendMessage(chatId, "Не передан текст");
    } catch (error) {
      console.error("Ошибка при загрузке файла:", error);
      chat.sendMessage(chatId, "Произошла ошибка при загрузке файла.");
    }
  });
};
