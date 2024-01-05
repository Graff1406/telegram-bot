const bot = require("./botConfig");
const openaiService = require("../openai/openaiService");
const geminiService = require("../gemini/geminiService");
const prompts = require("../models/prompts");
const isDev = process.env.NODE_ENV === "development";

module.exports = function () {
  const dialogContext = {};
  const userDefaultData = { chat: [], queries: [] };

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    const photo = msg.photo ? msg.photo[msg.photo.length - 1] : null;

    const handleSendMessage = (message, options) => {
      bot.sendMessage(chatId, `${isDev ? "DEV" : ""}\n${message}`, options);
    };

    async function sendResponseForImg(photo, service, aiName) {
      try {
        const pathInfo = await bot.getFileLink(photo.file_id);

        const data = await service.vision(pathInfo);

        if (data.is_counter) {
          handleSendMessage(`${aiName}
          №: ${data.number};
          Показатель: ${data.value};
          Тип: ${data.type}`);
        } else handleSendMessage(`${aiName} На фото не изабражен счетчик`);
      } catch (err) {
        handleSendMessage(`${aiName} не смог распознать данные на изображении`);
        console.error(`Error generating sendMessage for ${aiName}:`, err);
      }
    }

    if (photo) {
      handleSendMessage("Запущен процесс анализа изображения");

      Promise.all([
        sendResponseForImg(photo, openaiService, "ChatGPT"),
        sendResponseForImg(photo, geminiService, "Google Gemini"),
      ]).then(() =>
        handleSendMessage(
          "Если данные не соответствуют, тогда стоит сделать фото под другим ракурсом, чтобы провести более точный анализ"
        )
      );
    } else {
      try {
        const mergeMessage = (message, member) => {
          if (!dialogContext[chatId]) {
            dialogContext[chatId] = userDefaultData;
          }

          if (
            Array.isArray(dialogContext[chatId].chat) &&
            dialogContext[chatId].chat.length === 0
          ) {
            setTimeout(() => {
              dialogContext[chatId] = userDefaultData;
            }, 30 * 60 * 1000);
          }

          dialogContext[chatId].chat.push(`${member}: ${message}`);
        };

        function uniqueValuesFromString(inputString, existingArray) {
          const newValuesArray = inputString.split(";").map((value) =>
            value
              .replace(/[^\w\d\sа-яё]/gi, "")
              .trim()
              .toLowerCase()
          );

          let uniqueValuesSet = new Set([...existingArray, ...newValuesArray]);

          const uniqueValues = Array.from(new Set(uniqueValuesSet));

          return uniqueValues;
        }

        mergeMessage(userMessage, "client");

        const text = await geminiService.generateChatText({
          context: dialogContext[chatId].chat,
          prompt: userMessage,
          temperature: 0.6,
        });

        const query = await geminiService.generateChatText({
          context: dialogContext[chatId].chat,
          prompt: userMessage,
          history: prompts.modalGeorgiaApartmentQueries,
          temperature: 0.4,
        });

        dialogContext[chatId].queries = uniqueValuesFromString(
          query,
          dialogContext[chatId].queries
        );

        console.log("queries", dialogContext[chatId].queries);

        // const { text, queries } = await openaiService.generateText(
        //   dialogContext[chatId].chat
        // );

        mergeMessage(text, "model");

        // if (Array.isArray(queries) && queries.length > 0) {
        //   handleSendMessage(JSON.stringify(queries));
        // }

        handleSendMessage(text);
      } catch (e) {
        handleSendMessage("Я не смог для Вас сгенерировать ответ");
        console.error("Error generating sendMessage:", e);
      }
    }
  });
};
