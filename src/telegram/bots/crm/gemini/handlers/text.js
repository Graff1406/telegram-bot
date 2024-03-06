const axios = require("axios");
const cheerio = require("cheerio");

const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../../../../models/instructions");
const watchUser = require("../../../../../modules/watchUser");
const getTranslation = require("../../../../../helpers/getTranslation");
// const createCollage = require("../../../../../helpers/createCollage");

// Add post

const {
  postToFacebookGroup: postToFacebookPage,
} = require("../../../../../helpers/postToFacebookGroup");
const postToViberChannel = require("../../../../../modules/sendMessageToViber");

// DEV

const IS_DEV = process.env.NODE_ENV === "development";
const USER_DATA_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// State

let data = {};
let translation = {};
let agents;

const setInitData = (payload = {}) => {
  return {
    images: [],
    generatedByRus: "",
    chatHistory: [],
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

const hasDomain = (link) => {
  const domains = [
    {
      domain: "myhome.ge",
      mainClass: ".detail-page",
      avidClass: ".d-block.no",
      imagesClass: ".images.large img",
      phoneClass: "",
      parser: async function (link) {
        try {
          const response = await axios.get(link);
          const html = response.data;

          const $ = cheerio.load(html);
          const text = $(this.mainClass)
            .not(this.avidClass)
            .text()
            .trim()
            .replace(/\t/g, "");

          const images = [];
          $(this.imagesClass).each((index, element) => {
            const imgSrc = $(element).attr("data-src");
            images.push(imgSrc.split("?")[0]);
          });

          return {
            text,
            images,
          };
        } catch (error) {
          console.error("Ошибка при парсинге страницы:", error);
          return null;
        }
      },
    },
    {
      domain: "home.ss.ge",
      mainElementId: "#details_desc",
      imageId: "#image_gallery img",
      phoneClass: ".print-section .icon-call-fill",
      priceId: "#price",
      parser: async function (link) {
        try {
          const response = await axios.get(link);
          const html = response.data;

          const $ = cheerio.load(html);

          const mainElementData = $(this.mainElementId).text().trim();
          const price = $(this.priceId).text().trim();
          const images = $("img")
            .map((_, element) => $(element).attr("src"))
            .get();
          const filteredImages = $(images)
            .filter((_, url) => url.startsWith("https://static.ss.ge"))
            .map((_, url) => url.replace("_Thumb", ""))
            .get();
          const phoneNumber = $(this.phoneClass)
            .closest(".print-section")
            .find("button")
            .text()
            .trim();

          return {
            text: `Цена: ${price}\n${mainElementData}\nКонтакты: ${phoneNumber}`,
            images: filteredImages,
          };
        } catch (error) {
          console.error("Ошибка при парсинге страницы:", error);
          return null;
        }
      },
    },
    // { domain: "place.ge" },
    // { domain: "housing.ge" },
    // { domain: "binebi.ge" },
    // { domain: "home.ge" },
    // { domain: "korter.ge" },
    // { domain: "livo.ge" },
    // { domain: "allhome.ge" },
    // { domain: "makler.ge" },
    // { domain: "gethome.ge" },
  ];
  const getMainDomain = (url) => {
    const domain = new URL(url).hostname;
    return domain.startsWith("www.") ? domain.slice(4) : domain;
  };

  const mainDomain = getMainDomain(link);
  const domain = domains.find((item) => item.domain.endsWith(mainDomain));
  return {
    isAllowedDomain: !!domain,
    domain,
  };
};

const extractLink = (text) => {
  const regex = /(https?:\/\/[^\s]+)/;
  const match = text.match(regex);
  return match ? match[0] : null;
};

const useTranslation = async (code) => {
  if (Object.keys(translation).length === 0) {
    translation = await getTranslation(code);
  }
};

const getImages = async ({ images, text }) => {
  return await Promise.all(
    images
      .filter((_, i) => i <= 9)
      .map(async (link, i) => {
        const { data } = await axios.get(link, {
          responseType: "arraybuffer",
        });
        const photoBuffer = Buffer.from(data, "binary");
        return {
          type: "photo",
          media: photoBuffer,
          caption: i === 0 ? text : "",
        };
      })
  );
};

module.exports = () => {
  chat.on("text", async (msg) => {
    try {
      await useTranslation(msg.from.language_code);

      const chatId = msg.chat.id;
      const userMessage = msg.text;
      const agentFirstName = msg.from.first_name;
      const agentNickname = msg.from.username;
      const link = extractLink(userMessage);

      updateLastInteractionTime(chatId);

      const userData = getUserData(chatId);

      if (link) {
        const { isAllowedDomain, domain } = hasDomain(link);

        if (isAllowedDomain) {
          chat.sendMessage(chatId, translation.waitingForResponse.text);

          const result = await domain.parser(link);
          userData.images = result.images;

          if (result && result.text) {
            let [geminiRusResponse, location] = await Promise.all([
              geminiService.generateChatText({
                userMessage: result.text,
                instructions: instructions.propertyRus,
                temperature: 10,
              }),
              geminiService.generateChatText({
                userMessage: result.text,
                instructions: instructions.location,
                temperature: 0,
              }),
            ]);

            // const [geminiIvrResponse, geminiTurResponse, geminiUkrResponse] =
            //   await Promise.all([
            //     ,
            //     geminiService.generateChatText({
            //       userMessage: geminiRusResponse,
            //       instructions: "לתרגם לעברית",
            //       temperature: 10,
            //     }),
            //     geminiService.generateChatText({
            //       userMessage: geminiRusResponse,
            //       instructions: "türkçeye çevir",
            //       temperature: 10,
            //     }),
            //     geminiService.generateChatText({
            //       userMessage: geminiRusResponse,
            //       instructions: "перекласти українською",
            //       temperature: 10,
            //     }),
            //   ]);

            if (
              (location === "tbilisi" && geminiRusResponse) ||
              (location === "batumi" && geminiRusResponse)
            ) {
              geminiRusResponse = `${link}\n${geminiRusResponse}\nTelegram: https://t.me/${agentNickname}\n${agentFirstName}`;

              userData.generatedByRus = geminiRusResponse;

              userData.location = location;

              const media = await getImages({
                images: result.images,
                text: geminiRusResponse,
              });

              userData.media = media;

              await chat.sendMediaGroup(chatId, media);

              chat.sendMessage(
                chatId,
                translation.adReadyForPublication.title,
                {
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
                translation.warningNotTbilisiOrAdjara.title
              );
            }

            // if (geminiIvrResponse) {
            //   chat.sendMessage(chatId, geminiIvrResponse);
            // }

            // if (geminiTurResponse) {
            //   chat.sendMessage(chatId, geminiTurResponse);
            // }

            // if (geminiUkrResponse) {
            //   chat.sendMessage(chatId, geminiUkrResponse);
            // }

            // const geminiGeoResponse = await geminiService.generateChatText({
            //   userMessage: geminiRusResponse,
            //   instructions: "перевести на грузинский",
            //   temperature: 10,
            // });

            // if (geminiGeoResponse) {
            //   chat.sendMessage(chatId, geminiGeoResponse);
            // }
          }
        } else {
          chat.sendMessage(chatId, translation.warningInvalidLink.title);
        }
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
        const res = await geminiService.generateChatText({
          userMessage: userMessage,
          instructions: instructions.isNotLink,
          chatHistory: userData.chatHistory,
        });

        if (
          Array.isArray(userData.chatHistory) &&
          userData.chatHistory.length > 0 &&
          res
        ) {
          userData.chatHistory[userData.chatHistory.length - 1].parts = res;
        }

        chat.sendMessage(chatId, res);
      }
    } catch (error) {
      console.log(error);
    }
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    // const agentFirstName = query.from.first_name;
    // const agentNickname = query.from.username;
    const userData = getUserData(chatId);

    try {
      await useTranslation(query.from.language_code);

      if (query.data === "publish_with_picture") {
        await Promise.all([
          postToFacebookPage({
            content: userData.generatedByRus,
            photos: userData.images,
            location: userData.location,
          }),

          postToViberChannel(
            {
              type: "picture",
              text: userData.generatedByRus,
              media: userData.images[0],
            },
            translation,
            userData.location === "tbilisi"
              ? process.env.VIBER_CHANNEL_TBILISI_REAL_ESTATE
              : process.env.VIBER_CHANNEL_BATUMI_REAL_ESTATE,

            userData.location === "tbilisi"
              ? process.env.VIBER_CHANNEL_TBILISI_REAL_ESTATE_MEMBER_ID
              : process.env.VIBER_CHANNEL_BATUMI_REAL_ESTATE_MEMBER_ID
          ),

          chat.sendMediaGroup(
            IS_DEV
              ? process.env.TELEGRAM_GROUP_DENONA_APARTMENT_ID
              : userData.location === "tbilisi"
              ? process.env.TELEGRAM_CHANNEL_TBILISI_PROPERTIES_ID
              : process.env.TELEGRAM_CHANNEL_BATUMI_PROPERTIES_ID,
            userData.media
          ),
        ]);

        chat.sendMessage(
          chatId,
          `*${translation.adSuccessfullyPublished.title}*\n${translation.adSuccessfullyPublished.text}`,
          { parse_mode: "Markdown" }
        );
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
};
