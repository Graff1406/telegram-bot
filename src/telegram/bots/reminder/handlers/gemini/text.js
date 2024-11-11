const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");

const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../models");
const extractJsonSubstringForGemini = require("../../../../../helpers/extractJsonSubstringForGemini");

let data = {};
const USER_DATA_TIMEOUT = 14 * 24 * 60 * 60 * 1000; // 14 days
const menu = {
  values: "/values",
  property: "/property",
};

const setInitData = (payload = {}) => {
  return {
    chatHistory: [],
    currentPage: menu.values,
  };
};

const clearInactiveUserData = () => {
  const currentTime = Date.now();
  for (const chatId in data) {
    const userData = data[chatId];
    if (currentTime - userData.lastInteractionTime > USER_DATA_TIMEOUT) {
      delete data[chatId];
    }
  }
};

setInterval(clearInactiveUserData, USER_DATA_TIMEOUT);

const updateLastInteractionTime = (chatId) => {
  if (data[chatId]) {
    data[chatId].lastInteractionTime = Date.now();
  }
};

const getUserData = (chatId) => {
  if (!data[chatId]) {
    data[chatId] = setInitData();
  }
  return data[chatId];
};

const callAPI = async ({ chatId, userMessage, customInstructions }) => {
  const userData = getUserData(chatId);

  let ins = [instructions.init];

  if (userData.currentPage === menu.property)
    ins = [instructions.init, instructions.property];
  else if (Array.isArray(customInstructions)) ins = customInstructions;
  else ins = [instructions.init, instructions.principals];

  if (!userMessage) {
    userData.chatHistory = userData.chatHistory.filter(
      (_, i, arr) => i !== arr.length - 1
    );
    userData.chatHistory.push({
      role: "model",
      parts: "",
    });
  } else {
    userData.chatHistory.push(
      {
        role: "user",
        parts: userMessage,
      },
      {
        role: "model",
        parts: "",
      }
    );
  }

  try {
    const res = await geminiService.generateChatText({
      userMessage: userMessage,
      instructions: ins,
      chatHistory: userData.chatHistory,
    });

    console.log("-------------------------------");
    console.log(11111, res);
    const data = extractJsonSubstringForGemini(res);
    console.log(222222, data);

    userData.chatHistory[userData.chatHistory.length - 1].parts = data;

    try {
      if (data?.length > 500) {
        chat.sendMessage(chatId, data, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Update",
                  callback_data: "update",
                },
              ],
            ],
          },
        });
      } else {
        chat.sendMessage(chatId, data, {
          parse_mode: "Markdown",
        });
      }
    } catch (e) {
      chat.sendMessage(chatId, data);
    }
  } catch (error) {}
};

// Random principal
cron.schedule("0,30 7-21 * * *", () => {
  // every one hour
  callAPI({
    chatId: process.env.MY_TELEGRAM_ID,
    userMessage: instructions.notification,
    instructions: [instructions.principals],
  });
});

// Find the flaws
cron.schedule("0 10 * * *", () => {
  // once per day
  callAPI({
    chatId: process.env.MY_TELEGRAM_ID,
    userMessage: instructions.flaws,
    instructions: [instructions.principals],
  });
});

module.exports = () => {
  chat.on("text", (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    updateLastInteractionTime(chatId);

    if (userMessage !== menu.values && userMessage !== menu.property) {
      callAPI({ userMessage, chatId });
    }

    // chat.setMyCommands([
    //   {
    //     command: "/values",
    //     description: "Ценности",
    //   },
    //   {
    //     command: "/property",
    //     description: "Недвижимость",
    //   },
    // ]);
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const button = query.data;

    try {
      if (button === "update") {
        callAPI({ chatId });
      }
    } catch (error) {
      console.log("🚀 ~ chat.on ~ error:", error);
    }
  });

  chat.onText(/\/values/, (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);
    userData.currentPage = menu.values;
    chat.sendMessage(chatId, "Вкл. Ценности");
    return;
  });

  chat.onText(/\/property/, (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);
    userData.currentPage = menu.property;
    chat.sendMessage(chatId, "Вкл. Недвижимость");
    return;
  });

  chat.on("document", async (msg) => {
    const chatId = msg.chat.id;

    // Проверка, есть ли в сообщении документ
    if (msg.document) {
      const fileName = msg.document.file_name;
      const fileExtension = path.extname(fileName);

      // Проверяем, является ли файл .md
      if (fileExtension === ".md") {
        try {
          // Получаем file_id
          const fileId = msg.document.file_id;

          // Получаем ссылку на файл
          const fileLink = await chat.getFileLink(fileId);

          // Скачиваем и сохраняем файл
          const response = await axios.get(fileLink, {
            responseType: "stream",
          });
          const writer = fs.createWriteStream(
            path.join(__dirname, "../../data", "principals.md")
          );

          response.data.pipe(writer);

          // Дожидаемся завершения записи файла
          writer.on("finish", () => {
            chat.sendMessage(chatId, "Файл успешно сохранен как principals.md");
          });
          writer.on("error", (err) => {
            console.error("Ошибка при сохранении файла:", err);
            chat.sendMessage(chatId, "Ошибка при сохранении файла.");
          });
        } catch (error) {
          console.error("Ошибка при обработке файла:", error);
          chat.sendMessage(chatId, "Ошибка при обработке файла.");
        }
      } else {
        // Отправляем сообщение о неправильном формате файла
        chat.sendMessage(
          chatId,
          "Пожалуйста, отправьте файл с расширением .md"
        );
      }
    }
  });
};
