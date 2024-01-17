const bot = require("./botConfig");
const geminiService = require("../gemini/geminiService");
const prompts = require("../models/prompts");
const parseJsonString = require("../helpers/parseJsonString");
const extractJsonSubstring = require("../helpers/extractJsonSubstring");
const isDev = process.env.NODE_ENV === "development";

module.exports = function () {
  const context = {};
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

  bot.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    const buildPropertyDat = async () => {
      let attempts = 3;
      let success = false;

      while (attempts > 0 && !success) {
        const property = await AIResponse(
          context[chatId],
          userMessage,
          prompts.property
        );

        console.log("property", property);

        if (
          typeof property === "string" &&
          property[0] === "{" &&
          property[property.length - 1] === "}"
        ) {
          mergeState(chatId, property);

          const isRequiredFillFields = await AIResponse(
            context[chatId],
            JSON.stringify(emptyProps[chatId]),
            prompts.emptyFields
          );

          handleSendMessage(chatId, isRequiredFillFields);

          success = true;
        } else {
          attempts--;
          if (attempts === 0) {
            console.log("Достигнуто максимальное количество попыток");
          } else {
            console.log("Неудачная попытка. Осталось попыток: " + attempts);
          }
        }
      }
    };

    try {
      const isPropertySubject = await geminiService.generateText(
        `${
          state[chatId]
            ? prompts.continueDataCollection
            : prompts.isPropertySubject
        }. Сообщение от клиента: ${userMessage}`,
        0
      );

      if (isPropertySubject === "yes") {
        console.log("yes", isPropertySubject);
        // buildPropertyDat();

        const property = await geminiService.generateText(
          `${prompts.property}. Сообщение от клиента: ${userMessage}`,
          2
        );
        const jsonDataProperty = extractJsonSubstring(property);
        // console.log("jsonDataProperty:", jsonDataProperty);

        const dataForSaveToState = getFieldsWithValues(
          JSON.parse(jsonDataProperty)
        );
        // console.log("dataForSaveToState:", dataForSaveToState);

        const mergedState = mergeState(chatId, dataForSaveToState);
        console.log("🚀 ~ bot.on ~ mergedState:", mergedState);

        if (mergedState) {
          const emptyFields = findEmptyFields(mergedState);
          console.log("emptyFields", emptyFields);
          if (emptyFields) {
            const isEmptyText = await geminiService.generateText(
              `${prompts.emptyFields}. Сообщение от клиента: ${JSON.stringify(
                emptyFields
              )}`,
              0
            );

            handleSendMessage(chatId, isEmptyText);
          }
        }

        /*

        const jsonDataProperty = extractJsonSubstring(property);

        if (jsonDataProperty) {
          const withValues = getFieldsWithValues(jsonDataProperty);
          mergeState(chatId, withValues);

          if (state[chatId]) {
            const emptyFields = filterEmptyValues(state[chatId]);
            if (!emptyFields) {
              const isEmptyText = await geminiService.generateText(
                `${prompts.emptyFields}. Сообщение от клиента: ${JSON.stringify(
                  emptyFields
                )}`,
                0
              );

              handleSendMessage(chatId, isEmptyText);
            }
          }
        }

        */

        // if (emptyProps[chatId]) {
        //   const isEmptyText = await geminiService.generateText(
        //     `${prompts.emptyFields}. Сообщение от клиента: ${JSON.stringify(
        //       emptyProps[chatId]
        //     )}`,
        //     0
        //   );

        //   handleSendMessage(chatId, isEmptyText);
        // } else {
        //   emptyProps[chatId] = undefined;

        //   const isSaveText = await geminiService.generateText(
        //     `Сообщи что данные переданные были успешно сохранены`,
        //     0
        //   );

        //   handleSendMessage(chatId, isSaveText);
        // }
      } else if (isPropertySubject === "not") {
        console.log("not", isPropertySubject);
        if (emptyProps[chatId]) {
          const isEmptyText = await geminiService.generateText(
            `${prompts.emptyFields}. Сообщение: ${JSON.stringify(
              emptyProps[chatId]
            )}`,
            0
          );

          handleSendMessage(chatId, isEmptyText);
        } else {
          const question = await geminiService.generateText(prompts.toQuestion);

          mergeContext(chatId, question);
          handleSendMessage(chatId, question);
        }
      }
    } catch (err) {
      console.error(err);
      handleSendMessage(chatId, err);
    }
  });

  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo;
    console.log("🚀 ~ bot.on ~ photo:", photo);
    const caption = msg.caption;
    console.log("🚀 ~ bot.on ~ caption:", caption);

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
