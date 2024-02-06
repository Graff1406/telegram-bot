const chat = require("../../chat");

const openService = require("../../../../../api/openai/openaiService");

const extractJsonSubstring = require("../../../../../helpers/extractJsonSubstring");
const updateProperty = require("../../../../../helpers/updateProperty");
const addPicture = require("../../../../../helpers/addPicture");
const publishAdToChannel = require("../../../../../helpers/publishAdToChannel");
const extractItems = require("../../../../../helpers/extractItems");
const removePropertyById = require("../../../../../helpers/removePropertyById");
const getTranslation = require("../../../../../helpers/getTranslation");
const filterAllowedTags = require("../../../../../helpers/filterAllowedTags");

const instructions = require("../../../../../models/instructions");

const isDev = process.env.NODE_ENV === "development";

module.exports = () => {
  let status = "completed";
  let runConversationTimeoutId;
  let timeoutId;
  let timeout = 1000;
  let collectedPictures = false;
  let propertyDescription = {};
  let propertyPictureLinks = {};
  let translation = {};
  let lastUserMessage = null;
  let adReadyForPublishingWithPictures = false;
  let adReadyForPublishingWithoutPictures = false;

  const assistants = {};
  const action = {};

  const clear = () => {
    propertyDescription = {};
    propertyPictureLinks = {};
    adReadyForPublishingWithPictures = false;
    adReadyForPublishingWithoutPictures = false;
  };

  const defineAction = (chatId, propertyID, type) => {
    action[chatId] = {
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
      const assistant = await openService.generateChatResponse(
        `Ты Должен генерировать ответ на языке которому соответствует это код: "${languageCode}".\n${instructions.crm}`,
        true
      );
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
    description,
    pictures,
  }) => {
    try {
      const property = await updateProperty({
        agentNickname,
        agentLanguageCode,
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

  // const publishOnGroup = async (chatId, message) => {
  //   const media = await getMediaBasedLinks(propertyPictureLinks[chatId]);

  //   await chat.sendMediaGroup(chatId, media);

  //   chat.sendMessage(chatId, message, {
  //     parse_mode: "HTML",
  //   });
  // };

  const runConversation = async (chatId, userMessage, agent) => {
    status = "inProgress";

    runConversationTimeoutId = setTimeout(() => {
      chat.sendMessage(chatId, translation.waitingForResponse.text);
    }, 20000);

    try {
      const assistantInstance = await getAssistantAIByChatID(
        chatId,
        agent.language_code
      );

      const responseAssistant = await assistantInstance(userMessage);
      console.log(
        "🚀 ~ runConversation ~ responseAssistant:",
        responseAssistant
      );

      // await new Promise((resolve, reject) => {
      //   // Используем setTimeout для имитации задержки в 15 секунд
      //   setTimeout(() => {
      //     // После задержки, успешно выполняем промис
      //     resolve("Прошло 15 секунд!");
      //     status = "completed";
      //   }, 5000);
      // });

      status = "completed";

      clearTimeout(runConversationTimeoutId);

      try {
        const data = JSON.parse(extractJsonSubstring(responseAssistant));
        console.log(66666, data);

        // const data = {
        //   text: "текстовый ответ",
        //   property: {},
        //   list: true,
        // };

        // const data = {
        //   text: "текстовый ответ",
        //   property: {
        //     description:
        //       "<i>- Тип недвижимости:</i> <b>Квартира</b>\n<i>- Адрес:</i> <b>ул. Галицкая, Ивано-Франковск</b>\n<i>- Цена:</i> <b>59 000 $ (2 289 200 грн, 434 $ за м²)</b>\n<i>- Общая площадь:</i><b>136 м²</b><i>- Этаж:</i><b>5 из 6</b>\n<i>- Материал стен:</i> <b>Кирпич</b>\n<i>- Состояние:</i> <b>Вторичная недвижимость, 2-уровневая с ремонтом</b>\n<i>- Комиссионные:</i> <b>Без комиссионных</b>",
        //   },
        //   list: false,
        // };

        if (data === null) {
          chat.sendMessage(chatId, responseAssistant);
          return;
        }

        if (
          data.property &&
          typeof data.property.description === "string" &&
          data.property.description.length > 0
        ) {
          propertyDescription[chatId] = filterAllowedTags(
            data.property.description
          );

          console.log(
            77777,
            propertyDescription[chatId],
            filterAllowedTags(data.property.description)
          );

          if (
            propertyDescription[chatId] &&
            propertyPictureLinks[chatId] &&
            data.property.location
          ) {
            adReadyForPublishingWithPictures = true;

            chat.sendMessage(
              chatId,
              `<b>${translation.adReadyForPublishing.title}</b>\n${translation.adReadyForPublishing.text}`,
              {
                parse_mode: "HTML",
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
            propertyDescription[chatId] &&
            !propertyPictureLinks[chatId] &&
            data.property.location
          ) {
            adReadyForPublishingWithoutPictures = true;

            await chat.sendMessage(chatId, propertyDescription[chatId], {
              parse_mode: "HTML",
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
              `<b>${translation.warningNoPhotosAd.title}</b>\n${translation.warningNoPhotosAd.text}`,
              { parse_mode: "HTML" }
            );
          }
        } else if (data && data.list) {
          const items = await extractItems();
          const currentAgent = items.find(
            (item) => item.telegramAgentID === agent.id
          );
          const properties = currentAgent ? currentAgent.properties : [];

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
                parse_mode: "HTML",
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
              `<b>${translation.noPublishedPropertyAd.title}</b>\n${translation.noPublishedPropertyAd.text}`,
              { parse_mode: "HTML" }
            );
          }
        }

        if (data.text) {
          chat.sendMessage(chatId, data.text, { parse_mode: "HTML" });
        }
      } catch (error) {
        clearTimeout(runConversationTimeoutId);
        console.log("Response Assistant have not include JSON:", error.message);

        sendMessageWithRepeat(chatId, userMessage);
      }
    } catch (error) {
      clearTimeout(runConversationTimeoutId);
      console.error("Error getting assistant AI:", error);
      sendMessageWithRepeat(chatId, userMessage);
    }
  };

  chat.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    translation = await getTranslation(msg.from.language_code);

    if (chatId === +process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID) return;

    if (msg.text.toLowerCase() === "/start") {
      await chat.sendMessage(
        chatId,
        `<b>${translation.introduction.title}</b>\n${translation.introduction.text}`,
        { parse_mode: "HTML" }
      );

      await chat.sendMessage(
        chatId,
        `<b>${translation.benefitsOfDenonaCRM.title}</b>\n${translation.benefitsOfDenonaCRM.text}`,
        { parse_mode: "HTML" }
      );

      chat.sendMessage(
        chatId,
        `<b>${translation.propertyListingExample.title}</b>\n${translation.propertyListingExample.text}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (status === "inProgress") {
      chat.sendMessage(
        chatId,
        `<b>${translation.processingPreviousMessage.title}</b>\n${translation.processingPreviousMessage.text}`,
        { parse_mode: "HTML" }
      );
      clearTimeout(runConversationTimeoutId);
      return;
    }

    if (
      adReadyForPublishingWithPictures ||
      adReadyForPublishingWithoutPictures
    ) {
      chat.sendMessage(
        chatId,
        `<b>${translation.lastDataIgnored.title}</b>\n${translation.lastDataIgnored.text}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    runConversation(chatId, userMessage, msg.from);
  });

  chat.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    const caption = msg.caption;
    const photos = msg.photo;
    const startDownload = Date.now();

    if (timeoutId) clearTimeout(timeoutId);

    translation = await getTranslation(msg.from.language_code);

    if (chatId === +process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID) return;

    if (status === "inProgress") {
      chat.sendMessage(
        chatId,
        `<b>${translation.processingPreviousMessage.title}</b>\n${translation.processingPreviousMessage.text}`,
        { parse_mode: "HTML" }
      );
      clearTimeout(runConversationTimeoutId);
      return;
    }

    if (adReadyForPublishingWithPictures) {
      chat.sendMessage(
        chatId,
        `<b>${translation.lastDataIgnored.title}</b>\n${translation.lastDataIgnored.text}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (collectedPictures) {
      propertyPictureLinks[chatId] = undefined;
      collectedPictures = false;
    }

    if (!propertyDescription[chatId] && typeof caption === "string")
      propertyDescription[chatId] = filterAllowedTags(caption);

    try {
      const photoLinks = await Promise.all(
        photos.map(async (photo) => {
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

      propertyPictureLinks[chatId] = Array.isArray(propertyPictureLinks[chatId])
        ? [...propertyPictureLinks[chatId], photoLinks]
        : [photoLinks];
    } catch (error) {
      console.log(error);
    }

    timeout += Date.now() - startDownload;
    timeoutId = setTimeout(() => {
      collectedPictures = true;

      if (propertyDescription[chatId] && !adReadyForPublishingWithoutPictures) {
        runConversation(chatId, propertyDescription[chatId], msg.from);
      } else if (
        !!propertyDescription[chatId] &&
        adReadyForPublishingWithoutPictures
      ) {
        adReadyForPublishingWithPictures = true;

        chat.sendMessage(
          chatId,
          `<b>${translation.adReadyForPublishing.title}</b>\n${translation.adReadyForPublishing.text}`,
          {
            parse_mode: "HTML",
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
          `<b>${translation.propertyWithoutDescription.title}</b>\n${translation.propertyWithoutDescription.text}`,
          { parse_mode: "HTML" }
        );
      }
    }, timeout);
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const agentID = query.from.id;
    const agentNickname = query.from.username;
    console.log("🚀 ~ chat.on ~ agentNickname:", agentNickname);
    const agentLanguageCode = query.from.language_code;

    const publishedMessage = () => {
      chat.sendMessage(
        chatId,
        `<b>${translation.adSuccessfullyPublished.title}</b>\n${translation.adSuccessfullyPublished.text}`,
        { parse_mode: "HTML" }
      );

      clear();
    };

    try {
      if (
        data === "publish_with_picture" &&
        propertyPictureLinks[chatId] &&
        propertyDescription[chatId]
      ) {
        await publishAdToChannel({
          chat,
          chatId: isDev
            ? process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID
            : process.env.TELEGRAM_CHANNEL_DENONA_REAL_ESTATE_ID,
          message: propertyDescription[chatId],
          pictures: propertyPictureLinks[chatId],
          agentNickname,
          translation,
        });

        await addDataProperty({
          agentID,
          agentNickname,
          agentLanguageCode,
          description: propertyDescription[chatId],
          pictures: propertyPictureLinks[chatId],
        });

        publishedMessage();
      } else if (
        data === "publish_without_picture" &&
        propertyDescription[chatId]
      ) {
        await publishAdToChannel({
          chat,
          chatId: isDev
            ? process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID
            : process.env.TELEGRAM_CHANNEL_DENONA_REAL_ESTATE_ID,
          message: propertyDescription[chatId],
          agentNickname,
          pictures:
            Array.isArray(propertyPictureLinks[chatId]) &&
            propertyPictureLinks[chatId].length
              ? propertyPictureLinks[chatId]
              : undefined,
          translation,
        });

        await addDataProperty({
          agentID,
          agentNickname,
          agentLanguageCode,
          description: propertyDescription[chatId],
          pictures: propertyPictureLinks[chatId],
        });

        publishedMessage();
      } else if (data === "publish_ad_cancel") {
        chat.sendMessage(
          chatId,
          `<b>${translation.successfulPublishingAdCancellation.title}</b>\n${translation.successfulPublishingAdCancellation.text}`,
          {
            parse_mode: "HTML",
          }
        );
        clear();
      } else if (data.startsWith("update_text")) {
        const [action, propertyID] = data.split(":");

        defineAction(chatId, propertyID, action);

        chat.sendMessage(
          chatId,
          `<b>${translation.propertyDescriptionUpdate.title}</b>\n${translation.propertyDescriptionUpdate.text}`,
          { parse_mode: "HTML" }
        );
      } else if (data.startsWith("update_picture")) {
        const [action, propertyId] = data.split(":");
        defineAction(chatId, propertyId, action);
        chat.sendMessage(
          chatId,
          `<b>${translation.readyToReceivePropertyPhotos.title}</b>\n${translation.readyToReceivePropertyPhotos.text}`,
          { parse_mode: "HTML" }
        );
      } else if (data.startsWith("delete")) {
        const propertyId = data.split(":")[1];
        defineAction(chatId, propertyId, "delete");
        chat.sendMessage(
          chatId,
          `<b>${translation.deleteSelectedAd.title}</b>\n${translation.deleteSelectedAd.text}`,
          {
            parse_mode: "HTML",
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
          `<b>${translation.deletionAdCanceled.title}</b>\n`,
          { parse_mode: "HTML" }
        );
      } else if (data === "permit_delete") {
        removePropertyById(query.from.id, action[chatId].propertyID);
        chat.sendMessage(
          chatId,
          `<b>${translation.announcementAdDeletionSuccess.title}</b>\n`,
          { parse_mode: "HTML" }
        );
      } else if (data === "repeat_last_action") {
        if (lastUserMessage) {
          userMessage = null;
          runConversation(chatId, lastUserMessage, query.from);
        }
      } else {
        chat.answerCallbackQuery(query.id, {
          text: translation.actionPreviouslyDone.title,
          cache_time: 1,
        });
      }

      // Clear all the data
      clear();
    } catch (error) {
      console.error(error);
      clear();
    }
  });
};
