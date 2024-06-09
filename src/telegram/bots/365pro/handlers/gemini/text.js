const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../../../../models/instructions");
const {
  addUser,
  searchUsersByLocationAndTags,
  deleteDocumentById,
  getDocumentById,
} = require("../../../../../firebase");

// Modules

const axios = require("axios");

// Helpers

const getTranslation = require("../../../../../helpers/getTranslation");
const extractJsonSubstring = require("../../../../../helpers/extractJsonSubstring");

// State

let data = {};
let translation = {};

const USER_DATA_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const menuCommands = ["/start", "/search", "/profile", "/support"];

const setInitData = (payload = {}) => {
  return {
    mediaGroup: [],
    mediaGroupLinks: [],
    generatedByRus: "",
    chatHistory: [],
    chatHistoryAddPro: [],
    location: "",
    currentPage: menuCommands[0],
    loadingMedia: [],
    newProData: "",
    serviceTags: [],
    country: "",
    city: "",
    area: "",
    tel: "",
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

const useTranslation = async (code) => {
  if (Object.keys(translation).length === 0) {
    translation = await getTranslation(code);
  }
};

const getMediaBasedLink = async ({ link, type = "photo" }) => {
  try {
    const { data } = await axios.get(link, {
      responseType: type === "photo" ? "arraybuffer" : "stream",
    });

    return {
      type,
      media: data,
      parse_mode: "Markdown",
    };
  } catch (e) {
    console.log("🚀 ~ getMediaBasedLink ~ e:", e);

    return null;
  }
};

const showProfessionals = async (chatId, users, linkLabel, tags = []) => {
  await Promise.all(
    users.map(async (user) => {
      const caption = `${user.data}${
        user.tel
          ? `\n\n[${user.tel}](tel:${user.tel})`
          : `\n\n[@${user.telegramNickname}](@${user.telegramNickname})`
      }${
        linkLabel
          ? `\n\n[${linkLabel}](https://t.me/pro365Services/${user.messageIds[0]})`
          : ""
      }`;

      if (user?.mediaGroupLinks?.length) {
        const mediaGroup = await Promise.all(
          user.mediaGroupLinks.map(async ({ link, type }) =>
            getMediaBasedLink({ link, type })
          )
        );
        await chat.sendMediaGroup(
          chatId,
          mediaGroup.map((media, i) =>
            i === 0 && !media.caption ? { ...media, caption } : media
          ),
          {
            parse_mode: "Markdown",
          }
        );
      } else {
        await chat.sendMessage(chatId, caption, {
          parse_mode: "Markdown",
        });
      }

      if (user.id !== chatId.toString()) {
        chat.sendMessage(chatId, translation.showedInSearchResult.title);
      }
    })
  );
};

const getMiddleSizedImage = (images) => {
  if (images.length === 1) {
    return images[0];
  }

  const filteredImages = images.filter((image) => image.width <= 450);

  return filteredImages[filteredImages.length - 1];
};

const deleteUser = async (chatId) => {
  try {
    const user = await getDocumentById(chatId);

    await Promise.all(
      user.messageIds?.map(
        async (messageId) =>
          await chat.deleteMessage(
            process.env.TELEGRAM_CHANNEL_365_PRO_ID,
            messageId
          )
      )
    );

    await deleteDocumentById(chatId);

    await chat.sendMessage(chatId, translation.specialistRemoved.title);

    chat.sendMessage(chatId, translation.searchSpecialistModeEnabled.title);
  } catch (e) {
    console.log("🚀 ~ chat.on ~ callback_query delete:", e);
  }
};

module.exports = () => {
  chat.on("text", async (msg) => {
    try {
      const langCode = msg.from.language_code;
      await useTranslation(langCode);

      const chatId = msg.chat.id;
      const userMessage = msg.text;

      updateLastInteractionTime(chatId);

      const userData = getUserData(chatId);
      console.log("------------text---------------");
      console.log("-text-", 1111);

      // const mes = await chat.forwardMessage(
      //   chatId,
      //   process.env.TELEGRAM_CHANNEL_365_PRO_ID,
      //   27
      // );
      // console.log("🚀 ~ chat.on ~ mes:", mes.message_id);

      // await chat.deleteMessage(chatId, mes.message_id);

      // return;

      // chat
      //   .sendMessage(
      //     process.env.TELEGRAM_CHANNEL_365_PRO_ID,
      //     `
      //     Стоимость: 788 900 GEL
      //     Тип валюты: GEL
      //     Тип объявления: продажа
      //     Тип недвижимости: коммерческий универсальный объект
      //     Количество спальных комнат: 1
      //     Этажность здания: 4/4
      //     Локация: Батуми, ул. М.Абашидзе, 6, Пригород
      //     Площадь недвижимости: 237,40 м²
      //     Количество санузлов: 1
      //     Удаленность от моря/реки/озера: прямой вид на море
      //     comodidades de la habitacion📱 Тел.: 557 432 439
      //     Telegram: https://t.me/avtan_sh
      //     `
      //   )
      //   .then((sentMessage) => {
      //     const messageId = sentMessage.message_id;
      //     console.log("🚀 ~ .then ~ messageId:", messageId);
      //   });

      // return;

      if (
        userMessage === menuCommands[0] ||
        userData.currentPage === menuCommands[2]
      )
        return;
      console.log("-text-", 2222);

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

      let res = "";

      const callAI = async () =>
        (res = await geminiService.generateChatText({
          userMessage: userMessage,
          instructions: [
            instructions.pro365,
            instructions.pro365support,
            `${instructions.pro365ResLang}: ${langCode}`,
          ],
          chatHistory: userData.chatHistory,
        }));

      try {
        res = await callAI();
      } catch (e) {
        console.log("🚀 ~ chat.on ~ e:", e);
        res = await callAI();
      }

      const data = JSON.parse(extractJsonSubstring(res));
      console.log(11111, data);

      if (
        Array.isArray(userData.chatHistory) &&
        userData.chatHistory.length > 0 &&
        data !== null &&
        data.text.length > 0
      ) {
        userData.chatHistory[userData.chatHistory.length - 1].parts = data.text;
        if (
          typeof data.city === "string" &&
          data.city.length > 0 &&
          data.tags.length > 0
        ) {
          const country = data?.country?.toLowerCase();
          const city = data?.city?.toLowerCase();
          const area = data?.area?.toLowerCase();
          const tags = data?.tags?.map((tag) => tag.toLowerCase());

          const users = await searchUsersByLocationAndTags(
            { country, city, area },
            tags
          );

          if (users?.length > 0) {
            const message = await chat.sendMessage(
              chatId,
              `*${translation.waitForResponse.title}*`,
              {
                parse_mode: "Markdown",
              }
            );

            await chat.deleteMessage(chatId, message.message_id);

            showProfessionals(
              chatId,
              users,
              translation.comments.title,
              data?.tags
            );
          } else {
            await chat.sendMessage(
              chatId,
              `${translation.noSpecialistsAvailable.title}: ${tags?.join(", ")}`
            );

            await chat.sendMessage(
              chatId,
              translation.detailedTaskDescriptionRequest.title
            );

            chat.sendMessage(
              chatId,
              `*${translation.addServicesAndStartReceivingOrders.title} ${menuCommands[2]}*`,
              {
                parse_mode: "Markdown",
              }
            );
          }
        } else {
          chat.sendMessage(chatId, data.text, {
            parse_mode: "Markdown",
          });
        }
      } else if (typeof res === "string" && res.length === 0) {
        chat.sendMessage(chatId, translation.cannotUnderstandMessage.title);
      } else {
        userData.chatHistory[userData.chatHistory.length - 1].parts = res;
        chat.sendMessage(chatId, res, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      console.log("chat.on - text", error);
    }
  });

  chat.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    console.log("------------message------------");

    try {
      const langCode = msg.from.language_code;
      await useTranslation(langCode);

      const userData = getUserData(chatId);

      if (menuCommands.includes(userMessage)) {
        userData.currentPage = userMessage;
        console.log("--message--", 1111);

        if (userData.currentPage === menuCommands[0]) {
          await chat.setMyCommands([
            {
              command: "/search",
              description: translation.findSpecialist.title,
            },
            {
              command: "/profile",
              description: translation.forSpecialist.title,
            },
            {
              command: "/support",
              description: translation.helpSpecialist.title,
            },
          ]);

          await chat.sendMessage(
            chatId,
            `*${translation.welcomeMessage.title}*\n\n${translation.welcomeMessage.text}`,
            {
              parse_mode: "Markdown",
            }
          );

          chat.sendMessage(
            chatId,
            `*${translation.addServicesAndStartReceivingOrders.title} ${menuCommands[2]}*`,
            {
              parse_mode: "Markdown",
            }
          );

          // const user = await getDocumentById(chatId);

          // await chat.sendMessage(
          //   chatId,
          //   `*${translation.waitForResponse.title}*`,
          //   {
          //     parse_mode: "Markdown",
          //   }
          // );

          // showProfessionals(chatId, [user]);

          return;
        } else if (userData.currentPage === menuCommands[1]) {
          chat.sendMessage(
            chatId,
            translation.searchSpecialistModeEnabled.title,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
        } else if (userData.currentPage === menuCommands[2]) {
          const message = await chat.sendMessage(
            chatId,
            `*${translation.waitForResponse.title}*`,
            {
              parse_mode: "Markdown",
            }
          );

          const user = await getDocumentById(chatId);

          await chat.deleteMessage(chatId, message.message_id);

          if (user !== null) {
            await showProfessionals(chatId, [user], translation.comments.title);

            userData.currentPage = menuCommands[0];

            chat.sendMessage(
              chatId,
              translation.specialistProfileUpdate.title,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.deleteSpecialist.title,
                        callback_data: "delete",
                      },
                    ],
                  ],
                },
              }
            );

            return;
          }

          await chat.sendMessage(
            chatId,
            `*${translation.specialistRegistration.title}*\n\n${translation.specialistRegistration.text}`,
            {
              parse_mode: "Markdown",
            }
          );

          chat.sendMessage(chatId, translation.provideYourPhoneNumber.title, {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: translation.sendPhoneNumber.title,
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });

          return;
        } else if (userData.currentPage === menuCommands[3]) {
          // the manipulation for remove button "end phone"
          const message = await chat.sendMessage(chatId, "...", {
            reply_markup: {
              remove_keyboard: true,
            },
          });

          chat.deleteMessage(chatId, message.message_id);
        }
      }

      if (userData.currentPage !== menuCommands[2]) return;

      console.log("--message--", 2222);

      if (msg.text) {
        userData.chatHistoryAddPro.push(
          {
            role: "user",
            parts: userMessage,
          },
          {
            role: "model",
            parts: "",
          }
        );

        let res = "";

        const callAI = async () =>
          (res = await geminiService.generateChatText({
            userMessage: userMessage,
            instructions: [
              instructions.pro365AddUser,
              `${instructions.pro365ResLang}: ${langCode}`,
            ],
            chatHistory: userData.chatHistoryAddPro,
          }));

        try {
          res = await callAI();
        } catch (e) {
          console.log("🚀 ~ chat.on ~ e:", e);
          res = await callAI();
        }

        const data = JSON.parse(extractJsonSubstring(res));
        console.log("🚀 ~ chat.on ~ message - 1:", data);

        if (
          Array.isArray(userData.chatHistoryAddPro) &&
          userData.chatHistoryAddPro.length > 0 &&
          data !== null &&
          data.text.length > 0
        ) {
          userData.chatHistoryAddPro[
            userData.chatHistoryAddPro.length - 1
          ].parts = data.text;

          if (data.isReady) {
            // Save data
            userData.tags = data.tags;
            userData.country = data.country;
            userData.city = data.city;
            userData.area = data.area;
            userData.newProData = data.data;

            if (userData.mediaGroup.length === 0) {
              await chat.sendMessage(chatId, userData.newProData, {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.publishWithoutPhotoActionButton.title,
                        callback_data: "publish",
                      },
                    ],
                  ],
                },
              });

              chat.sendMessage(
                chatId,
                `*${translation.recommendedAddPhotoOrVideo.title}*\n\n${translation.recommendedAddPhotoOrVideo.text}`,
                {
                  parse_mode: "Markdown",
                }
              );
            } else {
              chat.sendMessage(
                chatId,
                translation.yourProfileReadyForPublication.title,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: translation.publishActionButton.title,
                          callback_data: "publish",
                        },
                      ],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                  },
                }
              );
            }
          } else {
            chat.sendMessage(chatId, data.text, {
              parse_mode: "Markdown",
            });
          }
        } else {
          userData.chatHistoryAddPro[
            userData.chatHistoryAddPro.length - 1
          ].parts = res;
          chat.sendMessage(chatId, res);
        }

        // console.log("🚀 ~ chat.on ~ message - 2:", userData.chatHistoryAddPro);
      }

      if (msg.photo) {
        const index = userData.loadingMedia.length;

        userData.loadingMedia[index] = true;
        try {
          const largePicSize = getMiddleSizedImage(msg.photo);
          const fileLink = await chat.getFileLink(largePicSize.file_id);
          const media = await getMediaBasedLink({
            link: fileLink,
          });

          userData.loadingMedia[index] = false;

          if (media !== null) userData.mediaGroup.push(media);

          userData.mediaGroupLinks.push({ type: "photo", link: fileLink });

          if (
            !userData.loadingMedia.includes(true) &&
            userData.newProData.length > 0
          ) {
            chat.sendMessage(
              chatId,
              translation.yourProfileReadyForPublication.title,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: translation.publishActionButton.title,
                        callback_data: "publish",
                      },
                    ],
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: true,
                },
              }
            );
          } else if (
            !userData.loadingMedia.includes(true) &&
            userData.newProData.length === 0
          ) {
            chat.sendMessage(chatId, translation.keepAddingProfileData.title);
          }

          // const photoLinks = await Promise.all(
          //   msg.photo.map(async (photo) => {
          //     const fileLink = await chat.getFileLink(largePicSize.file_id);
          //     return {
          //       id: photo.file_unique_id,
          //       link: fileLink,
          //       size: photo.file_size,
          //       width: photo.width,
          //       height: photo.height,
          //       type: "photo",
          //     };
          //   })
          // );

          // const media = await Promise.all(
          //   photoLinks.map(async (pic, i) => {
          //     const { data } = await axios.get(pic.link, {
          //       responseType: "arraybuffer",
          //     });
          //     const photoBuffer = Buffer.from(data, "binary");
          //     return {
          //       type: "photo",
          //       media: photoBuffer,
          //     };
          //   })
          // );

          // userData.mediaGroup.push(media);

          // chat.sendMediaGroup(
          //   process.env.TELEGRAM_CHANNEL_365_PRO_ID,
          //   media
          // );

          // await publishAdToChannel({
          //   chat,
          //   chatId: process.env.TELEGRAM_CHANNEL_365_PRO_ID,
          //   message: userData.newProData,
          //   pictures: userData.mediaGroup,
          //   translation,
          // });
          // console.log("🚀pic", userData.mediaGroup);
        } catch (error) {
          console.error("Видео гоова к публикации", error);
        }
        // Обработка фото
        // const fileLink = await chat.getFileLink(msg.photo.file_id);
        // console.log("🚀 ~ Фото URL:", fileLink);
      }

      if (msg.video || msg.video_note) {
        console.log("🚀 ~ chat.on ~ msg.video_note:", msg.video_note);
        const index = userData.loadingMedia.length;

        userData.loadingMedia[index] = true;

        const fileLink = await chat.getFileLink(
          msg.video.file_id || msg.video_note.file_id
        );

        const videoMedia = await getMediaBasedLink({
          link: fileLink,
          type: "video",
        });

        userData.loadingMedia[index] = false;

        if (videoMedia !== null) userData.mediaGroup.push(videoMedia);

        userData.mediaGroupLinks.push({ type: "video", link: fileLink });

        if (
          !userData.loadingMedia.includes(true) &&
          userData.newProData.length > 0
        ) {
          chat.sendMessage(
            chatId,
            translation.yourProfileReadyForPublication.title,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: translation.publishActionButton.title,
                      callback_data: "publish",
                    },
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }
          );
        } else if (
          !userData.loadingMedia.includes(true) &&
          userData.newProData.length === 0
        ) {
          chat.sendMessage(chatId, translation.keepAddingProfileData.title);
        }
      }
    } catch (e) {
      console.log("🚀 ~ chat.on ~ e:", e);
    }
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const agentNickname = query.from.username;
    const userData = getUserData(chatId);

    try {
      await useTranslation(query.from.language_code);

      const sortByVideoFirst = (items) =>
        items.sort((a, b) => {
          if (a.type === "video" && b.type !== "video") {
            return -1;
          } else if (a.type !== "video" && b.type === "video") {
            return 1;
          } else {
            return 0;
          }
        });

      if (query.data === "publish") {
        let messages;

        const caption = `${userData.newProData}${
          userData.tel
            ? `\n\n[${userData.tel}](tel:${userData.tel})`
            : `\n\n[@${agentNickname}](@${agentNickname})`
        }`;

        if (userData.mediaGroup.length > 0) {
          messages = await chat.sendMediaGroup(
            process.env.TELEGRAM_CHANNEL_365_PRO_ID,
            sortByVideoFirst(
              userData.mediaGroup.map((media, i) =>
                i === 0 && !media.caption ? { ...media, caption } : media
              )
            )
          );
        } else {
          messages = [
            await chat.sendMessage(
              process.env.TELEGRAM_CHANNEL_365_PRO_ID,
              caption,
              { parse_mode: "Markdown" }
            ),
          ];
        }

        await addUser({
          data: userData.newProData,
          tags: userData.tags?.map((tag) => tag.toLowerCase()),
          country: userData.country?.toLowerCase(),
          city: userData.city?.toLowerCase(),
          area: userData.area?.toLowerCase(),
          messageIds: messages.map((message) => message.message_id),
          chatID: chatId.toString(),
          telegramNickname: agentNickname,
          tel: userData.tel,
          mediaGroupLinks: sortByVideoFirst(userData.mediaGroupLinks),
        });

        await chat.sendMessage(
          chatId,
          translation.anketaPublishedNotification.title,
          { parse_mode: "Markdown" }
        );

        userData.currentPage = menuCommands[0];
        userData.mediaGroup = [];
        userData.mediaGroupLinks = [];
        userData.chatHistoryAddPro = [];
        userData.tags = [];
        userData.newProData = "";
        userData.country = "";
        userData.city = "";
        userData.area = "";

        userData.currentPage = menuCommands[0];

        chat.sendMessage(chatId, translation.searchSpecialistModeEnabled.title);
      } else if (query.data === "delete") {
        deleteUser(chatId);
      } else {
        chat.answerCallbackQuery(query.id, {
          text: translation.actionPreviouslyDone.title,
          cache_time: 1,
        });
      }
    } catch (error) {
      console.log("🚀 ~ chat.on ~ error:", error);
    }
  });

  chat.on("contact", (msg) => {
    const chatId = msg.chat.id;
    const contact = msg.contact;
    const userData = getUserData(chatId);

    if (contact.phone_number && !contact.phone_number.startsWith("+")) {
      userData.tel = "+" + contact.phone_number;
    } else {
      userData.tel = contact.phone_number;
    }

    chat.sendMessage(chatId, translation.phoneNumberReceived.title, {
      reply_markup: {
        remove_keyboard: true,
      },
    });
  });
};
