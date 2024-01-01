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

    try {
      if (photo) {
        const pathInfo = await bot.getFileLink(photo.file_id);

        const generatedAnswerGemini = await geminiService.vision(pathInfo);
        const generatedAnswerGPT = await openaiService.vision(pathInfo);
        try {
          const data = JSON.parse(generatedAnswerGPT);
          bot.sendMessage(
            chatId,
            `ChatGPT
              №: ${data.number};
              Показатель: ${data.value}`
          );

          const dataGemini = JSON.parse(generatedAnswerGemini);
          bot.sendMessage(
            chatId,
            `Google Gemini
              №: ${dataGemini.number};
              Показатель: ${dataGemini.value}`
          );

          // if (data.number) {
          //   bot.sendMessage(chatId, "Ниже номер счетчика");
          //   setTimeout(() => {
          //     bot.sendMessage(chatId, data.number);
          //   }, 100);
          // }

          // if (data.value) {
          //   setTimeout(() => {
          //     bot.sendMessage(chatId, "Ниже показатель счетчика");
          //   }, 200);

          //   setTimeout(() => {
          //     bot.sendMessage(chatId, data.value);
          //   }, 300);
          // }
        } catch (e) {
          bot.sendMessage(chatId, generatedAnswer);
        }
      } else {
        // const generatedAnswer = await geminiService.generateText(userMessage);
        const generatedAnswer = await openaiService.generateText(userMessage);

        bot.sendMessage(chatId, generatedAnswer);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      bot.sendMessage(
        chatId,
        `Sorry, I couldn't generate a response at the moment. Chat id: ${chatId}`
      );
    }
  });
};
