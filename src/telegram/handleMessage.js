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

        const generatedAnswerGPT = await openaiService.vision(pathInfo);
        try {
          const data = JSON.parse(generatedAnswerGPT);
          console.log(333333, data);
          bot.sendMessage(
            chatId,
            `ChatGPT
              №: ${data.number};
              Показатель: ${data.value};
              Тип: ${data.type}`
          );

          const generatedAnswerGemini = await geminiService.vision(pathInfo);

          const dataGemini = JSON.parse(generatedAnswerGemini);
          console.log(666666, dataGemini);
          bot.sendMessage(
            chatId,
            `Google Gemini
              №: ${dataGemini.number};
              Показатель: ${dataGemini.value};
              Тип: ${dataGemini.type}`
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
          const res = await openaiService.generateText(userMessage);
          bot.sendMessage(chatId, res);
        }
      } else {
        const res = await openaiService.generateText(userMessage);
        bot.sendMessage(chatId, res);
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
