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

        const answer = await service.vision(pathInfo);

        const data = JSON.parse(answer);
        bot.sendMessage(
          chatId,
          `${aiName}
          №: ${data.number};
          Показатель: ${data.value};
          Тип: ${data.type}`
        );
      } catch (err) {
        bot.sendMessage(
          chatId,
          ` "${aiName} не смог распознать данные на изображении"`
        );
      }
    }

    if (photo) {
      sendResponseForImg(photo, openaiService, "ChatGPT");
      sendResponseForImg(photo, geminiService, "Google Gemini");
    } else {
      try {
        const generatedAnswer = await geminiService.generateText(userMessage);
        // const generatedAnswer = await openaiService.generateText(userMessage);

        bot.sendMessage(chatId, generatedAnswer);
      } catch (e) {
        bot.sendMessage(chatId, "Я не смог для Вас сгенерировать ответ");
      }
    }
  });
};
