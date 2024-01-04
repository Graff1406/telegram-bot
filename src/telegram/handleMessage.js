const bot = require("./botConfig");
const openaiService = require("../openai/openaiService");
const geminiService = require("../gemini/geminiService");

const isDev = process.env.NODE_ENV === "development";

module.exports = function () {
  const dialogContext = {};

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
        const mergeMessage = (message) => {
          if (!dialogContext[chatId]) {
            dialogContext[chatId] = { chat: [] };
          }
          dialogContext[chatId].chat.push(message);
        };

        mergeMessage(userMessage);

        const generatedAnswer = await geminiService.generateText(
          dialogContext[chatId].chat,
          userMessage
        );

        // const generatedAnswer = await openaiService.generateText(dialogContext);

        mergeMessage(generatedAnswer);

        handleSendMessage(generatedAnswer);
      } catch (e) {
        handleSendMessage("Я не смог для Вас сгенерировать ответ");
        console.error("Error generating sendMessage:", e);
      }
    }
  });
};
