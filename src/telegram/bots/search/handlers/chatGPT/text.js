const axios = require("axios");
const chat = require("../../chat");
const openService = require("../../../../../api/openai/openaiService");
const instructions = require("../../../../../models/instructions");
const getTranslation = require("../../../../../helpers/getTranslation");
const extractJsonSubstring = require("../../../../../helpers/extractJsonSubstring");
const publishAdToChannel = require("../../../../../helpers/publishAdToChannel");
const extractItems = require("../../../../../helpers/extractItems");
const filterAllowedTags = require("../../../../../helpers/filterAllowedTags");

module.exports = () => {
  const assistants = {};
  let translation = {};
  let lastUserMessage = null;

  const sendMessageWithRepeat = (chatId, userMessage) => {
    lastUserMessage = userMessage;
    chat.sendMessage(
      chatId,
      `<b>${translation.retryPreviousAction.title}</b>\n${translation.retryPreviousAction.text}`,
      {
        parse_mode: "HTML",
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
        `Ты Должен генерировать ответ на языке которому соответствует это код: "${languageCode}". Этот код определяет язык user.\n${instructions.search}`,
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

    translation = await getTranslation(msg.from.language_code);

    if (msg.text.toLowerCase() === "/start") {
      chat.sendMessage(
        chatId,
        `<b>${translation.denonaAIBotInfo.title}</b>\n${translation.denonaAIBotInfo.text}`,
        { parse_mode: "HTML" }
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

    const timeoutId = setTimeout(() => {
      chat.sendMessage(chatId, translation.waitingForResponse.text);
    }, 20000);

    try {
      console.log(111, userMessage);

      const assistantInstance = await getAssistantAIByChatID(chatId);

      const responseAssistant = await assistantInstance(userMessage);

      console.log(222, responseAssistant);

      clearTimeout(timeoutId);

      try {
        const jsonData = extractJsonSubstring(responseAssistant);
        console.log(333, jsonData);
        const data = JSON.parse(jsonData);
        console.log(441144, data);

        if (
          !!data &&
          Array.isArray(data.properties) &&
          data.properties.length > 0
        ) {
          const agents = await extractItems();

          const properties = agents
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

          const coincideProperties = properties.filter((property) =>
            data.properties.some((item) => item.id === property.id)
          );
          console.log(444, coincideProperties);

          if (coincideProperties.length) {
            for (const property of coincideProperties) {
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

        if (!!data && data.text) {
          chat.sendMessage(chatId, data.text);
        }

        if (!data && typeof responseAssistant === "string") {
          chat.sendMessage(chatId, responseAssistant);
          return;
        }
      } catch (error) {
        lastUserMessage = userMessage;
        clearTimeout(timeoutId);
        console.error(error);
        sendMessageWithRepeat(chatId, userMessage);
      }
    } catch (error) {
      lastUserMessage = userMessage;
      clearTimeout(timeoutId);
      console.error(error);
      sendMessageWithRepeat(chatId, userMessage);
    }
  });
};
