const bot = require("./botConfig");
const openaiService = require("../openai/openaiService");
const geminiService = require("../gemini/geminiService");

const isDev = process.env.NODE_ENV === "development";

module.exports = function () {
  // bot.onText(/\/start/, (msg, match) => {
  //   const chatId = msg.chat.id;
  //   const resp = match[1];
  //   console.log(22222222222);

  //   function mainMenuKeyboard() {
  //     return {
  //       keyboard: [["Пункт 1", "Пункт 2"], ["Пункт 3", "Пункт 4"], ["Выход"]],
  //       resize_keyboard: true,
  //     };
  //   }

  //   bot.sendMessage(chatId, "Hello", {
  //     reply_markup: mainMenuKeyboard(),
  //   });
  // });

  // bot.setMyCommands([
  //   { command: "start", description: "Запустить бота" },
  //   { command: "help", description: "Помощь" },
  // ]);

  // if (userMessage.toLocaleLowerCase().includes("menu")) {
  //   function mainMenuKeyboard() {
  //     return {
  //       keyboard: [["Пункт 1", "Пункт 2"], ["Пункт 3", "Пункт 4"], ["Выход"]],
  //       resize_keyboard: true,
  //     };
  //   }

  //   bot.sendMessage(chatId, "Hello", {
  //     reply_markup: mainMenuKeyboard(),
  //   });

  //   return;
  // }

  // handleSendMessage(dialogContext, {
  //   reply_markup: {
  //     inline_keyboard: [
  //       [
  //         { text: "Кнопка под сообщением", callback_data: "comment" },
  //         { text: "Кнопка под сообщением - 2", callback_data: "comment-2" },
  //       ],
  //     ],
  //   },
  // });

  // handleSendMessage(dialogContext, {
  //   reply_markup: {
  //     force_reply: true, // Заставляет добавить над инпутом ввода возможность ответить на сообщение
  //   },
  // });

  const dialogContext = [];

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
        dialogContext.push(userMessage);

        const generatedAnswer = await geminiService.generateText(
          dialogContext,
          userMessage
        );

        // const generatedAnswer = await openaiService.generateText(dialogContext);

        dialogContext.push(generatedAnswer);

        handleSendMessage(generatedAnswer);
      } catch (e) {
        handleSendMessage("Я не смог для Вас сгенерировать ответ");
        console.error("Error generating sendMessage:", e);
      }
    }
  });

  bot.on("callback_query", (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const comment = callbackQuery.data;
    const username = callbackQuery.from.username;

    // Отправка комментария
    const commentMessage = `@${username} прокомментировал: "${comment}"`;
    bot.sendMessage(chatId, commentMessage);
  });
};
