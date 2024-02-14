const axios = require("axios");
const chat = require("../../chat");
const openService = require("../../../../../api/openai/openaiService");
const instructions = require("../../../../../models/instructions");
const getTranslation = require("../../../../../helpers/getTranslation");
const extractJsonSubstring = require("../../../../../helpers/extractJsonSubstring");
const publishAdToChannel = require("../../../../../helpers/publishAdToChannel");
const extractItems = require("../../../../../helpers/extractItems");
const filterAllowedTags = require("../../../../../helpers/filterAllowedTags");
const watchUser = require("../../../../../modules/watchUser");

module.exports = () => {
  const assistants = {};
  let translation = {};
  let data = {};

  const USER_DATA_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  const clearInactiveUserData = () => {
    const currentTime = Date.now();
    for (const chatId in data) {
      const userData = data[chatId];
      if (currentTime - userData.lastInteractionTime > USER_DATA_TIMEOUT) {
        delete data[chatId];
      }
    }
  };

  const updateLastInteractionTime = (chatId) => {
    if (data[chatId]) {
      data[chatId].lastInteractionTime = Date.now();
    }
  };

  setInterval(clearInactiveUserData, USER_DATA_TIMEOUT);

  const setInitData = (payload = {}) => {
    return {
      lastUserMessage: null,
      // status: "completed",
      // chatHistory: [],
      timeoutId: null,
      ...payload,
    };
  };

  const getUserData = (chatId) => {
    if (!data[chatId]) {
      data[chatId] = setInitData();
    }
    return data[chatId];
  };

  // const clearUserData = (chatId) => {
  //   data[chatId] = setInitData();
  // };

  const sendMessageWithRepeat = (chatId, userMessage) => {
    userData.lastUserMessage = userMessage;
    chat.sendMessage(
      chatId,
      `*${translation.retryPreviousAction.title}*\n${translation.retryPreviousAction.text}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: translation.repeatLastActionButton.title,
                callback_data: "repeat_last_action",
              },
            ],
          ],
        },
      }
    );
  };

  const getAssistantAIByChatID = async (id, languageCode) => {
    if (assistants[id]) {
      return assistants[id];
    }

    try {
      const assistant = await openService.generateChatResponse(
        `${instructions.search}\n\nТы Должен генерировать ответ на языке которому соответствует это код: "${languageCode}".`,
        true
      );
      assistants[id] = assistant;
      return assistant;
    } catch (error) {
      console.error("Error getting assistant AI:", error);
      throw new Error("Failed to get assistant AI");
    }
  };

  chat.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    // const agents = await extractItems();
    // const properties = agents.map((agent) => agent.properties).flat();
    // console.log("🚀 ~ chat.on ~ items:", agents);
    // return;
    updateLastInteractionTime(chatId);
    const userData = getUserData(chatId);

    watchUser({ chat, name: msg.from.username, message: userMessage });

    translation = await getTranslation(msg.from.language_code);

    if (msg.text.toLowerCase() === "/start") {
      chat.sendMessage(
        chatId,
        `*${translation.denonaAIBotInfo.title}*\n${translation.denonaAIBotInfo.text}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // const responseAssistant = `{"properties": [{
    //   "photoLinks": [
    //     "https://st.peopletalk.ru/wp-content/uploads/2017/07/GettyImages-685339256-1024x683.jpg",
    //     "https://st.peopletalk.ru/wp-content/uploads/2016/12/1481365004-1024x640.jpg",
    //     "https://st.peopletalk.ru/wp-content/uploads/2017/07/Snimok-17.png",
    //     "https://st.peopletalk.ru/wp-content/uploads/2017/08/rs_480x270-170226143951-Leonardo_DiCaprio_2016_Oscars.gif"
    //   ],
    //   "description": "Я в процессе подготовки ответа для Вас. Прошу подождите еще некоторое время!"
    // }]}`;

    // try {
    //   const data = JSON.parse(responseAssistant);

    //   if (Array.isArray(data.properties)) {
    //     data.properties.forEach(async (element) => {
    //       if (
    //         Array.isArray(element.photoLinks) &&
    //         element.photoLinks.length > 0
    //       ) {
    //         const media = await Promise.all(
    //           element.photoLinks.map(async (link, i) => {
    //             const { data } = await axios.get(link, {
    //               responseType: "arraybuffer",
    //             });
    //             const photoBuffer = Buffer.from(data, "binary");
    //             return {
    //               type: "photo",
    //               media: photoBuffer,
    //               caption: !i ? element.description : "",
    //             };
    //           })
    //         );

    //         chat.sendMediaGroup(chatId, media);
    //       } else {
    //         chat.sendMessage(chatId, element.description);
    //       }
    //     });
    //   }

    //   if (data.text) {
    //     chat.sendMessage(chatId, data.text);
    //   }
    // } catch (error) {
    //   console.error(error);
    //   chat.sendMessage(chatId, responseAssistant);
    // }
    // return;

    userData.timeoutId = setTimeout(() => {
      chat.sendMessage(chatId, translation.waitingForResponse.text);
    }, 20000);

    try {
      // console.log(111, userMessage);

      const assistantInstance = await getAssistantAIByChatID(chatId);

      const responseAssistant = await assistantInstance(userMessage);
      // userData.chatHistory.push({
      //   role: "user",
      //   content: userMessage,
      // });

      // const responseAssistant = await openService.generateText({
      //   instruction: `Ты Должен генерировать ответ на языке которому соответствует это код: "${msg.from.language_code}". Этот код определяет язык user.\n${instructions.search}`,
      //   chatHistory: userData.chatHistory,
      // });

      // console.log(222, responseAssistant);

      clearTimeout(userData.timeoutId);

      try {
        const jsonData = extractJsonSubstring(responseAssistant);

        watchUser({ chat, name: msg.from.username, message: jsonData });

        // console.log(333, jsonData);

        const data = JSON.parse(jsonData);
        // console.log(441144, data);

        if (data !== null && data.text) {
          chat.sendMessage(chatId, data.text);
          // userData.chatHistory.push({
          //   role: "assistant",
          //   content: data.text,
          // });
        } else if (data === null && typeof responseAssistant === "string") {
          chat.sendMessage(chatId, responseAssistant);
          // userData.chatHistory.push({
          //   role: "assistant",
          //   content: responseAssistant,
          // });
        }

        if (
          data !== null &&
          Array.isArray(data.properties) &&
          data.properties.length > 0
        ) {
          const agents = await extractItems();

          const currentAgent = agents
            .map((agent) =>
              agent.properties.map((property) => ({
                ...property,
                agent: {
                  telegramNickname: agent.telegramNickname,
                  languageCode: agent.languageCode,
                  telegramAgentID: agent.telegramAgentID,
                },
              }))
            )
            .flat();

          const properties = currentAgent.filter((property) =>
            data.properties.some((p) => p.id === property.id)
          );
          // console.log(444, properties);

          if (properties.length) {
            for (const property of properties) {
              await publishAdToChannel({
                chat,
                chatId: chatId,
                pictures:
                  Array.isArray(property.pictures) &&
                  property.pictures.length > 0
                    ? property.pictures
                    : undefined,
                translation,
                message: filterAllowedTags(property.description),
                agentNickname: property.agent.telegramNickname,
              });
            }
          }
        }
      } catch (error) {
        userData.lastUserMessage = userMessage;
        clearTimeout(userData.timeoutId);
        console.error(error);
        sendMessageWithRepeat(chatId, userMessage);
        watchUser({
          chat,
          name: msg.from.username,
          message: error.message,
        });
      }
    } catch (error) {
      userData.lastUserMessage = userMessage;
      clearTimeout(userData.timeoutId);
      console.error(error);
      sendMessageWithRepeat(chatId, userMessage);
      watchUser({ chat, name: msg.from.username, message: error.message });
    }
  });
};
