const bot = require("./botConfig");
const geminiService = require("../api/gemini/geminiService");
const openService = require("../api/openai/openaiService");
const prompts = require("../models/instructions");
const parseJsonString = require("../helpers/parseJsonString");
const extractJsonSubstring = require("../helpers/extractJsonSubstring");
const isDev = process.env.NODE_ENV === "development";

module.exports = async function () {
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

  const jsonToMarkdown = (jsonObject) => {
    let markdown = "";

    function processObject(obj, depth = 1) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];

          if (typeof value === "object" && value !== null) {
            markdown += `${"\t".repeat(depth - 1)}- ${key}:\n`;
            processObject(value, depth + 1);
          } else {
            markdown += `${"\t".repeat(depth - 1)}- ${key}: *${value}*\n`;
          }
        }
      }
    }

    processObject(jsonObject);

    return markdown;
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

  const extractPropertyObject = (inputString) => {
    try {
      // Ищем начало JSON объекта с свойством "property"
      const startIndex = inputString.indexOf('{"property":');
      if (startIndex === -1) {
        throw new Error('Не найдено свойство "property" в строке');
      }

      // Обрезаем строку до начала JSON объекта
      const jsonString = inputString.substring(startIndex);

      // Пытаемся распарсить JSON
      const parsedObject = JSON.parse(jsonString);

      // Проверяем, что объект содержит свойство "property"
      if (!parsedObject.property) {
        throw new Error('Свойство "property" отсутствует в JSON объекте');
      }

      // Определяем текст за пределами JSON объекта
      const textOutsideJson = inputString.substring(0, startIndex);

      return {
        propertyObject: parsedObject.property,
        textOutsideJson: textOutsideJson.trim(), // Обрезаем лишние пробелы
      };
    } catch (error) {
      console.error("Ошибка при извлечении JSON объекта:", error.message);
      return null;
    }
  };

  const runChat = await openService.generateChatResponse();

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

      label = "other";

      console.log("🚀 ~ bot.on ~ label:", label);

      const labels =
        history[chatId] && history[chatId][label]
          ? history[chatId]
          : (history[chatId] = { ...history[chatId], [label]: [] });

      const messages = labels[label];

      messages.push({ role: "user", content: userMessage });

      // console.log("history", history);

      let stepMessage = null;

      stepMessage = await runChat(userMessage);
      // console.log("🚀 ~ bot.on ~ stepMessage:", stepMessage);

      const data = JSON.parse(extractJsonSubstring(stepMessage));

      if (Object.keys(data.property).length > 0) {
        handleSendMessage(chatId, jsonToMarkdown(data.property), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Готово", callback_data: "save_property" },
                // {
                //   text: "Редактировать",
                //   callback_data: "edit_in_progress_property",
                // },
                // { text: "Отменить", callback_data: "cancel_property" },
              ],
            ],
          },
        });
      }

      // messages.push({ role: "assistant", content: data.text });

      handleSendMessage(chatId, data.text);

      // console.log(1111111, JSON.stringify(messages));

      // const data = extractPropertyObject(stepMessage);

      // if (data) {
      //   handleSendMessage(chatId, data.property, {
      //     reply_markup: {
      //       inline_keyboard: [
      //         [
      //           { text: "Готово", callback_data: "save_property" },
      //           {
      //             text: "Редактировать",
      //             callback_data: "edit_in_progress_property",
      //           },
      //           { text: "Отменить", callback_data: "cancel_property" },
      //         ],
      //       ],
      //     },
      //   });
      //   handleSendMessage(chatId, data.text);
      //   messages.push({ role: "assistant", content: property });
      //   messages.push({ role: "assistant", content: text });
      // } else {
      //   try {
      //     const data = JSON.parse(stepMessage);
      //     handleSendMessage(chatId, stepMessage, {
      //       reply_markup: {
      //         inline_keyboard: [
      //           [
      //             { text: "Готово", callback_data: "save_property" },
      //             {
      //               text: "Редактировать",
      //               callback_data: "edit_in_progress_property",
      //             },
      //             { text: "Отменить", callback_data: "cancel_property" },
      //           ],
      //         ],
      //       },
      //     });
      //     messages.push({ role: "assistant", content: data.property });
      //   } catch (error) {
      //     handleSendMessage(chatId, stepMessage);
      //     messages.push({ role: "assistant", content: stepMessage });
      //   }
      // }

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
