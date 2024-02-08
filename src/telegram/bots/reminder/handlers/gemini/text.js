const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const sendMessageToViber = require("../../../../../modules/sendMessageToViber");

const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const util = require("util");

module.exports = () => {
  let chatHistory = {};

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
      console.log("🚀 data:", data);

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
    //   text: "_Тип недвижимости:_ *Квартира*",
    //   media:
    //     "https://avatars.mds.yandex.net/get-kinopoisk-image/1704946/76e32e4c-996d-4647-9f75-7dfd4c41059c/1920x",
    // });
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
};
