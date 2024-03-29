const chat = require("../../chat");

const openService = require("../../../../../api/openai/openaiService");
// const geminiService = require("../../../../../api/gemini/geminiService");

const extractJsonSubstring = require("../../../../../helpers/extractJsonSubstring");
const updateProperty = require("../../../../../helpers/updateProperty");
const addPicture = require("../../../../../helpers/addPicture");
const publishAdToChannel = require("../../../../../helpers/publishAdToChannel");
const extractItems = require("../../../../../helpers/extractItems");
const removePropertyById = require("../../../../../helpers/removePropertyById");
const getTranslation = require("../../../../../helpers/getTranslation");
const filterAllowedTags = require("../../../../../helpers/filterAllowedTags");

const instructions = require("../../../../../models/instructions");
const sendMessageToViber = require("../../../../../modules/sendMessageToViber");
const watchUser = require("../../../../../modules/watchUser");
const {
  postToFacebookGroup,
} = require("../../../../../helpers/postToFacebookGroup");

const isDev = process.env.NODE_ENV === "development";

module.exports = () => {
  let data = {};
  let translation = {};
  let assistants = {};
  let agents;

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
      propertyDescription: "",
      propertyPictureLinks: [],
      adReadyForPublishingWithPictures: false,
      adReadyForPublishingWithoutPictures: false,
      lastUserMessage: null,
      action: {},
      status: "completed",
      runConversationTimeoutId: null,
      currentAgent: {},
      countCurrentlyDownloadedPictures: 0,
      chatHistory: [],
      properties: [],
      ...payload,
    };
  };

  const getUserData = (chatId) => {
    if (!data[chatId]) {
      data[chatId] = setInitData();
    }
    return data[chatId];
  };

  const clearUserData = (chatId) => {
    data[chatId] = setInitData();
  };

  const defineAction = (chatId, propertyID, type) => {
    const userData = getUserData(chatId);

    userData.action = {
      propertyID,
      type,
    };
  };

  // const getLinkToMessage = (chatId, messageId, text = "Объявление") => {
  //   return `<a href="https://t.me/c/${chatId}/${messageId}">${text}</a>`;
  // };

  const getAssistantAIByChatID = async (id, languageCode) => {
    if (assistants[id]) {
      return assistants[id];
    }

    try {
      const assistant = await openService.generateChatResponse({
        instruction: `${instructions.crm}\n\nТы Должен генерировать ответ на языке которому соответствует это код: "${languageCode}"`,
      });
      assistants[id] = assistant;
      return assistant;
    } catch (error) {
      console.error("Error getting assistant AI:", error);
      throw new Error("Failed to get assistant AI");
    }
  };

  const addDataProperty = async ({
    agentID,
    agentNickname,
    agentLanguageCode,
    agentPhoneNumbers,
    agentFirstName,
    description,
    pictures,
  }) => {
    try {
      const property = await updateProperty({
        agentNickname,
        agentLanguageCode,
        agentPhoneNumbers,
        agentFirstName,
        agentID,
        description,
      });

      if (!pictures) return property;

      await addPicture({
        propertyID: property.id,
        pictures,
      });

      return property;
    } catch (error) {
      console.log("addDataProperty: ", error);
      return null;
    }
  };

  const sendMessageWithRepeat = (chatId, userMessage) => {
    const userData = getUserData(chatId);
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

  const runConversation = async (chatId, userMessage, agent) => {
    const userData = getUserData(chatId);

    userData.status = "inProgress";

    userData.runConversationTimeoutId = setTimeout(() => {
      chat.sendMessage(chatId, translation.waitingForResponse.text);
    }, 20000);

    if (!agents) {
      const items = await extractItems();

      const item = items.find((item) => item.telegramAgentID === agent.id);

      if (item) userData.currentAgent = item;
    }

    try {
      const assistantInstance = await getAssistantAIByChatID(
        chatId,
        agent.language_code
      );

      const responseAssistant = await assistantInstance(userMessage);

      // userData.chatHistory.push(
      //   {
      //     role: "user",
      //     parts: userMessage,
      //   },
      //   {
      //     role: "model",
      //     parts: "",
      //   }
      // );

      // const responseAssistant = await geminiService.generateChatText({
      //   userMessage,
      //   instructions: instructions.crm,
      //   chatHistory: userData.chatHistory,
      // });

      userData.status = "completed";

      clearTimeout(userData.runConversationTimeoutId);

      watchUser({ chat, name: agent.first_name, message: responseAssistant });

      try {
        const data = JSON.parse(extractJsonSubstring(responseAssistant));

        // if (
        //   Array.isArray(userData.chatHistory) &&
        //   userData.chatHistory.length > 0 &&
        //   data &&
        //   typeof data.text === "string" &&
        //   data.text.length > 0
        // ) {
        //   userData.chatHistory[userData.chatHistory.length - 1].parts =
        //     data.text;
        // }

        // const data = {
        //   text: "текстовый ответ",
        //   property: {},
        //   list: true,
        // };

        // const data = {
        //   text: "текстовый ответ",
        //   property: {
        //     description:
        //       "_Тип недвижимости:_ *Квартира*\n_Адрес:_ *ул. Галицкая, Ивано-Франковск*\n_Цена:_ *59 000 $ (2 289 200 грн, 434 $ за м²)*\n_Общая площадь:_*136 м²*\n_Этаж:_*5 из 6*\n_Материал стен:_ *Кирпич*\n_Состояние:_ *Вторичная недвижимость, 2-уровневая с ремонтом*\n_Комиссионные:_ *Без комиссионных*",
        //     location: true,
        //     minData: true,
        //   },
        //   list: false,
        //   phoneNumbers: [],
        // };

        // const responseAssistant = "";

        if (data === null && typeof responseAssistant === "string") {
          chat.sendMessage(chatId, responseAssistant);
          return;
        } else if (data !== null && !data.hasOwnProperty("text")) {
          runConversation(userMessage);
          return;
        } else if (
          (data !== null &&
            !data.hasOwnProperty("property") &&
            typeof data.text === "string") ||
          (data !== null &&
            !data.hasOwnProperty("list") &&
            typeof data.text === "string") ||
          (data !== null &&
            !data.hasOwnProperty("phoneNumbers") &&
            typeof data.text === "string")
        ) {
          chat.sendMessage(chatId, data.text);
          console.log(111);
          return;
        }

        if (
          data !== null &&
          data.property &&
          typeof data.property.description === "string" &&
          data.property.description.length > 0 &&
          data.property.minData
        ) {
          userData.propertyDescription = filterAllowedTags(
            data.property.description
          );

          // console.log(
          //   77777,
          //   userData.propertyDescription,
          //   filterAllowedTags(data.property.description)
          // );

          userData.currentAgent.phoneNumbers =
            data &&
            Array.isArray(data.phoneNumbers) &&
            data.phoneNumbers.length > 0
              ? data.phoneNumbers
              : userData.currentAgent &&
                Array.isArray(userData.currentAgent.phoneNumbers) &&
                userData.currentAgent.phoneNumbers.length > 0
              ? userData.currentAgent.phoneNumbers
              : [];

          userData.currentAgent.telegramNickname = agent.username
            ? agent.username
            : typeof userData.currentAgent.telegramNickname === "string" &&
              userData.currentAgent.telegramNickname.length > 0
            ? userData.currentAgent.telegramNickname
            : "";

          if (
            userData.propertyDescription.length > 0 &&
            userData.propertyPictureLinks.length > 0 &&
            data.property.location &&
            userData.currentAgent.phoneNumbers.length > 0 &&
            userData.currentAgent.telegramNickname.length > 0
          ) {
            userData.adReadyForPublishingWithPictures = true;

            chat.sendMessage(
              chatId,
              `*${translation.adReadyForPublishing.title}*\n${translation.adReadyForPublishing.text}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.cancelActionButton.title,
                        callback_data: "publish_ad_cancel",
                      },
                      {
                        text: translation.publishActionButton.title,
                        callback_data: "publish_with_picture",
                      },
                    ],
                  ],
                },
              }
            );
          } else if (
            userData.propertyDescription.length > 0 &&
            userData.propertyPictureLinks.length === 0 &&
            data.property.location &&
            userData.currentAgent.phoneNumbers.length > 0 &&
            userData.currentAgent.telegramNickname.length > 0
          ) {
            userData.adReadyForPublishingWithoutPictures = true;

            await chat.sendMessage(chatId, userData.propertyDescription, {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: translation.cancelActionButton.title,
                      callback_data: "publish_ad_cancel",
                    },
                    {
                      text: translation.publishWithoutPhotoActionButton.title,
                      callback_data: "publish_without_picture",
                    },
                  ],
                ],
              },
            });

            chat.sendMessage(
              chatId,
              `*${translation.warningNoPhotosAd.title}*\n${translation.warningNoPhotosAd.text}`,
              { parse_mode: "Markdown" }
            );
          } else if (
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length > 0 &&
              !data.property.location) ||
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length === 0 &&
              !data.property.location)
          ) {
            chat.sendMessage(
              chatId,
              `*${translation.missingPropertyAddress.title}*\n${translation.missingPropertyAddress.text}`,
              { parse_mode: "Markdown" }
            );
            return;
          } else if (
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length > 0 &&
              userData.currentAgent.phoneNumbers.length === 0) ||
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length === 0 &&
              userData.currentAgent.phoneNumbers.length === 0)
          ) {
            chat.sendMessage(
              chatId,
              `*${translation.missingPhoneNumber.title}*\n${translation.missingPhoneNumber.text}`,
              { parse_mode: "Markdown" }
            );
            return;
          } else if (
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length > 0 &&
              userData.currentAgent.telegramNickname.length === 0) ||
            (userData.propertyDescription.length > 0 &&
              userData.propertyPictureLinks.length === 0 &&
              userData.currentAgent.telegramNickname.length === 0)
          ) {
            chat.sendMessage(
              chatId,
              `*${translation.warningNoTelegramLink.title}*\n${translation.warningNoTelegramLink.text}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.confirmationCreation.title,
                        callback_data: "set_telegram_username",
                      },
                    ],
                  ],
                },
              }
            );
            return;
          }
        } else if (data !== null && data.hasOwnProperty("list") && data.list) {
          const properties =
            userData.currentAgent &&
            Array.isArray(userData.currentAgent.properties) &&
            userData.currentAgent.properties.length > 0
              ? userData.currentAgent.properties
              : [];

          if (properties.length) {
            for (const property of properties) {
              if (
                Array.isArray(property.pictures) &&
                property.pictures.length > 0
              ) {
                await publishAdToChannel({
                  chat,
                  chatId: chatId,
                  pictures: property.pictures,
                  translation,
                });
              }

              await chat.sendMessage(chatId, property.description, {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.deleteAdActionButton.title,
                        callback_data: `delete:${property.id}`,
                      },
                    ],
                  ],
                },
              });
            }
          } else {
            chat.sendMessage(
              chatId,
              `*${translation.noPublishedPropertyAd.title}*\n${translation.noPublishedPropertyAd.text}`,
              { parse_mode: "Markdown" }
            );
          }
        }

        if (
          data !== null &&
          typeof data.text === "string" &&
          data.text.length > 0 &&
          data.property &&
          !data.property.minData
        ) {
          chat.sendMessage(chatId, data.text, { parse_mode: "Markdown" });
        }
      } catch (error) {
        clearTimeout(userData.runConversationTimeoutId);
        console.log("Response Assistant have not include JSON:", error.message);

        sendMessageWithRepeat(chatId, userMessage);
        watchUser({ chat, name: agent.first_name, message: error.message });
      }
    } catch (error) {
      userData.status = "completed";

      clearTimeout(userData.runConversationTimeoutId);
      console.error("Error getting assistant AI:", error);
      sendMessageWithRepeat(chatId, userMessage);
      watchUser({ chat, name: agent.first_name, message: error.message });
    }
  };

  chat.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    updateLastInteractionTime(chatId);
    const userData = getUserData(chatId);

    watchUser({ chat, name: msg.from.first_name, message: userMessage });

    translation = await getTranslation(msg.from.language_code);

    // const responseAssistant = await geminiService.generateChatText({
    //   userMessage,
    //   instructions: `Ты Должен генерировать ответ на языке которому соответствует это код: "${msg.from.language_code}".\n${instructions.crm}`,
    // });

    // const data = JSON.parse(responseAssistant);

    // chat.sendMessage(chatId, data.text, { parse_mode: "Markdown" });

    // console.log(
    //   "🚀 ~ runConversation ~ responseAssistant:",
    //   data,
    //   responseAssistant
    // );
    // return;

    if (chatId === +process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID) return;

    if (msg.text.toLowerCase() === "/start") {
      await chat.sendMessage(
        chatId,
        `*${translation.introduction.title}*\n${translation.introduction.text}`,
        { parse_mode: "Markdown" }
      );

      await chat.sendMessage(
        chatId,
        `*${translation.benefitsOfDenonaCRM.title}*\n${translation.benefitsOfDenonaCRM.text}`,
        { parse_mode: "Markdown" }
      );

      chat.sendMessage(
        chatId,
        `*${translation.propertyListingExample.title}*\n${translation.propertyListingExample.text}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (userData.status === "inProgress") {
      chat.sendMessage(
        chatId,
        `*${translation.processingPreviousMessage.title}*\n${translation.processingPreviousMessage.text}`,
        { parse_mode: "Markdown" }
      );
      clearTimeout(userData.runConversationTimeoutId);
      return;
    }

    if (
      userData.adReadyForPublishingWithPictures ||
      userData.adReadyForPublishingWithoutPictures
    ) {
      chat.sendMessage(
        chatId,
        `*${translation.lastDataIgnored.title}*\n${translation.lastDataIgnored.text}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    runConversation(chatId, userMessage, msg.from);
  });

  chat.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    const caption = msg.caption;
    const photo = msg.photo;

    updateLastInteractionTime(chatId);
    const userData = getUserData(chatId);

    userData.countCurrentlyDownloadedPictures += 1;

    watchUser({
      chat,
      photo: photo,
      name: msg.from.first_name,
      message: caption,
    });

    translation = await getTranslation(msg.from.language_code);

    if (chatId === +process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID) return;

    if (userData.status === "inProgress") {
      chat.sendMessage(
        chatId,
        `*${translation.processingPreviousMessage.title}*\n${translation.processingPreviousMessage.text}`,
        { parse_mode: "Markdown" }
      );
      clearTimeout(userData.runConversationTimeoutId);
      return;
    }

    if (userData.adReadyForPublishingWithPictures) {
      chat.sendMessage(
        chatId,
        `*${translation.lastDataIgnored.title}*\n${translation.lastDataIgnored.text}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (
      userData.propertyDescription.length === 0 &&
      typeof caption === "string"
    ) {
      userData.propertyDescription = filterAllowedTags(caption);
    }

    try {
      const photoLinks = await Promise.all(
        photo.map(async (photo) => {
          const fileLink = await chat.getFileLink(photo.file_id);
          return {
            id: photo.file_unique_id,
            link: fileLink,
            size: photo.file_size,
            width: photo.width,
            height: photo.height,
          };
        })
      );

      userData.propertyPictureLinks =
        userData.propertyPictureLinks.length > 0
          ? [...userData.propertyPictureLinks, photoLinks]
          : [photoLinks];
    } catch (error) {
      console.log(error);
    }

    if (
      userData.propertyPictureLinks.length !==
      userData.countCurrentlyDownloadedPictures
    ) {
      return;
    }

    userData.countCurrentlyDownloadedPictures = 0;

    if (
      userData.propertyDescription.length > 0 &&
      !userData.adReadyForPublishingWithoutPictures
    ) {
      runConversation(chatId, userData.propertyDescription, msg.from);
    } else if (
      userData.propertyDescription.length > 0 &&
      userData.adReadyForPublishingWithoutPictures
    ) {
      userData.adReadyForPublishingWithPictures = true;

      chat.sendMessage(
        chatId,
        `*${translation.adReadyForPublishing.title}*\n${translation.adReadyForPublishing.text}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: translation.cancelActionButton.title,
                  callback_data: "publish_ad_cancel",
                },
                {
                  text: translation.publishActionButton.title,
                  callback_data: "publish_with_picture",
                },
              ],
            ],
          },
        }
      );
    } else {
      chat.sendMessage(
        chatId,
        `*${translation.propertyWithoutDescription.title}*\n${translation.propertyWithoutDescription.text}`,
        { parse_mode: "Markdown" }
      );
    }
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const agentID = query.from.id;
    const agentNickname = query.from.username;
    const agentFirstName = query.from.first_name;
    const agentLanguageCode = query.from.language_code;
    console.log("🚀 ~ chat.on ~ query:", agentNickname);

    updateLastInteractionTime(chatId);
    const userData = getUserData(chatId);

    const agentPhoneNumbers = userData.currentAgent
      ? userData.currentAgent.phoneNumbers
      : undefined;

    const publishedMessage = () => {
      chat.sendMessage(
        chatId,
        `*${translation.adSuccessfullyPublished.title}*\n${translation.adSuccessfullyPublished.text}`,
        { parse_mode: "Markdown" }
      );

      clearUserData(chatId);
    };

    try {
      if (
        data === "publish_with_picture" &&
        userData.propertyPictureLinks.length > 0 &&
        userData.propertyDescription.length > 0
      ) {
        await postToFacebookGroup({
          content: `${userData.propertyDescription}\n${agentPhoneNumbers.join(
            "\n"
          )}\n${agentFirstName}`,
          photos: userData.propertyPictureLinks,
          agentNickname,
        });

        await sendMessageToViber(
          {
            type: "picture",
            text: userData.propertyDescription,
            media: userData.propertyPictureLinks[0][2].link,
            agentPhoneNumbers,
            agentFirstName,
          },
          translation
        );

        await publishAdToChannel({
          chat,
          chatId: isDev
            ? process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID
            : process.env.TELEGRAM_CHANNEL_DENONA_REAL_ESTATE_ID,
          message: userData.propertyDescription,
          pictures: userData.propertyPictureLinks,
          agentNickname,
          agentPhoneNumbers,
          translation,
        });

        await addDataProperty({
          agentID,
          agentNickname,
          agentLanguageCode,
          agentPhoneNumbers,
          description: userData.propertyDescription,
          pictures: userData.propertyPictureLinks,
          agentFirstName,
        });

        publishedMessage();
      } else if (
        data === "publish_without_picture" &&
        userData.propertyDescription.length > 0
      ) {
        await postToFacebookGroup({
          content: `${userData.propertyDescription}\n${agentPhoneNumbers.join(
            "\n"
          )}\n${agentFirstName}`,
          agentNickname,
        });

        await sendMessageToViber(
          {
            type: "text",
            text: userData.propertyDescription,
            agentPhoneNumbers,
            agentFirstName,
          },
          translation
        );

        await publishAdToChannel({
          chat,
          chatId: isDev
            ? process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID
            : process.env.TELEGRAM_CHANNEL_DENONA_REAL_ESTATE_ID,
          message: userData.propertyDescription,
          agentNickname,
          agentPhoneNumbers,
          pictures:
            userData.propertyPictureLinks.length > 0
              ? userData.propertyPictureLinks
              : undefined,
          translation,
        });

        await addDataProperty({
          agentID,
          agentNickname,
          agentLanguageCode,
          description: userData.propertyDescription,
          pictures: userData.propertyPictureLinks,
          agentFirstName,
          agentPhoneNumbers: userData.currentAgent
            ? userData.currentAgent.phoneNumbers
            : undefined,
        });

        publishedMessage();
      } else if (data === "publish_ad_cancel") {
        chat.sendMessage(
          chatId,
          `*${translation.successfulPublishingAdCancellation.title}*\n${translation.successfulPublishingAdCancellation.text}`,
          {
            parse_mode: "Markdown",
          }
        );
        clearUserData(chatId);
      } else if (data.startsWith("update_text")) {
        const [action, propertyID] = data.split(":");

        defineAction(chatId, propertyID, action);

        chat.sendMessage(
          chatId,
          `*${translation.propertyDescriptionUpdate.title}*\n${translation.propertyDescriptionUpdate.text}`,
          { parse_mode: "Markdown" }
        );
      } else if (data.startsWith("update_picture")) {
        const [action, propertyId] = data.split(":");
        defineAction(chatId, propertyId, action);
        chat.sendMessage(
          chatId,
          `*${translation.readyToReceivePropertyPhotos.title}*\n${translation.readyToReceivePropertyPhotos.text}`,
          { parse_mode: "Markdown" }
        );
      } else if (data.startsWith("delete")) {
        const propertyId = data.split(":")[1];
        defineAction(chatId, propertyId, "delete");
        chat.sendMessage(
          chatId,
          `*${translation.deleteSelectedAd.title}*\n${translation.deleteSelectedAd.text}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: translation.cancelActionButton.title,
                    callback_data: "permit_cancel",
                  },
                  {
                    text: translation.deleteAdActionButton.title,
                    callback_data: "permit_delete",
                  },
                ],
              ],
            },
          }
        );
      } else if (data === "permit_cancel") {
        chat.sendMessage(
          chatId,
          `*${translation.deletionAdCanceled.title}*\n`,
          { parse_mode: "Markdown" }
        );
      } else if (data === "permit_delete") {
        removePropertyById(query.from.id, userData.action.propertyID);
        chat.sendMessage(
          chatId,
          `*${translation.announcementAdDeletionSuccess.title}*\n`,
          { parse_mode: "Markdown" }
        );
      } else if (data === "repeat_last_action" ?? userData.lastUserMessage) {
        runConversation(chatId, userData.lastUserMessage, query.from);
      } else if (data === "set_telegram_username") {
        runConversation(chatId, userData.propertyDescription, query.from);
      } else {
        chat.answerCallbackQuery(query.id, {
          text: translation.actionPreviouslyDone.title,
          cache_time: 1,
        });
      }

      // Clear all the data
      clearUserData(chatId);
    } catch (error) {
      console.error(error);
      clearUserData(chatId);
    }
  });
};
