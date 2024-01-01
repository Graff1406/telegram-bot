const bot = require("./botConfig");
const openaiService = require("../openai/openaiService");
// const geminiService = require("../gemini/geminiService");

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
        const fileInfo = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${"6049321677:AAF9v6XTI_qmgh__cG4LHQkTqHpYatZH0xI"}/${
          fileInfo.file_path
        }`;

        // const geminiPathInfo = await bot.getFileLink(photo.file_id);

        // const generatedAnswer = await geminiService.vision(geminiPathInfo);
        const generatedAnswer = await openaiService.vision(fileUrl);
        try {
          const data = JSON.parse(generatedAnswer);
          if (data.number) {
            bot.sendMessage(chatId, "Ниже номер счетчика");
            setTimeout(() => {
              bot.sendMessage(chatId, data.number);
            }, 100);
          }

          if (data.value) {
            setTimeout(() => {
              bot.sendMessage(chatId, "Ниже показатель счетчика");
            }, 200);

            setTimeout(() => {
              bot.sendMessage(chatId, data.value);
            }, 300);
          }
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
