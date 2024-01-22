const bot = require("./botConfig");
const geminiService = require("../gemini/geminiService");
const prompts = require("../models/prompts");
const parseJsonString = require("../helpers/parseJsonString");
const extractJsonSubstring = require("../helpers/extractJsonSubstring");
const isDev = process.env.NODE_ENV === "development";

module.exports = function () {
  const history = {};
  const dialogs = [];
  const state = {};
  const emptyProps = {};

  const handleSendMessage = (id, message, options) => {
    bot.sendMessage(id, `${isDev ? "DEV" : ""}\n${message}`, options);
  };

  const AIResponse = async (context, prompt, instructions, temperature = 0) => {
    return await geminiService.generateChatText({
      context,
      prompt,
      history: instructions,
      temperature,
    });
  };

  const mergeContext = (id, message, role = "ассистент") => {
    const date = new Date();
    const item = `
    роль: ${role};
    создано: ${date};
    диалог: ${message}.`;
    context[id] = context[id] ? [context[id], item] : [item];
  };

  const mergeState = (id, data) => {
    const localState = (state[id] = state[id]
      ? { ...state[id], ...data }
      : data);
    return localState;
  };

  const getFieldsWithValues = (jsonObject) => {
    const withValues = {};

    const processObject = (inputObj, outputWithValues) => {
      Object.keys(inputObj).forEach((key) => {
        const value = inputObj[key];

        if (value !== null && value !== undefined) {
          outputWithValues[key] = value;
        }

        if (typeof value === "object" && value !== null) {
          outputWithValues[key] = {};
          processObject(value, outputWithValues[key]);
        }
      });
    };

    processObject(jsonObject, withValues);

    return withValues;
  };
  const findEmptyFields = (formData) => {
    const emptyFields = {};

    const processObject = (data, path = "") => {
      Object.keys(data).forEach((key) => {
        const value = data[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (isEmpty(value)) {
          emptyFields[currentPath] = value;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          processObject(value, currentPath);
        }
      });
    };

    const isEmpty = (value) => {
      return (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && Object.keys(value).length === 0)
      );
    };

    processObject(formData);

    return emptyFields;
  };
  const mergeObjects = (obj1, obj2) => {
    const result = { ...obj1 };

    for (const key in obj2) {
      if (obj2.hasOwnProperty(key) && obj2[key] !== null) {
        result[key] = typeof obj2[key] === "number" ? obj2[key] : obj2[key];
      }
    }

    return result;
  };

  const jsonToMarkdown = (jsonString) => {
    try {
      const obj = JSON.parse(jsonString);
      let markdown = "";

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          markdown += `\`${key}\`: ${obj[key]}\n`;
        }
      }

      return markdown;
    } catch (error) {
      console.error("Ошибка при парсинге JSON:", error.message);
      return null;
    }
  };

  const handleProperty = (id, message, callback = () => {}) => {
    console.log("🚀 ~ handleProperty ~ message:", message);
    try {
      // Save data of property
      const jsonData = extractJsonSubstring(message);
      const jsData = JSON.parse(jsonData);
      state[id] = mergeObjects(state[id], jsData);

      if (jsData && Object.keys(jsData).length > 0) {
        handleSendMessage(id, jsonToMarkdown(JSON.stringify(state[id])), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Готово", callback_data: "save_property" },
                {
                  text: "Редактировать",
                  callback_data: "edit_in_progress_property",
                },
                { text: "Отменить", callback_data: "cancel_property" },
              ],
            ],
          },
        });
        callback();
      } else {
        callback();
      }
    } catch (error) {
      console.log("handleProperty", error);
    }
  };

  const handleOther = (id, message) => {
    try {
      handleSendMessage(id, message, { parse_mode: "Markdown" });
    } catch (error) {
      console.log("handleProperty", error);
    }
  };

  bot.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    try {
      // history.push(
      //   { role: "user", parts: userMessage },
      //   { role: "model", parts: "" }
      // );

      // dialogs.push(
      //   { role: "user", parts: userMessage },
      //   { role: "model", parts: "" }
      // );

      let label = "";

      const isPropertySubject =
        state[chatId] && Object.keys(state[chatId]).length > 0;

      if (isPropertySubject) {
        label = await geminiService.generateChatText({
          prompt: [prompts.ContinueCollectPropertyData],
          history: history[chatId]["property"],
        });
      } else {
        label = await geminiService.generateText(
          `Инструкция: ${prompts.entry}. Сообщение: ${userMessage}`
        );
      }

      console.log("🚀 ~ bot.on ~ label:", label);

      const labels =
        history[chatId] && history[chatId][label]
          ? history[chatId]
          : (history[chatId] = { ...history[chatId], [label]: [] });

      const messages = labels[label];

      messages.push(
        { role: "user", parts: userMessage },
        { role: "model", parts: "" }
      );

      // console.log("history", history);

      let stepMessage = null;

      switch (label) {
        case "property":
          if (isPropertySubject) {
            stepMessage = await geminiService.generateChatText({
              prompt: [prompts.property],
              history: messages,
            });
          } else {
            stepMessage = await geminiService.generateText(
              `Инструкция: ${prompts.property}. Свойства Недвижимости: ${userMessage}`
            );
          }
          handleProperty(chatId, stepMessage, async () => {
            stepMessage = await geminiService.generateChatText({
              prompt: [
                prompts.other,
                prompts.rules,
                prompts.contacts,
                prompts.global,
              ],
              history: messages,
            });
            handleSendMessage(chatId, stepMessage);
          });
          break;
        case "rules":
          stepMessage = await geminiService.generateChatText({
            prompt: [prompts.rules, prompts.contacts, prompts.global],
            history: messages,
          });
          handleSendMessage(chatId, stepMessage);
          break;

        case "list":
          Array.from({ length: 3 }).forEach(() => {
            handleSendMessage(
              chatId,
              `
            \`Тип недвижимости:\` Квартира
            \`Классификация объекта недвижимости:\` Вторичная недвижимость
            \`Город:\` Ивано-Франковск
            `,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "Редактировать", callback_data: "button_1" },
                      { text: "Удалить", callback_data: "button_2" },
                    ],
                  ],
                },
              }
            );
          });
          break;

        case "other":
          stepMessage = await geminiService.generateChatText({
            prompt: [prompts.other, prompts.contacts, prompts.global],
            history: messages,
          });
          handleSendMessage(chatId, stepMessage);
          break;
      }

      if (messages && stepMessage)
        messages[messages.length - 1] = {
          role: "model",
          parts: stepMessage,
        };

      // const [modelMessage, dialogMessage] = await Promise.all([
      //   geminiService.generateChatText({
      //     prompt: [prompts.property],
      //     history,
      //     temperature: 0,
      //   }),
      //   geminiService.generateChatText({
      //     prompt: prompts.other,
      //     history: dialogs,
      //   }),
      // ]);

      // console.log("🚀 ~ bot.on ~ modelMessage:", modelMessage);
      // console.log("🚀 ~ bot.on ~ dialogMessage:", dialogMessage);

      // const jsonData = extractJsonSubstring(modelMessage);

      // let data = null;

      // if (jsonData) {
      //   data = JSON.parse(jsonData);
      //   state[chatId] = mergeObjects(state[chatId], data);

      //   history[history.length - 1] = {
      //     role: "model",
      //     parts: JSON.stringify(state[chatId]),
      //   };
      // }

      // dialogs[dialogs.length - 1] = {
      //   role: "model",
      //   parts: dialogMessage,
      // };

      // if (data && Object.keys(data).length > 0) {
      //   handleSendMessage(
      //     chatId,
      //     jsonToMarkdown(JSON.stringify(state[chatId])),
      //     {
      //       parse_mode: "Markdown",
      //       reply_markup: {
      //         inline_keyboard: [
      //           [{ text: "Сохранить", callback_data: "button1" }],
      //           [{ text: "Ещё данные", callback_data: "button2" }],
      //         ],
      //       },
      //     }
      //   );
      // } else {
      //   handleSendMessage(chatId, dialogMessage, { parse_mode: "Markdown" });
      // }
    } catch (err) {
      console.error(err);
      handleSendMessage(chatId, err);
    }
  });

  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo;
    const fileId = msg.photo[0];
    console.log("🚀 ~ bot.on ~ photo:", fileId);
    const caption = msg.caption;
    // console.log("🚀 ~ bot.on ~ caption:", caption);

    // try {
    //   const query = await geminiService.generateChatText({
    //     context: dialogContext[chatId].chat,
    //     prompt: userMessage,
    //     history: prompts.photo,
    //     temperature: 0.4,
    //   });
    //   handleSendMessage(query);
    // } catch (err) {
    //   console.error(err);
    //   handleSendMessage(err);
    // }
  });
};
