const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../../../../models/instructions");
const extractJsonSubstringForGemini = require("../../../../../helpers/extractJsonSubstringForGemini");

let data = {};
const USER_DATA_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
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

const callAPI = async ({ chatId, userMessage }) => {
  const userData = getUserData(chatId);

  let ins = [instructions.myself];

  if (userData.currentPage === menu.property)
    ins = [instructions.myself, instructions.property];
  else ins = [instructions.myself, instructions.values];

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
      if (data?.length > 400) {
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
};
