const bot = require("./botConfig");
const openaiService = require("../openai/openaiService");
const geminiService = require("../gemini/geminiService");

module.exports = function () {
  // bot.onText(/\/echo (.+)/, (msg, match) => {
  //   const chatId = msg.chat.id;
  //   const resp = match[1];

  //   bot.sendMessage(chatId, resp);
  // });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    const photo = msg.photo ? msg.photo[msg.photo.length - 1] : null;

    async function sendResponseForImg(photo, service, aiName) {
      try {
        const pathInfo = await bot.getFileLink(photo.file_id);

        const data = await service.vision(pathInfo);

        if (data.is_counter)
          bot.sendMessage(
            chatId,
            `${aiName}
          №: ${data.number};
          Показатель: ${data.value};
          Тип: ${data.type}`
          );
        else
          bot.sendMessage(
            chatId,
            `${aiName}
             На фото не изабражен счетчик
          `
          );
      } catch (err) {
        bot.sendMessage(
          chatId,
          ` "${aiName} не смог распознать данные на изображении"`
        );
        console.error(`Error generating sendMessage for ${aiName}:`, err);
        throw new Error("Failed to generate Google Gemini response");
      }
    }

    if (photo) {
      bot.sendMessage(chatId, "Запуще процесс анализа изображения");

      Promise.all([
        sendResponseForImg(photo, openaiService, "ChatGPT"),
        sendResponseForImg(photo, geminiService, "Google Gemini"),
      ]).then(() =>
        bot.sendMessage(
          chatId,
          "Если данные не соответствуют, тогда стоит сделать фото под другим ракурсом, чтобы провести более точный анализ"
        )
      );
    } else {
      try {
        const generatedAnswer = await geminiService.generateText(userMessage);
        // const generatedAnswer = await openaiService.generateText(userMessage);

        bot.sendMessage(chatId, generatedAnswer);
      } catch (e) {
        bot.sendMessage(chatId, "Я не смог для Вас сгенерировать ответ");
        console.error("Error generating sendMessage:", err);
        throw new Error("Failed to generate Google Gemini response");
      }
    }
  });
};
